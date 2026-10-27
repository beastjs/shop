import { fileURLToPath } from "node:url";
import { defineConfig } from "@rsbuild/core";
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss";
import { beastOctane } from "beast-tsrx/rsbuild";
import { beastDevtools } from "@beastjs/devtools/rsbuild";
import { beastPageBuilder } from "@beastjs/page-builder/rsbuild";

export default defineConfig({
  source: {
    entry: { index: "./src/main.ts" },
    define: {
      "process.env.PUBLIC_CONVEX_URL": JSON.stringify(process.env.CONVEX_URL),
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  html: { template: "./index.html" },
  server: {
    proxy: {
      "/api/unsplash": {
        target: "https://api.unsplash.com",
        changeOrigin: true,
        pathRewrite: { "^/api/unsplash": "" },
        on: {
          proxyReq: (proxyReq) => {
            const accessKey = process.env.UNSPLASH_ACCESS_KEY
            if (accessKey) {
              proxyReq.setHeader("Authorization", `Client-ID ${accessKey}`)
              proxyReq.setHeader("Accept-Version", "v1")
            }
          },
        },
      },
    },
  },
  plugins: [pluginTailwindcss(), ...beastOctane({ octane: { profile: process.env.NODE_ENV !== "production" } }), beastDevtools(), beastPageBuilder()],
});
