import checksums from "../../data/regression/openapi.sha256.json" with { type: "json" };
import { OPENAPI_JSON_PATH, OPENAPI_YAML_PATH, resolveFromRoot } from "@proxmox-openapi/shared/paths.ts";

export interface ArtifactBaseline {
  id: "raw-snapshot" | "normalized-ir" | "openapi-json" | "openapi-yaml";
  label: string;
  description: string;
  path: string;
  sha256: string;
}

export const ARTIFACT_BASELINES: ArtifactBaseline[] = [
  {
    id: "raw-snapshot",
    label: "Raw API snapshot",
    description: "Cached payload scraped from the Proxmox API viewer.",
    path: resolveFromRoot("tools/api-scraper/data/raw/proxmox-openapi-schema.json"),
    sha256: "e5c1f9da030fb2a1b23dbc212cc491f229e3784eefdf33e4a6af76064ca48bec",
  },
  {
    id: "normalized-ir",
    label: "Normalized intermediate representation",
    description: "Structured document produced by the normalization pipeline.",
    path: resolveFromRoot("tools/api-normalizer/data/ir/proxmox-openapi-ir.json"),
    sha256: "0a9743bb0e84990249480658d26ee6f865386271dee07541d6c93b2009e8be4d",
  },
  {
    id: "openapi-json",
    label: "OpenAPI JSON document",
    description: "Generated OpenAPI 3.1 specification (JSON).",
    path: OPENAPI_JSON_PATH,
    sha256: checksums.json.sha256,
  },
  {
    id: "openapi-yaml",
    label: "OpenAPI YAML document",
    description: "Generated OpenAPI 3.1 specification (YAML).",
    path: OPENAPI_YAML_PATH,
    sha256: checksums.yaml.sha256,
  },
];
