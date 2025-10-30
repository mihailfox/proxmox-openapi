# @mihailfox/proxmox-openapi

Generate Proxmox OpenAPI artifacts (raw snapshot, normalized IR, OpenAPI JSON/YAML) from the comfort of your own CI –
now with dedicated commands for every stage of the pipeline.

## Installation

```bash
npm install @mihailfox/proxmox-openapi --registry=https://npm.pkg.github.com
```

> **Note**
> Access to GitHub Packages requires authentication. Configure an `.npmrc` entry such as:
>
> ```ini
> @mihailfox:registry=https://npm.pkg.github.com
> //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
> ```
>
> Replace `NPM_TOKEN` with a GitHub token that has the `read:packages` scope (plus `write:packages` if you intend to publish).

## CLI

### Pipeline

```bash
npx @mihailfox/proxmox-openapi pipeline --mode full --report var/automation-summary.json
```

| Flag | Description |
| ---- | ----------- |
| `--mode <ci|full>` | Select the automation mode (defaults to `ci`). |
| `--offline` | Skip network scraping and reuse cached artifacts. |
| `--fallback-to-cache` / `--no-fallback-to-cache` | Allow or disable cached snapshot reuse (defaults to allow). |
| `--base-url <url>` | Override the Proxmox API viewer base URL. |
| `--raw-output <path>` | Persist the raw snapshot JSON to a custom location. |
| `--ir-output <path>` | Persist the normalized intermediate representation. |
| `--openapi-dir <dir>` | Directory where OpenAPI JSON/YAML should be written. |
| `--basename <name>` | Basename used for OpenAPI output files. |
| `--report <path>` | Write the automation summary JSON to the specified path. |

### Stage Commands

Run individual stages when you only need part of the workflow:

```bash
# Scrape the Proxmox API viewer (writes JSON under packages/proxmox-openapi/data/api-scraper/raw/)
npx proxmox-openapi scrape --base-url https://pve.proxmox.com/pve-docs/api-viewer/

# Normalize a snapshot into the IR format (defaults to the cached raw snapshot bundled with the package)
npx proxmox-openapi normalize --input packages/proxmox-openapi/data/api-scraper/raw/proxmox-openapi-schema.json

# Generate OpenAPI bundles (JSON & YAML)
npx proxmox-openapi generate --output var/openapi --basename proxmox-ve
```

## Library Usage

```ts
import {
  DEFAULT_BASE_URL,
  generateOpenApiDocument,
  normalizeSnapshot,
  runAutomationPipeline,
  scrapeApiDocumentation,
  type AutomationPipelineRunOptions,
} from "@mihailfox/proxmox-openapi";

const options: AutomationPipelineRunOptions = {
  mode: "ci",
  summaryOutputPath: "var/automation-summary.json",
};

const summary = await runAutomationPipeline(options);

// Or compose stages manually:
const { snapshot } = await scrapeApiDocumentation({ baseUrl: DEFAULT_BASE_URL, persist: false });
const normalized = normalizeSnapshot(snapshot);
const document = generateOpenApiDocument(normalized);
```

`AutomationPipelineRunOptions` mirrors the CLI flags, and additional helpers such as `DEFAULT_BASE_URL` and
`scrapeApiDocumentation` expose the lower-level building blocks for custom pipelines.
