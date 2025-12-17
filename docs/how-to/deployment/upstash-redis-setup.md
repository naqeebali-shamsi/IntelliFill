# Upstash Redis Setup for IntelliFill on Render

This guide walks you through setting up Upstash Redis for IntelliFill when deployed on Render.

## Why Upstash?

Render doesn't provide managed Redis. Upstash is the recommended solution because:

- **Free tier available** (10K commands/day)
- **Serverless** - no server management
- **Global replication** - low latency
- **REST API fallback** - works in edge environments

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

| Value          | Example                                                | Used For           |
| -------------- | ------------------------------------------------------ | ------------------ |
| **Endpoint**   | `usw1-example.upstash.io`                              | Connection host    |
| **Port**       | `6379`                                                 | Connection port    |
| **Password**   | `AbCd1234...`                                          | Authentication     |
| **Redis URL**  | `redis://default:AbCd...@usw1-example.upstash.io:6379` | Primary connection |
| **REST URL**   | `https://usw1-example.upstash.io`                      | REST API fallback  |
| **REST Token** | `AXyz789...`                                           | REST API auth      |

### 4. Configure Render Environment Variables

1. Go to Render Dashboard → Your Service → **Environment**
2. Add these environment variables:

```
REDIS_URL=redis://default:YOUR_PASSWORD@YOUR_ENDPOINT:6379
UPSTASH_REDIS_REST_URL=https://YOUR_ENDPOINT
UPSTASH_REDIS_REST_TOKEN=YOUR_REST_TOKEN
```

**Example with real format:**

```
REDIS_URL=redis://default:AbCdEf123456GhIjKl@usw1-cool-redis-12345.upstash.io:6379
UPSTASH_REDIS_REST_URL=https://usw1-cool-redis-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQq
```

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

## Troubleshooting

### Connection Refused

**Symptom**: `ECONNREFUSED` errors

**Solutions**:

1. Verify `REDIS_URL` format is correct
2. Check Upstash dashboard for the correct endpoint
3. Ensure TLS is enabled if using `rediss://` protocol

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

- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Upstash Documentation](https://docs.upstash.com/redis)
- [IntelliFill Deployment Guide](./render-deployment.md)
