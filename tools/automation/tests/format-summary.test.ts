import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatAutomationSummary, toRelativePath } from "../scripts/format-summary.ts";
import type { AutomationPipelineResult } from "@proxmox-openapi/automation";

const repoRoot = process.cwd();

function createSummary(overrides: Partial<AutomationPipelineResult> = {}): AutomationPipelineResult {
  return {
    rawSnapshotPath: path.join(repoRoot, "tools/api-scraper/data/raw/proxmox-openapi-schema.json"),
    normalizedDocumentPath: path.join(repoRoot, "tools/api-normalizer/data/ir/proxmox-openapi-ir.json"),
    openApiJsonPath: path.join(repoRoot, "var/openapi/proxmox-ve.json"),
    openApiYamlPath: path.join(repoRoot, "var/openapi/proxmox-ve.yaml"),
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
    expect(markdown).toContain("| Raw snapshot | `tools/api-scraper/data/raw/proxmox-openapi-schema.json` |");
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
