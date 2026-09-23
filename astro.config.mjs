// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://fivepointsbenefits-astro-vercel.vercel.app/",

  // ✅ Full Server-Side Rendering — har request par WordPress se fresh data
  output: "server",

  adapter: vercel({
    // Vercel Analytics / Speed Insights chahiye to yahan enable karein
    maxDuration: 15,
  }),

  // HTML minify (whitespace hataata hai — DOM same rehta hai)
  compressHTML: true,

  build: {
    // Chhoti CSS inline → kam network requests, fast first paint
    inlineStylesheets: "auto",
  },

  vite: {
    build: {
      cssCodeSplit: true,
    },
  },
});
