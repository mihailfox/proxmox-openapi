import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const APP_ROOT = path.resolve(__dirname, "app");
const PUBLIC_DIR = path.resolve(APP_ROOT, "public");
const OUTPUT_DIR = path.resolve(__dirname, "dist");

const rawBase = process.env.VITE_SITE_BASE ?? "/";
const SITE_BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export default defineConfig({
  root: APP_ROOT,
  publicDir: PUBLIC_DIR,
  envDir: __dirname,
  base: SITE_BASE,
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    open: false,
    fs: {
      allow: [APP_ROOT, __dirname],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    open: false,
  },
  build: {
    outDir: OUTPUT_DIR,
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(APP_ROOT, "index.html"),
    },
  },
});
