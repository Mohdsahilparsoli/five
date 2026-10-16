/**
 * SEO helpers: canonical URLs on whatever domain the site is served from
 * (vercel.app, custom domain, preview…), and cleanup of the Yoast <head>
 * markup that WordPress returns (which points at the WordPress domain).
 */

/** Fallback origin, used only if the request host can't be read. */
export const SITE_ORIGIN = (
  import.meta.env.SITE_URL ||
  process.env.SITE_URL ||
  "https://www.fivepointsbenefitplans.com"
).replace(/\/+$/, "");

const first = (v) => (v ?? "").split(",")[0].trim();
const HOST_RE = /^[a-z0-9.-]+(?::\d+)?$/i;

/**
 * Origin of the live request, read from the headers Vercel (or any proxy)
 * sends: "https://<the domain the visitor opened>".
 * Astro.url can't be used for this — without `security.allowedDomains`
 * Astro replaces the host with "localhost" on Vercel.
 * @param {Request} request
 */
export function originOf(request) {
  const headers = request?.headers;
  const host = first(headers?.get("x-forwarded-host")) || first(headers?.get("host"));
  if (!host || !HOST_RE.test(host)) return SITE_ORIGIN;

  const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
  const proto = first(headers?.get("x-forwarded-proto")) || (isLocal ? "http" : "https");
  return `${proto === "http" && isLocal ? "http" : "https"}://${host.toLowerCase()}`;
}

/**
 * Canonical URL on the domain the page was opened on.
 *   home   → "https://<domain>"
 *   /about → "https://<domain>/about/"
 * @param {Request} request
 */
export function canonicalFor(request) {
  const origin = originOf(request);
  let path = "/";
  try {
    path = decodeURI(new URL(request.url).pathname);
  } catch {}
  path = path.replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "");
  return path ? `${origin}/${encodeURI(path)}/` : origin;
}

/**
 * Any WordPress host (admin.…, test.admin.…, or the one in WP_GRAPHQL_URL).
 * Media and API paths (/wp-content, /wp-includes, /wp-json, /graphql) are
 * left alone because those files really live on WordPress.
 */
const wpHosts = new Set(["admin.fivepointsbenefitplans.com", "test.admin.fivepointsbenefitplans.com"]);
try {
  const wp = import.meta.env.WP_GRAPHQL_URL || process.env.WP_GRAPHQL_URL;
  if (wp) wpHosts.add(new URL(wp).host);
} catch {
  /* ignore bad env value */
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hostPattern = [...wpHosts].map(escapeRe).join("|");
// Matches https://host and the JSON-escaped form https:\/\/host
const WP_URL_RE = new RegExp(
  `https?:(\\\\?/)\\1(?:${hostPattern})(?!(?:\\\\?/)(?:wp-content|wp-includes|wp-json|graphql)\\b)`,
  "gi",
);
/**
 * Clean Yoast fullHead:
 *  - drop Yoast's canonical (we output our own),
 *  - point page URLs (og:url, JSON-LD @id/url, …) at the current domain.
 */
export function cleanYoastHead(html, request) {
  if (!html || typeof html !== "string") return "";
  const [scheme, host] = originOf(request).split("://");
  return html
    .replace(/<link\b[^>]*\brel=["']?canonical["']?[^>]*>\s*/gi, "")
    .replace(WP_URL_RE, (_m, slash) => `${scheme}:${slash}${slash}${host}`);
}
