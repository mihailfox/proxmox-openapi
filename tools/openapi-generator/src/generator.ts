import type {
  NormalizedApiDocument,
  NormalizedEndpoint,
  NormalizedGroup,
  NormalizedSchema,
} from "@proxmox-openapi/api-normalizer/types.ts";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

type Document = OpenAPIV3_1.Document;
type Operation = OpenAPIV3_1.OperationObject;
type Parameter = OpenAPIV3_1.ParameterObject;
type SchemaObject = OpenAPIV3_1.SchemaObject;
type MediaTypeObject = OpenAPIV3_1.MediaTypeObject;
type SecurityRequirement = OpenAPIV3_1.SecurityRequirementObject;

interface TagInfo {
  name: string;
  group: string;
  segments: string[];
}

interface EndpointContext {
  endpoint: NormalizedEndpoint;
  tag: TagInfo;
}

interface TagMetadata {
  info: TagInfo;
  displayName: string;
  description: string;
}

const PRIMARY_TAG_GROUP_ORDER = ["access", "cluster", "nodes", "storage", "pools", "version"];

const SEGMENT_DISPLAY_OVERRIDES = new Map<string, string>([
  ["acl", "ACL"],
  ["access", "Access Control"],
  ["acme", "ACME"],
  ["apt", "APT"],
  ["backup", "Backup"],
  ["backup-info", "Backup Info"],
  ["ceph", "Ceph"],
  ["cluster", "Cluster"],
  ["config", "Configuration"],
  ["dns", "DNS"],
  ["ha", "High Availability"],
  ["lxc", "Containers (LXC)"],
  ["mapping", "Mappings"],
  ["metrics", "Metrics"],
  ["network", "Network"],
  ["nodes", "Nodes"],
  ["notifications", "Notifications"],
  ["openid", "OpenID Connect"],
  ["nextid", "Next ID"],
  ["pools", "Resource Pools"],
  ["qemu", "Virtual Machines (QEMU)"],
  ["replication", "Replication"],
  ["sdn", "Software Defined Networking"],
  ["storage", "Storage"],
  ["tfa", "Two-Factor Auth"],
  ["tasks", "Tasks"],
  ["version", "Version"],
  ["vzdump", "VZDump"],
]);

export interface GenerateOpenApiOptions {
  /**
   * Base server URL included in the generated document. Defaults to the
   * canonical Proxmox VE API entry point.
   */
  serverUrl?: string;
}

const DEFAULT_SERVER_URL = "https://{host}:{port}/api2/json";

const DEFAULT_SERVER: OpenAPIV3_1.ServerObject = {
  url: DEFAULT_SERVER_URL,
  description: "Proxmox VE API base URL",
  variables: {
    host: {
      default: "localhost",
    },
    port: {
      default: "8006",
    },
  },
};

const SECURITY_SCHEMES: NonNullable<OpenAPIV3_1.ComponentsObject["securitySchemes"]> = {
  PVEAuthCookie: {
    type: "apiKey",
    in: "cookie",
    name: "PVEAuthCookie",
    description: "Proxmox VE authentication cookie. Obtained via the access ticket endpoint.",
  },
  PVEAPIToken: {
    type: "apiKey",
    in: "header",
    name: "Authorization",
    description: "API token authentication using the `Authorization: PVEAPIToken=TOKEN` header.",
  },
};

function setExtension<T>(target: T, key: string, value: unknown): void {
  (target as unknown as Record<string, unknown>)[key] = value;
}

function deriveTagInfo(path: string, depth = 2): TagInfo {
  const rawSegments = path.split("/").filter((value) => Boolean(value) && !value.startsWith("{"));

  if (rawSegments.length === 0) {
    return {
      name: "general",
      group: "general",
      segments: ["general"],
    };
  }

  const trimmed = rawSegments.slice(0, Math.max(1, Math.min(depth, rawSegments.length)));
  const name = trimmed.join("/");
  const group = rawSegments[0];

  return {
    name,
    group,
    segments: trimmed,
  };
}

function formatSegment(segment: string): string {
  const normalized = segment.toLowerCase();
  const overridden = SEGMENT_DISPLAY_OVERRIDES.get(normalized);
  if (overridden) {
    return overridden;
  }

  const words = segment
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));

  return words.join(" ") || segment;
}

function formatDisplayName(info: TagInfo): string {
  return info.segments.map(formatSegment).join(" › ");
}

function buildTagDescription(info: TagInfo, displayName: string): string {
  if (info.segments.length <= 1) {
    return `Operations for the ${displayName} endpoints.`;
  }

  const [parent, ...rest] = info.segments.map(formatSegment);
  const child = rest.join(" › ");
  return `Operations for ${child} under ${parent}.`;
}

export function generateOpenApiDocument(ir: NormalizedApiDocument, options: GenerateOpenApiOptions = {}): Document {
  const tagMetadata = new Map<string, TagMetadata>();
  const contexts = collectEndpointContexts(ir.groups);

  contexts.sort((a, b) => {
    if (a.endpoint.path === b.endpoint.path) {
      return a.endpoint.httpMethod.localeCompare(b.endpoint.httpMethod);
    }
    return a.endpoint.path.localeCompare(b.endpoint.path);
  });

  const paths: Document["paths"] = {};

  for (const context of contexts) {
    if (!tagMetadata.has(context.tag.name)) {
      const displayName = formatDisplayName(context.tag);
      tagMetadata.set(context.tag.name, {
        info: context.tag,
        displayName,
        description: buildTagDescription(context.tag, displayName),
      });
    }

    const pathItem = (paths[context.endpoint.path] ?? {}) as OpenAPIV3_1.PathItemObject;
    const method = context.endpoint.httpMethod.toLowerCase() as keyof OpenAPIV3_1.PathItemObject;
    const operation = convertEndpointToOperation(context);
    (pathItem as unknown as Record<string, unknown>)[method as string] = operation;
    paths[context.endpoint.path] = pathItem;
  }

  const info: OpenAPIV3_1.InfoObject = {
    title: ir.source.documentTitle ?? "Proxmox VE API",
    version: ir.source.scrapedAt ?? ir.irVersion,
    description: buildTopLevelDescription(ir),
  };

  const document: Document = {
    openapi: "3.1.0",
    info,
    servers: [options.serverUrl ? { ...DEFAULT_SERVER, url: options.serverUrl } : DEFAULT_SERVER],
    tags: [],
    paths,
    components: {
      securitySchemes: SECURITY_SCHEMES,
    },
  };

  const groupedTags = new Map<string, TagMetadata[]>();

  for (const metadata of tagMetadata.values()) {
    const bucket = groupedTags.get(metadata.info.group) ?? [];
    bucket.push(metadata);
    groupedTags.set(metadata.info.group, bucket);
  }

  const orderedGroups = Array.from(groupedTags.keys()).sort((a, b) => {
    const indexA = PRIMARY_TAG_GROUP_ORDER.indexOf(a);
    const indexB = PRIMARY_TAG_GROUP_ORDER.indexOf(b);

    if (indexA === -1 && indexB === -1) {
      return a.localeCompare(b);
    }
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const tags: OpenAPIV3_1.TagObject[] = [];
  const tagGroups: Array<{ name: string; tags: string[] }> = [];

  for (const groupKey of orderedGroups) {
    const metadataList = groupedTags.get(groupKey);
    if (!metadataList) continue;

    metadataList.sort((a, b) => a.displayName.localeCompare(b.displayName));
    tagGroups.push({
      name: formatSegment(groupKey),
      tags: metadataList.map((meta) => meta.info.name),
    });

    for (const meta of metadataList) {
      const tag: OpenAPIV3_1.TagObject = {
        name: meta.info.name,
        description: meta.description,
      };
      setExtension(tag, "x-displayName", meta.displayName);
      tags.push(tag);
    }
  }

  document.tags = tags;

  setExtension(document, "x-proxmox", {
    irVersion: ir.irVersion,
    normalizedAt: ir.normalizedAt,
    source: ir.source,
    summary: ir.summary,
  });
  setExtension(document, "x-tagGroups", tagGroups);

  return document;
}

function collectEndpointContexts(groups: NormalizedGroup[]): EndpointContext[] {
  const contexts: EndpointContext[] = [];

  for (const group of groups) {
    for (const endpoint of group.endpoints) {
      contexts.push({
        endpoint,
        tag: deriveTagInfo(endpoint.path),
      });
    }

    if (group.children.length > 0) {
      contexts.push(...collectEndpointContexts(group.children));
    }
  }

  return contexts;
}

function convertEndpointToOperation(context: EndpointContext): Operation {
  const { endpoint, tag } = context;
  const operation: Operation = {
    operationId: endpoint.operationId,
    summary: endpoint.name,
    description: endpoint.description,
    tags: [tag.name],
    responses: convertResponses(endpoint.responses),
  };

  setExtension(operation, "x-proxmox-endpoint-id", endpoint.id);
  setExtension(operation, "x-proxmox-features", endpoint.features);

  if (endpoint.status) {
    setExtension(operation, "x-proxmox-status", endpoint.status);
  }

  const { parameters, requestBody } = convertRequest(endpoint);
  if (parameters.length > 0) {
    operation.parameters = parameters;
  } else {
    delete operation.parameters;
  }

  if (requestBody) {
    operation.requestBody = requestBody;
  }

  const securityRequirements = convertSecurity(endpoint);
  if (securityRequirements) {
    operation.security = securityRequirements;
  }

  if (endpoint.security.permissions) {
    setExtension(operation, "x-proxmox-permissions", endpoint.security.permissions);
  }

  return operation;
}

function convertSecurity(endpoint: NormalizedEndpoint): SecurityRequirement[] | undefined {
  if (!endpoint.security.requiresAuthentication) {
    return [];
  }

  const requirements: SecurityRequirement[] = [];

  requirements.push({ PVEAuthCookie: [] });
  if (endpoint.security.allowToken) {
    requirements.push({ PVEAPIToken: [] });
  }

  return requirements;
}

function convertRequest(endpoint: NormalizedEndpoint): {
  parameters: Parameter[];
  requestBody?: OpenAPIV3_1.RequestBodyObject;
} {
  const pathParamNames = extractPathParamNames(endpoint.path);
  const method = endpoint.httpMethod.toUpperCase();
  const parameters: Parameter[] = [];

  const rawSchema = endpoint.request?.schema ? cloneSchema(endpoint.request.schema) : undefined;

  if (rawSchema?.properties) {
    const filteredProperties: Record<string, NormalizedSchema> = {};

    for (const [name, propertySchema] of Object.entries(rawSchema.properties)) {
      if (pathParamNames.has(name)) {
        parameters.push(createParameter(name, propertySchema, "path"));
        continue;
      }

      if (method === "GET" || method === "DELETE") {
        parameters.push(createParameter(name, propertySchema, "query"));
        continue;
      }

      filteredProperties[name] = propertySchema;
    }

    rawSchema.properties = filteredProperties;
  }

  const requestBody = buildRequestBody(rawSchema, method);

  return { parameters, requestBody };
}

function buildRequestBody(
  schema: NormalizedSchema | undefined,
  method: string
): OpenAPIV3_1.RequestBodyObject | undefined {
  if (!schema) {
    return undefined;
  }

  if (method === "GET" || method === "DELETE") {
    return undefined;
  }

  if (!schemaHasContent(schema)) {
    return undefined;
  }

  const mediaType: MediaTypeObject = {
    schema: convertSchema(schema),
  };

  let required = true;
  if ((schema.type ?? "object") === "object") {
    const properties = schema.properties ?? {};
    const hasRequired = Object.values(properties).some((property) => !property.optional);
    required = hasRequired;
  }

  return {
    required,
    content: {
      "application/json": mediaType,
    },
  };
}

function convertResponses(responses: NormalizedEndpoint["responses"]): OpenAPIV3_1.ResponsesObject {
  const result: OpenAPIV3_1.ResponsesObject = {};

  if (responses.length === 0) {
    result[200] = {
      description: "Successful response",
    };
    return result;
  }

  responses.forEach((response, index) => {
    const statusCode = index === 0 ? "200" : "default";
    const description = response.description ?? "Successful response";
    const schema = response.schema ? convertSchema(response.schema) : undefined;

    if (schema) {
      result[statusCode] = {
        description,
        content: {
          "application/json": {
            schema,
          },
        },
      };
    } else {
      result[statusCode] = { description };
    }
  });

  return result;
}

function createParameter(name: string, schema: NormalizedSchema, location: Parameter["in"]): Parameter {
  const description = joinDescription(schema.description, schema.verboseDescription);

  return {
    name,
    in: location,
    required: location === "path" ? true : !schema.optional,
    description: description || undefined,
    schema: convertSchema(schema) as unknown as OpenAPIV3.SchemaObject,
  };
}

function convertSchema(schema: NormalizedSchema): SchemaObject {
  const result: SchemaObject = {} as SchemaObject;

  if (schema.type && schema.type !== "any") {
    (result as unknown as Record<string, unknown>).type = schema.type;
  }

  const description = joinDescription(schema.description, schema.verboseDescription);
  if (description) {
    result.description = description;
  }

  if (schema.enum) {
    result.enum = [...schema.enum];
  }

  if (schema.defaultValue !== undefined) {
    result.default = coerceDefault(schema);
  }

  if (schema.properties) {
    const properties: Record<string, SchemaObject> = {};
    const required: string[] = [];

    for (const [name, propertySchema] of Object.entries(schema.properties)) {
      properties[name] = convertSchema(propertySchema);
      if (!propertySchema.optional) {
        required.push(name);
      }
    }

    result.properties = properties;
    if (required.length > 0) {
      result.required = required;
    }
  }

  if (schema.items) {
    (result as unknown as Record<string, unknown>).items = convertSchema(schema.items);
  }

  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties === "boolean") {
      result.additionalProperties = schema.additionalProperties;
    } else {
      result.additionalProperties = convertSchema(schema.additionalProperties);
    }
  }

  if (schema.constraints) {
    const { constraints } = schema;

    if (constraints.minimum !== undefined) {
      result.minimum = constraints.minimum;
    }

    if (constraints.maximum !== undefined) {
      result.maximum = constraints.maximum;
    }

    if (constraints.minLength !== undefined) {
      result.minLength = constraints.minLength;
    }

    if (constraints.maxLength !== undefined) {
      result.maxLength = constraints.maxLength;
    }

    if (constraints.pattern) {
      result.pattern = constraints.pattern;
    }

    if (constraints.format) {
      result.format = constraints.format;
    }

    if (constraints.formatDescription) {
      setExtension(result, "x-proxmox-format-description", constraints.formatDescription);
    }

    if (constraints.requires && constraints.requires.length > 0) {
      setExtension(result, "x-proxmox-requires", constraints.requires);
    }
  }

  if (schema.typetext) {
    setExtension(result, "x-proxmox-typetext", schema.typetext);
  }

  if (schema.optional !== undefined) {
    setExtension(result, "x-proxmox-optional", schema.optional);
  }

  if (schema.metadata) {
    setExtension(result, "x-proxmox-metadata", schema.metadata);
  }

  return result;
}

function coerceDefault(schema: NormalizedSchema): unknown {
  if (schema.defaultValue === undefined) {
    return undefined;
  }

  if (schema.type === "boolean" && typeof schema.defaultValue === "number") {
    return schema.defaultValue === 1;
  }

  return schema.defaultValue;
}

function extractPathParamNames(path: string): Set<string> {
  const matches = path.matchAll(/\{([^}]+)}/g);
  return new Set(Array.from(matches, (match) => match[1]));
}

function joinDescription(...parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part?.trim())).join("\n\n");
}

function schemaHasContent(schema: NormalizedSchema): boolean {
  if (schema.type && schema.type !== "object" && schema.type !== "any") {
    return true;
  }

  if (schema.enum && schema.enum.length > 0) {
    return true;
  }

  if (schema.items) {
    return true;
  }

  if (schema.properties && Object.keys(schema.properties).length > 0) {
    return true;
  }

  if (schema.additionalProperties === true) {
    return true;
  }

  if (typeof schema.additionalProperties === "object") {
    return true;
  }

  return false;
}

function cloneSchema(schema: NormalizedSchema): NormalizedSchema {
  return JSON.parse(JSON.stringify(schema)) as NormalizedSchema;
}

function buildTopLevelDescription(ir: NormalizedApiDocument): string {
  const lines = [
    "Generated from the normalized Proxmox VE API intermediate representation.",
    `Source: ${ir.source.sourceUrl}`,
    `Scraped at: ${ir.source.scrapedAt}`,
    `Normalized at: ${ir.normalizedAt}`,
    `Operations: ${ir.summary.methodCount}`,
  ];

  return lines.join("\n");
}
