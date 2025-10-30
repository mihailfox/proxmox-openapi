export {
  DEFAULT_BASE_URL,
  scrapeApiDocumentation,
} from "@proxmox-openapi/api-scraper/scraper.ts";
export { persistSnapshot } from "@proxmox-openapi/api-scraper/persistence.ts";
export type { RawApiSnapshot } from "@proxmox-openapi/api-scraper/types.ts";
export type { ScrapeOptions } from "@proxmox-openapi/api-scraper/scraper.ts";

export { normalizeSnapshot } from "@proxmox-openapi/api-normalizer/normalizer.ts";
export type { NormalizeSnapshotOptions } from "@proxmox-openapi/api-normalizer/normalizer.ts";
export type { NormalizedApiDocument } from "@proxmox-openapi/api-normalizer/types.ts";

export { generateOpenApiDocument } from "@proxmox-openapi/openapi-generator/generator.ts";
export type { GenerateOpenApiOptions } from "@proxmox-openapi/openapi-generator/generator.ts";

export {
  runAutomationPipeline,
  resolveAutomationPipelineOptions,
} from "@proxmox-openapi/automation";
export type {
  AutomationPipelineResult,
  AutomationPipelineRunOptions,
} from "@proxmox-openapi/automation";

export { createCli, runCli } from "./run-cli.js";
