import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => {
    // Handle permissions differently for Chrome/Edge (MV3) vs Firefox (MV2)
    if (browser === "chrome" || browser === "edge") {
      return {
        permissions: ["storage", "tabs", "windows"],
        optional_host_permissions: [
          "https://api.groundedmomentum.com/*"
        ],
      };
    } else {
      // Firefox MV2
      return {
        permissions: ["storage", "tabs"],
        optional_permissions: [
          "https://api.groundedmomentum.com/*"
        ],
      };
    }
  },
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react"],
  srcDir: "src",
  outDir: "dist",
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
