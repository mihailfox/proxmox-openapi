import path from "node:path";
import process from "node:process";

import { toModuleDirname } from "./module-paths.ts";

let moduleDirname: string | undefined;

try {
  const moduleUrl = new Function("return import.meta.url")() as string | undefined;
  if (typeof moduleUrl === "string") {
    moduleDirname = toModuleDirname(moduleUrl);
  }
} catch {
  moduleDirname = undefined;
}

const workspaceRoot = process.env.GITHUB_WORKSPACE ?? process.cwd();

export const REPO_ROOT = moduleDirname !== undefined ? path.resolve(moduleDirname, "..", "..") : workspaceRoot;

export const VAR_DIR = path.join(REPO_ROOT, "var");
export const OPENAPI_ARTIFACT_DIR = path.join(VAR_DIR, "openapi");
export const OPENAPI_BASENAME = "proxmox-ve";
export const OPENAPI_JSON_PATH = path.join(OPENAPI_ARTIFACT_DIR, `${OPENAPI_BASENAME}.json`);
export const OPENAPI_YAML_PATH = path.join(OPENAPI_ARTIFACT_DIR, `${OPENAPI_BASENAME}.yaml`);

export function resolveFromRoot(relativePath: string): string {
  return path.join(REPO_ROOT, relativePath);
}

export function relativeToRoot(targetPath: string): string {
  return path.relative(REPO_ROOT, targetPath);
}
