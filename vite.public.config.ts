import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "public-spa",
  publicDir: "../public",
  build: {
    outDir: "../public-dist",
    emptyOutDir: true,
  },
});
