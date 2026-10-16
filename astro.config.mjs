// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  // Public URL of the site (canonical links). Override with SITE_URL on Vercel.
  site: process.env.SITE_URL || "https://www.fivepointsbenefitplans.com",

  // Server-side rendering: every page is rendered from live WordPress data,
  // and cached briefly at Vercel's CDN (see src/middleware.js).
  output: "server",

  adapter: vercel({
    maxDuration: 15,
  }),

  compressHTML: true,

  build: {
    inlineStylesheets: "auto",
  },
});
