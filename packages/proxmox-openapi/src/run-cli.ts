import process from "node:process";
import { Command, Option } from "commander";

import {
  runAutomationPipeline,
  type AutomationPipelineRunOptions,
  type AutomationPipelineResult,
} from "@proxmox-openapi/automation";

export interface CliContext {
  readonly command: Command;
}

function toPipelineOptions(rawOptions: Record<string, unknown>): AutomationPipelineRunOptions {
  const mode = typeof rawOptions.mode === "string" && rawOptions.mode === "full" ? "full" : "ci";

  return {
    mode,
    baseUrl: typeof rawOptions.baseUrl === "string" ? rawOptions.baseUrl : undefined,
    rawSnapshotPath: typeof rawOptions.rawOutput === "string" ? rawOptions.rawOutput : undefined,
    irOutputPath: typeof rawOptions.irOutput === "string" ? rawOptions.irOutput : undefined,
    openApiOutputDir: typeof rawOptions.openapiDir === "string" ? rawOptions.openapiDir : undefined,
    openApiBasename: typeof rawOptions.basename === "string" ? rawOptions.basename : undefined,
    summaryOutputPath: typeof rawOptions.report === "string" ? rawOptions.report : undefined,
    fallbackToCache: typeof rawOptions.fallbackToCache === "boolean" ? rawOptions.fallbackToCache : undefined,
    offline: typeof rawOptions.offline === "boolean" ? rawOptions.offline : undefined,
  } satisfies AutomationPipelineRunOptions;
}

function buildCommand(): Command {
  const program = new Command();

  program
    .name("proxmox-openapi")
    .description("Generate Proxmox OpenAPI artifacts for Proxmox VE.")
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
      const result: AutomationPipelineResult = await runAutomationPipeline(pipelineOptions);

      if (pipelineOptions.summaryOutputPath) {
        console.log(`Summary written to ${pipelineOptions.summaryOutputPath}`);
      }

      const payloadDir = pipelineOptions.openApiOutputDir ?? "var/openapi";
      console.log(`OpenAPI artifacts available in ${payloadDir}`);
      console.log(`Cache usage: ${result.usedCache ? "reused cached snapshot" : "fresh scrape"}`);
    });

  return program;
}

export async function runCli(argv: readonly string[] = process.argv): Promise<void> {
  const command = buildCommand();
  await command.parseAsync(argv);
}

export function createCli(): CliContext {
  return { command: buildCommand() };
}
