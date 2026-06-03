import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: ({ browser }) => {
    // Names/descriptions sourced from src/locales/<lang>.yml so the Chrome,
    // Edge, and Firefox store listings render in each user's language.
    const localized = {
      name: "__MSG_extName__",
      description: "__MSG_extDescription__",
      short_name: "__MSG_extShortName__",
      default_locale: "en",
    } as const;

    // Handle permissions differently for Chrome/Edge (MV3) vs Firefox (MV2)
    if (browser === "chrome" || browser === "edge") {
      return {
        ...localized,
        permissions: ["storage", "tabs", "windows"],
        optional_host_permissions: [
          "https://api.groundedmomentum.com/*"
        ],
      };
    } else {
      // Firefox MV2
      return {
        ...localized,
        permissions: ["storage", "tabs"],
        optional_permissions: [
          "https://api.groundedmomentum.com/*"
        ],
        
        browser_specific_settings: {
          gecko_android: {},
        },
      };
    }
  },
  extensionApi: "chrome",
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  srcDir: "src",
  outDir: "dist",
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
