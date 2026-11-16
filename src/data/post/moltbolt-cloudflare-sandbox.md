---
publishDate: 2026-10-25T00:00:00Z
title: 'Moltbolt: Running a Personal AI Assistant in a Cloudflare Sandbox'
excerpt: 'How I run OpenClaw in a Cloudflare Sandbox container behind a Worker, with R2 snapshots, Browser Rendering, AI Gateway and Access.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ai'
lang: 'en'
---

## What Moltbolt is

Moltbolt is my personal AI assistant. Under the hood it is [OpenClaw](https://github.com/openclaw/openclaw) (formerly Moltbot, formerly Clawdbot), an open-source assistant built around a gateway: one long-running process that connects to chat channels such as Telegram, Discord or Slack, keeps conversation history, pairs devices and runs an agent with a workspace and skills.

I did not write the hosting layer from scratch. I started from Cloudflare's [moltworker](https://github.com/cloudflare/moltworker) project, which its README describes as an experimental proof of concept, "not officially supported". I deployed it under my own domain, connected a Telegram bot, sent the model traffic through AI Gateway, and added a small wiki Worker next to it.

The result runs on two custom domains, `moltbolt.carluve.dev` for the assistant and `wiki-moltbolt.carluve.dev` for the wiki. Both sit behind Cloudflare Access. They are private tools, not public demos.

## Why a Sandbox and not just a Worker

A Worker is a V8 isolate that handles a request. OpenClaw needs Node 22, a CLI that writes config files, a gateway process listening on a TCP port, and a filesystem for its workspace. A Worker can't provide any of that.

[Cloudflare Sandboxes](https://developers.cloudflare.com/sandbox/) fill that gap. According to the docs, a container sandbox runs an image you provide as a full Linux environment, and a Durable Object in your Worker starts and controls it. Sandboxes require the Workers Paid plan. The Dockerfile starts from the Sandbox base image, swaps in Node 22 and pins an OpenClaw release:

```dockerfile
FROM docker.io/cloudflare/sandbox:0.7.20
# ... install Node 22 ...
RUN npm install -g openclaw@2026.3.23-2 \
    && openclaw --version
ENV HOME=/home/openclaw
EXPOSE 18789
```

The Wrangler config ties it together. The `Sandbox` class is a Durable Object with SQLite storage (`new_sqlite_classes`). There is one container definition on the `standard-1` instance type with `max_instances: 1`. The [Containers pricing page](https://developers.cloudflare.com/containers/pricing/) lists `standard-1` as 1/2 vCPU, 4 GiB of memory and 8 GB of disk. Memory and disk are billed on provisioned capacity while the container runs, and CPU only on active use. I'm not quoting a monthly cost here because it depends entirely on how long the container stays awake.

That brings up a lifecycle knob. The Worker keeps the container alive unless told otherwise:

```ts
export function buildSandboxOptions(env: OpenClawEnv): SandboxOptions {
  const sleepAfter = env.SANDBOX_SLEEP_AFTER?.toLowerCase() || 'never';
  if (sleepAfter === 'never') {
    return { keepAlive: true };
  }
  return { sleepAfter };
}
```

Cold starts are slow (the README warns the first request can take a minute or two), so "always on" is the default. Setting `SANDBOX_SLEEP_AFTER` trades latency for compute.

## How the Worker fronts the container

The Worker is a Hono app, and every request resolves the same named sandbox: `getSandbox(env.Sandbox, 'openclaw', options)`. A single name and a single instance give you one assistant with one state.

Routing has three layers:

- **Public routes** come first: `/sandbox-health`, the logos and `/api/status`. The loading page polls `/api/status` while the gateway boots.
- **Protected routes** sit behind a middleware that validates the Cloudflare Access JWT: `/api/*`, the admin UI at `/_admin/`, and `/debug/*` when it is enabled.
- **The catch-all** proxies everything else to the OpenClaw gateway on port 18789 inside the container, using `sandbox.containerFetch()` for HTTP and `sandbox.wsConnect()` for WebSockets.

On WebSockets, the Worker relays messages through its own `WebSocketPair` and rewrites gateway errors such as "pairing required" into hints that point at `/_admin/`. Because the Access redirect strips `?token=`, it injects the gateway token server-side for users who have already passed Access. If a proxy call throws "is not listening", the Worker kills leftover OpenClaw processes, restores state, restarts the gateway and retries once.

## Persisting sessions to R2

A container's disk lasts only as long as the container. OpenClaw keeps its config, paired devices, workspace and skills under `/home/openclaw`, and persistence comes down to snapshotting that directory.

The current code uses the Sandbox SDK's backup API rather than mounting a bucket inside the container. The Worker calls `createBackup()` on `/home/openclaw` and stores the returned handle in the `moltbolt-sessions` bucket, bound as `BACKUP_BUCKET`:

```ts
const handle = await sandbox.createBackup({
  dir: BACKUP_DIR, // /home/openclaw
  ttl: 604800, // 7 days
});
await storeHandle(bucket, handle);
```

Per the [SDK 0.x backup guide](https://developers.cloudflare.com/sandbox/guides/backup-restore/), archives live in R2 under `backups/{id}/`, and the directory must sit under an allowed root such as `/home` (not `/root`, hence `HOME=/home/openclaw` in the Dockerfile). In production, a restore mounts a copy-on-write overlay that "is lost when the sandbox sleeps or the container restarts". So the Worker calls `restoreIfNeeded()` before starting the gateway, and a `restore-needed` marker in R2 tells every isolate to restore again after a gateway restart.

Snapshots are taken on demand from the admin UI's sync action, not on a timer. Anything that happens after the last snapshot is lost when the container restarts.

The same bucket also supports a small scheduling trick. A Workers Cron Trigger runs every minute and reads OpenClaw's cron job store from R2 at `openclaw/cron/jobs.json`. If a job is due within the lead window (10 minutes by default), the trigger wakes the container so OpenClaw's own timers fire on time.

## Browser Rendering as the assistant's browser

OpenClaw can drive a browser, but nothing inside the container provides one. Moltworker solves this with a CDP shim. The Worker exposes `/cdp`, accepts a WebSocket, launches a browser with `puppeteer.launch(env.BROWSER)` through the Browser Rendering binding, and translates a subset of Chrome DevTools Protocol commands into Puppeteer calls. The subset covers `Page.navigate`, `Page.captureScreenshot`, `Runtime.evaluate`, DOM queries, input events, cookies and request interception.

At startup, `start-openclaw.sh` writes a browser profile into `openclaw.json` that points at `WORKER_URL/cdp?secret=...`. The agent thinks it is talking to a remote Chrome; it is actually talking back to its own Worker, which borrows a headless browser from Cloudflare.

## Model choice through AI Gateway

The Worker passes AI provider settings into the container as environment variables. With `CF_AI_GATEWAY_MODEL` set in `provider/model-id` form, the startup script adds a provider entry and makes it the default model:

```js
baseUrl = 'https://gateway.ai.cloudflare.com/v1/' + accountId + '/' + gatewayId + '/' + gwProvider;
if (gwProvider === 'workers-ai') baseUrl += '/v1';
// ...
config.agents.defaults.model = { primary: providerName + '/' + modelId };
```

My gateway is `moltbolt-carluve` and the model is Kimi K2.5 on Workers AI (`@cf/moonshotai/kimi-k2.5`). The model is one configuration value: switching to an Anthropic or OpenAI model means changing the provider prefix, not the agent code.

## The wiki Worker

The second Worker, `moltbolt-wiki`, is a small Hono API for notes organized by project. D1 (`moltbolt-wiki-db`) holds projects, entries, tags and the join table between entries and tags. R2 (`moltbolt-wiki`) is used when an entry's content is longer than 4096 characters. In that case the content is also written to `entries/{projectId}/{slug}.md`, and the full text is read back from R2 when the entry is fetched. Search is a plain `LIKE` over title, content and summary, with wildcards escaped and a limit of 20 results.

There is a dedicated `POST /api/save-from-chat` endpoint for the assistant. It creates the project if it doesn't exist, inserts the entry with `source` defaulting to `telegram`, and attaches tags. Every `/api/*` route requires a bearer key, compared with a constant-time function.

To be accurate about the current state: the wiki API is deployed, but the moltworker code in this repo does not pass the wiki URL or key into the container, and it ships no wiki skill. The assistant-to-wiki link is therefore configuration I still have to finish, not something the code wires up for you.

## Security: an assistant with a shell and a browser

It's worth being explicit about what this thing can do. The agent runs in a Linux container with a shell. The Worker itself runs commands there with `sandbox.exec()`. It can drive a real headless browser through `/cdp`, and the container's environment holds the AI provider key, the Telegram bot token and the CDP secret. A prompt-injected or misbehaving agent could read those values, browse wherever it likes and write to its own workspace.

Here is what limits it, based on what the code actually does:

- **Isolation.** All of this happens inside one Cloudflare-managed container, not on my laptop or my network. The container holds no R2 credentials, because backups are driven from the Worker side.
- **Access in front of the Worker.** Protected routes need a valid `CF-Access-JWT-Assertion` header or `CF_Authorization` cookie. The JWT is verified with `jose` against the team's JWKS, with issuer and audience checks:

```ts
const JWKS = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
const { payload } = await jwtVerify(token, JWKS, { issuer, audience: expectedAud });
```

- **Gateway token plus device pairing.** Even with the token, every new device has to be approved in `/_admin/`. Telegram DMs default to the `pairing` policy, so a stranger who finds the bot cannot just start talking to it.
- **Secrets kept out of process arguments.** The startup script writes the gateway token into the config file instead of passing `--token`, because command-line arguments are visible through `ps`.
- **Fail closed.** If the Access team domain or audience is missing, the Worker returns a configuration error and refuses to serve the app unprotected.

The code also leaves some gaps, and you should know about them if you deploy it yourself. A few routes sit outside the JWT middleware by design (the browser shim relies on a shared secret, and the status page has to answer before login), so review each one and decide whether it should wake a billed container. The gateway accepts any origin and relies on Access and the token rather than origin checks. `DEV_MODE` bypasses both Access and pairing, so it must never be set in production.

## Takeaways

The interesting part isn't the chatbot but the split. The Worker handles identity, routing, recovery and scheduling; R2 holds snapshots; Browser Rendering supplies the browser; AI Gateway decouples the model. The container does the one thing a Worker cannot: run a stateful Node process with a shell. It is still an experimental project on SDK 0.x (the docs now point to 1.0), so I treat it as a personal tool, not infrastructure I'd hand to anyone else.
