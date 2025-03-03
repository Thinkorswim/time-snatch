import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        inspiration: resolve(__dirname, 'src/inspiration/inspiration.html'),
        controller: resolve(__dirname, 'src/scripts/controller.ts'),
      },
      output: {
        entryFileNames: 'src/scripts/[name].js', // Place scripts in a `scripts` folder
      }
    },
    outDir: 'dist',
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    watch: {
      usePolling: true
    }
  }
})
