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
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm", "cjs"],
    sourcemap: true,
    clean: false,
    outDir: "dist",
    target: "node18",
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
