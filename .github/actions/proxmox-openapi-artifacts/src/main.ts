import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { runAutomationPipeline, type AutomationPipelineRunOptions } from "@mihailfox/proxmox-openapi";

function coerceBoolean(input: string | undefined, defaultValue: boolean): boolean {
  if (!input) {
    return defaultValue;
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === "") {
    return defaultValue;
  }

  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  core.warning(`Boolean input value "${input}" is not recognized. Falling back to ${String(defaultValue)}.`);
  return defaultValue;
}

function optionalString(name: string): string | undefined {
  const value = core.getInput(name);
  return value.trim() === "" ? undefined : value;
}

async function ensureReportDirectory(reportPath: string): Promise<void> {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
}

async function run(): Promise<void> {
  try {
    const workingDirectoryInput = core.getInput("working-directory");
    const workingDirectory = workingDirectoryInput ? path.resolve(workingDirectoryInput) : process.cwd();

    const installCommand = core.getInput("install-command") || "npm ci";
    const shouldInstallPlaywright = coerceBoolean(core.getInput("install-playwright-browsers") || undefined, true);

    const nodeVersion = core.getInput("node-version");
    if (nodeVersion && nodeVersion.trim() !== "") {
      core.info(
        'Input "node-version" is managed by the workflow (e.g., actions/setup-node) and will be ignored by the action.'
      );
    }

    const reportPathInput = optionalString("report-path");
    const summaryPath =
      reportPathInput ?? path.join(await fs.mkdtemp(path.join(os.tmpdir(), "proxmox-action-")), "summary.json");
    if (reportPathInput) {
      await ensureReportDirectory(summaryPath);
    }

    if (installCommand.trim() !== "") {
      core.startGroup(`Installing dependencies with: ${installCommand}`);
      const installResult = await getExecOutput("bash", ["-c", installCommand], {
        cwd: workingDirectory,
        ignoreReturnCode: true,
      });
      if (installResult.exitCode !== 0) {
        core.error(installResult.stderr);
        throw new Error(`Dependency installation failed with exit code ${installResult.exitCode}.`);
      }
      core.info(installResult.stdout);
      core.endGroup();
    }

    if (shouldInstallPlaywright) {
      core.startGroup("Installing Playwright browsers");
      const playwrightResult = await getExecOutput("npx", ["playwright", "install", "--with-deps"], {
        cwd: workingDirectory,
        ignoreReturnCode: true,
      });
      if (playwrightResult.exitCode !== 0) {
        core.error(playwrightResult.stderr);
        throw new Error(`Playwright installation failed with exit code ${playwrightResult.exitCode}.`);
      }
      core.info(playwrightResult.stdout);
      core.endGroup();
    }

    const modeInput = optionalString("mode");
    const mode: AutomationPipelineRunOptions["mode"] = modeInput === "full" ? "full" : "ci";

    const pipelineOptions: AutomationPipelineRunOptions = {
      mode,
      baseUrl: optionalString("base-url"),
      rawSnapshotPath: optionalString("raw-snapshot-path"),
      irOutputPath: optionalString("ir-output-path"),
      openApiOutputDir: optionalString("openapi-dir"),
      openApiBasename: optionalString("openapi-basename"),
      fallbackToCache: coerceBoolean(core.getInput("fallback-to-cache") || undefined, true),
      offline: coerceBoolean(core.getInput("offline") || undefined, false),
      summaryOutputPath: summaryPath,
    };

    const extraArgs = optionalString("extra-cli-args");
    if (extraArgs) {
      core.warning("The `extra-cli-args` input is not supported in the TypeScript action and will be ignored.");
    }

    core.startGroup("Running automation pipeline");
    const result = await runAutomationPipeline(pipelineOptions, {
      logger: (message: string) => core.info(message),
    });
    core.endGroup();

    core.setOutput("raw-snapshot", result.rawSnapshotPath);
    core.setOutput("normalized-document", result.normalizedDocumentPath);
    core.setOutput("openapi-json", result.openApiJsonPath);
    core.setOutput("openapi-yaml", result.openApiYamlPath);
    core.setOutput("from-cache", result.usedCache ? "true" : "false");
    core.setOutput("summary-path", summaryPath);

    core.notice("Proxmox OpenAPI automation pipeline completed successfully.");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(`Unknown error: ${String(error)}`);
    }
  }
}

void run();
