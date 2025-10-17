import process from "node:process";
import { parseArgs } from "node:util";

import { runAutomationPipeline, type AutomationPipelineRunOptions } from "./pipeline.ts";
import { normalizeBooleanFlagArguments } from "./cli-arg-utils.ts";

function parseCliOptions(argv: readonly string[] = process.argv.slice(2)): AutomationPipelineRunOptions {
  const { argv: sanitizedArgv, value: fallbackValue } = normalizeBooleanFlagArguments(argv, "fallback-to-cache");
  const { values } = parseArgs({
    args: Array.from(sanitizedArgv),
    options: {
      mode: { type: "string", short: "m" },
      offline: { type: "boolean" },
      "base-url": { type: "string" },
      "raw-output": { type: "string" },
      "ir-output": { type: "string" },
      "openapi-dir": { type: "string" },
      basename: { type: "string", short: "b" },
      report: { type: "string" },
    },
    allowPositionals: false,
  });

  return {
    mode: values.mode === "full" ? "full" : "ci",
    offline: typeof values.offline === "boolean" ? values.offline : undefined,
    fallbackToCache: fallbackValue,
    baseUrl: values["base-url"],
    rawSnapshotPath: values["raw-output"],
    irOutputPath: values["ir-output"],
    openApiOutputDir: values["openapi-dir"],
    openApiBasename: values.basename,
    summaryOutputPath: values.report,
  } satisfies AutomationPipelineRunOptions;
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  await runAutomationPipeline(options);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

export { parseCliOptions };
