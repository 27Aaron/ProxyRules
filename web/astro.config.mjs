import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.ASTRO_BASE_PATH ?? "/ProxyRules/",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(rootDirectory, "./src"),
      },
    },
  },
})
