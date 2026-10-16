/**
 * WordPress (WPGraphQL) data layer.
 *
 * Guarantees:
 *  - Never throws. On HTTP error, timeout or bad JSON it returns the last
 *    successful response for the same query (if any), otherwise `null`.
 *    Pages therefore always render, even when WordPress is down.
 *  - Identical queries made while rendering one page (Header, Footer, page
 *    body) share a single network request.
 *  - Results are cached for only a few seconds, so edits in WordPress show up
 *    on the live site almost immediately.
 *  - Any failure during a request is recorded so the middleware can mark the
 *    response `no-store`; the CDN never keeps a degraded page.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { SITE_NAME } from "../consts";

export { SITE_NAME };

const WP_GRAPHQL_URL =
  import.meta.env.WP_GRAPHQL_URL ||
  process.env.WP_GRAPHQL_URL ||
  "https://test.admin.fivepointsbenefitplans.com/graphql";

const CACHE_TTL_MS = 5_000;
const TIMEOUT_MS = 7_000;
const MAX_ENTRIES = 200;

/** Short-lived cache of in-flight / recent requests. */
const cache = new Map();
/** Last successful payload per query — fallback when WordPress fails. */
const lastGood = new Map();

/** Per-request state, set by the middleware. */
export const requestState = new AsyncLocalStorage();

const markDegraded = () => {
  const store = requestState.getStore();
  if (store) store.degraded = true;
};

function remember(map, key, value) {
  if (map.size >= MAX_ENTRIES) map.delete(map.keys().next().value);
  map.set(key, value);
}

async function request(query, variables, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (FivePoints-Astro-SSR)",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status >= 500 && attempt === 0) return request(query, variables, 1);
      console.error(`[wordpress] HTTP ${res.status}`);
      return null;
    }

    if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
      console.error("[wordpress] Non-JSON response");
      return null;
    }

    const json = await res.json();
    if (json?.errors?.length) {
      // Partial data is still used — one bad field must not break the page.
      console.error("[wordpress] GraphQL error:", json.errors[0]?.message);
    }
    return json?.data ?? null;
  } catch (error) {
    if (attempt === 0 && error?.name !== "AbortError") return request(query, variables, 1);
    console.error("[wordpress] Fetch failed:", error?.message ?? error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a GraphQL query. Always resolves to an object or `null`; never throws.
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 */
export function fetchAPI(query, variables = {}) {
  const key = JSON.stringify([query, variables]);
  const now = Date.now();
  let entry = cache.get(key);

  if (!entry || entry.expires <= now) {
    const promise = request(query, variables).then((data) => {
      if (data) {
        remember(lastGood, key, data);
        return { data, ok: true };
      }
      cache.delete(key); // don't cache failures; next request retries
      return { data: lastGood.get(key) ?? null, ok: false };
    });
    entry = { expires: now + CACHE_TTL_MS, promise };
    remember(cache, key, entry);
  }

  return entry.promise.then(({ data, ok }) => {
    if (!ok) markDegraded();
    return data;
  });
}

/* ==========================================================
   SHARED QUERIES (Header + Footer share one request)
========================================================== */
export const LAYOUT_QUERY = `
query GetLayout {
  menu(id: "mainmenu", idType: SLUG) {
    menuItems(first: 200) {
      nodes {
        id
        label
        uri
        parentId
      }
    }
  }
  siteLogo {
    sourceUrl
    altText
  }
  mainSidebar
}`;

export const getLayoutData = () => fetchAPI(LAYOUT_QUERY);

export const FOOTER_MENU = `query GetFooterMenu {
  menu(id: "footer-menu", idType: SLUG) {
    id
    databaseId
    name
    slug
    menuItems(first: 100) {
      nodes {
        id
        databaseId
        label
        url
        uri
        parentId
        target
        cssClasses
        description
      }
    }
  }
}`;

export const getfootermenu = () => fetchAPI(FOOTER_MENU);

export const HOME_SLIDER_QUERY = `
query GetHomeSliders {
  homeSliders(first: 10, where: { orderby: { field: DATE, order: DESC } }) {
    nodes {
      content
      title
      homeSliderImage {
        homeSliderImg {
          sliderImg {
            node {
              sourceUrl
              mediaDetails {
                width
                height
                sizes {
                  name
                  sourceUrl
                  width
                  height
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export const PLANS_QUERY = `
query GetAllPlans {
  ourPlans {
    nodes {
      title
      slug
      excerpt
      postLink {
        link {
          title
          url
          target
        }
      }
      featuredImage {
        node {
          sourceUrl
          mediaDetails {
            width
            height
            sizes {
              name
              sourceUrl
              width
            }
          }
        }
      }
    }
  }
}`;

/* ==========================================================
   SAFE HELPERS
========================================================== */

/** Always returns an array (null / undefined / object → []). */
export const toArray = (value) => (Array.isArray(value) ? value : []);

/** Page title fallback chain. */
export const pageTitle = (page) => page?.seo?.title || page?.title || SITE_NAME;
