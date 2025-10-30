import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    target: "node18",
    tsconfig: "tsconfig.tsup.json",
    noExternal: [/^@proxmox-openapi\//],
    external: ["playwright", "playwright-core", "chromium-bidi"],
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm", "cjs"],
    sourcemap: true,
    clean: false,
    outDir: "dist",
    target: "node18",
    tsconfig: "tsconfig.tsup.json",
    noExternal: [/^@proxmox-openapi\//],
    external: ["playwright", "playwright-core", "chromium-bidi"],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
