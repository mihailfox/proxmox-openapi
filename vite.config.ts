import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const APP_ROOT = path.resolve(__dirname, "app");
const PUBLIC_ROOT = path.resolve(APP_ROOT, "public");

export default defineConfig({
  root: PUBLIC_ROOT,
  publicDir: false,
  envDir: __dirname,
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
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
});
