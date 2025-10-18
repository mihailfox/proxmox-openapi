import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const [currentTag = "dev"] = process.argv.slice(2);
const releaseRoot = path.resolve("var", "openapi-release");
const stagingName = `proxmox-openapi-schema-${currentTag}`;
const stagingDir = path.join(releaseRoot, stagingName);
const artifactsDir = path.resolve("var", "openapi");
const automationSummaryPath = path.resolve("var", "automation-summary.json");

async function main() {
  await fs.rm(releaseRoot, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });

  const artifacts = [
    { source: path.join(artifactsDir, "proxmox-ve.json"), target: "proxmox-ve.json" },
    { source: path.join(artifactsDir, "proxmox-ve.yaml"), target: "proxmox-ve.yaml" },
  ];

  for (const artifact of artifacts) {
    await assertFile(artifact.source);
    await fs.copyFile(artifact.source, path.join(stagingDir, artifact.target));
  }

  const manifest = await buildManifest(artifacts.map((entry) => ({
    file: entry.target,
    absolute: path.join(stagingDir, entry.target),
  })));
  await fs.writeFile(path.join(stagingDir, "openapi.sha256.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const releaseNotes = await generateReleaseNotes(currentTag);
  await fs.writeFile(path.join(stagingDir, "RELEASE_NOTES.md"), releaseNotes, "utf8");

  try {
    await fs.copyFile(automationSummaryPath, path.join(stagingDir, "automation-summary.json"));
  } catch (error) {
    console.warn(`[openapi-release] Skipping automation summary copy: ${(error instanceof Error ? error.message : error)}`);
  }

  console.log(`[openapi-release] Prepared ${stagingName} at ${path.relative(process.cwd(), stagingDir)}.`);
}

async function assertFile(filePath) {
  try {
    await fs.access(filePath);
  } catch (_error) {
    throw new Error(`Required artifact missing: ${path.relative(process.cwd(), filePath)}`);
  }
}

async function buildManifest(entries) {
  const artifacts = {};
  for (const entry of entries) {
    const payload = await fs.readFile(entry.absolute);
    const hash = createHash("sha256").update(payload).digest("hex");
    artifacts[entry.file.replace(/\.[^.]+$/, "")] = {
      file: entry.file,
      sha256: hash,
      bytes: payload.byteLength,
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    artifacts,
  };
}

async function generateReleaseNotes(tag) {
  const current = await readCurrentState();
  const previousTag = resolvePreviousTag(tag);
  const previous = previousTag ? await readStateAtRef(previousTag) : null;

  const lines = [];
  lines.push(`# Proxmox OpenAPI schema ${tag}`);
  lines.push("");
  lines.push(`- Normalized at: ${current.normalized.normalizedAt}`);
  lines.push(`- Raw snapshot scraped at: ${current.snapshot.scrapedAt ?? "unknown"}`);
  lines.push(`- Cache usage: ${current.automation?.usedCache ? "♻️ Reused cached snapshot" : "✨ Fresh scrape"}`);
  lines.push("");

  if (previous && previousTag) {
    lines.push(`## Changes since ${previousTag}`);
    lines.push("");
    lines.push(formatDeltaRow("Groups", previous.normalized.summary.groupCount, current.normalized.summary.groupCount));
    lines.push(formatDeltaRow("Endpoints", previous.normalized.summary.endpointCount, current.normalized.summary.endpointCount));
    lines.push(formatDeltaRow("Methods", previous.normalized.summary.methodCount, current.normalized.summary.methodCount));
    lines.push(formatDeltaRow("Raw snapshot endpoints", previous.snapshot.stats.endpointCount, current.snapshot.stats.endpointCount));
  } else {
    lines.push(`## Changes`);
    lines.push("");
    lines.push("First tagged release of the schema bundle.");
  }

  lines.push("");
  lines.push(`## Artifacts`);
  lines.push("");
  lines.push(`- OpenAPI JSON: \`proxmox-ve.json\``);
  lines.push(`- OpenAPI YAML: \`proxmox-ve.yaml\``);
  lines.push(`- Checksums: \`openapi.sha256.json\``);

  return lines.join("\n");
}

function formatDeltaRow(label, previous, current) {
  const delta = current - previous;
  const trend = delta === 0 ? "±0" : delta > 0 ? `+${delta}` : `${delta}`;
  return `- ${label}: ${previous} → ${current} (${trend})`;
}

async function readCurrentState() {
  const normalizedPath = path.resolve("tools", "api-normalizer", "data", "ir", "proxmox-openapi-ir.json");
  const snapshotPath = path.resolve("tools", "api-scraper", "data", "raw", "proxmox-openapi-schema.json");
  const normalized = JSON.parse(await fs.readFile(normalizedPath, "utf8"));
  const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  const automation = await readAutomationSummary();
  return { normalized, snapshot, automation };
}

async function readAutomationSummary() {
  try {
    const payload = await fs.readFile(path.resolve("var", "automation-summary.json"), "utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function readStateAtRef(ref) {
  const normalized = JSON.parse(runGitShow(ref, "tools/api-normalizer/data/ir/proxmox-openapi-ir.json"));
  const snapshot = JSON.parse(runGitShow(ref, "tools/api-scraper/data/raw/proxmox-openapi-schema.json"));
  return { normalized, snapshot };
}

function runGitShow(ref, file) {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: "utf8" });
  } catch (error) {
    throw new Error(`Unable to read ${file} at ${ref}: ${error instanceof Error ? error.message : error}`);
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
    if (!currentTag) {
      return tags[1] ?? null;
    }
    const index = tags.indexOf(currentTag);
    if (index === -1) {
      return tags[0] === currentTag ? tags[1] ?? null : tags[0];
    }
    return tags[index + 1] ?? null;
  } catch (error) {
    console.warn(`[openapi-release] Unable to resolve previous tag: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}

main().catch((error) => {
  console.error(`[openapi-release] ${error instanceof Error ? error.stack ?? error.message : error}`);
  process.exitCode = 1;
});
