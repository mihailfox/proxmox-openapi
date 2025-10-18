import fs from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const pagesDir = path.resolve("var", "pages");
const openapiSrcDir = path.resolve("var", "openapi");
const openapiDistDir = path.join(distDir, "openapi");

async function ensureDistExists() {
  try {
    await fs.access(distDir);
  } catch {
    throw new Error("SPA build not found. Run `npm run ui:build` before preparing pages.");
  }
}

async function copyOpenApiArtifacts() {
  try {
    await fs.access(openapiSrcDir);
  } catch {
    console.warn("[pages] No OpenAPI artifacts found. Skipping copy into SPA output.");
    return;
  }

  await fs.mkdir(openapiDistDir, { recursive: true });
  await fs.cp(openapiSrcDir, openapiDistDir, { recursive: true });
  console.log(`[pages] Copied OpenAPI artifacts into ${path.relative(process.cwd(), openapiDistDir)}.`);
}

async function ensure404Fallback() {
  const indexPath = path.join(distDir, "index.html");
  const notFoundPath = path.join(distDir, "404.html");

  try {
    await fs.copyFile(indexPath, notFoundPath);
    console.log("[pages] Created 404.html fallback for GitHub Pages.");
  } catch (error) {
    throw new Error(`Failed to create 404.html fallback: ${error instanceof Error ? error.message : error}`);
  }
}

async function copyAutomationSummary() {
  const summaryPath = path.resolve("var", "automation-summary.json");
  try {
    await fs.access(summaryPath);
    await fs.copyFile(summaryPath, path.join(distDir, "automation-summary.json"));
  } catch {
    // Optional file; ignore if missing.
  }
}

async function copyToPagesDir() {
  await fs.rm(pagesDir, { recursive: true, force: true });
  await fs.mkdir(pagesDir, { recursive: true });
  await fs.cp(distDir, pagesDir, { recursive: true });
  console.log(`[pages] Prepared artifact at ${path.relative(process.cwd(), pagesDir)}.`);
}

async function main() {
  await ensureDistExists();
  await copyOpenApiArtifacts();
  await copyAutomationSummary();
  await ensure404Fallback();
  await copyToPagesDir();
}

main().catch((error) => {
  console.error(`[pages] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
