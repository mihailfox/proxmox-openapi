import { test, expect } from "@playwright/test";

import { countEndpoints, fetchApiScript, parseApiSchema, toRawTree } from "../src/extractor.ts";
import type { RawApiTreeNode } from "../src/types.ts";
import { registerCodexMock } from "../src/codex-mock.ts";

test.describe("Proxmox API viewer smoke test", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const baseUrl = typeof testInfo.project.use.baseURL === "string" ? testInfo.project.use.baseURL : undefined;
    await registerCodexMock(page.context(), baseUrl);
  });

  test("loads documentation landing page", async ({ page }) => {
    await page.goto("./");
    await expect(page).toHaveTitle(/Proxmox VE API Documentation/);
    await page.waitForSelector(".x-tree-node-text", { state: "attached" });
    const resourceNodes = await page.locator(".x-tree-node-text").allTextContents();
    expect(resourceNodes.length).toBeGreaterThan(0);
  });
  test("parses raw schema payload and verifies key endpoints", async ({ page }) => {
    await page.goto("./", { waitUntil: "networkidle" });

    const scriptSource = await fetchApiScript(page);
    const schemaNodes = parseApiSchema(scriptSource);
    expect(schemaNodes.length).toBeGreaterThan(0);

    const tree = toRawTree(schemaNodes);
    expect(tree).toHaveLength(6);

    const endpointTotal = countEndpoints(tree);
    expect(endpointTotal).toBeGreaterThan(500);

    const nodesGroup = findNodeByPath(tree, "/nodes");
    expect(nodesGroup?.methods.some((method) => method.httpMethod === "GET")).toBe(true);

    const versionEndpoint = findNodeByPath(tree, "/version");
    expect(versionEndpoint?.methods.map((method) => method.httpMethod)).toEqual(["GET"]);
  });
});

function findNodeByPath(tree: RawApiTreeNode[], targetPath: string): RawApiTreeNode | undefined {
  for (const node of tree) {
    if (node.path === targetPath) {
      return node;
    }
    const childMatch = findNodeByPath(node.children, targetPath);
    if (childMatch) {
      return childMatch;
    }
  }
  return undefined;
}
