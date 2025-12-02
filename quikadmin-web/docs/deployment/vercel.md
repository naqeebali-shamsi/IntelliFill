# Vercel Deployment

Deploy QuikAdmin Web to Vercel in minutes.

## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

## Manual Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Deploy

```bash
# From project root
vercel

# Production deployment
vercel --prod
```

## Environment Variables

Set in Vercel Dashboard: Settings > Environment Variables

Required variables:
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

See: [Environment Variables](../reference/configuration/environment-variables.md)

## Build Configuration

Vercel auto-detects Vite configuration.

**Build Command**: `bun run build`
**Output Directory**: `dist`
**Install Command**: `bun install`

## Custom Domain

1. Go to Vercel Dashboard > Project > Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

[Back to Deployment](./README.md)
