# Optimization Notes (SSR + Vercel)

DOM aur CSS me koi change nahi kiya gaya. Same data par purana aur naya code
bilkul same HTML deta hai (har page compare karke check kiya gaya).

## 1. Server-Side Rendering (WordPress change → live site turant)
- `astro.config.mjs`: `output: "server"` + `@astrojs/vercel` adapter
  (pehle `output: "static"` + Netlify adapter tha).
- Purane `src/lib/wordpress.js` me `wpCache` bina expiry ke tha. Ab cache sirf 5 second ka hai.
- Cache-Control ek hi jagah `src/middleware.js` me:
  `s-maxage=1, stale-while-revalidate=300` → Vercel CDN turant page deta hai aur
  background me WordPress se naya page bana leta hai.
  100% live har request chahiye to `HTML_CACHE_CONTROL` ko `"no-store"` kar dein.

## 2. Crash-proof
- Har jagah `?.` aur `?? ""`.
- Har `.map()` → `toArray(...)`.
- Har WordPress image `{src && (<img .../>)}` condition ke saath.
- `fetchAPI` kabhi throw nahi karta: 8s timeout, 1 retry, error par `null`.
- `about-us/[slug]` par member na mile to 404 status (crash nahi).

## 3. Speed
- Header + Footer ek hi GraphQL query share karte hain (pehle 2 calls).
- Layout data middleware me page query ke saath parallel start hota hai.
- Home page ki 3 queries aur About page ki 2 queries `Promise.all` se parallel.
- Same request me duplicate queries de-duplicate hoti hain.
- Menu tree O(n) map se banta hai.
- 15 same plan pages ab shared `src/components/WpContentPage.astro` use karte hain.
- Unused packages hataaye: express, cors, body-parser, swiper (npm), compress,
  sitemap, mdx, netlify adapter.

## 4. Security
- `send-otp.js` ka hardcoded Gmail password hataya → ab `SMTP_USER` / `SMTP_PASS`
  env variables. Purana app password Google account se revoke karein.
- GraphQL me slug ab variable se jaata hai (string injection nahi).

## Vercel setup
1. Framework preset: Astro. Build command: `npm run build`.
2. Environment Variables (optional): `WP_GRAPHQL_URL`, `SMTP_USER`, `SMTP_PASS`.
3. Deploy.
