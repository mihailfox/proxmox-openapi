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

interface EndpointContext {
  endpoint: NormalizedEndpoint;
  tagName: string;
  tagDescription?: string;
}

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

export function generateOpenApiDocument(ir: NormalizedApiDocument, options: GenerateOpenApiOptions = {}): Document {
  const tagMap = new Map<string, { description?: string }>();
  const contexts = collectEndpointContexts(ir.groups);

  contexts.sort((a, b) => {
    if (a.endpoint.path === b.endpoint.path) {
      return a.endpoint.httpMethod.localeCompare(b.endpoint.httpMethod);
    }
    return a.endpoint.path.localeCompare(b.endpoint.path);
  });

  const paths: Document["paths"] = {};

  for (const context of contexts) {
    if (!tagMap.has(context.tagName)) {
      tagMap.set(context.tagName, { description: context.tagDescription });
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
    tags: Array.from(tagMap.entries()).map(([name, value]) => ({
      name,
      description: value.description,
    })),
    paths,
    components: {
      securitySchemes: SECURITY_SCHEMES,
    },
  };

  setExtension(document, "x-proxmox", {
    irVersion: ir.irVersion,
    normalizedAt: ir.normalizedAt,
    source: ir.source,
    summary: ir.summary,
  });

  return document;
}

function collectEndpointContexts(groups: NormalizedGroup[], trail: string[] = []): EndpointContext[] {
  const contexts: EndpointContext[] = [];

  for (const group of groups) {
    const nextTrail = [...trail, group.label];
    const tagDescription = nextTrail.join(" › ");

    for (const endpoint of group.endpoints) {
      contexts.push({
        endpoint,
        tagName: group.path,
        tagDescription,
      });
    }

    if (group.children.length > 0) {
      contexts.push(...collectEndpointContexts(group.children, nextTrail));
    }
  }

  return contexts;
}

function convertEndpointToOperation(context: EndpointContext): Operation {
  const { endpoint, tagName } = context;
  const operation: Operation = {
    operationId: endpoint.operationId,
    summary: endpoint.name,
    description: endpoint.description,
    tags: [tagName],
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
