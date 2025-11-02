# Proxmox OpenAPI Artifacts Action

This JavaScript action runs the automation pipeline that scrapes, normalizes, and packages the Proxmox OpenAPI
artifacts. It is bundled for Node.js 24 and can run in both GitHub-hosted and self-hosted environments.

## Requirements
- Node.js 24 runner image (GitHub-hosted `ubuntu-latest` is supported).
- Network access to the Proxmox API viewer for live scrapes, unless `offline: true`.

## Inputs

| Name | Description | Default | Required |
| ---- | ----------- | ------- | -------- |
| `mode` | Pipeline mode (`ci` or `full`). | `ci` | No |
| `base-url` | Override the Proxmox API viewer URL used by the scraper. | — | No |
| `raw-snapshot-path` | Path where the raw snapshot JSON is written. | — | No |
| `ir-output-path` | Path for the normalized intermediate representation. | — | No |
| `openapi-dir` | Directory that contains the OpenAPI JSON/YAML outputs. | — | No |
| `openapi-basename` | Basename for generated OpenAPI files. | — | No |
| `fallback-to-cache` | Reuse cached snapshots when the live scrape fails. | `true` | No |
| `offline` | Force offline mode (skip live scrape). | `false` | No |
| `install-command` | Command used to install dependencies before the pipeline runs. | `npm ci` | No |
| `working-directory` | Repository subdirectory that contains the automation packages. | `.` | No |
| `install-playwright-browsers` | Install Playwright dependencies before the pipeline runs. | `true` | No |
| `report-path` | Location for an optional JSON summary report. | — | No |

## Outputs

| Name | Description |
| ---- | ----------- |
| `raw-snapshot` | Absolute path to the raw snapshot JSON file. |
| `normalized-document` | Absolute path to the normalized intermediate representation. |
| `openapi-json` | Absolute path to the generated OpenAPI JSON file. |
| `openapi-yaml` | Absolute path to the generated OpenAPI YAML file. |
| `from-cache` | `true` when the pipeline reused a cached snapshot. |
| `summary-path` | Path to the JSON summary produced by the pipeline. |

## Usage

### GitHub-hosted runners

```yaml
jobs:
  openapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Generate Proxmox OpenAPI artifacts
        uses: mihailfox/proxmox-openapi/.github/actions/proxmox-openapi-artifacts@v1
        with:
          mode: ci
          fallback-to-cache: true
```

### Self-Hosted Runners (Offline-Compatible)

Download the release asset from the [v1.0.0](https://github.com/mihailfox/proxmox-openapi/releases/tag/v1.0.0)
(or later) tag and unpack it under the same path our workflows use:

```bash
mkdir -p .github/actions/proxmox-openapi-artifacts
curl -sSL https://github.com/mihailfox/proxmox-openapi/releases/download/v1.0.0/proxmox-openapi-artifacts-action-v1.0.0.tgz \
  | tar -xz -C .github/actions/proxmox-openapi-artifacts --strip-components=1 proxmox-openapi-artifacts-action
```

Then reference the local path in your workflow:

```yaml
jobs:
  openapi:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v5
      - name: Generate Proxmox OpenAPI artifacts
        uses: ./.github/actions/proxmox-openapi-artifacts
        with:
          mode: full
          offline: true
```

## Development

- Run `npm install` from the repository root to install dependencies.
- Rebuild the bundled dist output with `npm run action:package`.
- Commit the updated `dist/` directory alongside any source changes.

## Versioning
- Action tags under the repository follow semantic versioning. Prereleases contain `-alpha.`, `-beta.`, or `-rc.`.
- See the root `CHANGELOG.md` for user‑visible changes across the tooling and action.

## Notes
> The action runs on Node.js 24 (`using: node24`). Configure Node in your workflow with `actions/setup-node@v5` when you need a specific minor version.
