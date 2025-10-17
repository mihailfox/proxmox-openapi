import { promises as fs } from "node:fs";
import path from "node:path";

import type { RawApiSnapshot } from "@proxmox-openapi/api-scraper/types.ts";
import { normalizeSnapshot } from "./normalizer.ts";

interface CliOptions {
  inputPath: string;
  outputPath: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const resolvedInput = path.resolve(process.cwd(), options.inputPath);
  const resolvedOutput = path.resolve(process.cwd(), options.outputPath);

  const payload = await fs.readFile(resolvedInput, "utf8");
  const snapshot = JSON.parse(payload) as RawApiSnapshot;
  const normalized = normalizeSnapshot(snapshot);

  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, JSON.stringify(normalized, null, 2));

  process.stdout.write(`Normalized snapshot written to ${path.relative(process.cwd(), resolvedOutput)}\n`);
}

function parseArgs(argv: string[]): CliOptions {
  let inputPath = "tools/api-scraper/data/raw/proxmox-openapi-schema.json";
  let outputPath = "tools/api-normalizer/data/ir/proxmox-openapi-ir.json";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input" || arg === "-i") {
      inputPath = argv[index + 1] ?? inputPath;
      index += 1;
    } else if (arg === "--output" || arg === "-o") {
      outputPath = argv[index + 1] ?? outputPath;
      index += 1;
    }
  }

  return { inputPath, outputPath };
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
