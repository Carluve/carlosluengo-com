---
publishDate: 2026-02-22T00:00:00Z
title: 'OpenCode with Cloudflare Gateway and Unified Billing: A Practical Setup for Developers'
excerpt: 'Pairing OpenCode with Cloudflare AI Gateway for centralized policy, observability, and billing across model providers.'
image: 'media:blog/opencode-con-cloudflare-ai-gateway/opencode-cloudflare-provider-picker.png'
imageAlt: 'OpenCode with Cloudflare Gateway and Unified Billing: A Practical Setup for Developers'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'infraestructura'
---

![OpenCode with Cloudflare Gateway and Unified Billing: A Practical Setup for Developers](media:blog/opencode-con-cloudflare-ai-gateway/opencode-cloudflare-provider-picker.png)

## Why this pairing works

OpenCode excels at developer workflow, while Cloudflare AI Gateway adds a policy and observability layer. Together they enable:

- Central endpoint management
- Usage analytics and request visibility
- Credential abstraction through Unified Billing or BYOK
- Dynamic routing for cost and reliability optimization

The key advantage: you are not forced to rewrite your toolchain, only your model endpoint and auth path.

## Unified Billing vs BYOK (and when to choose each)

**Unified Billing** streamlines operations by consolidating payments through Cloudflare, eliminating multi-vendor key management — ideal for pilots and rapid onboarding.

**BYOK (Bring Your Own Key)** maintains existing provider relationships, committed discounts, and enterprise billing workflows.

Start with Unified Billing if you are optimising for speed and consistency. Move to BYOK when procurement or negotiated rates become the primary concern.

## A minimal OpenCode + Gateway setup

The basic flow requires:

1. Create a gateway in Cloudflare AI Gateway
2. Choose authentication method (Unified Billing or BYOK)
3. Generate a Cloudflare token with required permissions
4. Point OpenCode to the Gateway OpenAI-compatible endpoint
5. Validate model listing and test execution

Example implementation:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.CLOUDFLARE_API_TOKEN,
  baseURL: 'https://gateway.ai.cloudflare.com/v1/<account-id>/<gateway-name>/openai',
});

const response = await client.chat.completions.create({
  model: 'openai/gpt-5',
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Explain the trade-offs of edge inference routing.' },
  ],
});

console.log(response.choices[0]?.message?.content);
```

For local development:

```bash
export CLOUDFLARE_API_TOKEN="cf_xxx"
export AI_GATEWAY_BASE_URL="https://gateway.ai.cloudflare.com/v1/<account-id>/<gateway-name>/openai"
```

## What changes in day-to-day development

Centralized observability enables faster debugging, measurable experimentation, and more objective cost discussions. Within OpenCode, developers can select models routed through Cloudflare Gateway while maintaining low context-switching overhead.

## Trade-offs to consider before rolling out

- **Extra hop:** Gateway introduces minor latency in some paths
- **Platform coupling:** Increased dependency on Cloudflare primitives and policies
- **Feature parity nuance:** Some provider-specific capabilities may lag behind direct API usage
- **Operational overhead:** Governance requires clear ownership

These trade-offs are acceptable for most product teams, especially when consistency and observability are priorities.

## Why this matters

This approach balances developer velocity with operational control through incremental implementation rather than wholesale architecture redesign. It's particularly valuable for teams prioritizing standardization and spend visibility across AI model usage.

## También te puede interesar

- [Deploying a Tiny App at the Edge with Cloudflare Workers](/blog/deploying-tiny-app-edge-cloudflare-workers)
- [Cloudflare: Why a Simpler, Faster and Safer Internet Actually Matters](/blog/cloudflare-simpler-faster-safer-internet)
