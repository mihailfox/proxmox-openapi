declare module "../../api-scraper/data/raw/proxmox-openapi-schema.json" {
  import type { RawApiSnapshot } from "@proxmox-openapi/api-scraper/types.ts";

  const snapshot: RawApiSnapshot;
  export default snapshot;
}

declare module "../../data/regression/openapi.sha256.json" {
  interface OpenApiChecksum {
    readonly sha256: string;
  }

  const checksums: {
    readonly json: OpenApiChecksum;
    readonly yaml: OpenApiChecksum;
    readonly generatedAt?: string;
  };

  export default checksums;
}
