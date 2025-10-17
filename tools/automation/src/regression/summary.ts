import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { OpenAPIV3_1 } from "openapi-types";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { RawApiSnapshot } from "@proxmox-openapi/api-scraper/types.ts";
import type { NormalizedApiDocument } from "@proxmox-openapi/api-normalizer/types.ts";
import { ARTIFACT_BASELINES, type ArtifactBaseline } from "./baselines.ts";
import { generateOpenApiDocument } from "@proxmox-openapi/openapi-generator/generator.ts";

export interface ArtifactState {
  baseline: ArtifactBaseline;
  actualSha256: string;
  matches: boolean;
  byteLength: number;
}

export interface RegressionParity {
  jsonMatchesYaml: boolean;
  methodCountMatches: boolean;
}

export interface RegressionSummary {
  artifacts: ArtifactState[];
  snapshotStats: RawApiSnapshot["stats"];
  normalizedSummary: NormalizedApiDocument["summary"];
  openApiOperationCount: number;
  tagCount: number;
  parity: RegressionParity;
}

export function computeRegressionSummary(): RegressionSummary {
  const artifacts = ARTIFACT_BASELINES.map((baseline) => computeArtifactState(baseline));
  const rawSnapshot = readRawSnapshot();
  const normalized = readNormalizedDocument();
  const openApiJson = generateOpenApiDocument(normalized);
  const openApiYaml = parseYaml(stringifyYaml(openApiJson)) as OpenAPIV3_1.Document;

  const operationCount = countOperations(openApiJson);
  const yamlOperationCount = countOperations(openApiYaml);

  return {
    artifacts,
    snapshotStats: rawSnapshot.stats,
    normalizedSummary: normalized.summary,
    openApiOperationCount: operationCount,
    tagCount: openApiJson.tags?.length ?? 0,
    parity: {
      jsonMatchesYaml: deepEquals(openApiJson, openApiYaml),
      methodCountMatches: operationCount === normalized.summary.methodCount && operationCount === yamlOperationCount,
    },
  };
}

export function computeArtifactState(baseline: ArtifactBaseline): ArtifactState {
  const payload = readFileSync(baseline.path);
  const hash = createHash("sha256").update(payload).digest("hex");
  return {
    baseline,
    actualSha256: hash,
    matches: hash === baseline.sha256,
    byteLength: payload.byteLength,
  };
}

function readRawSnapshot(): RawApiSnapshot {
  const payload = readFileSync(resolveBaselinePath("raw-snapshot"), "utf8");
  return JSON.parse(payload) as RawApiSnapshot;
}

function readNormalizedDocument(): NormalizedApiDocument {
  const payload = readFileSync(resolveBaselinePath("normalized-ir"), "utf8");
  return JSON.parse(payload) as NormalizedApiDocument;
}

function resolveBaselinePath(id: ArtifactBaseline["id"]): string {
  const baseline = ARTIFACT_BASELINES.find((artifact) => artifact.id === id);
  if (!baseline) {
    throw new Error(`Unknown artifact baseline: ${id}`);
  }
  return baseline.path;
}

function countOperations(document: OpenAPIV3_1.Document): number {
  const methodNames = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
  const methodSet = new Set<string>(methodNames);

  return Object.values(document.paths ?? {}).reduce<number>((total, pathItem) => {
    if (!pathItem) {
      return total;
    }

    const methodCount = Object.entries(pathItem).reduce<number>((count, [key, value]) => {
      if (!methodSet.has(key) || !value) {
        return count;
      }
      return count + 1;
    }, 0);

    return total + methodCount;
  }, 0);
}

function deepEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
