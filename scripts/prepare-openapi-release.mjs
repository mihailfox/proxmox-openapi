import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [requestedTag] = process.argv.slice(2);
const tagName = requestedTag ?? process.env.GITHUB_REF_NAME ?? "dev";
const pveVersion = process.env.PVE_VERSION ?? "";
const workspace = process.cwd();
const artifactsDir = path.resolve("var", "openapi");
const releaseRoot = path.resolve("var", "openapi-release");
const stagingDir = path.join(releaseRoot, `proxmox-openapi-schema-${tagName}`);
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
  const previous = previousTag ? await readStateAtRef(previousTag) : null;

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

  if (previous) {
    lines.push(`## Changes since ${previousTag}`);
    lines.push("");
    lines.push(formatDelta("Groups", previous.normalized.summary.groupCount, current.normalized.summary.groupCount));
    lines.push(
      formatDelta("Endpoints", previous.normalized.summary.endpointCount, current.normalized.summary.endpointCount)
    );
    lines.push(formatDelta("Methods", previous.normalized.summary.methodCount, current.normalized.summary.methodCount));
    lines.push(
      formatDelta("Raw snapshot endpoints", previous.snapshot.stats.endpointCount, current.snapshot.stats.endpointCount)
    );
  } else {
    lines.push("## Changes");
    lines.push("");
    lines.push("Initial tagged release of the schema bundle.");
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push("");
  lines.push("- OpenAPI JSON: `proxmox-ve.json`");
  lines.push("- OpenAPI YAML: `proxmox-ve.yaml`");
  lines.push("- Checksums: `openapi.sha256.json`");

  if (changelogSection && changelogSection.trim() !== "") {
    lines.push("");
    lines.push("## Changelog");
    lines.push("");
    lines.push(changelogSection.trim());
  }

  return lines.join("\n");
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
    const headingRegex = new RegExp(`^##\\s+${escapeRegExp(tag)}(?:\\s+—.*)?$`, "m");
    const lines = changelog.split("\n");
    let start = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (headingRegex.test(lines[i])) {
        start = i + 1;
        break;
      }
    }
    if (start === -1) {
      return "";
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
  } catch (error) {
    console.warn(`[openapi-release] Unable to read CHANGELOG: ${error instanceof Error ? error.message : error}`);
    return "";
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(`[openapi-release] ${error instanceof Error ? (error.stack ?? error.message) : error}`);
  process.exitCode = 1;
});
