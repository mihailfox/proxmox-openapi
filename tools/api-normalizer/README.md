# Proxmox API Normalizer

The normalizer converts raw scraper payloads from `tools/api-scraper` into a
structured intermediate representation (IR) that downstream tooling can consume
when generating OpenAPI documents.

## Usage

```bash
npm run normalizer:generate
```

The command reads the latest raw snapshot from
`tools/api-scraper/data/raw/proxmox-openapi-schema.json` and writes a normalized IR
file to `tools/api-normalizer/data/ir/proxmox-openapi-ir.json`.

To target alternative files, pass explicit paths:

```bash
npm run normalizer:generate -- --input /path/to/raw.json --output /tmp/ir.json
```

## Testing

Run the Vitest suite to verify normalization behaviour:

```bash
npm run normalizer:test
```

The tests exercise representative endpoints to ensure permissions, schema
shapes, and slug generation remain stable.
