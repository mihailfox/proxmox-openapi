export {
  DEFAULT_BASE_URL,
  scrapeApiDocumentation,
} from "./internal/api-scraper/scraper.ts";
export { persistSnapshot } from "./internal/api-scraper/persistence.ts";
export type { RawApiSnapshot } from "./internal/api-scraper/types.ts";
export type { ScrapeOptions } from "./internal/api-scraper/scraper.ts";

export { normalizeSnapshot } from "./internal/api-normalizer/normalizer.ts";
export type { NormalizeSnapshotOptions } from "./internal/api-normalizer/normalizer.ts";
export type { NormalizedApiDocument } from "./internal/api-normalizer/types.ts";

export { generateOpenApiDocument } from "./internal/openapi-generator/generator.ts";
export type { GenerateOpenApiOptions } from "./internal/openapi-generator/generator.ts";

export {
  runAutomationPipeline,
  resolveAutomationPipelineOptions,
} from "./internal/automation/pipeline.ts";
export type {
  AutomationPipelineResult,
  AutomationPipelineRunOptions,
} from "./internal/automation/pipeline.ts";

export { createCli, runCli } from "./run-cli.js";

export {
  OPENAPI_ARTIFACT_DIR,
  OPENAPI_BASENAME,
  OPENAPI_JSON_PATH,
  OPENAPI_YAML_PATH,
  DATA_DIR,
  RAW_SNAPSHOT_CACHE_PATH,
  NORMALIZED_IR_CACHE_PATH,
  resolveFromRoot,
  relativeToRoot,
} from "./internal/shared/paths.ts";
