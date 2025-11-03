#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/set-release-version.mjs --version <semver>");
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let version;
  let updateActionDependency = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--version" && args[i + 1]) {
      version = args[i + 1];
      i += 1;
    } else if (arg === "--update-action-dependency") {
      updateActionDependency = true;
    }
  }
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    usage();
  }
  return { version, updateActionDependency };
}

async function updatePackageJson(filePath, version, { updateActionDependency = false } = {}) {
  const json = JSON.parse(await fs.readFile(filePath, "utf8"));
  json.version = version;
  if (updateActionDependency && json.dependencies && json.dependencies["@mihailfox/proxmox-openapi"]) {
    json.dependencies["@mihailfox/proxmox-openapi"] = `^${version}`;
  }
  const payload = `${JSON.stringify(json, null, 2)}\n`;
  await fs.writeFile(filePath, payload, "utf8");
  console.log(`[set-release-version] Updated ${path.relative(process.cwd(), filePath)} to ${version}`);
}

async function main() {
  const { version, updateActionDependency } = parseArgs();
  await Promise.all([
    updatePackageJson(path.resolve("package.json"), version),
    updatePackageJson(path.resolve("packages/proxmox-openapi/package.json"), version),
    updatePackageJson(path.resolve(".github/actions/proxmox-openapi-artifacts/package.json"), version, {
      updateActionDependency,
    }),
  ]);
}

main().catch((error) => {
  console.error(`[set-release-version] ${error instanceof Error ? (error.stack ?? error.message) : error}`);
  process.exitCode = 1;
});
