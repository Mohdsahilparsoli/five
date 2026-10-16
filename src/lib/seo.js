/**
 * SEO helpers: canonical URLs on the main domain, and cleanup of the Yoast
 * <head> markup that WordPress returns (which points at the WordPress domain).
 */

/** Main public domain (no trailing slash). Override with SITE_URL if needed. */
export const SITE_ORIGIN = (
  import.meta.env.SITE_URL ||
  process.env.SITE_URL ||
  "https://www.fivepointsbenefitplans.com"
).replace(/\/+$/, "");

/**
 * Canonical URL for a path, always on the main domain with a trailing slash.
 * "/about" → "https://www.fivepointsbenefitplans.com/about/"
 */
export function canonicalFor(pathname = "/") {
  let path = decodeURI(String(pathname || "/")).split(/[?#]/)[0];
  path = "/" + path.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
  if (!path.endsWith("/")) path += "/";
  return SITE_ORIGIN + encodeURI(path);
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
const SITE_HOST = SITE_ORIGIN.replace(/^https?:\/\//, "");

/**
 * Clean Yoast fullHead:
 *  - drop Yoast's canonical (we output our own),
 *  - point page URLs (og:url, JSON-LD @id/url, …) at the main domain.
 */
export function cleanYoastHead(html) {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<link\b[^>]*\brel=["']?canonical["']?[^>]*>\s*/gi, "")
    .replace(WP_URL_RE, (_m, slash) => `https:${slash}${slash}${SITE_HOST}`);
}
