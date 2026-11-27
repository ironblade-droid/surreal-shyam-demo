import { defineConfig } from "vite";
export default defineConfig({ root: __dirname, base: "./", build: { outDir: "../dist-website", emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 900 } });
