import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import type { AutomationPipelineResult } from "@proxmox-openapi/automation";

const DEFAULT_SUMMARY_PATH = "var/reports/automation-summary.json";

interface CliParseResult {
  inputPath: string;
  outputPath?: string;
  relativeTo?: string;
  showHelp: boolean;
}

export function toRelativePath(targetPath: string, baseDir: string): string {
  const relativePath = path.relative(baseDir, targetPath);
  const normalized = relativePath === "" ? "." : relativePath;
  return normalized.split(path.sep).join("/");
}

export function formatAutomationSummary(
  summary: AutomationPipelineResult,
  options: { summaryPath?: string; relativeTo?: string } = {}
): string {
  const baseDir = path.resolve(options.relativeTo ?? process.cwd());
  const rows: Array<[string, string]> = [
    ["Raw snapshot", summary.rawSnapshotPath],
    ["Normalized IR", summary.normalizedDocumentPath],
    ["OpenAPI JSON", summary.openApiJsonPath],
    ["OpenAPI YAML", summary.openApiYamlPath],
  ];

  const formattedRows = rows.map(([label, absolutePath]) => {
    const resolved = path.resolve(absolutePath);
    const display = toRelativePath(resolved, baseDir);
    return `| ${label} | \`${display}\` |`;
  });

  const summaryPath = options.summaryPath ? toRelativePath(path.resolve(options.summaryPath), baseDir) : undefined;

  const cacheLine = summary.usedCache ? "♻️ Reused cached snapshot" : "✨ Fresh scrape";

  const sections = ["## Automation summary", ""];

  if (summaryPath) {
    sections.push(`- Summary JSON: \`${summaryPath}\``);
  }

  sections.push(`- Cache usage: ${cacheLine}`, "", "| Artifact | Path |", "| --- | --- |", ...formattedRows, "");

  return sections.join("\n");
}

function assertValidSummary(payload: unknown): asserts payload is AutomationPipelineResult {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Summary payload must be an object.");
  }

  const candidate = payload as Partial<AutomationPipelineResult>;
  const requiredKeys: Array<keyof AutomationPipelineResult> = [
    "rawSnapshotPath",
    "normalizedDocumentPath",
    "openApiJsonPath",
    "openApiYamlPath",
    "usedCache",
  ];

  for (const key of requiredKeys) {
    if (candidate[key] === undefined) {
      throw new Error(`Summary payload is missing required field: ${key}`);
    }
  }

  const stringKeys: Array<keyof AutomationPipelineResult> = [
    "rawSnapshotPath",
    "normalizedDocumentPath",
    "openApiJsonPath",
    "openApiYamlPath",
  ];

  for (const key of stringKeys) {
    if (typeof candidate[key] !== "string") {
      throw new Error(`Summary payload field ${key} must be a string.`);
    }
  }

  if (typeof candidate.usedCache !== "boolean") {
    throw new Error("Summary payload field usedCache must be a boolean.");
  }
}

export function parseCliArguments(argv: readonly string[]): CliParseResult {
  const result: CliParseResult = {
    inputPath: DEFAULT_SUMMARY_PATH,
    showHelp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case "--help":
      case "-h": {
        return { ...result, showHelp: true };
      }
      case "--input":
      case "-i": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("Missing value for --input.");
        }
        result.inputPath = next;
        index += 1;
        break;
      }
      case "--output":
      case "-o": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("Missing value for --output.");
        }
        result.outputPath = next;
        index += 1;
        break;
      }
      case "--relative-to": {
        const next = argv[index + 1];
        if (!next) {
          throw new Error("Missing value for --relative-to.");
        }
        result.relativeTo = next;
        index += 1;
        break;
      }
      default: {
        if (token.startsWith("-")) {
          throw new Error(`Unrecognized option: ${token}`);
        }
        result.inputPath = token;
      }
    }
  }

  return result;
}

function printHelp(): void {
  process.stdout.write(
    `Usage: tsx tools/automation/scripts/format-summary.ts [options]\n\n` +
      `Options:\n` +
      `  -i, --input <path>         Path to the automation summary JSON (default: ${DEFAULT_SUMMARY_PATH})\n` +
      `  -o, --output <path>        Write Markdown to the specified file instead of stdout\n` +
      `      --relative-to <path>  Base directory for relative paths (default: current working directory)\n` +
      `  -h, --help                 Show this help message\n`
  );
}

async function runCli(): Promise<void> {
  try {
    const parsed = parseCliArguments(process.argv.slice(2));

    if (parsed.showHelp) {
      printHelp();
      return;
    }

    const inputPath = path.resolve(parsed.inputPath);
    const relativeTo = parsed.relativeTo ? path.resolve(parsed.relativeTo) : process.cwd();
    const raw = await fs.readFile(inputPath, "utf8");
    const payload = JSON.parse(raw) as unknown;
    assertValidSummary(payload);

    const markdown = formatAutomationSummary(payload, {
      summaryPath: inputPath,
      relativeTo,
    });

    if (parsed.outputPath) {
      const outputPath = path.resolve(parsed.outputPath);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, markdown, "utf8");
    } else {
      process.stdout.write(markdown);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`format-summary: ${message}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void runCli();
}
