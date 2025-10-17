import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/main.ts",
  },
  format: "cjs",
  sourcemap: true,
  clean: true,
  dts: false,
  platform: "node",
  target: "node24",
  outDir: "dist",
  bundle: true,
  shims: false,
  noExternal: ["@actions/core", "@actions/exec", "@proxmox-openapi/automation"],
  external: ["playwright", "playwright-core", "chromium-bidi"],
  outExtension() {
    return {
      js: ".cjs",
    };
  },
});
