---
title: 'Upstash Redis Setup'
description: 'Guide for setting up Upstash Redis for IntelliFill when deployed on Render'
category: 'how-to'
lastUpdated: '2025-12-30'
status: 'active'
---

# Upstash Redis Setup for IntelliFill on Render

This guide walks you through setting up Upstash Redis for IntelliFill when deployed on Render.

## Why Upstash?

Render doesn't provide managed Redis. Upstash is the recommended solution because:

- **Free tier available** (10K commands/day)
- **Serverless** - no server management
- **Global replication** - low latency
- **REST API fallback** - works in edge environments
- **TLS enabled by default** - secure connections out of the box

## Setup Steps

### 1. Create Upstash Account

1. Go to [https://upstash.com](https://upstash.com)
2. Sign up with GitHub, Google, or email
3. Verify your email if required

### 2. Create Redis Database

1. Click **Create Database**
2. Configure:
   - **Name**: `intellifill-production` (or your preferred name)
   - **Type**: Regional (free tier) or Global (paid)
   - **Region**: Select closest to your Render region
     - Render Oregon → Upstash `us-west-1`
     - Render Frankfurt → Upstash `eu-west-1`
   - **TLS**: Enabled (recommended)
3. Click **Create**

### 3. Get Connection Details

After creation, you'll see your database dashboard. Copy these values:

| Value          | Example                                                 | Used For           |
| -------------- | ------------------------------------------------------- | ------------------ |
| **Endpoint**   | `usw1-example.upstash.io`                               | Connection host    |
| **Port**       | `6379`                                                  | Connection port    |
| **Password**   | `AbCd1234...`                                           | Authentication     |
| **Redis URL**  | `rediss://default:AbCd...@usw1-example.upstash.io:6379` | Primary connection |
| **REST URL**   | `https://usw1-example.upstash.io`                       | REST API fallback  |
| **REST Token** | `AXyz789...`                                            | REST API auth      |

**IMPORTANT**: Note the `rediss://` protocol (with double 's') - this indicates TLS is enabled. Upstash requires TLS connections by default.

### 4. Configure Render Environment Variables

1. Go to Render Dashboard → Your Service → **Environment**
2. Add these environment variables:

```
REDIS_URL=rediss://default:YOUR_PASSWORD@YOUR_ENDPOINT:6379
UPSTASH_REDIS_REST_URL=https://YOUR_ENDPOINT
UPSTASH_REDIS_REST_TOKEN=YOUR_REST_TOKEN
```

**Example with real format:**

```
REDIS_URL=rediss://default:AbCdEf123456GhIjKl@usw1-cool-redis-12345.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://usw1-cool-redis-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq
```

**CRITICAL**: Use `rediss://` (with double 's') NOT `redis://`. The extra 's' enables TLS encryption which Upstash requires.

3. Click **Save Changes**
4. Render will automatically redeploy with the new variables

### 5. Verify Connection

After deployment, check your Render logs for:

```
✅ Good: "Redis connected for rate limiting"
❌ Bad: "Failed to connect Redis for rate limiting - using memory store instead"
```

You can also check the `/api/ready` endpoint:

```bash
curl https://your-app.onrender.com/api/ready
```

Expected response with Redis connected:

```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "redis": true,
    "filesystem": true
  }
}
```

## Bull Queue TLS Configuration

If you're using Bull queues for background job processing, you need to configure TLS correctly for Upstash connections.

### Detecting Upstash and Configuring TLS

```typescript
import Bull from 'bull';

const redisUrl = process.env.REDIS_URL;
const isUpstash = redisUrl?.includes('upstash.io');
const isTLS = redisUrl?.startsWith('rediss://');

// Create queue with proper TLS settings
const queue = new Bull('document-processing', {
  redis: redisUrl,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// If using manual Redis options:
const queueWithOptions = new Bull('ocr-processing', {
  redis: {
    host: 'your-endpoint.upstash.io',
    port: 6379,
    password: 'your-password',
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
});
```

### Common Bull + Upstash Issues

1. **Self-signed certificate errors**: Set `rejectUnauthorized: false` in TLS options
2. **Connection timeouts**: Set `maxRetriesPerRequest: null` for long-running jobs
3. **Ready check failures**: Set `enableReadyCheck: false` for serverless Redis

### ioredis Direct Configuration

If using ioredis directly (not through Bull):

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
```

---

## Troubleshooting

### Connection Refused

**Symptom**: `ECONNREFUSED` errors

**Solutions**:

1. Verify `REDIS_URL` format is correct
2. Check Upstash dashboard for the correct endpoint
3. Ensure you're using `rediss://` protocol (TLS required)

### Authentication Failed

**Symptom**: `NOAUTH` or `invalid password` errors

**Solutions**:

1. Copy password directly from Upstash dashboard (don't retype)
2. URL-encode special characters in password
3. Use the full Redis URL from Upstash (includes auth)

### Timeout Errors

**Symptom**: Connection timeouts

**Solutions**:

1. Check Upstash region matches Render region
2. Verify no firewall blocking outbound port 6379
3. Check Upstash dashboard for service status

### TLS Certificate Errors

**Symptom**: `unable to verify the first certificate` or `DEPTH_ZERO_SELF_SIGNED_CERT`

**Solutions**:

1. Add `rejectUnauthorized: false` to TLS options:

   ```typescript
   tls: {
     rejectUnauthorized: false;
   }
   ```

2. Ensure you're using `rediss://` not `redis://` in REDIS_URL

3. For Bull queues, configure TLS at the queue level (see Bull Queue TLS Configuration above)

### Protocol Mismatch Errors

**Symptom**: `ERR_SSL_WRONG_VERSION_NUMBER` or TLS handshake failures

**Solutions**:

1. Verify you're using `rediss://` (TLS) not `redis://` (plain)
2. Check that your Redis client library supports TLS
3. Update ioredis to version 5.x or later for better TLS support

## Free Tier Limits

Upstash free tier includes:

- 10,000 commands per day
- 256MB storage
- 1 database
- 20 concurrent connections

For production with higher traffic, consider upgrading to Pay-as-you-go ($0.2 per 100K commands).

## Security Best Practices

1. **Never commit credentials** - Use environment variables only
2. **Enable TLS** - Always use encrypted connections
3. **Rotate credentials** - Regenerate passwords periodically in Upstash dashboard
4. **Monitor usage** - Check Upstash dashboard for anomalies

## Related Documentation

- [Deployment Troubleshooting](../troubleshooting/deployment-issues.md)
- [Environment Variables](../../reference/configuration/environment.md)
- [Docker Deployment](./docker-deployment.md)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Upstash Documentation](https://docs.upstash.com/redis)
