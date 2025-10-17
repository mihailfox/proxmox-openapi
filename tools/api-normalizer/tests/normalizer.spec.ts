import { describe, expect, it } from "vitest";

import rawSnapshot from "../../api-scraper/data/raw/proxmox-openapi-schema.json" with { type: "json" };
import type { RawApiSnapshot } from "@proxmox-openapi/api-scraper/types.ts";
import { normalizeSnapshot } from "../src/normalizer.ts";
import type { NormalizedGroup } from "../src/types.ts";

const snapshot = rawSnapshot as unknown as RawApiSnapshot;

describe("normalizeSnapshot", () => {
  it("produces a document with metadata and summary", () => {
    const normalized = normalizeSnapshot(snapshot, {
      normalizedAt: "2025-09-30T00:00:00.000Z",
      checksum: "test-checksum",
    });

    expect(normalized.irVersion).toBe("1.0.0");
    expect(normalized.normalizedAt).toBe("2025-09-30T00:00:00.000Z");
    expect(normalized.source.snapshotChecksum).toBe("test-checksum");
    expect(normalized.summary.endpointCount).toBe(normalized.source.rawStats.endpointCount);
    expect(normalized.summary.groupCount).toBeGreaterThan(0);
    expect(normalized.summary.methodCount).toBeGreaterThan(0);
  });

  it("normalizes endpoints with security and schema information", () => {
    const normalized = normalizeSnapshot(snapshot, {
      normalizedAt: "2025-09-30T00:00:00.000Z",
      checksum: "test-checksum",
    });

    const accessGroup = findGroupByPath(normalized.groups, "/access");
    expect(accessGroup).toBeDefined();
    if (!accessGroup) {
      throw new Error("Expected access group to be available.");
    }

    const indexEndpoint = accessGroup.endpoints.find((endpoint) => endpoint.httpMethod === "GET");
    expect(indexEndpoint).toBeDefined();
    if (!indexEndpoint) {
      throw new Error("Expected GET /access endpoint to exist.");
    }
    expect(indexEndpoint.operationId).toBe("get-access");
    expect(indexEndpoint.security.allowToken).toBe(true);
    expect(indexEndpoint.security.requiresAuthentication).toBe(false);
    expect(indexEndpoint.security.permissions?.all?.[0]?.user).toBe("all");

    expect(indexEndpoint.request?.schema.additionalProperties).toBe(false);
    expect(indexEndpoint.responses).toHaveLength(1);
    const [response] = indexEndpoint.responses;
    expect(response.schema?.items).toBeDefined();
    expect(response.schema?.metadata?.links).toBeDefined();
  });

  it("creates consistent slugs for nested groups", () => {
    const normalized = normalizeSnapshot(snapshot, {
      normalizedAt: "2025-09-30T00:00:00.000Z",
      checksum: "test-checksum",
    });

    const nodesGroup = findGroupByPath(normalized.groups, "/nodes");
    expect(nodesGroup?.slug).toBe("nodes");

    const storageGroup = findGroupByPath(normalized.groups, "/nodes/{node}/storage");
    expect(storageGroup?.slug).toBe("nodes-node-storage");
  });
});

function findGroupByPath(groups: NormalizedGroup[], path: string): NormalizedGroup | undefined {
  for (const group of groups) {
    if (group.path === path) {
      return group;
    }
    const child = findGroupByPath(group.children, path);
    if (child) {
      return child;
    }
  }
  return undefined;
}
