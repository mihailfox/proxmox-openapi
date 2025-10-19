# npm package: @mihailfox/proxmox-openapi

The npm distribution packages the automation pipeline so you can generate schema bundles directly from your own workflows.

## Installation

```bash
# .npmrc
@mihailfox:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

```bash
npm install @mihailfox/proxmox-openapi
```

Use a GitHub token with `read:packages` scope to download releases (add `write:packages` to publish).

## CLI Usage

```bash
npx @mihailfox/proxmox-openapi --mode full --openapi-dir var/openapi --report var/automation-summary.json
```

### Flags

| Flag | Description |
| ---- | ----------- |
| `--mode <ci|full>` | Controls whether the pipeline runs in CI or full scrape mode (defaults to `ci`). |
| `--base-url <url>` | Override the Proxmox API viewer base URL. |
| `--raw-output <path>` | Persist the raw snapshot JSON to a custom path. |
| `--ir-output <path>` | Persist the normalized intermediate representation. |
| `--openapi-dir <dir>` | Directory for generated OpenAPI JSON/YAML (defaults to `var/openapi`). |
| `--basename <name>` | Basename used for generated OpenAPI files. |
| `--report <path>` | Write the automation summary JSON to the specified path. |
| `--offline` | Skip the live scrape and rely on cached artifacts. |
| `--fallback-to-cache` / `--no-fallback-to-cache` | Control whether cached snapshots are reused (defaults to reuse). |

## Library API

```ts
import {
  runAutomationPipeline,
  type AutomationPipelineRunOptions,
} from "@mihailfox/proxmox-openapi";

const result = await runAutomationPipeline({
  mode: "ci",
  summaryOutputPath: "var/automation-summary.json",
});
```

The return value is an `AutomationPipelineResult` describing generated paths and cache behaviour.

## Release Cadence

- Packages are published to GitHub Packages (`npm.pkg.github.com`) alongside GitHub release tags.
- Publication happens through `.github/workflows/npm-package.yml`, which rebuilds the workspace and issues `npm publish --provenance`.
- Tags that include prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`) are also published, allowing consumers to opt-in to prerelease channels.
