export interface ApiSchemaNode {
  text: string;
  path: string;
  leaf?: number;
  info?: Record<string, ApiSchemaMethod>;
  children?: ApiSchemaNode[];
}

export interface ApiSchemaMethod {
  method: string;
  name?: string;
  description?: string;
  allowtoken?: number;
  protected?: number;
  permissions?: ApiSchemaPermission;
  parameters?: ApiSchemaParameters;
  returns?: ApiSchemaReturn;
  proxy?: number;
  download?: number;
  upload?: number;
  status?: string;
  permissions_any?: ApiSchemaPermission[];
}

export interface ApiSchemaPermission {
  description?: string;
  user?: string;
  check?: unknown;
}

export interface ApiSchemaParameters {
  type?: string;
  items?: ApiSchemaProperty | ApiSchemaParameters;
  properties?: Record<string, ApiSchemaProperty>;
  additionalProperties?: boolean | number | ApiSchemaProperty;
  enum?: Array<string | number>;
  default?: unknown;
  optional?: number;
  description?: string;
  typetext?: string;
}

export interface ApiSchemaProperty {
  type?: string;
  typetext?: string;
  description?: string;
  verbose_description?: string;
  optional?: number;
  default?: unknown;
  enum?: Array<string | number>;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  format_description?: string;
  title?: string;
  properties?: Record<string, ApiSchemaProperty>;
  items?: ApiSchemaProperty | ApiSchemaParameters;
  additionalProperties?: boolean | number | ApiSchemaProperty;
  subdir?: string;
  requires?: string | string[];
  renderer?: string;
  alias?: string;
  default_key?: string;
  disallow?: string;
  extends?: unknown;
  links?: unknown;
  "instance-types"?: unknown;
  [key: string]: unknown;
}

export interface ApiSchemaReturn {
  type?: string;
  description?: string;
  properties?: Record<string, ApiSchemaProperty>;
  items?: ApiSchemaProperty | ApiSchemaParameters;
  additionalProperties?: boolean | number | ApiSchemaProperty;
}

export interface RawApiMethod {
  httpMethod: string;
  name?: string;
  description?: string;
  allowToken?: boolean;
  protected?: boolean;
  permissions?: ApiSchemaPermission | ApiSchemaPermission[];
  parameters?: ApiSchemaParameters;
  returns?: ApiSchemaReturn;
  proxy?: boolean;
  download?: boolean;
  upload?: boolean;
  status?: string;
}

export interface RawApiTreeNode {
  path: string;
  text: string;
  methods: RawApiMethod[];
  children: RawApiTreeNode[];
}

export interface RawApiSnapshot {
  scrapedAt: string;
  sourceUrl: string;
  documentTitle?: string;
  stats: {
    rootGroupCount: number;
    endpointCount: number;
  };
  schema: RawApiTreeNode[];
}
