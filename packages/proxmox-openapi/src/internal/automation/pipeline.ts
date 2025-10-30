import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import SwaggerParser from "@apidevtools/swagger-parser";
import { stringify as stringifyYaml } from "yaml";

import { DEFAULT_BASE_URL, scrapeApiDocumentation } from "../api-scraper/scraper.ts";
import type { RawApiSnapshot } from "../api-scraper/types.ts";
import { normalizeSnapshot } from "../api-normalizer/normalizer.ts";
import type { NormalizedApiDocument } from "../api-normalizer/types.ts";
import { generateOpenApiDocument } from "../openapi-generator/generator.ts";
import { logRegressionReport } from "./regression/report.ts";
import {
  NORMALIZED_IR_CACHE_PATH,
  OPENAPI_ARTIFACT_DIR,
  OPENAPI_BASENAME,
  RAW_SNAPSHOT_CACHE_PATH,
} from "../shared/paths.ts";

export interface AutomationPipelineRunOptions {
  mode?: "ci" | "full";
  baseUrl?: string;
  rawSnapshotPath?: string;
  irOutputPath?: string;
  openApiOutputDir?: string;
  openApiBasename?: string;
  offline?: boolean;
  fallbackToCache?: boolean;
  summaryOutputPath?: string;
}

interface PipelineOptions {
  mode: "ci" | "full";
  baseUrl: string;
  rawSnapshotPath: string;
  irOutputPath: string;
  openApiOutputDir: string;
  openApiBasename: string;
  offline: boolean;
  fallbackToCache: boolean;
  summaryOutputPath?: string;
}

interface ScrapeOutcome {
  snapshot: RawApiSnapshot;
  sourcePath?: string;
  fromCache: boolean;
}

export interface AutomationPipelineResult {
  rawSnapshotPath: string;
  normalizedDocumentPath: string;
  openApiJsonPath: string;
  openApiYamlPath: string;
  usedCache: boolean;
}

interface PipelineRuntimeContext {
  logger?: (message: string) => void;
}

export function resolveAutomationPipelineOptions(options: AutomationPipelineRunOptions = {}): PipelineOptions {
  const mode = options.mode === "full" ? "full" : "ci";
  const rawSnapshotPath = path.resolve(options.rawSnapshotPath ?? RAW_SNAPSHOT_CACHE_PATH);
  const irOutputPath = path.resolve(options.irOutputPath ?? NORMALIZED_IR_CACHE_PATH);
  const openApiOutputDir = path.resolve(options.openApiOutputDir ?? OPENAPI_ARTIFACT_DIR);
  const openApiBasename = options.openApiBasename ?? OPENAPI_BASENAME;

  const offline = mode === "ci" ? true : options.offline === undefined ? false : options.offline;

  const fallbackToCache =
    mode === "ci" ? true : options.fallbackToCache === undefined ? false : options.fallbackToCache;

  return {
    mode,
    baseUrl: options.baseUrl ?? process.env.SCRAPER_BASE_URL ?? DEFAULT_BASE_URL,
    rawSnapshotPath,
    irOutputPath,
    openApiOutputDir,
    openApiBasename,
    offline,
    fallbackToCache,
    summaryOutputPath: options.summaryOutputPath ? path.resolve(options.summaryOutputPath) : undefined,
  };
}

export async function runAutomationPipeline(
  options: AutomationPipelineRunOptions = {},
  context: PipelineRuntimeContext = {}
): Promise<AutomationPipelineResult> {
  const logger = context.logger ?? defaultLogger;
  const resolved = resolveAutomationPipelineOptions(options);

  logHeading(logger, "Starting automation pipeline");

  const scrapeOutcome = await obtainRawSnapshot(resolved, logger);
  if (scrapeOutcome.sourcePath) {
    logger(`Raw snapshot source: ${relative(scrapeOutcome.sourcePath)}`);
  }
  logger(`Snapshot ready (${scrapeOutcome.fromCache ? "cache" : "fresh scrape"})`);

  const normalized = await buildNormalizedDocument(
    scrapeOutcome.snapshot,
    resolved.irOutputPath,
    scrapeOutcome.fromCache
  );
  logger(`Normalized IR written to ${relative(resolved.irOutputPath)}`);

  const documentPaths = await writeOpenApiDocuments(normalized, resolved);
  logger(`OpenAPI artifacts updated:\n- ${relative(documentPaths.json)}\n- ${relative(documentPaths.yaml)}`);

  await SwaggerParser.validate(documentPaths.json);
  logger(`Validated OpenAPI document ${relative(documentPaths.json)}`);

  logRegressionReport();

  const summary: AutomationPipelineResult = {
    rawSnapshotPath: resolved.rawSnapshotPath,
    normalizedDocumentPath: resolved.irOutputPath,
    openApiJsonPath: documentPaths.json,
    openApiYamlPath: documentPaths.yaml,
    usedCache: scrapeOutcome.fromCache,
  };

  if (resolved.summaryOutputPath) {
    await writeSummary(resolved.summaryOutputPath, summary);
    logger(`Pipeline summary written to ${relative(resolved.summaryOutputPath)}`);
  }

  logHeading(logger, "Pipeline complete");

  return summary;
}

async function obtainRawSnapshot(options: PipelineOptions, logger: (message: string) => void): Promise<ScrapeOutcome> {
  const { rawSnapshotPath, baseUrl, offline, fallbackToCache } = options;

  if (offline) {
    const snapshot = await readSnapshot(rawSnapshotPath);
    return { snapshot, sourcePath: rawSnapshotPath, fromCache: true };
  }

  await fs.mkdir(path.dirname(rawSnapshotPath), { recursive: true });

  try {
    logger(`Scraping API viewer at ${baseUrl}`);
    const result = await scrapeApiDocumentation({
      baseUrl,
      persist: {
        outputDir: path.dirname(rawSnapshotPath),
        fileName: path.basename(rawSnapshotPath),
      },
    });
    return {
      snapshot: result.snapshot,
      sourcePath: result.filePath,
      fromCache: false,
    };
  } catch (error) {
    if (!fallbackToCache) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Scrape failed (${message}). Falling back to cached snapshot.`);

    const snapshot = await readSnapshot(rawSnapshotPath);
    return { snapshot, sourcePath: rawSnapshotPath, fromCache: true };
  }
}

async function readSnapshot(filePath: string): Promise<RawApiSnapshot> {
  try {
    const payload = await fs.readFile(filePath, "utf8");
    return JSON.parse(payload) as RawApiSnapshot;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read cached snapshot at ${relative(filePath)}: ${message}`);
  }
}

async function buildNormalizedDocument(
  snapshot: RawApiSnapshot,
  outputPath: string,
  reuseExistingMetadata: boolean
): Promise<NormalizedApiDocument> {
  const previous = reuseExistingMetadata ? await readNormalizedDocument(outputPath) : undefined;
  const normalized = normalizeSnapshot(snapshot, {
    normalizedAt: previous?.normalizedAt,
    checksum: previous?.source.snapshotChecksum,
  });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}

async function readNormalizedDocument(filePath: string): Promise<NormalizedApiDocument | undefined> {
  try {
    const payload = await fs.readFile(filePath, "utf8");
    return JSON.parse(payload) as NormalizedApiDocument;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read normalized document at ${relative(filePath)}: ${message}`);
  }
}

async function writeOpenApiDocuments(
  normalized: NormalizedApiDocument,
  options: PipelineOptions
): Promise<{ json: string; yaml: string }> {
  const document = generateOpenApiDocument(normalized);
  const jsonPath = path.join(options.openApiOutputDir, `${options.openApiBasename}.json`);
  const yamlPath = path.join(options.openApiOutputDir, `${options.openApiBasename}.yaml`);

  await fs.mkdir(options.openApiOutputDir, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await fs.writeFile(yamlPath, `${stringifyYaml(document)}\n`, "utf8");

  return { json: jsonPath, yaml: yamlPath };
}

function defaultLogger(message: string): void {
  process.stdout.write(`${message}\n`);
}

function logHeading(logger: (message: string) => void, message: string): void {
  logger(`\n=== ${message} ===`);
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath) || ".";
}

async function writeSummary(filePath: string, summary: AutomationPipelineResult): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}
