# IntelliFill Marketing Site

Marketing website for IntelliFill, built with Astro 5 and TailwindCSS.

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

This site deploys to **intellifill.com** via Vercel.

### Initial Setup (one-time)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import this repository
3. Set **Root Directory** to `marketing`
4. Framework preset: **Astro**
5. Click **Deploy**

### Domain Configuration

After deployment:

1. Go to **Project Settings** > **Domains**
2. Add `intellifill.com` as the primary domain
3. Add `www.intellifill.com` with redirect to `intellifill.com`

### Environment Variables

No environment variables required for the marketing site.

## Architecture

```
marketing/
├── src/
│   ├── layouts/        # Page layouts (BaseLayout)
│   ├── pages/          # Astro pages
│   ├── components/     # UI components
│   └── styles/         # Global styles
├── public/             # Static assets
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind configuration
└── vercel.json         # Vercel deployment config
```

## Multi-Domain Setup

IntelliFill uses a multi-domain architecture:

| Domain             | Project        | Purpose           |
| ------------------ | -------------- | ----------------- |
| intellifill.com    | marketing/     | Marketing website |
| app.intellifill.com| quikadmin-web/ | Application       |

### Cross-Site Links

- Marketing "Get Started" -> `https://app.intellifill.com/register`
- Marketing "Login" -> `https://app.intellifill.com/login`
- Marketing "Dashboard" -> `https://app.intellifill.com`

## Tech Stack

- **Astro 5.2** - Static site generator
- **TailwindCSS 3.4** - Utility-first CSS
- **@astrojs/sitemap** - Automatic sitemap generation

## Content

- **Hero Section** - Main value proposition with CTA
- **Features** - Key product features and benefits
- **Pricing** - Subscription tiers (Free, PRO)
- **Footer** - Links, copyright, social

## Performance

Built for maximum performance:

- Static HTML output (no client-side JavaScript by default)
- Optimized images and assets
- CDN-ready deployment
- < 100kb total page weight target
