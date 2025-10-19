# @mihailfox/proxmox-openapi

Generate Proxmox OpenAPI artifacts (raw snapshot, normalized IR, OpenAPI JSON/YAML) from the comfort of your own CI.

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

```bash
npx @mihailfox/proxmox-openapi --mode full --report var/automation-summary.json
```

### Options

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

## Library Usage

```ts
import { runAutomationPipeline } from "@mihailfox/proxmox-openapi";

await runAutomationPipeline({
  mode: "ci",
  summaryOutputPath: "var/automation-summary.json",
});
```

The `AutomationPipelineRunOptions` interface mirrors the CLI flags. See the project documentation for end-to-end
examples and the release checklist.
