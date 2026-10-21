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

const first = (v) => (v ?? "").split(",")[0].trim().toLowerCase();
const HOST_RE = /^[a-z0-9.-]+(?::\d+)?$/i;
const LOCAL_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/;
const isPublicHost = (h) => !!h && HOST_RE.test(h) && !LOCAL_RE.test(h);
const env = (key) => (typeof process !== "undefined" ? process.env?.[key] : undefined);

/**
 * Origin of the live request: "https://<the domain the visitor opened>".
 *
 * Checked in order, first public (non-localhost) host wins:
 *   1. x-forwarded-host  (set by Vercel / any proxy)
 *   2. host header
 *   3. the request URL's host
 *   4. Vercel's own production domain (VERCEL_PROJECT_PRODUCTION_URL —
 *      your custom domain if one is attached, else *.vercel.app)
 *   5. VERCEL_URL (this deployment's URL)
 * Only when running locally (npm run dev) can it be http://localhost.
 * @param {Request} request
 */
export function originOf(request) {
  const headers = request?.headers;
  let urlHost = "";
  try {
    urlHost = new URL(request?.url).host.toLowerCase();
  } catch {}

  const candidates = [
    first(headers?.get?.("x-forwarded-host")),
    first(headers?.get?.("host")),
    urlHost,
  ];
  const host = candidates.find(isPublicHost);
  if (host) return `https://${host}`;

  const vercelHost = [env("VERCEL_PROJECT_PRODUCTION_URL"), env("VERCEL_URL")]
    .map((h) => first(h).replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .find(isPublicHost);
  if (vercelHost) return `https://${vercelHost}`;

  // Local development only
  const local = candidates.find((h) => h && LOCAL_RE.test(h));
  if (local && !env("VERCEL")) return `http://${local}`;

  return SITE_ORIGIN;
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
 *  - point page URLs (og:url, JSON-LD @id/url, …) at the current domain,
 *    including any localhost URLs WordPress might output.
 */
// Matches http(s)://localhost[:port] (plain or JSON-escaped)
const LOCAL_URL_RE = /https?:(\\?\/)\1(?:localhost|127\.0\.0\.1)(?::\d+)?/gi;

export function cleanYoastHead(html, request) {
  if (!html || typeof html !== "string") return "";
  const [scheme, host] = originOf(request).split("://");
  return html
    .replace(/<link\b[^>]*\brel=["']?canonical["']?[^>]*>\s*/gi, "")
    .replace(WP_URL_RE, (_m, slash) => `${scheme}:${slash}${slash}${host}`)
    .replace(LOCAL_URL_RE, (_m, slash) => `${scheme}:${slash}${slash}${host}`);
}
