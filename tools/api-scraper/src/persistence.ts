import { promises as fs } from "node:fs";
import path from "node:path";

import type { RawApiSnapshot } from "./types.ts";

export interface PersistOptions {
  outputDir: string;
  fileName?: string;
}

export async function persistSnapshot(snapshot: RawApiSnapshot, options: PersistOptions): Promise<string> {
  const { outputDir, fileName = "proxmox-openapi-schema.json" } = options;
  const resolvedDir = path.resolve(outputDir);
  await fs.mkdir(resolvedDir, { recursive: true });
  const filePath = path.join(resolvedDir, fileName);
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
  await fs.writeFile(filePath, serialized, "utf8");
  return filePath;
}
