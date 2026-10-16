/**
 * WordPress (WPGraphQL) data layer — SSR optimized
 * ------------------------------------------------
 * - Kabhi throw nahi karta: error / timeout / bad JSON par `null` return karta hai,
 *   isliye backend se data na aaye tab bhi site crash nahi hogi.
 * - Same request ke andar duplicate queries (Header + Footer + page) sirf EK baar
 *   network par jaati hain (in-flight de-duplication).
 * - Bahut chhota memory cache (default 5 sec) — WordPress mein change karte hi
 *   live site par turant dikh jaata hai (purana code data ko hamesha ke liye cache
 *   kar raha tha, isliye changes reflect nahi ho rahe the).
 */

const WP_GRAPHQL_URL =
  import.meta.env.WP_GRAPHQL_URL ||
  (typeof process !== "undefined" ? process.env?.WP_GRAPHQL_URL : undefined) ||
  "https://test.admin.fivepointsbenefitplans.com/graphql";

const CACHE_TTL_MS = 5_000; // chhota TTL = fresh content + fast repeat renders
const TIMEOUT_MS = 8_000; // WP slow ho to function hang na ho
const MAX_CACHE_ENTRIES = 100;

/** @type {Map<string, { expires: number, promise: Promise<any> }>} */
const cache = new Map();

async function request(query, variables, attempt = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Astro-SSR-Bot)",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      // 5xx par ek baar retry
      if (response.status >= 500 && attempt === 0) {
        return request(query, variables, 1);
      }
      console.error(`[wordpress] HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      console.error("[wordpress] Non-JSON response from GraphQL endpoint");
      return null;
    }

    const json = await response.json();

    // Partial data bhi use karo — ek field ka error poora page na tode
    if (json?.errors?.length) {
      console.error("[wordpress] GraphQL errors:", json.errors?.[0]?.message);
    }

    return json?.data ?? null;
  } catch (error) {
    // Network glitch par ek baar retry (timeout par nahi)
    if (attempt === 0 && error?.name !== "AbortError") {
      return request(query, variables, 1);
    }
    console.error("[wordpress] Fetch failed:", error?.message ?? error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GraphQL query chalao. Hamesha object ya null return karega — kabhi throw nahi.
 * @param {string} query
 * @param {Record<string, any>} [variables]
 */
export function fetchAPI(query, variables = {}) {
  const key = JSON.stringify([query, variables]);
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expires > now) return hit.promise;

  const promise = request(query, variables).then((data) => {
    // Failed response cache mat karo — agli request dobara try karegi
    if (data === null) cache.delete(key);
    return data;
  });

  if (cache.size >= MAX_CACHE_ENTRIES) {
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  }

  cache.set(key, { expires: now + CACHE_TTL_MS, promise });
  return promise;
}

/* ==========================================================
   SHARED QUERIES (Header + Footer ek hi query use karte hain
   → ek hi network call)
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
}`

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

/** Hamesha array return karega (null / undefined / object → []) */
export const toArray = (value) => (Array.isArray(value) ? value : []);

/** Page title fallback chain */
export const SITE_NAME = "Five Points Benefit Plans";
export const pageTitle = (page) => page?.seo?.title || page?.title || SITE_NAME;

