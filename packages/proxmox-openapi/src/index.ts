export {
  runAutomationPipeline,
  resolveAutomationPipelineOptions,
} from "@proxmox-openapi/automation";

export type {
  AutomationPipelineResult,
  AutomationPipelineRunOptions,
} from "@proxmox-openapi/automation";

export { createCli, runCli } from "./run-cli.js";
