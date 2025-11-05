import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { mock, test } from "node:test";

import { extractChangelogSection } from "../../scripts/prepare-openapi-release.mjs";

const SAMPLE_CHANGELOG = `# Changelog

## Unreleased

### Added
- Unreleased feature

### Fixed
- Another fix still pending

## v1.2.3 — 2025-11-04

### Changed
- Updated workflow logic

### Fixed
- Patched automation pipeline
`;

test("extractChangelogSection returns matching tagged section", async (t) => {
  const readFileMock = mock.method(fs, "readFile", async () => SAMPLE_CHANGELOG);
  t.after(() => readFileMock.mock.restore());

  const result = await extractChangelogSection("v1.2.3");
  assert.equal(result.source, "v1.2.3");
  assert.ok(result.content.includes("### Changed"));
  assert.ok(result.content.includes("Patched automation pipeline"));
});

test("extractChangelogSection falls back to Unreleased section", async (t) => {
  const readFileMock = mock.method(fs, "readFile", async () => SAMPLE_CHANGELOG);
  t.after(() => readFileMock.mock.restore());

  const result = await extractChangelogSection("v1.3.0");
  assert.equal(result.source, "Unreleased");
  assert.ok(result.content.includes("Unreleased feature"));
  assert.ok(result.content.includes("Another fix still pending"));
});

test("extractChangelogSection returns empty payload when changelog missing", async (t) => {
  const error = new Error("missing file");
  const readFileMock = mock.method(fs, "readFile", async () => {
    throw error;
  });
  t.after(() => readFileMock.mock.restore());

  const result = await extractChangelogSection("v1.3.0");
  assert.equal(result.source, null);
  assert.equal(result.content, "");
});
