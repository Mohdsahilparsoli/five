import { defineMiddleware } from "astro:middleware";
import { getLayoutData, getfootermenu, requestState } from "./lib/wordpress";

/**
 * CDN caching for HTML (Vercel Edge):
 *  - s-maxage=1               → the CDN treats a page as fresh for 1 second.
 *  - stale-while-revalidate   → visitors get the cached page instantly while a
 *                               fresh copy is rendered from WordPress in the
 *                               background.
 * Result: fast pages, few function invocations (free-plan friendly), and
 * WordPress edits appear on the next page load or two.
 *
 * If any WordPress request failed while rendering, the page is sent with
 * `no-store` so a broken/partial page is never cached.
 */
const HTML_CACHE = "public, max-age=0, s-maxage=1, stale-while-revalidate=300";
const NO_STORE = "no-store, max-age=0";

const isPageRequest = ({ request, url }) =>
  (request.method === "GET" || request.method === "HEAD") &&
  !url.pathname.startsWith("/api") &&
  !url.pathname.startsWith("/_") && // /_astro, /_image, /_server-islands
  !url.pathname.includes(".");

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isPageRequest(context)) return next();

  const { url } = context;

  // Canonical trailing slash
  if (!url.pathname.endsWith("/")) {
    return context.redirect(`${url.pathname}/${url.search}`, 301);
  }

  const state = { degraded: false };

  return requestState.run(state, async () => {
    // Start Header/Footer data in parallel with the page's own queries.
    const layout = Promise.all([getLayoutData(), getfootermenu()]);
    const response = await next();
    await layout;

    try {
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("text/html")) {
        if (state.degraded || response.status >= 500) {
          response.headers.set("Cache-Control", NO_STORE);
        } else if (!response.headers.has("Cache-Control")) {
          response.headers.set("Cache-Control", HTML_CACHE);
        }
      }
    } catch {
      // Immutable headers — leave as is.
    }

    return response;
  });
});
