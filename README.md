# Proxmox OpenAPI Tooling

Utilities for scraping the official Proxmox API viewer, normalizing responses, and publishing OpenAPI specs plus a companion SPA.

This toolkit underpins a broader goal: ship third-party automation for Proxmox VE, beginning with the ingredients required
to deliver a full-featured Terraform provider and other infrastructure-as-code integrations.

## Project Vision
- Deliver first-party quality building blocks that unblock a Terraform provider and future IaC integrations for Proxmox VE.
- Keep schema generation reproducible so external tooling can track upstream releases with confidence.
- Provide an approachable UI and documentation hub that mirrors the automation behaviour available through the npm package and GitHub Action.

## Packages
- `app/`: Vite-based SPA that surfaces the generated specifications and embeds Swagger UI with lazy loading.
- `packages/proxmox-openapi/`: Consolidated source for scraping, normalization, OpenAPI generation, automation orchestration, and the published CLI (`@mihailfox/proxmox-openapi`).
- `.github/actions/proxmox-openapi-artifacts/`: First-party GitHub Action wrapping the automation pipeline for CI.
- `.github/workflows/`: CI pipelines for validations, artifact generation, GitHub Pages, and project automation.
- `.devcontainer/`: Containerized development environment configs. See [docs/devcontainer.md](docs/devcontainer.md).
- `var/`: Workspace-local output directory (automation summaries, OpenAPI bundles, release staging, static site builds).

### Git hooks & formatting
- We pin Git’s hooks directory to `.githooks` (`git config core.hooksPath .githooks`) so every commit runs Biome on staged
  sources. The pre-commit script (`.githooks/pre-commit`) exits quietly if `npx` or `@biomejs/biome` are missing.
- The hook executes `npx @biomejs/biome check --write --staged --files-ignore-unknown=true --no-errors-on-unmatched`.
  It formats only staged files, sorts imports, and applies autofixable lint fixes without touching unstaged work.
- Format the entire tree manually with `npx @biomejs/biome check --write --organize-imports-enabled=true .` whenever you
  want a clean sweep.

## SPA Overview
The SPA under `app/` is a React + Vite project that ships the marketing pages, API explorer, and statically bundled
OpenAPI artifacts. The build expects fresh schema bundles under `var/openapi`, which are synced into the public assets
via `npm run openapi:prepare` before Vite serves or builds the site. GitHub Pages deploys the compiled assets located in
`dist/` together with the generated OpenAPI bundle. See [docs/spa-deployment.md](docs/spa-deployment.md) for the
deployment workflow and rollback guidance.

## Automation Pipeline Overview
The automation pipeline chains the following stages (implemented in `packages/proxmox-openapi/src/internal/automation/pipeline.ts`):
1. **Scrape** – `@proxmox-openapi/api-scraper` launches Playwright, fetches `apidoc.js`, and persists a raw snapshot (JSON).
2. **Normalize** – `@proxmox-openapi/api-normalizer` converts the raw tree into a versioned intermediate representation (IR).
3. **Generate** – `@proxmox-openapi/openapi-generator` emits OpenAPI 3.1 JSON/YAML documents and enriches tags/metadata.
4. **Validate** – Swagger Parser validates the JSON output and persists a structured run summary.

Run the end-to-end flow with `npx proxmox-openapi pipeline` (or `npm run automation:pipeline`, which proxies the same CLI).
Pass `--mode=full` for a live scrape or `--no-fallback-to-cache` to fail fast when Proxmox endpoints are unreachable. The
command writes a JSON summary to `var/automation-summary.json` when invoked with `--report <path>`. Stage-specific
commands (`scrape`, `normalize`, `generate`) mirror the library internals under `packages/proxmox-openapi/src/internal/`
for targeted debugging.

### Local Development Quickstart
1. Install dependencies with `npm install`.
2. Generate or refresh the OpenAPI artifacts (`npx proxmox-openapi pipeline --mode full --report var/automation-summary.json`).
3. Start the SPA dev server (`npm run ui:dev`). The script copies the current artifacts and launches Vite at
   `http://127.0.0.1:5173`.
4. When finished, stop the dev server with `Ctrl+C`. Regenerate artifacts whenever the API schema changes.

### Devcontainer & launcher helpers
- The devcontainer definition lives under `.devcontainer/`; see [docs/devcontainer.md](docs/devcontainer.md) for the full
  image layout, helper scripts, and troubleshooting tips.
- `./launcher.sh` wraps the most common devcontainer actions:
  - `./launcher.sh vscode --attach-shell` opens the repo in VS Code and waits for the container before spawning a shell.
  - `./launcher.sh get_config customizations.vscode.settings` queries arbitrary paths from `devcontainer.json` if you
    need to script against the configuration.
- The launcher sources `scripts/common.sh`, which also powers other automation helpers. Use `./launcher.sh help` for the
  full command list.

## Working With Automation
The "Project Stage Sync" workflow keeps the delivery project up to date. Review the [automation runbook](docs/automation.md) for triggers,
token requirements, CLI flags, and manual override instructions. When opening a pull request, ensure the relevant issue is linked so the
workflow can reconcile status changes. Use `packages/proxmox-openapi/scripts/automation/format-summary.ts` to turn pipeline summaries into Markdown for PRs.

## Monitoring & Quality
- Run a Lighthouse audit (Performance, Accessibility, Best Practices ≥ 90) against the deployed pages site after significant UI changes.
- Check for broken links using a crawler such as `npx broken-link-checker https://mihailfox.github.io/proxmox-openapi/` before publishing.
- Verify that the embedded Swagger UI loads the latest `openapi/proxmox-ve.json` bundle after every automation pipeline run.

## Testing
- `npm run test:all` executes unit suites for the scraper, normalizer, generator, and automation helpers.
- Playwright suites cover scraper smoke tests (`packages/proxmox-openapi/tests/api-scraper/smoke.spec.ts`) and UI contrast/theme behaviour (`tests/ui/theme.spec.ts`).

## GitHub Action Usage
The bundled action in `.github/actions/proxmox-openapi-artifacts` runs the automation pipeline and ships with the
repository. It now delegates execution to the `@mihailfox/proxmox-openapi` package so GitHub Actions, local scripts, and
downstream consumers rely on an identical code path. After cloning, rebuild the dist output with
`npm run action:package` whenever the source changes.

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
  npx proxmox-openapi pipeline --mode full --report var/automation-summary.json
  npx proxmox-openapi scrape --output var/cache/api-scraper/raw/proxmox-openapi-schema.json
  npx proxmox-openapi generate --output var/openapi --basename proxmox-ve
  ```

- See [docs/packages.md](docs/packages.md) for CLI flag reference, library usage, and release cadence details.

## Schema Releases
- Push tags matching `v*`, semantic versions, or prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`) to trigger `.github/workflows/openapi-release.yml`.
- The workflow regenerates artifacts, runs `npm run openapi:validate`, and publishes assets via `softprops/action-gh-release@v2`.
- See [docs/releases.md](docs/releases.md) for download commands, checksum verification, and release metadata.

## Contributing
1. Install dependencies with `npm install`.
2. Run targeted checks (`npm run lint`, `npm run test:all`, etc.) before pushing.
3. Reference the linked issue in branch names/PR bodies and document any automation impact.
4. See [docs/automation.md](docs/automation.md) for expectations around project updates and troubleshooting.
