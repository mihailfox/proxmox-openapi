import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [requestedTag] = process.argv.slice(2);
const tagName = requestedTag ?? process.env.GITHUB_REF_NAME ?? "dev";
const pveVersion = process.env.PVE_VERSION ?? "";
const workspace = process.cwd();
const artifactsDir = path.resolve("var", "openapi");
const releaseRoot = path.resolve("var", "openapi-release");
const stagingDir = path.join(releaseRoot, `proxmox-openapi-schema-${tagName}`);
const RELEASE_STATS_MARKER = "openapi-stats";
async function main() {
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  const files = [copyAsset("proxmox-ve.json"), copyAsset("proxmox-ve.yaml")];
  await Promise.all(files);

  const manifest = await buildChecksumManifest(
    ["proxmox-ve.json", "proxmox-ve.yaml"].map((file) => path.join(stagingDir, file))
  );
  if (pveVersion) {
    manifest.proxmoxVersion = pveVersion;
  }
  await writeJson(path.join(stagingDir, "openapi.sha256.json"), manifest);

  const changelogSection = await extractChangelogSection(tagName);
  const releaseNotes = await composeReleaseNotes(tagName, pveVersion, changelogSection);
  await fs.writeFile(path.join(releaseRoot, `RELEASE_NOTES-${tagName}.md`), releaseNotes, "utf8");

  console.log(`[openapi-release] Prepared bundle at ${path.relative(workspace, stagingDir)}.`);
}

async function copyAsset(filename) {
  const source = path.join(artifactsDir, filename);
  await fs.access(source);
  await fs.copyFile(source, path.join(stagingDir, filename));
}

async function buildChecksumManifest(assetPaths) {
  const entries = await Promise.all(
    assetPaths.map(async (filePath) => {
      const payload = await fs.readFile(filePath);
      const sha256 = createHash("sha256").update(payload).digest("hex");
      return {
        file: path.basename(filePath),
        sha256,
        bytes: payload.byteLength,
      };
    })
  );

  const artifacts = entries.reduce((acc, entry) => {
    acc[entry.file] = entry;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    artifacts,
  };
}

async function composeReleaseNotes(tag, proxmoxVersion, changelogSection) {
  const current = await readWorkingState();
  const previousTag = resolvePreviousTag(tag);
  const previous = previousTag ? await loadPreviousStats(previousTag) : null;
  const currentStats = buildStatsPayload(tag, current);

  const lines = [];
  lines.push(`# Proxmox OpenAPI schema ${tag}`);
  lines.push("");
  lines.push(`- Normalized at: ${current.normalized.normalizedAt}`);
  lines.push(`- Raw snapshot scraped at: ${current.snapshot.scrapedAt ?? "unknown"}`);
  lines.push(`- Cache usage: ${current.automation?.usedCache ? "♻️ Reused cached snapshot" : "✨ Fresh scrape"}`);
  if (proxmoxVersion) {
    lines.push(`- Upstream Proxmox VE version: ${proxmoxVersion}`);
  }
  lines.push("");

  if (previous && hasSummary(previous) && hasSummary(currentStats) && previousTag) {
    lines.push(`## Changes since ${previousTag}`);
    lines.push("");
    lines.push(
      formatDelta("Groups", previous.normalized.summary.groupCount, currentStats.normalized.summary.groupCount)
    );
    lines.push(
      formatDelta("Endpoints", previous.normalized.summary.endpointCount, currentStats.normalized.summary.endpointCount)
    );
    lines.push(
      formatDelta("Methods", previous.normalized.summary.methodCount, currentStats.normalized.summary.methodCount)
    );
    if (previous.snapshot.stats?.endpointCount != null && currentStats.snapshot.stats?.endpointCount != null) {
      lines.push(
        formatDelta(
          "Raw snapshot endpoints",
          previous.snapshot.stats.endpointCount,
          currentStats.snapshot.stats.endpointCount
        )
      );
    }
  } else if (previousTag) {
    lines.push(`## Changes since ${previousTag}`);
    lines.push("");
    lines.push("Previous release notes did not include OpenAPI stats; reporting current snapshot for reference.");
    lines.push("");
    if (currentStats.normalized.summary) {
      lines.push(`- Groups: ${currentStats.normalized.summary.groupCount}`);
      lines.push(`- Endpoints: ${currentStats.normalized.summary.endpointCount}`);
      lines.push(`- Methods: ${currentStats.normalized.summary.methodCount}`);
    }
    if (currentStats.snapshot.stats?.endpointCount != null) {
      lines.push(`- Raw snapshot endpoints: ${currentStats.snapshot.stats.endpointCount}`);
    }
  }

  const content = changelogSection?.content?.trim();
  if (content) {
    lines.push("");
    lines.push("## Changelog");
    if (changelogSection.source && changelogSection.source.toLowerCase() === "unreleased") {
      lines.push("");
      lines.push("_Derived from the Unreleased section at release time._");
    }
    lines.push("");
    lines.push(content);
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  lines.push("- OpenAPI JSON: `proxmox-ve.json`");
  lines.push("- OpenAPI YAML: `proxmox-ve.yaml`");
  lines.push("- Checksums: `openapi.sha256.json`");

  lines.push("");
  lines.push(renderStatsMarker(currentStats));

  return lines.join("\n");
}

async function loadPreviousStats(tag) {
  const cachedState = await readStateAtRef(tag);
  if (cachedState) {
    return buildStatsPayload(tag, cachedState);
  }
  return loadStatsFromReleaseNotes(tag);
}

function buildStatsPayload(tag, state) {
  const normalized = state?.normalized ?? {};
  const snapshot = state?.snapshot ?? {};
  return {
    tag,
    normalized: {
      normalizedAt: normalized.normalizedAt ?? null,
      summary: copySummary(normalized.summary),
    },
    snapshot: {
      scrapedAt: snapshot.scrapedAt ?? null,
      stats: copyRawStats(snapshot.stats),
    },
  };
}

function hasSummary(stats) {
  return Boolean(
    stats?.normalized?.summary &&
      typeof stats.normalized.summary.groupCount === "number" &&
      typeof stats.normalized.summary.endpointCount === "number" &&
      typeof stats.normalized.summary.methodCount === "number"
  );
}

function renderStatsMarker(stats) {
  return `<!-- ${RELEASE_STATS_MARKER}: ${JSON.stringify(stats)} -->`;
}

function copySummary(summary) {
  if (!summary) {
    return null;
  }
  const { groupCount, endpointCount, methodCount } = summary;
  if (typeof groupCount !== "number" || typeof endpointCount !== "number" || typeof methodCount !== "number") {
    return null;
  }
  return { groupCount, endpointCount, methodCount };
}

function copyRawStats(stats) {
  if (!stats) {
    return null;
  }
  const { endpointCount, rootGroupCount } = stats;
  const payload = {};
  if (typeof endpointCount === "number") {
    payload.endpointCount = endpointCount;
  }
  if (typeof rootGroupCount === "number") {
    payload.rootGroupCount = rootGroupCount;
  }
  return Object.keys(payload).length > 0 ? payload : null;
}

async function loadStatsFromReleaseNotes(tag) {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    return null;
  }

  const token = selectGitHubToken();
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "proxmox-openapi-release-script",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  try {
    const response = await fetch(url, { headers });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      console.warn(
        `[openapi-release] Unable to read release notes for ${tag}: ${response.status} ${response.statusText}`
      );
      return null;
    }
    const payload = await response.json();
    const marker = parseStatsMarker(payload.body ?? "");
    if (!marker) {
      return null;
    }
    return normalizeStatsPayload(marker, tag);
  } catch (error) {
    console.warn(
      `[openapi-release] Failed to fetch release notes for ${tag}: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

function parseStatsMarker(body) {
  if (!body) {
    return null;
  }
  const markerRegex = new RegExp(`<!--\\s*${RELEASE_STATS_MARKER}:\\s*({[\\s\\S]*?})\\s*-->`);
  const match = markerRegex.exec(body);
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    console.warn(
      `[openapi-release] Unable to parse ${RELEASE_STATS_MARKER} marker: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

function normalizeStatsPayload(payload, fallbackTag) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const normalized = payload.normalized ?? {};
  const snapshot = payload.snapshot ?? {};
  const summary = copySummary(normalized.summary);
  const stats = copyRawStats(snapshot.stats);
  if (!summary && !stats) {
    return null;
  }
  return {
    tag: typeof payload.tag === "string" ? payload.tag : fallbackTag,
    normalized: {
      normalizedAt: typeof normalized.normalizedAt === "string" ? normalized.normalizedAt : null,
      summary,
    },
    snapshot: {
      scrapedAt: typeof snapshot.scrapedAt === "string" ? snapshot.scrapedAt : null,
      stats,
    },
  };
}

function selectGitHubToken() {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GH_PAT ?? process.env.GITHUB_PAT ?? null;
}

function formatDelta(label, previous, current) {
  const delta = current - previous;
  const trend = delta === 0 ? "±0" : delta > 0 ? `+${delta}` : `${delta}`;
  return `- ${label}: ${previous} → ${current} (${trend})`;
}

async function readWorkingState() {
  const cacheRoot = path.resolve("var", "cache");
  const normalizedPath = path.join(cacheRoot, "api-normalizer", "ir", "proxmox-openapi-ir.json");
  const snapshotPath = path.join(cacheRoot, "api-scraper", "raw", "proxmox-openapi-schema.json");

  const normalized = JSON.parse(await fs.readFile(normalizedPath, "utf8"));
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  const automation = await readAutomationSummary();
  return { normalized, snapshot, automation };
}

async function readAutomationSummary() {
  try {
    return JSON.parse(await fs.readFile(path.resolve("var", "automation-summary.json"), "utf8"));
  } catch {
    return null;
  }
}

function resolvePreviousTag(currentTag) {
  try {
    const tags = execSync("git tag --sort=-creatordate", { encoding: "utf8" })
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (tags.length === 0) {
      return null;
    }

    const index = tags.indexOf(currentTag);
    if (index > -1) {
      return tags[index + 1] ?? null;
    }
    return tags[0];
  } catch (error) {
    console.warn(`[openapi-release] Unable to resolve previous tag: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

async function readStateAtRef(ref) {
  try {
    const normalized = JSON.parse(runGitShow(ref, "var/cache/api-normalizer/ir/proxmox-openapi-ir.json"));
    const snapshot = JSON.parse(runGitShow(ref, "var/cache/api-scraper/raw/proxmox-openapi-schema.json"));
    return { normalized, snapshot };
  } catch (error) {
    console.warn(
      `[openapi-release] Unable to load cached state for ${ref}: ${error instanceof Error ? error.message : error}`
    );
    return null;
  }
}

function runGitShow(ref, file) {
  return execSync(`git show ${ref}:${file}`, { encoding: "utf8" });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function extractChangelogSection(tag) {
  try {
    const changelog = await fs.readFile(path.resolve("CHANGELOG.md"), "utf8");
    const tagged = findChangelogSection(changelog, tag);
    if (tagged) {
      return { content: tagged, source: tag };
    }
    const fallback = findChangelogSection(changelog, "Unreleased");
    if (fallback) {
      return { content: fallback, source: "Unreleased" };
    }
    return { content: "", source: null };
  } catch (error) {
    console.warn(`[openapi-release] Unable to read CHANGELOG: ${error instanceof Error ? error.message : error}`);
    return { content: "", source: null };
  }
}

function findChangelogSection(changelog, heading) {
  const headingRegex = new RegExp(`^##\\s+${escapeRegExp(heading)}(?:\\s+—.*)?$`, "m");
  const lines = changelog.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (headingRegex.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) {
    return null;
  }
  let end = lines.length;
  for (let i = start; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  const sectionLines = lines.slice(start, end);
  while (sectionLines.length && sectionLines[0].trim() === "") sectionLines.shift();
  while (sectionLines.length && sectionLines[sectionLines.length - 1].trim() === "") sectionLines.pop();
  return sectionLines.join("\n");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const isDirectExecution = Boolean(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));

if (isDirectExecution) {
  main().catch((error) => {
    console.error(`[openapi-release] ${error instanceof Error ? (error.stack ?? error.message) : error}`);
    process.exitCode = 1;
  });
}

export { composeReleaseNotes, extractChangelogSection };
