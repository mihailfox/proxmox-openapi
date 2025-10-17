import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: currentDir,
  test: {
    environment: "jsdom",
    globals: true,
    include: ["app/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: path.resolve(currentDir, "coverage/ui"),
    },
  },
});
