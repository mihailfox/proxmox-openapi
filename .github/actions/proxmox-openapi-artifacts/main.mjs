#!/usr/bin/env node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as core from "@actions/core";
import { getExecOutput } from "@actions/exec";

function readInput(name) {
  const key = `INPUT_${name}`;
  const value = process.env[key];
  return typeof value === "string" ? value : undefined;
}

function optionalString(name) {
  const value = readInput(name);
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function coerceBoolean(name, defaultValue) {
  const value = optionalString(name);
  if (value === undefined) return defaultValue;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  core.warning(`Boolean input "${value}" for ${name} is not recognized. Falling back to ${String(defaultValue)}.`);
  return defaultValue;
}

async function ensureReportDirectory(reportPath) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
}

async function run() {
  try {
    const workspace = process.env.GITHUB_WORKSPACE ?? process.cwd();
    const workingDirectoryInput = optionalString("WORKING_DIRECTORY");
    const workingDirectory = workingDirectoryInput ? path.resolve(workspace, workingDirectoryInput) : workspace;

    const installCommandEnv = readInput("INSTALL_COMMAND");
    const installCommand = installCommandEnv === undefined ? "npm ci" : installCommandEnv;
    const shouldInstallPlaywright = coerceBoolean("INSTALL_PLAYWRIGHT_BROWSERS", true);

    const reportPathInput = optionalString("REPORT_PATH");
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
      if (installResult.stdout.trim() !== "") {
        core.info(installResult.stdout);
      }
      core.endGroup();
    }

    if (shouldInstallPlaywright) {
      const playwrightArgs =
        process.platform === "linux"
          ? ["playwright", "install", "chromium", "--with-deps"]
          : ["playwright", "install", "chromium"];
      core.startGroup("Installing Playwright browsers");
      const playwrightResult = await getExecOutput("npx", playwrightArgs, {
        cwd: workingDirectory,
        ignoreReturnCode: true,
      });
      if (playwrightResult.exitCode !== 0) {
        core.error(playwrightResult.stderr);
        throw new Error(`Playwright installation failed with exit code ${playwrightResult.exitCode}.`);
      }
      if (playwrightResult.stdout.trim() !== "") {
        core.info(playwrightResult.stdout);
      }
      core.endGroup();
    }

    const modeInput = optionalString("MODE");
    const mode = modeInput === "full" ? "full" : "ci";

    const pipelineOptions = {
      mode,
      baseUrl: optionalString("BASE_URL"),
      rawSnapshotPath: optionalString("RAW_SNAPSHOT_PATH"),
      irOutputPath: optionalString("IR_OUTPUT_PATH"),
      openApiOutputDir: optionalString("OPENAPI_DIR"),
      openApiBasename: optionalString("OPENAPI_BASENAME"),
      fallbackToCache: coerceBoolean("FALLBACK_TO_CACHE", true),
      offline: coerceBoolean("OFFLINE", false),
      summaryOutputPath: summaryPath,
    };

    const extraArgs = optionalString("EXTRA_CLI_ARGS");
    if (extraArgs) {
      core.warning("The `extra-cli-args` input is not supported and will be ignored.");
    }

    const nodeVersion = optionalString("NODE_VERSION");
    if (nodeVersion) {
      core.info(
        'Input "node-version" is managed by the workflow (e.g., actions/setup-node) and is ignored by the composite action.'
      );
    }

    const { runAutomationPipeline } = await loadCliModule(workingDirectory);

    core.startGroup("Running automation pipeline");
    const result = await runAutomationPipeline(pipelineOptions, {
      logger: (message) => core.info(message),
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

async function loadCliModule(workingDirectory) {
  try {
    return await import("@mihailfox/proxmox-openapi");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") {
      const localDist = path.resolve(workingDirectory, "packages/proxmox-openapi/dist/index.js");
      await ensureLocalCliBuild(localDist, workingDirectory);
      return import(pathToFileURL(localDist).href);
    }
    throw error;
  }
}

async function ensureLocalCliBuild(localDistPath, workingDirectory) {
  try {
    await fs.access(localDistPath);
    return;
  } catch {
    core.startGroup("Building local proxmox-openapi workspace");
    const buildResult = await getExecOutput("npm", ["run", "build", "--workspace", "packages/proxmox-openapi"], {
      cwd: workingDirectory,
      ignoreReturnCode: true,
    });
    if (buildResult.exitCode !== 0) {
      core.error(buildResult.stderr);
      throw new Error(`Building packages/proxmox-openapi failed with exit code ${buildResult.exitCode}.`);
    }
    if (buildResult.stdout.trim() !== "") {
      core.info(buildResult.stdout);
    }
    core.endGroup();
    await fs.access(localDistPath);
  }
}

await run();
