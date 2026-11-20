import { fileURLToPath } from "node:url";
import { defineConfig } from "@rsbuild/core";
import { pluginTailwindcss } from "@rsbuild/plugin-tailwindcss";
import { beastOctane } from "beast-tsrx/rsbuild";
import { beastDevtools } from "@beastjs/devtools/rsbuild";
import { beastPageBuilder } from "@beastjs/page-builder/rsbuild";

/**
 * Dev only: mute Octane's intentional "streamed signal client build changed" error.
 *
 * Code that reads Octane signals (the cart) can't be hot-swapped, so after every rebuild
 * Octane's HMR fence calls `location.reload()` and then throws this error just to abort the
 * hot update. The reload is the real behavior; the throw is noise that `dev.browserLogs`
 * forwards to the terminal on every save. Listeners on `window` fire in registration order,
 * so this has to be an inline <head> script that registers before Rsbuild's dev client.
 * Every other browser error is still forwarded.
 */
const quietSignalReloadTag = {
  tag: "script",
  head: true,
  append: false,
  children: `window.addEventListener("error", function (event) {
  if (typeof event.message === "string" && event.message.indexOf("[octane] The streamed signal client build changed") !== -1) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});`,
};

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
  html: {
    template: "./index.html",
    tags: process.env.NODE_ENV === "development" ? [quietSignalReloadTag] : [],
  },
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
