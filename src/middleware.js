import { defineMiddleware } from "astro:middleware";
import { getLayoutData } from "./lib/wordpress";

/**
 * CDN cache strategy (Vercel Edge):
 *  - s-maxage=1              → Vercel CDN response ko sirf 1 sec fresh maanta hai
 *  - stale-while-revalidate  → visitor ko turant cached page milta hai (fast),
 *                              aur background mein naya page WordPress se ban jaata hai
 * Result: WordPress mein update karte hi agle 1-2 page loads mein live site update.
 */
const HTML_CACHE_CONTROL =
  "public, max-age=0, s-maxage=1, stale-while-revalidate=300";

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const method = request.method;
  const isPageRequest =
    (method === "GET" || method === "HEAD") &&
    !url.pathname.startsWith("/api") &&
    !url.pathname.startsWith("/_") && // /_astro, /_image, /_server-islands
    !url.pathname.includes(".");

  if (!isPageRequest) {
    return next();
  }

  // trailing slash logic (pehle jaisa hi)
  if (!url.pathname.endsWith("/")) {
    const target = new URL(url);
    target.pathname += "/";
    return context.redirect(target.pathname + target.search, 301);
  }

  // 🚀 Header/Footer ka data page query ke saath PARALLEL mein fetch shuru
  // (await nahi kiya — Header/Footer isi promise ko reuse karenge)
  getLayoutData();

  const response = await next();

  try {
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("text/html") && !response.headers.has("Cache-Control")) {
      response.headers.set("Cache-Control", HTML_CACHE_CONTROL);
    }
  } catch {
    // immutable headers — ignore
  }

  return response;
});
