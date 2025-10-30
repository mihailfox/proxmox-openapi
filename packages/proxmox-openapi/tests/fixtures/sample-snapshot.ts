import type { RawApiSnapshot } from "../../src/internal/api-scraper/types.ts";
import { normalizeSnapshot } from "../../src/internal/api-normalizer/normalizer.ts";
import type { NormalizeSnapshotOptions, NormalizedApiDocument } from "../../src/internal/api-normalizer/normalizer.ts";

export const SAMPLE_SNAPSHOT: RawApiSnapshot = {
  scrapedAt: "2025-09-30T00:00:00.000Z",
  sourceUrl: "https://pve.proxmox.com:8006/api2/json",
  documentTitle: "Proxmox VE API",
  stats: {
    rootGroupCount: 2,
    endpointCount: 2,
  },
  schema: [
    {
      path: "/access",
      text: "Access",
      methods: [
        {
          httpMethod: "GET",
          name: "get-access",
          description: "List available access control entries.",
          allowToken: true,
          protected: false,
          permissions: { user: "all", description: "Global access" },
          parameters: {
            type: "object",
            description: "Optional filters",
            additionalProperties: false,
            properties: {
              realm: {
                type: "string",
                description: "Realm identifier",
              },
            },
          },
          returns: {
            type: "array",
            description: "Access entries",
            items: {
              type: "object",
              description: "Access entry",
              additionalProperties: false,
              metadata: {
                links: [
                  {
                    rel: "self",
                    href: "/access",
                  },
                ],
              },
              properties: {
                roleid: { type: "string", description: "Role identifier" },
              },
            },
          },
          proxy: false,
          download: false,
          upload: false,
        },
      ],
      children: [
        {
          path: "/access/ticket",
          text: "Ticket",
          methods: [],
          children: [],
        },
      ],
    },
    {
      path: "/nodes",
      text: "Nodes",
      methods: [],
      children: [
        {
          path: "/nodes/{node}/storage",
          text: "Storage",
          methods: [
            {
              httpMethod: "POST",
              name: "create-storage",
              description: "Create storage on a node.",
              protected: true,
              permissions: [{ user: "root@pam" }],
              parameters: {
                type: "object",
                description: "Storage definition",
                properties: {
                  storage: { type: "string", description: "Storage identifier" },
                },
              },
              returns: {
                type: "object",
                description: "Creation task identifier",
                properties: {
                  upid: { type: "string" },
                },
              },
              proxy: false,
              download: false,
              upload: false,
            },
          ],
          children: [],
        },
      ],
    },
  ],
};

export function createNormalizedSample(options: NormalizeSnapshotOptions = {}): NormalizedApiDocument {
  return normalizeSnapshot(SAMPLE_SNAPSHOT, options);
}
