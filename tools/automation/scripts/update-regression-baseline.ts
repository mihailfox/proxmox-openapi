import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";

import { runAutomationPipeline } from "@proxmox-openapi/automation";
import {
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
  resolveFromRoot,
  relativeToRoot,
} from "@proxmox-openapi/shared/paths.ts";

const RAW_SNAPSHOT_PATH = resolveFromRoot("tools/api-scraper/data/raw/proxmox-openapi-schema.json");
const NORMALIZED_IR_PATH = resolveFromRoot("tools/api-normalizer/data/ir/proxmox-openapi-ir.json");
const CHECKSUM_OUTPUT_PATH = resolveFromRoot("tools/automation/data/regression/openapi.sha256.json");

interface CommandLineOptions {
  runPipeline: boolean;
}

interface TrackedArtifact {
  label: string;
  path: string;
}

const trackedArtifacts: TrackedArtifact[] = [
  { label: "raw snapshot", path: RAW_SNAPSHOT_PATH },
  { label: "normalized intermediate representation", path: NORMALIZED_IR_PATH },
  { label: "OpenAPI JSON", path: OPENAPI_JSON_PATH },
  { label: "OpenAPI YAML", path: OPENAPI_YAML_PATH },
];

async function main(): Promise<void> {
  const options = parseCommandLine(process.argv.slice(2));

  if (options.runPipeline) {
    await runAutomationPipeline({ mode: "ci" });
  }

  await assertArtifactsPresent();

  const [jsonHash, yamlHash] = await Promise.all([
    computeSha256(OPENAPI_JSON_PATH),
    computeSha256(OPENAPI_YAML_PATH),
  ]);

  const payload = {
    json: { sha256: jsonHash },
    yaml: { sha256: yamlHash },
    generatedAt: new Date().toISOString(),
  } satisfies Record<string, unknown>;

  await fs.mkdir(path.dirname(CHECKSUM_OUTPUT_PATH), { recursive: true });
  await fs.writeFile(CHECKSUM_OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  log(`Baseline written to ${relativeToRoot(CHECKSUM_OUTPUT_PATH)}`);
  log(`OpenAPI JSON sha256: ${jsonHash}`);
  log(`OpenAPI YAML sha256: ${yamlHash}`);
}

function parseCommandLine(argv: readonly string[]): CommandLineOptions {
  const { values } = parseArgs({
    args: Array.from(argv),
    allowPositionals: false,
    options: {
      pipeline: { type: "boolean" },
    },
  });

  return {
    runPipeline: values.pipeline === true,
  } satisfies CommandLineOptions;
}

async function assertArtifactsPresent(): Promise<void> {
  const missing = [] as TrackedArtifact[];

  for (const artifact of trackedArtifacts) {
    if (!(await fileExists(artifact.path))) {
      missing.push(artifact);
    }
  }

  if (missing.length > 0) {
    const message = missing
      .map((artifact) => `- ${artifact.label} (${relativeToRoot(artifact.path)})`)
      .join("\n");
    throw new Error(
      `Required artifacts are missing. Run the automation pipeline (e.g. npm run automation:pipeline) and retry.\n${message}`
    );
  }
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function computeSha256(filePath: string): Promise<string> {
  const payload = await fs.readFile(filePath);
  return createHash("sha256").update(payload).digest("hex");
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
