import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatAutomationSummary, toRelativePath } from "../../../scripts/automation/format-summary.ts";
import type { AutomationPipelineResult } from "../../../src/internal/automation/pipeline.ts";
import {
  NORMALIZED_IR_CACHE_PATH,
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
  RAW_SNAPSHOT_CACHE_PATH,
} from "../../../src/internal/shared/paths.ts";

const repoRoot = process.cwd();

function createSummary(overrides: Partial<AutomationPipelineResult> = {}): AutomationPipelineResult {
  return {
    rawSnapshotPath: RAW_SNAPSHOT_CACHE_PATH,
    normalizedDocumentPath: NORMALIZED_IR_CACHE_PATH,
    openApiJsonPath: OPENAPI_JSON_PATH,
    openApiYamlPath: OPENAPI_YAML_PATH,
    usedCache: false,
    ...overrides,
  };
}

describe("toRelativePath", () => {
  it("produces POSIX-style relative paths", () => {
    const base = path.join(repoRoot, "versions");
    const target = path.join(repoRoot, "var", "openapi", "proxmox-ve.json");

    expect(toRelativePath(target, base)).toBe("../var/openapi/proxmox-ve.json");
  });
});

describe("formatAutomationSummary", () => {
  it("renders a Markdown section with relative paths and cache status", () => {
    const summary = createSummary();
    const markdown = formatAutomationSummary(summary, {
      summaryPath: path.join(repoRoot, "var/reports/automation-summary.json"),
      relativeTo: repoRoot,
    });

    expect(markdown).toContain("## Automation summary");
    expect(markdown).toContain("- Summary JSON: `var/reports/automation-summary.json`");
    expect(markdown).toContain("- Cache usage: ✨ Fresh scrape");
    expect(markdown).toContain(
      "| Raw snapshot | `packages/proxmox-openapi/data/api-scraper/raw/proxmox-openapi-schema.json` |"
    );
    expect(markdown).toContain("| OpenAPI YAML | `var/openapi/proxmox-ve.yaml` |");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("marks cache reuse when the summary indicates cached data", () => {
    const summary = createSummary({ usedCache: true });
    const markdown = formatAutomationSummary(summary, {
      relativeTo: repoRoot,
    });

    expect(markdown).not.toContain("Summary JSON");
    expect(markdown).toContain("- Cache usage: ♻️ Reused cached snapshot");
  });
});
