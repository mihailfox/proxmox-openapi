import { createHash } from "node:crypto";

import type {
  ApiSchemaParameters,
  ApiSchemaPermission,
  ApiSchemaProperty,
  ApiSchemaReturn,
  RawApiMethod,
  RawApiSnapshot,
  RawApiTreeNode,
} from "@proxmox-openapi/api-scraper/types.ts";
import {
  IR_VERSION,
  type HttpMethod,
  type NormalizedApiDocument,
  type NormalizedConstraints,
  type NormalizedEndpoint,
  type NormalizedFeatureFlags,
  type NormalizedGroup,
  type NormalizedPermission,
  type NormalizedPermissionSet,
  type NormalizedRequest,
  type NormalizedResponse,
  type NormalizedSchema,
  type NormalizedSecurity,
} from "./types.ts";

const HTTP_METHOD_WHITELIST = new Set<HttpMethod>([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
  "HEAD",
  "TRACE",
]);

export interface NormalizeSnapshotOptions {
  normalizedAt?: string;
  checksum?: string;
}

type SchemaInput = ApiSchemaParameters | ApiSchemaProperty | ApiSchemaReturn;

type AdditionalProperties = boolean | number | ApiSchemaProperty | ApiSchemaParameters;

export function normalizeSnapshot(
  snapshot: RawApiSnapshot,
  options: NormalizeSnapshotOptions = {}
): NormalizedApiDocument {
  const groups = snapshot.schema.map((node) => normalizeGroup(node));
  const summary = summarize(groups);
  const checksum = options.checksum ?? hashSnapshot(snapshot);

  return {
    irVersion: IR_VERSION,
    normalizedAt: options.normalizedAt ?? new Date().toISOString(),
    source: {
      snapshotChecksum: checksum,
      scrapedAt: snapshot.scrapedAt,
      sourceUrl: snapshot.sourceUrl,
      documentTitle: snapshot.documentTitle,
      rawStats: snapshot.stats,
    },
    summary: {
      groupCount: summary.groupCount,
      endpointCount: snapshot.stats.endpointCount,
      methodCount: summary.methodCount,
    },
    groups,
  };
}

function normalizeGroup(node: RawApiTreeNode): NormalizedGroup {
  const slug = toSlug(node.path);
  return {
    id: slug,
    path: node.path,
    slug,
    label: node.text,
    endpoints: node.methods.map((method) => normalizeEndpoint(node.path, method)),
    children: node.children.map((child) => normalizeGroup(child)),
  };
}

function normalizeEndpoint(path: string, method: RawApiMethod): NormalizedEndpoint {
  const httpMethod = toHttpMethod(method.httpMethod);
  const operationId = buildOperationId(httpMethod, path);
  const request = normalizeRequest(method.parameters);
  const responses = normalizeResponses(method.returns);

  return {
    id: operationId,
    operationId,
    path,
    httpMethod,
    name: method.name,
    description: method.description,
    status: method.status,
    security: normalizeSecurity(method),
    features: normalizeFeatures(method),
    request,
    responses,
  };
}

function normalizeSecurity(method: RawApiMethod): NormalizedSecurity {
  const permissions = normalizePermissions(method.permissions);
  return {
    allowToken: Boolean(method.allowToken),
    requiresAuthentication: Boolean(method.protected),
    permissions: permissions ?? undefined,
  };
}

function normalizeFeatures(method: RawApiMethod): NormalizedFeatureFlags {
  return {
    proxy: Boolean(method.proxy),
    download: Boolean(method.download),
    upload: Boolean(method.upload),
  };
}

function normalizePermissions(permissions: RawApiMethod["permissions"]): NormalizedPermissionSet | undefined {
  if (!permissions) {
    return undefined;
  }

  if (Array.isArray(permissions)) {
    const any = permissions.map(normalizePermission).filter(Boolean) as NormalizedPermission[];
    if (any.length === 0) {
      return undefined;
    }
    return { any };
  }

  const normalized = normalizePermission(permissions);
  return normalized ? { all: [normalized] } : undefined;
}

function normalizePermission(permission: ApiSchemaPermission | undefined): NormalizedPermission | undefined {
  if (!permission) {
    return undefined;
  }
  const normalized: NormalizedPermission = {};
  if (permission.description) {
    normalized.description = permission.description;
  }
  if (permission.user) {
    normalized.user = permission.user;
  }
  if (permission.check !== undefined) {
    normalized.check = permission.check;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRequest(parameters: ApiSchemaParameters | undefined): NormalizedRequest | undefined {
  const schema = normalizeSchema(parameters);
  if (!schema) {
    return undefined;
  }
  const description = parameters?.description;
  return {
    description: description?.trim() ? description : undefined,
    schema,
  };
}

function normalizeResponses(returns: ApiSchemaReturn | undefined): NormalizedResponse[] {
  const schema = normalizeSchema(returns);
  const description = returns?.description?.trim() ? returns.description : undefined;
  if (!schema && !description) {
    return [];
  }
  return [
    {
      description,
      schema: schema ?? undefined,
    },
  ];
}

function normalizeSchema(input: SchemaInput | undefined): NormalizedSchema | undefined {
  if (!input) {
    return undefined;
  }

  const schema: NormalizedSchema = {};

  if ("type" in input && input.type) {
    schema.type = input.type;
  }
  if ("typetext" in input && input.typetext) {
    schema.typetext = input.typetext;
  }
  if ("description" in input && input.description) {
    schema.description = input.description;
  }
  if ("verbose_description" in input && input.verbose_description) {
    schema.verboseDescription = input.verbose_description;
  }

  if ("optional" in input && input.optional !== undefined) {
    schema.optional = Boolean(input.optional);
  }
  if ("default" in input && input.default !== undefined) {
    schema.defaultValue = input.default;
  }
  if ("enum" in input && input.enum) {
    schema.enum = [...input.enum];
  }

  const constraints = extractConstraints(input);
  if (constraints) {
    schema.constraints = constraints;
  }

  if ("properties" in input && input.properties) {
    const properties: Record<string, NormalizedSchema> = {};
    for (const [key, value] of Object.entries(input.properties)) {
      const child = normalizeSchema(value);
      if (child) {
        properties[key] = child;
      }
    }
    if (Object.keys(properties).length > 0) {
      schema.properties = properties;
    }
  }

  if ("items" in input && input.items) {
    const items = normalizeSchema(input.items as SchemaInput);
    if (items) {
      schema.items = items;
    }
  }

  if ("additionalProperties" in input && input.additionalProperties !== undefined) {
    schema.additionalProperties = normalizeAdditionalProperties(input.additionalProperties);
  }

  const metadata = extractMetadata(input);
  if (metadata && Object.keys(metadata).length > 0) {
    schema.metadata = metadata;
  }

  return Object.keys(schema).length > 0 ? schema : undefined;
}

function normalizeAdditionalProperties(
  additional: AdditionalProperties | undefined
): boolean | NormalizedSchema | undefined {
  if (additional === undefined) {
    return undefined;
  }
  if (typeof additional === "boolean") {
    return additional;
  }
  if (typeof additional === "number") {
    return Boolean(additional);
  }
  const schema = normalizeSchema(additional as SchemaInput);
  return schema ?? undefined;
}

function extractConstraints(input: SchemaInput): NormalizedConstraints | undefined {
  const constraints: NormalizedConstraints = {};
  if ("minimum" in input && typeof input.minimum === "number") {
    constraints.minimum = input.minimum;
  }
  if ("maximum" in input && typeof input.maximum === "number") {
    constraints.maximum = input.maximum;
  }
  if ("minLength" in input && typeof input.minLength === "number") {
    constraints.minLength = input.minLength;
  }
  if ("maxLength" in input && typeof input.maxLength === "number") {
    constraints.maxLength = input.maxLength;
  }
  if ("pattern" in input && typeof input.pattern === "string") {
    constraints.pattern = input.pattern;
  }
  if ("format" in input && typeof input.format === "string") {
    constraints.format = input.format;
  }
  if ("format_description" in input && typeof input.format_description === "string") {
    constraints.formatDescription = input.format_description;
  }
  if ("requires" in input && input.requires) {
    const requires = Array.isArray(input.requires) ? input.requires : [input.requires];
    constraints.requires = requires.map((item) => String(item));
  }

  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

function extractMetadata(input: SchemaInput): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};
  if ("title" in input && input.title) {
    metadata.title = input.title;
  }
  if ("renderer" in input && input.renderer) {
    metadata.renderer = input.renderer;
  }
  if ("alias" in input && input.alias) {
    metadata.alias = input.alias;
  }
  if ("subdir" in input && input.subdir) {
    metadata.subdir = input.subdir;
  }
  if ("default_key" in input && input.default_key !== undefined) {
    metadata.defaultKey = input.default_key;
  }
  if ("disallow" in input && input.disallow) {
    metadata.disallow = input.disallow;
  }
  if ("extends" in input && input.extends !== undefined) {
    metadata.extends = input.extends;
  }
  if ("links" in input && input.links !== undefined) {
    metadata.links = input.links;
  }
  if ("instance-types" in input && input["instance-types"] !== undefined) {
    metadata.instanceTypes = input["instance-types"];
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function hashSnapshot(snapshot: RawApiSnapshot): string {
  const serialized = JSON.stringify(snapshot);
  return createHash("sha256").update(serialized).digest("hex");
}

function summarize(groups: NormalizedGroup[]): { groupCount: number; methodCount: number } {
  let groupCount = 0;
  let methodCount = 0;

  const stack = [...groups];
  while (stack.length > 0) {
    const group = stack.pop();
    if (!group) {
      continue;
    }
    groupCount += 1;
    methodCount += group.endpoints.length;
    stack.push(...group.children);
  }

  return { groupCount, methodCount };
}

function toHttpMethod(method: string): HttpMethod {
  const upper = method.toUpperCase() as HttpMethod;
  return HTTP_METHOD_WHITELIST.has(upper) ? upper : "UNKNOWN";
}

function toSlug(path: string): string {
  if (!path) {
    return "root";
  }
  const normalized = path.replace(/^\/+/, "");
  const slug = normalized
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "root";
}

function buildOperationId(method: HttpMethod, path: string): string {
  const slug = toSlug(path);
  return `${method.toLowerCase()}-${slug}`;
}
