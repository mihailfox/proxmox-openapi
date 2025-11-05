# npm Package: @mihailfox/proxmox-openapi

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
npx proxmox-openapi pipeline --mode full --openapi-dir var/openapi --report var/automation-summary.json
```

### Flags

| Flag | Description | Default | Required |
| ---- | ----------- | ------- | -------- |
| `--mode <ci or full>` | Controls whether the pipeline runs in CI or full scrape mode. | `ci` | No |
| `--base-url <url>` | Overrides the Proxmox API viewer base URL. | — | No |
| `--raw-output <path>` | Persists the raw snapshot JSON to a custom path. | — | No |
| `--ir-output <path>` | Persists the normalized intermediate representation. | — | No |
| `--openapi-dir <dir>` | Directory for generated OpenAPI JSON/YAML. | `var/openapi` | No |
| `--basename <name>` | Basename used for generated OpenAPI files. | `proxmox-ve` | No |
| `--report <path>` | Writes the automation summary JSON to the specified path. | — | No |
| `--offline` | Skips the live scrape and relies on cached artifacts. | `false` | No |
| `--fallback-to-cache` / `--no-fallback-to-cache` | Controls whether cached snapshots are reused. | `true` | No |

### Stage Commands

Run individual phases when you only need part of the pipeline:

```bash
npx proxmox-openapi scrape --output var/cache/api-scraper/raw/proxmox-openapi-schema.json
npx proxmox-openapi normalize --input var/cache/api-scraper/raw/proxmox-openapi-schema.json
npx proxmox-openapi generate --output var/openapi --basename proxmox-ve --format json,yaml
```

These commands share the same defaults as the original workspace scripts and are useful for debugging targeted changes.

## Library API

```ts
import {
  DEFAULT_BASE_URL,
  generateOpenApiDocument,
  normalizeSnapshot,
  scrapeApiDocumentation,
  runAutomationPipeline,
  type AutomationPipelineRunOptions,
} from "@mihailfox/proxmox-openapi";

const result = await runAutomationPipeline({
  mode: "ci",
  summaryOutputPath: "var/automation-summary.json",
});

const { snapshot } = await scrapeApiDocumentation({ baseUrl: DEFAULT_BASE_URL, persist: false });
const normalized = normalizeSnapshot(snapshot);
const document = generateOpenApiDocument(normalized);
```

The return value is an `AutomationPipelineResult` describing generated paths and cache behaviour. Additional helpers such
as `normalizeSnapshot`, `generateOpenApiDocument`, and `DEFAULT_BASE_URL` let you compose custom flows without dropping
into the internal workspace packages.

## Release Cadence

- Packages are published to GitHub Packages (`npm.pkg.github.com`) alongside GitHub release tags.
- Publication happens through `.github/workflows/npm-package.yml`, which rebuilds the workspace and issues `npm publish --provenance`.
- Tags that include prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`) are also published, allowing consumers to opt-in to prerelease channels.

## Notes
> When installing in CI, set `NODE_AUTH_TOKEN` or include the token in `.npmrc`. Use a token with `read:packages` scope.
> Use `npm install --no-save @mihailfox/proxmox-openapi@latest --registry=https://npm.pkg.github.com` when you always want the newest published CLI.
