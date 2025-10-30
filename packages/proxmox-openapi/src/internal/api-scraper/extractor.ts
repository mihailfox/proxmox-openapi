import type { Page } from "playwright";

import type { ApiSchemaMethod, ApiSchemaNode, RawApiMethod, RawApiTreeNode } from "./types.ts";

const API_SCRIPT_REGEX = /const apiSchema = (\[.*?\])\s*;\s*let method2cmd/s;

export async function fetchApiScript(page: Page, scriptPath = "apidoc.js"): Promise<string> {
  return await page.evaluate(async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Unable to download ${path}: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  }, scriptPath);
}

export function parseApiSchema(scriptSource: string): ApiSchemaNode[] {
  const match = scriptSource.match(API_SCRIPT_REGEX);
  if (!match) {
    throw new Error("Unable to locate `apiSchema` payload inside apidoc.js");
  }
  return JSON.parse(match[1]) as ApiSchemaNode[];
}

export function toRawTree(nodes: ApiSchemaNode[]): RawApiTreeNode[] {
  const tree = nodes.map(normalizeNode);
  sortTree(tree);
  return tree;
}

function normalizeNode(node: ApiSchemaNode): RawApiTreeNode {
  return {
    path: node.path,
    text: node.text,
    methods: mapMethods(node.info),
    children: (node.children ?? []).map(normalizeNode),
  };
}

function mapMethods(info?: Record<string, ApiSchemaMethod>): RawApiMethod[] {
  if (!info) {
    return [];
  }
  const methods = Object.entries(info).map(([httpMethod, method]) => ({
    httpMethod,
    name: method.name,
    description: method.description,
    allowToken: method.allowtoken === 1,
    protected: method.protected === 1,
    permissions: method.permissions_any?.length ? method.permissions_any : method.permissions,
    parameters: method.parameters,
    returns: method.returns,
    proxy: method.proxy === 1,
    download: method.download === 1,
    upload: method.upload === 1,
    status: method.status,
  }));
  methods.sort((a, b) => a.httpMethod.localeCompare(b.httpMethod));
  return methods;
}

function sortTree(nodes: RawApiTreeNode[]): void {
  nodes.sort((a, b) => a.path.localeCompare(b.path));
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortTree(node.children);
    }
  }
}

export function countEndpoints(nodes: RawApiTreeNode[]): number {
  return nodes.reduce((total, node) => {
    const childrenCount = countEndpoints(node.children);
    const methodCount = node.methods.length;
    return total + childrenCount + methodCount;
  }, 0);
}
