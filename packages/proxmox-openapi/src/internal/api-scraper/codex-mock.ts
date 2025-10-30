import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { BrowserContext } from "playwright";

import { RAW_SNAPSHOT_CACHE_PATH } from "../shared/paths.ts";
import { resolveFromModule } from "../shared/module-paths.ts";
import type { ApiSchemaMethod, ApiSchemaNode, RawApiMethod, RawApiTreeNode } from "./types.ts";

const moduleReference = typeof __dirname === "string" ? __dirname : (import.meta as ImportMeta | undefined);
const MOCK_ROOT = resolveFromModule(moduleReference ?? process.cwd(), "mocks");
const MOCK_INDEX_PATH = resolve(MOCK_ROOT, "index.html");
const MOCK_SNAPSHOT_PATH = RAW_SNAPSHOT_CACHE_PATH;

const MOCK_TARGET_PATTERN = /pve\.proxmox\.com\/pve-docs\/api-viewer/i;

interface MockAssets {
  html: string;
  script: string;
}

interface RawSnapshot {
  schema?: RawApiTreeNode[];
}

let cachedAssets: MockAssets | undefined;
let loadPromise: Promise<MockAssets> | undefined;
let cachedScript: string | undefined;
let scriptPromise: Promise<string> | undefined;

function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }
  return normalized.length > 0;
}

export function isCodexEnvironment(): boolean {
  return isTruthy(process.env.CODEX_ENV);
}

async function loadMockAssets(): Promise<MockAssets> {
  if (cachedAssets) {
    return cachedAssets;
  }
  if (!loadPromise) {
    loadPromise = Promise.all([readFile(MOCK_INDEX_PATH, "utf-8"), loadMockScript()]).then(([html, script]) => {
      cachedAssets = { html, script };
      return cachedAssets;
    });
  }
  return loadPromise;
}

function normalizeBasePath(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

async function loadMockScript(): Promise<string> {
  if (cachedScript) {
    return cachedScript;
  }
  if (!scriptPromise) {
    scriptPromise = readFile(MOCK_SNAPSHOT_PATH, "utf-8")
      .then((contents) => JSON.parse(contents) as RawSnapshot)
      .then((snapshot) => {
        const schemaNodes = Array.isArray(snapshot.schema) ? snapshot.schema : [];
        const apiSchema = schemaNodes.map(toApiSchemaNode);
        cachedScript = `const apiSchema = ${JSON.stringify(apiSchema)};\nlet method2cmd = {};\n`;
        return cachedScript;
      });
  }
  return scriptPromise;
}

function toApiSchemaNode(node: RawApiTreeNode): ApiSchemaNode {
  const infoEntries = node.methods.map((method) => [method.httpMethod, toApiSchemaMethod(method)]);
  const info = infoEntries.length > 0 ? Object.fromEntries(infoEntries) : undefined;
  const children = node.children.map(toApiSchemaNode);
  const schemaNode: ApiSchemaNode = {
    text: node.text,
    path: node.path,
  };

  if (info && Object.keys(info).length > 0) {
    schemaNode.info = info;
  }

  if (children.length > 0) {
    schemaNode.children = children;
  } else {
    schemaNode.leaf = 1;
  }

  return schemaNode;
}

function toApiSchemaMethod(method: RawApiMethod): ApiSchemaMethod {
  const schemaMethod: ApiSchemaMethod = {
    method: method.httpMethod,
  };

  if (method.name !== undefined) {
    schemaMethod.name = method.name;
  }
  if (method.description !== undefined) {
    schemaMethod.description = method.description;
  }
  if (method.allowToken) {
    schemaMethod.allowtoken = 1;
  }
  if (method.protected) {
    schemaMethod.protected = 1;
  }
  if (Array.isArray(method.permissions)) {
    if (method.permissions.length > 0) {
      schemaMethod.permissions_any = method.permissions;
    }
  } else if (method.permissions !== undefined) {
    schemaMethod.permissions = method.permissions;
  }
  if (method.parameters !== undefined) {
    schemaMethod.parameters = method.parameters;
  }
  if (method.returns !== undefined) {
    schemaMethod.returns = method.returns;
  }
  if (method.proxy) {
    schemaMethod.proxy = 1;
  }
  if (method.download) {
    schemaMethod.download = 1;
  }
  if (method.upload) {
    schemaMethod.upload = 1;
  }
  if (method.status !== undefined) {
    schemaMethod.status = method.status;
  }

  return schemaMethod;
}

export async function registerCodexMock(context: BrowserContext, baseUrl: string | undefined): Promise<boolean> {
  if (!isCodexEnvironment()) {
    return false;
  }

  if (!baseUrl || !MOCK_TARGET_PATTERN.test(baseUrl)) {
    return false;
  }

  let target: URL;
  try {
    target = new URL(baseUrl);
  } catch {
    return false;
  }

  const assets = await loadMockAssets();
  const basePath = normalizeBasePath(target.pathname);
  const basePathWithoutTrailingSlash = basePath.slice(0, -1);

  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    let url: URL;
    try {
      url = new URL(requestUrl);
    } catch {
      await route.continue();
      return;
    }

    if (url.origin !== target.origin) {
      await route.continue();
      return;
    }

    let relativePath: string | undefined;
    if (url.pathname === basePathWithoutTrailingSlash) {
      relativePath = "";
    } else if (url.pathname.startsWith(basePath)) {
      relativePath = url.pathname.slice(basePath.length);
    }

    if (relativePath === undefined) {
      await route.continue();
      return;
    }

    const normalizedRelative = relativePath.replace(/^\/+/, "");

    if (normalizedRelative === "" || normalizedRelative === "index.html") {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: assets.html,
      });
      return;
    }

    if (normalizedRelative === "apidoc.js") {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: assets.script,
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "Mock asset not found",
    });
  });

  return true;
}
