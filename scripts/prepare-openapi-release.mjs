import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const [requestedTag] = process.argv.slice(2);
const tagName = requestedTag ?? process.env.GITHUB_REF_NAME ?? "dev";
const workspace = process.cwd();
const artifactsDir = path.resolve("var", "openapi");
const releaseRoot = path.resolve("var", "openapi-release");
const stagingDir = path.join(releaseRoot, `proxmox-openapi-schema-${tagName}`);
async function main() {
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  const files = [
    copyAsset("proxmox-ve.json"),
    copyAsset("proxmox-ve.yaml"),
  ];
  await Promise.all(files);

  const manifest = await buildChecksumManifest(["proxmox-ve.json", "proxmox-ve.yaml"].map((file) => path.join(stagingDir, file)));
  await writeJson(path.join(stagingDir, "openapi.sha256.json"), manifest);

  const releaseNotes = await composeReleaseNotes(tagName);
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
    const key = entry.file.replace(/\.[^.]+$/, "");
    acc[key] = entry;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    artifacts,
  };
}

async function composeReleaseNotes(tag) {
  const current = await readWorkingState();
  const previousTag = resolvePreviousTag(tag);
  const previous = previousTag ? await readStateAtRef(previousTag) : null;

  const lines = [];
  lines.push(`# Proxmox OpenAPI schema ${tag}`);
  lines.push("");
  lines.push(`- Normalized at: ${current.normalized.normalizedAt}`);
  lines.push(`- Raw snapshot scraped at: ${current.snapshot.scrapedAt ?? "unknown"}`);
  lines.push(`- Cache usage: ${current.automation?.usedCache ? "♻️ Reused cached snapshot" : "✨ Fresh scrape"}`);
  lines.push("");

  if (previous) {
    lines.push(`## Changes since ${previousTag}`);
    lines.push("");
    lines.push(formatDelta("Groups", previous.normalized.summary.groupCount, current.normalized.summary.groupCount));
    lines.push(formatDelta("Endpoints", previous.normalized.summary.endpointCount, current.normalized.summary.endpointCount));
    lines.push(formatDelta("Methods", previous.normalized.summary.methodCount, current.normalized.summary.methodCount));
    lines.push(formatDelta("Raw snapshot endpoints", previous.snapshot.stats.endpointCount, current.snapshot.stats.endpointCount));
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

  return lines.join("\n");
}

function formatDelta(label, previous, current) {
  const delta = current - previous;
  const trend = delta === 0 ? "±0" : delta > 0 ? `+${delta}` : `${delta}`;
  return `- ${label}: ${previous} → ${current} (${trend})`;
}

async function readWorkingState() {
  const normalized = JSON.parse(await fs.readFile(path.resolve("tools", "api-normalizer", "data", "ir", "proxmox-openapi-ir.json"), "utf8"));
  const snapshot = JSON.parse(await fs.readFile(path.resolve("tools", "api-scraper", "data", "raw", "proxmox-openapi-schema.json"), "utf8"));
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
  const normalized = JSON.parse(runGitShow(ref, "tools/api-normalizer/data/ir/proxmox-openapi-ir.json"));
  const snapshot = JSON.parse(runGitShow(ref, "tools/api-scraper/data/raw/proxmox-openapi-schema.json"));
  return { normalized, snapshot };
}

function runGitShow(ref, file) {
  return execSync(`git show ${ref}:${file}`, { encoding: "utf8" });
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(`[openapi-release] ${error instanceof Error ? error.stack ?? error.message : error}`);
  process.exitCode = 1;
});
