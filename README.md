# Proxmox OpenAPI Tooling

Utilities for scraping the official Proxmox API viewer, normalizing responses, and publishing OpenAPI specs plus a companion SPA.

## Packages
- `app/`: Vite-based SPA that surfaces the generated specifications and embeds Swagger UI with lazy loading.
- `tools/`: Source workspaces for scraping, normalization, OpenAPI generation, and orchestration (`automation`).
- `packages/`: Published distribution of the automation CLI (`@mihailfox/proxmox-openapi`) that re-exports `tools/automation`.
- `.github/actions/proxmox-openapi-artifacts/`: First-party GitHub Action wrapping the automation pipeline for CI.
- `.github/workflows/`: CI pipelines for validations, artifact generation, GitHub Pages, and project automation.
- `.devcontainer/`: Containerized development environment configs. See [docs/devcontainer.md](docs/devcontainer.md).
- `var/`: Workspace-local output directory (automation summaries, OpenAPI bundles, release staging, static site builds).

## SPA Overview
The SPA under `app/` is a React + Vite project that ships the marketing pages, API explorer, and statically bundled
OpenAPI artifacts. The build expects fresh schema bundles under `var/openapi`, which are synced into the public assets
via `npm run openapi:prepare` before Vite serves or builds the site. GitHub Pages deploys the compiled assets located in
`dist/` together with the generated OpenAPI bundle. See [docs/spa-deployment.md](docs/spa-deployment.md) for the
deployment workflow and rollback guidance.

## Automation Pipeline Overview
The automation pipeline chains the following stages (implemented in `tools/automation/src/pipeline.ts`):
1. **Scrape** – `@proxmox-openapi/api-scraper` launches Playwright, fetches `apidoc.js`, and persists a raw snapshot (JSON).
2. **Normalize** – `@proxmox-openapi/api-normalizer` converts the raw tree into a versioned intermediate representation (IR).
3. **Generate** – `@proxmox-openapi/openapi-generator` emits OpenAPI 3.1 JSON/YAML documents and enriches tags/metadata.
4. **Validate & QA** – Swagger Parser validates the JSON output, and regression helpers compute checksum parity summaries.

`npm run automation:pipeline` defaults to CI mode (offline, cache-enabled). Pass `--mode=full` for a live scrape or
`--no-fallback-to-cache` to fail fast when Proxmox endpoints are unreachable. The command writes a JSON summary to
`var/automation-summary.json` when invoked with `--report <path>` and logs a regression digest (checksums, parity stats).

### Local Development Quickstart
1. Install dependencies with `npm install`.
2. Generate or refresh the OpenAPI artifacts (`npm run automation:pipeline -- --mode=ci --report var/automation-summary.json`).
3. Start the SPA dev server (`npm run ui:dev`). The script copies the current artifacts and launches Vite at
   `http://127.0.0.1:5173`.
4. When finished, stop the dev server with `Ctrl+C`. Regenerate artifacts whenever the API schema changes.

## Working With Automation
The "Project Stage Sync" workflow keeps the delivery project up to date. Review the [automation runbook](docs/automation.md) for triggers,
token requirements, CLI flags, and manual override instructions. When opening a pull request, ensure the relevant issue is linked so the
workflow can reconcile status changes. Use `tools/automation/scripts/format-summary.ts` to turn pipeline summaries into Markdown for PRs.

## Monitoring & Quality
- Run a Lighthouse audit (Performance, Accessibility, Best Practices ≥ 90) against the deployed pages site after significant UI changes.
- Check for broken links using a crawler such as `npx broken-link-checker https://mihailfox.github.io/proxmox-openapi/` before publishing.
- Verify that the embedded Swagger UI loads the latest `openapi/proxmox-ve.json` bundle after every automation pipeline run.

## Testing & Regression
- `npm run test:all` executes unit suites for the scraper, normalizer, generator, automation helpers, and regression harness.
- Regression specs (`tests/regression`) assert checksum baselines from `tools/automation/data/regression/openapi.sha256.json` and parity between JSON/YAML outputs.
- Playwright suites cover scraper smoke tests (`tools/api-scraper/tests/smoke.spec.ts`) and UI contrast/theme behaviour (`tests/ui/theme.spec.ts`).
- Update baselines via `npm run regression:record` (which delegates to `tools/automation/scripts/update-regression-baseline.ts`) after intentional schema shifts.

## GitHub Action Usage
The bundled action in `.github/actions/proxmox-openapi-artifacts` runs the automation pipeline and ships with the
repository. After cloning, rebuild the dist output with `npm run action:package` whenever the source changes.

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

### Self-hosted runners (offline-compatible)

Download the release bundle and reference it locally:

```bash
curl -sSL https://github.com/mihailfox/proxmox-openapi/releases/download/v1.0.0/proxmox-openapi-artifacts-action-v1.0.0.tgz \
  | tar -xz -C .github/actions --strip-components=1 proxmox-openapi-artifacts-action
```

```yaml
jobs:
  openapi:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v5
      - name: Generate Proxmox OpenAPI artifacts
        uses: ./proxmox-openapi-artifacts-action
        with:
          mode: full
          offline: true
```

## npm Package
- Configure an `.npmrc` entry with your GitHub Packages token:

  ```ini
  @mihailfox:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NPM_TOKEN}
  ```

- Install and run the CLI:

  ```bash
  npm install @mihailfox/proxmox-openapi
  npx @mihailfox/proxmox-openapi --mode ci --report var/automation-summary.json
  ```

- See [docs/packages.md](docs/packages.md) for CLI flag reference, library usage, and release cadence details.

## Schema Releases
- Push tags matching `v*`, semantic versions, or prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`) to trigger `.github/workflows/openapi-release.yml`.
- The workflow regenerates artifacts, runs `npm run regression:test` and `npm run openapi:validate`, and publishes assets via `softprops/action-gh-release@v2`.
- See [docs/releases.md](docs/releases.md) for download commands, checksum verification, and release metadata.

## Contributing
1. Install dependencies with `npm install`.
2. Run targeted checks (`npm run lint`, `npm run test:all`, etc.) before pushing.
3. Reference the linked issue in branch names/PR bodies and document any automation impact.
4. See [docs/automation.md](docs/automation.md) for expectations around project updates and troubleshooting.
