import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const resolveWorkspace = (...segments: string[]): string => path.resolve(workspaceRoot, ...segments);

export default defineConfig({
  resolve: {
    alias: {
      "@proxmox-openapi/shared": resolveWorkspace("tools/shared"),
      "@proxmox-openapi/api-scraper": resolveWorkspace("tools/api-scraper/src"),
      "@proxmox-openapi/api-normalizer": resolveWorkspace("tools/api-normalizer/src"),
      "@proxmox-openapi/openapi-generator": resolveWorkspace("tools/openapi-generator/src"),
      "@proxmox-openapi/automation": resolveWorkspace("tools/automation/src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["tests/regression/**/*.spec.ts"],
  },
});
