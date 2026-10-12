---
publishDate: 2026-02-22T00:00:00Z
title: "Backing Up Synology to Cloudflare R2: A Practical Guide for Developers"
excerpt: "Configuring Synology Hyper Backup against Cloudflare R2 for cheap, egress-free, testable backups."
image: "https://pub-27745be1d92d4677b679da82c54861cb.r2.dev/blog/copias-synology-en-cloudflare-r2/cloudflare-r2-bucket-settings.webp"
imageAlt: "Backing Up Synology to Cloudflare R2: A Practical Guide for Developers"
category: "Cloudflare"
tags:
  - "cloudflare"
  - "infraestructura"
---

![Backing Up Synology to Cloudflare R2: A Practical Guide for Developers](https://pub-27745be1d92d4677b679da82c54861cb.r2.dev/blog/copias-synology-en-cloudflare-r2/cloudflare-r2-bucket-settings.webp)

## Why Cloudflare R2 is a strong target for Synology backups

From a developer and operator perspective, R2 offers several concrete benefits:

- **S3 compatibility**: Hyper Backup already supports S3-style targets, enabling natural integration.
- **No egress fees**: one of the biggest practical wins. Restore and verification operations are less costly.
- **Predictable billing model**: easier to estimate storage growth and monthly expenses.
- **Cloudflare network and platform tooling**: useful account controls, API token model, and growing observability.
- **Good fit for hybrid setups**: local NAS for speed combined with cloud bucket for resilience.

When egress costs aren't a concern, restore tests become a technical exercise, not a finance negotiation.

## Prerequisites

Before configuration, prepare:

1. A Synology NAS with Hyper Backup installed
2. A Cloudflare account with R2 enabled
3. A private R2 bucket (example: `synology-backup-prod`)
4. R2 API credentials (Access Key + Secret Key) scoped to the bucket
5. A retention decision regarding versions, rotation, and recovery objectives

## Step-by-step setup in Hyper Backup with R2

Configure destination settings using S3-compatible values:

- **S3 Server**: `Custom Server URL`
- **Server address**: `<accountid>.r2.cloudflarestorage.com`
- **Signature version**: use **v4** (v2 is legacy/deprecated)
- **Access Key / Secret Key**: from R2 API token/credentials
- **Bucket name**: your R2 bucket name
- **Directory**: optional logical prefix (example: `hyper-backup/main-nas`)

Enable important safety switches:

- **client-side encryption** in Hyper Backup
- **integrity check schedule** (weekly or monthly)
- **backup schedule** aligned with business hours and NAS usage

### Endpoint validation

Before large first syncs, validate credentials from a workstation:

```bash
export AWS_ACCESS_KEY_ID="<r2_access_key>"
export AWS_SECRET_ACCESS_KEY="<r2_secret_key>"
export AWS_DEFAULT_REGION="auto"

aws s3 ls s3://synology-backup-prod \
  --endpoint-url https://<accountid>.r2.cloudflarestorage.com
```

If this command returns cleanly, your endpoint and credentials are correct.

## Retention, rotation, and lifecycle strategy

Typical starting configuration:

- Daily backups
- Smart Recycle or customized retention
- 60-120 versions depending on churn
- Monthly restore test to a separate shared folder

On the R2 side, lifecycle rules help control long-term costs. Example lifecycle rule to expire a specific prefix after 365 days:

```json
{
  "Rules": [
    {
      "ID": "expire-old-archives",
      "Status": "Enabled",
      "Filter": { "Prefix": "archive/" },
      "Expiration": { "Days": 365 }
    }
  ]
}
```

Apply with:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket synology-backup-prod \
  --lifecycle-configuration file://lifecycle.json \
  --endpoint-url https://<accountid>.r2.cloudflarestorage.com
```

## Security and operational notes

Key recommendations:

- Create dedicated R2 credentials per NAS/task, not shared global keys
- Keep the R2 bucket private
- Store the Hyper Backup encryption passphrase in a password manager
- Alert on backup failure and integrity check failure
- Document restore steps in a short runbook

### Trade-offs to consider

- **Initial backup can be slow** for multi-terabyte NAS volumes on consumer uplinks
- **API operation costs still exist** even without egress fees; monitor Class A/B patterns
- **Restore speed depends on your download path**, not only cloud performance

## Why this matters

Most homelab and SMB backup failures are process failures. Many configure backup once, never test restore, and assume RAID equals resilience.

This setup encourages a healthier model:

- Local storage for daily speed
- Cloud copy for disaster scenarios
- Explicit retention and restore drills

## Final thoughts

Setup is quick, S3 compatibility keeps tooling familiar, and no egress fees remove barriers to proper recovery testing. Start with one critical folder set, run the first backup, then perform a real restore test within the same week. Once successful, scale gradually across remaining NAS workloads.

A backup is only real when restore is boring. This setup gets you much closer to that outcome.


## También te puede interesar

- [Cloudflare: Why a Simpler, Faster and Safer Internet Actually Matters](/blog/cloudflare-simpler-faster-safer-internet)
- [Deploying a Tiny App at the Edge with Cloudflare Workers](/blog/deploying-tiny-app-edge-cloudflare-workers)
