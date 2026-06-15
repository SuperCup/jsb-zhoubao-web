import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const dataCacheVersion =
  process.env.DATA_CACHE_VERSION ??
  process.env.GITHUB_SHA ??
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

export default defineConfig({
  plugins: [react()],
  base: process.env.PUBLIC_BASE_PATH ?? "/",
  define: {
    __DATA_CACHE_VERSION__: JSON.stringify(dataCacheVersion),
  },
  root: "public-spa",
  publicDir: "../public",
  build: {
    outDir: "../public-dist",
    emptyOutDir: true,
  },
});
