import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    permissions: [
      "storage",
      "tabs",
      "windows"
    ],
  },
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  srcDir: "src",
  outDir: "dist",
  vite: () => ({
    plugins: [tailwindcss()]
  })
});
