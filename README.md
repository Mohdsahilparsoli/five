# Five Points Benefit Plans — Website

Astro (SSR) frontend for a headless WordPress (WPGraphQL) backend, deployed on Vercel.

## How it works

- **Live WordPress content** — every page is rendered on the server from WordPress
  (`output: "server"`). Vercel's CDN caches HTML for 1 second with
  `stale-while-revalidate`, so pages load instantly and a WordPress edit appears
  on the next page load or two.
- **Never crashes** — `src/lib/wordpress.js` never throws. On timeout (7s), HTTP
  error or bad JSON it retries once, then falls back to the last successful
  response, or `null`. All templates use optional chaining and `toArray()`, so
  missing data renders as empty sections, not a 500.
- **Broken pages are never cached** — if any WordPress request fails while
  rendering, the middleware sends `Cache-Control: no-store`, so the CDN keeps
  retrying for fresh data instead of caching a partial page.
- **Fast** — Header and Footer share one GraphQL request, layout data is fetched
  in parallel with page data, duplicate queries in one render are de-duplicated,
  static assets are cached for 7 days, and images in `public/assets/img` are
  compressed (max 1920px wide).

## Project structure

```text
src/
  components/   Header, Footer, sliders, shared WpContentPage
  layouts/      BaseLayout
  lib/          wordpress.js (data layer), otp.js (OTP signing)
  middleware.js trailing-slash redirect + CDN cache headers
  pages/        routes (one .astro per WordPress page)
  pages/apix/   send-otp / verify-otp API routes
public/assets/  images, PDFs, JS
```

## Development

```sh
npm ci
cp .env.example .env   # optional
npm run dev            # http://localhost:4321
npm run build
```

## Environment variables

| Name             | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| `WP_GRAPHQL_URL` | WPGraphQL endpoint (defaults to the test admin site) |
| `SITE_URL`       | Public URL for canonical links                       |
| `SMTP_USER`      | Gmail address for OTP emails                         |
| `SMTP_PASS`      | Gmail App Password                                   |
| `OTP_SECRET`     | Random string used to sign OTP tokens                |

## OTP API

1. `POST /apix/send-otp` with `{ "email" }` → `{ "success": true, "token" }`
2. `POST /apix/verify-otp` with `{ "email", "otp", "token" }` → `{ "success": true }`

Tokens are HMAC-signed and expire after 5 minutes, so this works across
serverless instances without a database.

## Deployment

Pushes to `main` deploy automatically on Vercel (framework preset: Astro).
