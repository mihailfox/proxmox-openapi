import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
  root: packageRoot,
  test: {
    environment: "node",
    globals: true,
    include: ["tests/openapi-generator/**/*.spec.ts"],
  },
});
