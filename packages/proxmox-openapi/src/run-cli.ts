import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { Command, Option } from "commander";
import { stringify as stringifyYaml } from "yaml";

import { DEFAULT_BASE_URL, scrapeApiDocumentation } from "@proxmox-openapi/api-scraper/scraper.ts";
import type { RawApiSnapshot } from "@proxmox-openapi/api-scraper/types.ts";
import { normalizeSnapshot } from "@proxmox-openapi/api-normalizer/normalizer.ts";
import type { NormalizedApiDocument } from "@proxmox-openapi/api-normalizer/types.ts";
import {
  generateOpenApiDocument,
  type GenerateOpenApiOptions,
} from "@proxmox-openapi/openapi-generator/generator.ts";
import { OPENAPI_ARTIFACT_DIR, OPENAPI_BASENAME } from "@proxmox-openapi/shared/paths.ts";
import {
  runAutomationPipeline,
  resolveAutomationPipelineOptions,
  type AutomationPipelineRunOptions,
  type AutomationPipelineResult,
} from "@proxmox-openapi/automation";

export interface CliContext {
  readonly command: Command;
}

const DEFAULT_RAW_SNAPSHOT_PATH = "tools/api-scraper/data/raw/proxmox-openapi-schema.json";
const DEFAULT_IR_OUTPUT_PATH = "tools/api-normalizer/data/ir/proxmox-openapi-ir.json";

type PipelineCliOptions = AutomationPipelineRunOptions;

function toPipelineOptions(rawOptions: Record<string, unknown>): PipelineCliOptions {
  const mode = typeof rawOptions.mode === "string" && rawOptions.mode === "full" ? "full" : "ci";

  return {
    mode,
    baseUrl: asString(rawOptions.baseUrl),
    rawSnapshotPath: asString(rawOptions.rawOutput),
    irOutputPath: asString(rawOptions.irOutput),
    openApiOutputDir: asString(rawOptions.openapiDir),
    openApiBasename: asString(rawOptions.basename),
    summaryOutputPath: asString(rawOptions.report),
    fallbackToCache: asBoolean(rawOptions.fallbackToCache),
    offline: asBoolean(rawOptions.offline),
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

function configurePipelineCommand(command: Command): Command {
  return command
    .description("Run the scrape → normalize → generate automation pipeline.")
    .option("-m, --mode <mode>", "Pipeline mode (ci|full)", "ci")
    .option("--base-url <url>", "Override the Proxmox API viewer base URL")
    .option("--raw-output <path>", "Path for the raw snapshot JSON output")
    .option("--ir-output <path>", "Path for the normalized intermediate representation output")
    .option("--openapi-dir <dir>", "Directory that receives generated OpenAPI files")
    .option("-b, --basename <name>", "Basename used for OpenAPI output files")
    .option("--report <path>", "Write the automation summary JSON to the provided path")
    .addOption(new Option("--fallback-to-cache", "Allow reusing cached snapshots").default(true))
    .addOption(new Option("--no-fallback-to-cache", "Disable cached snapshot reuse"))
    .option("--offline", "Force offline mode (skip live scraping)")
    .action(async (opts: Record<string, unknown>) => {
      const pipelineOptions = toPipelineOptions(opts);
      const resolved = resolveAutomationPipelineOptions(pipelineOptions);
      const result: AutomationPipelineResult = await runAutomationPipeline(pipelineOptions);

      if (resolved.summaryOutputPath) {
        console.log(`Summary written to ${relative(resolved.summaryOutputPath)}`);
      }

      console.log(`OpenAPI artifacts available in ${relative(resolved.openApiOutputDir)}`);
      console.log(`Cache usage: ${result.usedCache ? "reused cached snapshot" : "fresh scrape"}`);
    });
}

function configureScrapeCommand(command: Command): Command {
  return command
    .description("Scrape the Proxmox API viewer and emit the raw snapshot JSON.")
    .option("--base-url <url>", "Override the Proxmox API viewer base URL")
    .option("--output <path>", "Path for the raw snapshot JSON output", DEFAULT_RAW_SNAPSHOT_PATH)
    .option("--no-persist", "Disable writing the snapshot to disk (prints stats only)")
    .action(async (opts: Record<string, unknown>) => {
      const baseUrl = asString(opts.baseUrl);
      const outputPath = asString(opts.output) ?? DEFAULT_RAW_SNAPSHOT_PATH;
      const shouldPersist = opts.persist !== false;
      const resolvedOutput = path.resolve(outputPath);

      const persist = shouldPersist
        ? {
            outputDir: path.dirname(resolvedOutput),
            fileName: path.basename(resolvedOutput),
          }
        : false;

      const { snapshot, filePath } = await scrapeApiDocumentation({
        baseUrl,
        persist,
      });

      console.log(
        [
          `Scraped ${snapshot.stats.rootGroupCount} groups`,
          `${snapshot.stats.endpointCount} endpoints`,
          `source: ${baseUrl ?? DEFAULT_BASE_URL}`,
        ].join(" | ")
      );

      if (filePath) {
        console.log(`Snapshot saved to ${relative(filePath)}`);
      }
    });
}

function configureNormalizeCommand(command: Command): Command {
  return command
    .description("Normalize a scraped snapshot into the intermediate representation (IR).")
    .option("--input <path>", "Path to the raw snapshot JSON", DEFAULT_RAW_SNAPSHOT_PATH)
    .option("--output <path>", "Where to write the normalized IR JSON", DEFAULT_IR_OUTPUT_PATH)
    .action(async (opts: Record<string, unknown>) => {
      const inputPath = path.resolve(asString(opts.input) ?? DEFAULT_RAW_SNAPSHOT_PATH);
      const outputPath = path.resolve(asString(opts.output) ?? DEFAULT_IR_OUTPUT_PATH);

      const payload = await fs.readFile(inputPath, "utf8");
      const snapshot = JSON.parse(payload) as RawApiSnapshot;
      const normalized = normalizeSnapshot(snapshot);

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");

      console.log(`Normalized IR written to ${relative(outputPath)}`);
    });
}

function configureGenerateCommand(command: Command): Command {
  return command
    .description("Generate OpenAPI documents from the normalized IR.")
    .option("--input <path>", "Path to the normalized IR JSON", DEFAULT_IR_OUTPUT_PATH)
    .option("--output <dir>", "Directory for generated OpenAPI files", OPENAPI_ARTIFACT_DIR)
    .option("-b, --basename <name>", "Basename for the OpenAPI files", OPENAPI_BASENAME)
    .option("--format <formats>", "Comma-separated list of formats (json,yaml)", "json,yaml")
    .option("--server-url <url>", "Override the server URL baked into the OpenAPI document")
    .action(async (opts: Record<string, unknown>) => {
      const inputPath = path.resolve(asString(opts.input) ?? DEFAULT_IR_OUTPUT_PATH);
      const outputDir = path.resolve(asString(opts.output) ?? OPENAPI_ARTIFACT_DIR);
      const basename = asString(opts.basename) ?? OPENAPI_BASENAME;
      const serverUrl = asString(opts.serverUrl);
      const formats = parseFormats(opts.format);

      const payload = await fs.readFile(inputPath, "utf8");
      const normalized = JSON.parse(payload) as NormalizedApiDocument;

      const options: GenerateOpenApiOptions = {};
      if (serverUrl) {
        options.serverUrl = serverUrl;
      }

      const document = generateOpenApiDocument(normalized, options);

      await fs.mkdir(outputDir, { recursive: true });

      const written: string[] = [];

      if (formats.has("json")) {
        const jsonPath = path.join(outputDir, `${basename}.json`);
        await fs.writeFile(jsonPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
        written.push(jsonPath);
      }

      if (formats.has("yaml")) {
        const yamlPath = path.join(outputDir, `${basename}.yaml`);
        await fs.writeFile(yamlPath, `${stringifyYaml(document)}\n`, "utf8");
        written.push(yamlPath);
      }

      if (written.length === 0) {
        throw new Error("No output formats selected. Use --format to include json and/or yaml.");
      }

      for (const filePath of written) {
        console.log(`Generated ${relative(filePath)}`);
      }
    });
}

function parseFormats(value: unknown): Set<"json" | "yaml"> {
  if (!value) {
    return new Set(["json", "yaml"]);
  }

  const tokens = String(value)
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const formats = new Set<"json" | "yaml">();

  for (const token of tokens) {
    if (token === "json" || token === "yaml") {
      formats.add(token);
    }
  }

  return formats;
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

function buildCommand(): Command {
  const program = new Command()
    .name("proxmox-openapi")
    .description("Scrape, normalize, and generate Proxmox VE OpenAPI artifacts.");

  configurePipelineCommand(program);
  configurePipelineCommand(program.command("pipeline").alias("run"));
  configureScrapeCommand(program.command("scrape"));
  configureNormalizeCommand(program.command("normalize"));
  configureGenerateCommand(program.command("generate"));

  program.showHelpAfterError();

  return program;
}

export async function runCli(argv: readonly string[] = process.argv): Promise<void> {
  const command = buildCommand();
  await command.parseAsync(argv);
}

export function createCli(): CliContext {
  return { command: buildCommand() };
}
