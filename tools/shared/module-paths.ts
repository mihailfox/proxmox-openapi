import path from "node:path";
import { fileURLToPath } from "node:url";

function normalizeImportMeta(metaOrUrl: ImportMeta | string): string {
  if (typeof metaOrUrl === "string") {
    return metaOrUrl;
  }

  return metaOrUrl.url;
}

export function toModulePath(metaOrUrl: ImportMeta | string): string {
  return fileURLToPath(normalizeImportMeta(metaOrUrl));
}

export function toModuleDirname(metaOrUrl: ImportMeta | string): string {
  return path.dirname(toModulePath(metaOrUrl));
}

export function resolveFromModule(metaOrUrl: ImportMeta | string, ...segments: string[]): string {
  return path.join(toModuleDirname(metaOrUrl), ...segments);
}

export function isExecutedFromCli(meta: ImportMeta): boolean {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  return path.resolve(entryPoint) === toModulePath(meta);
}
