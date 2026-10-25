---
publishDate: 2026-10-25T00:00:00Z
title: 'An HR Intranet Agent on Cloudflare: Durable Objects, Whisper and Two Tool Servers'
excerpt: 'A chat and voice HR agent built as three Workers: what each piece does, where MCP is only borrowed as a shape, and what a real deployment would need.'
image: 'media:blog/catalogo-de-demos/hr-agent-worker.svg'
imageAlt: 'Dark browser-window card titled HR Agent Worker with an AGENTS label, the URL hr-agent-worker.carluve.workers.dev and a Spanish caption about an HR agent'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'ai'
lang: 'en'
draft: true
---

## What the demo does

I built this to show what an "HR assistant on the intranet" looks like when every backend piece runs on Cloudflare. An employee opens a portal and types or speaks a question: how many vacation days do I have left, what is the remote work policy, book me three days off next month. The agent reasons, calls tools, answers in Spanish, and opens a leave request with an ID like `SOL-2847`.

A second frontend, the observability panel, subscribes to the same session and shows everything the employee does not see: the model's thinking stream, every tool call with its parameters and result, token counts and latency. In front of a customer, that panel tends to get more attention than the chat.

The code is split into three Workers:

- **`hr-agent-worker`**: the HTTP router plus a Durable Object class, `HRAgentSessionV2`, built on the Agents SDK. One instance per conversation.
- **`mcp-policies`**: read-only tools over the policy handbook.
- **`mcp-cases`**: tools that act on leave requests.

Both frontends are plain HTML and vanilla JS, written for Cloudflare Pages.

## Why policies and cases are separate servers

The design notes in the repo give a short reason: the policy server is read-only and changes nothing, while the cases server has side effects (it creates requests and notifies managers). Keeping them apart means you can deploy, version and lock them down separately. In a real company you would put read access to the handbook behind a light check and the case server behind something much stricter, and you can only do that if they are separate services.

Here is what each server exposes, from its `TOOLS` map (both servers list them on `GET /health`):

| Server         | Tools                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mcp-policies` | `search_policy`, `get_policy_detail`, `get_leave_types`, `get_benefit_info`, `get_faq`                                     |
| `mcp-cases`    | `get_leave_balance`, `create_leave_request`, `get_request_status`, `list_my_requests`, `notify_approver`, `cancel_request` |

The policy data is five policies (vacation, medical leave, remote work, parental leave, expenses) and a few FAQs held in a TypeScript file. `search_policy` is a case-insensitive substring match over title, summary, content and tags, capped at three results. That is enough for a demo. For a real handbook you would replace it with embeddings in Vectorize or AI Search.

You can check that both servers are live: [mcp-policies /health](https://mcp-policies.carluve.workers.dev/health) and [mcp-cases /health](https://mcp-cases.carluve.workers.dev/health).

## The honest part about "MCP"

The servers are named after MCP and work like MCP servers (a set of named tools the agent can discover and call), but they do not implement the protocol. There is no JSON-RPC, no `tools/list`, and no streamable HTTP transport. Each one accepts a plain `POST /call` with `{ tool, input }` and returns JSON. On the agent side, routing is a hardcoded list of tool names:

```ts
private async callMCP(toolName: string, input: any): Promise<MCPCallResponse> {
  const policyTools = ['search_policy', 'get_policy_detail', 'get_leave_types', 'get_benefit_info', 'get_faq']
  const serverUrl = policyTools.includes(toolName)
    ? this.env.MCP_POLICIES_URL
    : this.env.MCP_CASES_URL

  const response = await fetch(`${serverUrl}/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: toolName, input })
  })
  // ...
}
```

The tool schemas the model sees are also hardcoded in the agent, not discovered from the servers. One side effect is easy to miss: the agent declares eight tools, so `get_benefit_info`, `get_faq` and `cancel_request` exist on the servers but the model never hears about them.

The architecture note says this was chosen because a plain `fetch` is simpler than the official SDK's stdio transport. That made sense at the time I wrote it, but stdio was never the right comparison. The Agents SDK has a real MCP client: an Agent calls `addMcpServer()` with a URL, the transport is auto-detected (streamable HTTP or legacy SSE), and the connection is kept in the agent's SQL storage. On the server side, `McpAgent` handles the protocol. Moving to both would let the agent discover tools at runtime and let any other MCP client (an IDE, another agent) use the same HR servers. That is the first change I would make.

## Session state in the Durable Object

The router Worker creates a session ID, writes a small record to KV with a 24-hour TTL, and initialises the Durable Object for that ID with the employee context:

```ts
await env.HR_SESSIONS.put(
  sessionId,
  JSON.stringify({ employee_id, created_at: Date.now() }),
  { expirationTtl: 86400 } // 24 hours
);
const doId = env.AGENT_SESSION.idFromName(sessionId);
```

`/chat` and `/audio` check that KV record before they forward to the Durable Object, so KV is the session gate. The Durable Object then does the work: it adds the message to the history, streams the model response, fans every event out over Server-Sent Events to all subscribers (the employee portal and the observability panel), runs any tool calls, and loops until the model stops asking for tools.

`HRAgentSessionV2` is declared with `new_sqlite_classes`, so it has SQLite storage available, but the history is not saved there. `messages`, `employee` and the open SSE connections are ordinary class fields. The Agents SDK docs say state written with `setState()` or `this.sql` survives restarts and hibernation, and they make no such promise for plain fields. So if the instance is evicted, the conversation is lost. For a demo session that lasts a few minutes this has not been a problem, but it is the second change I would make.

## The model and AI Gateway

The agent uses the Anthropic SDK with extended thinking turned on:

```ts
const client = new Anthropic({
  baseURL: this.env.CF_AIG_TOKEN
    ? `${this.env.AI_GATEWAY_URL}/anthropic` // AI Gateway
    : 'https://api.anthropic.com', // Direct to Anthropic
  apiKey: apiKey,
});

const stream = await client.messages.stream({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 16000,
  thinking: { type: 'enabled', budget_tokens: 8000 },
  system: buildSystemPrompt(this.employee),
  tools: tools as any,
  messages: this.messages as any,
});
```

The README still says Claude 3.7 Sonnet. The code has moved on to Claude Sonnet 4. The AI Gateway (`hr-demo`) sits between the Worker and Anthropic only when the `CF_AIG_TOKEN` secret is set. With a plain Anthropic key, the call goes straight to `api.anthropic.com` and skips the gateway's logs. The system prompt includes the employee's name, ID, department, manager and today's date, and instructs the model to check the balance before creating a request and to notify the manager afterwards.

## The voice path

In the browser, `MediaRecorder` captures `audio/webm;codecs=opus`. When the employee stops recording, the whole clip is base64-encoded and POSTed to `/audio`. The design spec described a WebSocket that streamed chunks; the code that shipped uses this simpler single POST. The Durable Object decodes the clip and sends it to Whisper on Workers AI, always through the gateway:

```ts
const result = await env.AI.run(
  '@cf/openai/whisper',
  { audio: [...new Uint8Array(audioBlob)] },
  { gateway: { id: env.CLOUDFLARE_GATEWAY_ID, skipCache: false, cacheTtl: 3600 } }
);
```

The transcript is broadcast as a `transcription_chunk` event, then handled exactly like a typed message. Whisper does not return a confidence score, so the code reports a fixed 0.95, which means that number on the observability panel is cosmetic.

The Worker has an R2 binding for an `hr-audio-recordings` bucket, but nothing writes to it. Recordings are not stored.

## What actually reaches D1

`schema.sql` defines four tables: `sessions`, `messages`, `leave_requests` and `agent_events`. In the current code, only `sessions` is written to: one `INSERT OR REPLACE` with the session ID, employee ID and last-active time at the end of each agent turn. Messages and events are not persisted.

The cases server has the D1 binding, but its data is fixed demo data. Balances and request history are hardcoded for one fictional employee, `create_leave_request` generates a random `SOL-` number and returns it with the D1 insert commented out, and `notify_approver` logs a line and reports that it sent the notification. The agent's behaviour is real: it decides which tool to call, in what order and with what arguments. The HR records behind those tools are not.

## Privacy, and why this is a demo

HR conversations contain the most sensitive data a company has, such as medical leave, parental leave and absences. This demo has none of the controls that data needs:

- **No authentication.** `/session/new` takes an `employee_id` from the request body and falls back to the demo employee for any unknown ID. A `SESSION_SECRET` for signing JWTs appears in the spec, but the code never uses it.
- **Open CORS** (`*`) on all three Workers. The tool servers can be called by anyone who knows their URLs.
- **The SSE stream is not gated.** `/sse/:sessionId` does not check KV, so anyone with a session ID can subscribe and see the full conversation, including the model's thinking. The ID is a random UUID, which is all that stands in the way. The observability panel uses this same stream, and it has no login.
- **Where data goes.** Transcripts and messages go to Anthropic, and through AI Gateway when it is turned on. Whisper requests can be cached at the gateway for an hour. Audio is not written to R2, and conversation text is not written to D1.

All the people and records in it are fictional, which is why it is acceptable as a demo. To use it with real employees, I would put both portals behind Cloudflare Access, pass the verified identity to the agent instead of trusting a body field, require auth on the tool servers (or move them to `McpAgent` with OAuth), and decide explicitly what gets logged and for how long.

## Where it stands

The agent Worker is deployed and its health check responds. The two tool servers are live. The Pages projects for the employee portal and the observability panel are not deployed right now, so there is nothing to click through at the moment. The repo still holds the frontends.

What the demo does well is show the loop: speech to text at the edge, one stateful object per conversation, a model that picks tools, and a second screen that makes the reasoning visible. Turning it into a product means adopting real MCP, keeping state in SQLite, and adding identity, and the platform has a native piece for each of those.
