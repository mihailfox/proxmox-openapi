import { describe, expect, it } from "vitest";

import type { OpenAPIV3_1 } from "openapi-types";
import { generateOpenApiDocument } from "../../src/internal/openapi-generator/generator.ts";
import { createNormalizedSample } from "../fixtures/sample-snapshot.ts";

const ir = createNormalizedSample({ normalizedAt: "2025-10-30T00:00:00.000Z" });

function isParameterObject(
  value: OpenAPIV3_1.ParameterObject | OpenAPIV3_1.ReferenceObject
): value is OpenAPIV3_1.ParameterObject {
  return "in" in value;
}

function countOperations(document: ReturnType<typeof generateOpenApiDocument>): number {
  const methods = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

  return Object.values(document.paths ?? {}).reduce((total, pathItem) => {
    if (!pathItem) {
      return total;
    }

    return (
      total +
      methods.reduce((count, method) => {
        const operation = pathItem[method as keyof OpenAPIV3_1.PathItemObject];
        return operation ? count + 1 : count;
      }, 0)
    );
  }, 0);
}

describe("generateOpenApiDocument", () => {
  it("produces a document with expected metadata", () => {
    const document = generateOpenApiDocument(ir);

    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBe("Proxmox VE API");
    expect(document.info.version).toBe(ir.source.scrapedAt);
    expect(document.tags?.length).toBeGreaterThan(0);
  });

  it("groups tags by top-level category", () => {
    const document = generateOpenApiDocument(ir);
    const tagGroups = (document as unknown as Record<string, unknown>)["x-tagGroups"] as
      | Array<{ name: string; tags: string[] }>
      | undefined;

    expect(tagGroups).toBeDefined();
    const accessGroup = tagGroups?.find((group) => group.name === "Access Control");
    expect(accessGroup?.tags).toContain("access");

    const nodesGroup = tagGroups?.find((group) => group.name === "Nodes");
    expect(nodesGroup?.tags).toContain("nodes/storage");

    const storageTag = document.tags?.find((tag) => tag.name === "nodes/storage");
    expect(storageTag).toBeDefined();
    expect((storageTag as Record<string, unknown>)["x-displayName"]).toBe("Nodes › Storage");
  });

  it("includes every endpoint from the intermediate representation", () => {
    const document = generateOpenApiDocument(ir);
    const operationCount = countOperations(document);

    expect(operationCount).toBe(ir.summary.methodCount);
  });

  it("maps path parameters and omits redundant request bodies", () => {
    const document = generateOpenApiDocument(ir);
    const operation = document.paths?.["/access"]?.get;

    expect(operation).toBeDefined();
    expect(operation?.requestBody).toBeUndefined();

    const param = operation?.parameters?.find(
      (value): value is OpenAPIV3_1.ParameterObject =>
        isParameterObject(value) && value.in === "query" && value.name === "realm"
    );

    expect(param).toBeDefined();
    expect(param?.required).toBe(true);
  });

  it("represents query parameters for read operations", () => {
    const document = generateOpenApiDocument(ir);
    const operation = document.paths?.["/access"]?.get;

    expect(operation).toBeDefined();
    const queryParameters = operation?.parameters?.filter(isParameterObject) ?? [];
    expect(queryParameters).toEqual(expect.arrayContaining([expect.objectContaining({ name: "realm", in: "query" })]));
    expect(operation?.requestBody).toBeUndefined();
  });

  it("captures request bodies for write operations with authentication metadata", () => {
    const document = generateOpenApiDocument(ir);
    const operation = document.paths?.["/nodes/{node}/storage"]?.post;

    expect(operation).toBeDefined();
    expect(operation?.requestBody).toBeDefined();
    expect(operation?.requestBody && "content" in operation.requestBody).toBe(true);

    const schema =
      operation?.requestBody && "content" in operation.requestBody
        ? operation.requestBody.content?.["application/json"]?.schema
        : undefined;

    expect(schema).toBeDefined();
    expect(schema && "properties" in schema && schema.properties).toHaveProperty("storage");

    expect(operation?.security).toEqual(expect.arrayContaining([{ PVEAuthCookie: [] }]));
  });
});
