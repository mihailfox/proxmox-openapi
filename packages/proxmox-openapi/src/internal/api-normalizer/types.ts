export const IR_VERSION = "1.0.0";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD" | "TRACE" | "UNKNOWN";

export interface NormalizedApiDocument {
  irVersion: string;
  normalizedAt: string;
  source: NormalizedSourceMetadata;
  summary: NormalizedSummary;
  groups: NormalizedGroup[];
}

export interface NormalizedSourceMetadata {
  snapshotChecksum: string;
  scrapedAt: string;
  sourceUrl: string;
  documentTitle?: string;
  rawStats: {
    rootGroupCount: number;
    endpointCount: number;
  };
}

export interface NormalizedSummary {
  groupCount: number;
  endpointCount: number;
  methodCount: number;
}

export interface NormalizedGroup {
  id: string;
  path: string;
  slug: string;
  label: string;
  endpoints: NormalizedEndpoint[];
  children: NormalizedGroup[];
}

export interface NormalizedEndpoint {
  id: string;
  operationId: string;
  path: string;
  httpMethod: HttpMethod;
  name?: string;
  description?: string;
  status?: string;
  security: NormalizedSecurity;
  features: NormalizedFeatureFlags;
  request?: NormalizedRequest;
  responses: NormalizedResponse[];
}

export interface NormalizedSecurity {
  allowToken: boolean;
  requiresAuthentication: boolean;
  permissions?: NormalizedPermissionSet;
}

export interface NormalizedPermissionSet {
  all?: NormalizedPermission[];
  any?: NormalizedPermission[];
}

export interface NormalizedPermission {
  description?: string;
  user?: string;
  check?: unknown;
}

export interface NormalizedFeatureFlags {
  proxy: boolean;
  download: boolean;
  upload: boolean;
}

export interface NormalizedRequest {
  description?: string;
  schema: NormalizedSchema;
}

export interface NormalizedResponse {
  description?: string;
  schema?: NormalizedSchema;
}

export interface NormalizedSchema {
  type?: string;
  typetext?: string;
  description?: string;
  verboseDescription?: string;
  optional?: boolean;
  defaultValue?: unknown;
  enum?: Array<string | number>;
  constraints?: NormalizedConstraints;
  properties?: Record<string, NormalizedSchema>;
  items?: NormalizedSchema;
  additionalProperties?: boolean | NormalizedSchema;
  metadata?: Record<string, unknown>;
}

export interface NormalizedConstraints {
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  formatDescription?: string;
  requires?: string[];
}
