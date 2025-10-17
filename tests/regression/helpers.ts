import { access } from "node:fs/promises";
import { constants } from "node:fs";

import { runAutomationPipeline } from "@proxmox-openapi/automation";
import { OPENAPI_JSON_PATH, OPENAPI_YAML_PATH } from "@proxmox-openapi/shared/paths.ts";

let ensurePromise: Promise<void> | null = null;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureOpenApiArtifacts(): Promise<void> {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    const [jsonExists, yamlExists] = await Promise.all([fileExists(OPENAPI_JSON_PATH), fileExists(OPENAPI_YAML_PATH)]);

    if (jsonExists && yamlExists) {
      return;
    }

    await runAutomationPipeline({ mode: "ci" });
  })();

  await ensurePromise;
}
