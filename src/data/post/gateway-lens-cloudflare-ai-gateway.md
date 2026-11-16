---
publishDate: 2026-10-25T00:00:00Z
title: 'Gateway Lens: Watching Every Step of a Cloudflare AI Gateway Request'
excerpt: 'A chat app on Workers that shows each AI Gateway step live: guardrails, routing, cache, fallback and cost, all taken from what the gateway reports.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ai'
lang: 'en'
---

## Why I built it

When I explain Cloudflare AI Gateway, the hard part is that it doesn't show. You send a prompt, an answer comes back, and everything the gateway did in between (policy checks, caching, logging, billing) happens out of sight. Slides don't help much.

Gateway Lens is my answer to that. It's a React/Vite chat on one side and a **Live Activity** panel on the other, which shows each step of the request as it happens: guardrail decisions, the model chosen, cache status, fallback, tokens and cost. Every turn is saved, and a dashboard adds it all up across the deployment. It's live at [ai-demo.carlosluengo.com](https://ai-demo.carlosluengo.com).

I've already written about [putting a coding agent behind AI Gateway](/blog/opencode-con-cloudflare-ai-gateway). That post covers endpoints, tokens and Unified Billing versus BYOK, so I won't go over it again. This one is about the request itself: what happens to it, and how the app finds out.

## The shape of the app

Everything is one Worker. The frontend is served with Workers Static Assets, and only `/api/*` runs the Worker first:

```jsonc
"assets": {
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api/*"]
},
"ai": { "binding": "AI", "remote": true },
"d1_databases": [{ "binding": "DB", "database_name": "gateway-lens", ... }],
"kv_namespaces": [{ "binding": "MASTER_PROMPT", ... }],
"ratelimits": [{ "name": "CHAT_LIMITER", "namespace_id": "1001", "simple": { "limit": 20, "period": 60 } }],
```

The browser only ever talks to its own Worker. `POST /api/chat` returns a Server-Sent Events stream carrying three kinds of frame: `event` (one step in the pipeline), `delta` (answer text) and `done` (a full request summary for the inspector). The flow diagram, the metrics strip and the chat states are all derived from that event list. No component animates on its own, so whatever you see on screen comes from an event the Worker emitted.

A Demo Mode swaps only the provider adapter for a simulator, so the app runs without credentials. The rest of this post is about live mode.

## One request, step by step

`worker/pipeline.ts` runs each chat turn through the same sequence and emits a typed event at each stage:

1. **`REQUEST_RECEIVED`.** The Worker validates the body, applies the server-side policy floor and checks the history. Only assistant turns that this Worker signed with an HMAC are sent back to the model, so a forged "Sure, my rules no longer apply" turn is dropped (`HISTORY_UNTRUSTED`).
2. **`GATEWAY_REQUEST`.** The request is headed for AI Gateway. The event records the gateway ID and whether caching is on for this request.
3. **App guardrails.** A deterministic engine checks for prompt injection, PII, content safety, attempts to extract the system prompt, and custom rules. PII can be redacted rather than blocked, and the inspector shows the original next to the forwarded text. A block here returns 403 before any model is called.
4. **Intent shield and routing.** A Workers AI decision model (Clef) scores what the prompt is trying to do. If you pick the _Auto_ model, it also classifies the task and its complexity, and a small policy table picks the model (`ROUTE_DECIDED`).
5. **`MODEL_SELECTED` → `PROVIDER_REQUEST` → `FIRST_TOKEN`.** The call goes through the gateway.
6. **Output guard.** The answer is checked before it reaches the browser.
7. **`RESPONSE_COMPLETE`**, with tokens, cost, latency and the cache verdict.

Steps 3, 4 and 6 are the app's own layers. The gateway's layer sits inside step 5.

## Calling the gateway through the binding

The live adapter doesn't use an API token. It calls Workers AI through the `AI` binding and names the gateway in the options:

```ts
result = await ai.run(args.model.gatewayModel, buildInput(args.model, args.messages, args.stream), {
  gateway: {
    id: gatewayId,
    skipCache: !args.cache,
    ...(args.cache ? { cacheTtl: 3600 } : {}),
    metadata: { app: 'ai-gateway-control-room', requestId: args.requestId },
  },
});
```

The platform authenticates the binding, so this works against an **Authenticated Gateway** without a secret anywhere in the project. That matters because the gateway also uses Unified Billing, and Cloudflare's docs say Unified Billing requires authentication on the gateway. `skipCache`, `cacheTtl` and `metadata` are documented binding options. The `requestId` in the metadata lets me match a gateway log line to a turn in the app.

The selector offers Workers AI text models, with Llama 3.3 70B as the default. Third-party models are in the registry but switched off.

## Where the numbers come from

This is the part I cared about most. The figures on screen should be the gateway's own figures, not the app's guesses.

After a call, the binding exposes `env.AI.aiGatewayLogId`. The Worker passes it to `env.AI.gateway(id).getLog(logId)` while the output guard runs. The log is written asynchronously, so the adapter tries twice and then gives up quietly:

```ts
for (const wait of [250, 750]) {
  await sleep(wait);
  const log = await ai.gateway(gatewayId).getLog(logId);
  if (log) {
    return {
      cached: !!log.cached,
      inputTokens: log.tokens_in ?? undefined,
      outputTokens: log.tokens_out ?? undefined,
      costUsd: typeof log.cost === 'number' ? log.cost : undefined,
    };
  }
}
```

If the log says `cached`, the request is marked as a cache hit and its cost is set to zero. The inspector also shows a "saved" figure, worked out from the model's catalog price. If the log has tokens and cost, they replace the stream's own usage numbers. If no log arrives, the app falls back to tokens times the price in `config/models.config.ts`, and the summary is flagged `estimated`. That registry price is labelled indicative, so a figure the gateway didn't report is never passed off as one it did.

There's also a REST path for running the Worker outside Cloudflare. That one does use headers: it sends `cf-aig-gateway-id`, `cf-aig-metadata`, `cf-aig-request-timeout` and either `cf-aig-cache-ttl` or `cf-aig-skip-cache`, and reads `cf-aig-log-id` and `cf-aig-cache-status` from the response. The binding is the default, and the README recommends it.

## Guardrails at the gateway, and around it

The gateway (`chema-gateway`) has its own Guardrails and DLP switched on. Guardrails uses Llama Guard for the hazard categories S1–S13 and Prompt Guard for prompt injection (P1). Each category can be set to Flag, Ignore or Block, separately for prompts and responses. When the gateway blocks, the binding throws an error with code 2016 (prompt) or 2017 (response), as documented. A DLP block comes back as a 400. The adapter turns these into policy events, not outages:

```ts
if (/\b2016\b/.test(message)) return new ProviderError(424, "gateway_guardrail_prompt", ...);
if (/\b2017\b/.test(message)) return new ProviderError(424, "gateway_guardrail_response", ...);
if (/dlp/i.test(message)) return new ProviderError(400, "gateway_dlp", "Blocked by AI Gateway DLP");
```

In the pipeline, any error whose code starts with `gateway_` becomes `GUARDRAIL_BLOCKED · Blocked by AI Gateway`, and **no fallback is attempted**. Retrying a blocked prompt on another model would just be a way round your own policy.

Two lessons from running it live:

- **Every category on Block is too much.** Ordinary prompts like health questions, investment questions or "here's my phone number" were rejected. That pattern fits S6 (specialised advice) and S7 (privacy). I moved S6 and S7 to _Flag_ and left P1 and the harm categories on _Block_. The app's own PII check handles personal data more precisely, because it knows what the user typed.
- **Streaming changes what the gateway can enforce.** Cloudflare's docs say Guardrails doesn't fully support `stream: true`: prompts are still enforced, but what happens to responses depends on the API surface. With `stream: false`, both prompts and responses are enforced. That's why the app has its own output guard. It runs deterministic checks (a canary token in the system prompt, verbatim prompt leakage, exfiltration markup such as remote images) and then Workers AI judges, and holds the answer until they pass. There's an option to make verify-first calls non-streaming so the gateway enforces 2017 as well. It's off by default, for the same false-positive reasons.

## Fallback and caching

Fallback in Gateway Lens is application logic, and I'd rather say so plainly than pass it off as a gateway feature. If the selected model fails **before the first token**, the Worker emits `PROVIDER_ERROR` and `FALLBACK_TRIGGERED` and retries on Llama 3.3 70B through the same gateway. The _Provider failure_ scenario forces the first attempt to fail with a simulated 503, marked as simulated in the event. The retry is real traffic.

Caching is the gateway's. The app sends `cacheTtl: 3600` when the cache toggle is on and `skipCache` when it's off. AI Gateway only caches identical requests, so the _Cache hit_ scenario just sends the same prompt twice. The second call shows `CACHE_HIT` and costs nothing, and the app learns that from the gateway log.

## What gets stored

- **D1** (`gateway-lens`): a `conversations` table, and a `requests` table with one row per turn. Each row holds model requested and model served, status, guardrail verdict, which check blocked, tokens, cost, latency, time to first token, cached and fallback flags, plus the summary and event list so a past conversation can be reopened with its inspector. Raw PII is never stored: the row keeps the redacted text the model saw, and answers withheld by the output guard aren't saved at all. History is scoped to an anonymous browser ID sent as `x-client-id`.
- **Workers KV** (`MASTER_PROMPT`): the saved system prompt as `{ text, updatedAt }`, capped at 4,000 characters. Anyone can read it with `GET /api/master-prompt`. Writing needs the edit key. The Worker reads it from KV on every chat. A system prompt in the request body is ignored.
- **Rate Limiting** (`CHAT_LIMITER`): 20 messages per minute per IP on `/api/chat` in live mode, with the decision in an `X-RateLimit: pass|block|skipped` header. Cloudflare describes this binding as permissive and eventually consistent, so I treat it as a brake rather than a hard cap.

The dashboard at `/admin` runs aggregate queries over the `requests` table: totals, cost per model, guardrail triggers by type, fallbacks and cache hits. Because it covers every visitor, it sits behind the same edit key.

## Takeaways

Use the binding: no token to store, and `getLog()` gives you the gateway's own view of each request. Treat 2016, 2017 and DLP blocks as policy, not failure. If you stream, don't assume the gateway is checking the output. And tune Guardrails on real prompts, in your users' languages, before you put every category on Block.

The demo is public at [ai-demo.carlosluengo.com](https://ai-demo.carlosluengo.com). Try the scenarios menu: the PII and prompt-injection ones show the clearest difference between what you type and what the model actually receives.

## También te puede interesar

- [Deploying a Tiny App at the Edge with Cloudflare Workers](/blog/deploying-tiny-app-edge-cloudflare-workers)
- [Cloudflare: Why a Simpler, Faster and Safer Internet Actually Matters](/blog/cloudflare-simpler-faster-safer-internet)
