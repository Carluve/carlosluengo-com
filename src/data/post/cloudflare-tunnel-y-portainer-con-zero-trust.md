---
publishDate: 2026-01-31T00:00:00Z
title: 'Securely Publishing Docker Services with Cloudflare Tunnel + Portainer (Zero Trust Without Opening Ports)'
excerpt: 'Integrating Cloudflare Tunnel into a Portainer-managed Docker stack to expose services without opening router ports.'
category: 'Cloudflare'
tags:
  - 'cloudflare'
  - 'infraestructura'
lang: 'en'
---

## Overview

This guide demonstrates integrating Cloudflare Tunnel directly into a Portainer-managed Docker stack to expose containerized services without opening router ports or requiring a fixed public IP.

## Why This Approach?

Several advantages stand out:

- Cloudflare Tunnel (cloudflared) is free for personal use
- Zero Trust security model with email, WARP, or device-based policies
- Centralized management through Portainer
- No dependency on VPNs, VPS, or complex reverse proxies like Traefik

## Setup Steps

**Step 1: Create Tunnel in Zero Trust Dashboard**

Navigate to one.dash.cloudflare.com, create a tunnel named (e.g., "homelab-tunnel"), and copy the provided token.

**Step 2: Docker Compose Stack**

Deploy a containerized cloudflared instance:

```yaml
version: '3.9'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    environment:
      - TUNNEL_TOKEN=YOUR_TOKEN_HERE
    command: tunnel run
```

**Step 3: Configure Public Hostnames**

Map subdomains to internal services (e.g., `portainer.yourdomain.com` → `http://portainer:9000`).

**Step 4: Optional CIDR Routes**

Enable private network access via WARP by configuring IP ranges like `192.168.1.0/24`.

**Step 5: Install WARP Client**

Connect devices to your Zero Trust environment for secure access.

**Step 6: Add Access Policies**

Restrict access via email, device posture, or one-time PINs.

## Key Benefits

- No open router ports
- No public IP requirement
- Strong authentication via Cloudflare Access
- End-to-end encryption
- Free for personal use
- IP-agnostic (works across ISP changes)

## También te puede interesar

- [EmDash: A Practical Look at Cloudflare's "WordPress Successor"](/blog/emdash-y-zero-trust)
- [Cloudflare: Why a Simpler, Faster and Safer Internet Actually Matters](/blog/cloudflare-simpler-faster-safer-internet)
