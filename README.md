# Proxmox OpenAPI Tooling

Utilities for scraping the official Proxmox API viewer, normalizing responses, and publishing OpenAPI specs plus a companion SPA.

## Packages
- `app/`: Vite-based SPA that surfaces the generated specifications.
- `tools/`: CLI packages for scraping, normalization, OpenAPI generation, and automation helpers.
- `.github/workflows/`: CI pipelines for validations, artifact generation, GitHub Pages, and project automation.

## SPA Overview
The SPA under `app/` is a React + Vite project that ships the marketing pages, API explorer, and statically bundled
OpenAPI artifacts. The build expects fresh schema bundles under `var/openapi`, which are synced into the public assets
via `npm run openapi:prepare` before Vite serves or builds the site. GitHub Pages deploys the compiled assets located in
`dist/` together with the generated OpenAPI bundle. See [docs/spa-deployment.md](docs/spa-deployment.md) for the
deployment workflow and rollback guidance.

### Local Development Quickstart
1. Install dependencies with `npm install`.
2. Generate or refresh the OpenAPI artifacts (`npm run automation:pipeline -- --mode=ci`).
3. Start the SPA dev server (`npm run ui:dev`). The script copies the current artifacts and launches Vite at
   `http://127.0.0.1:5173`.
4. When finished, stop the dev server with `Ctrl+C`. Regenerate artifacts whenever the API schema changes.

## Working With Automation
The "Project Stage Sync" workflow keeps the delivery project up to date. Review the [automation runbook](docs/automation.md) for triggers, token requirements, and manual override instructions. When opening a pull request, ensure the relevant issue is linked so the workflow can reconcile status changes.

## Monitoring & Quality
- Run a Lighthouse audit (Performance, Accessibility, Best Practices ≥ 90) against the deployed pages site after significant UI changes.
- Check for broken links using a crawler such as `npx broken-link-checker https://mihailfox.github.io/proxmox-openapi/` before publishing.
- Verify that the embedded Swagger UI loads the latest `openapi/proxmox-ve.json` bundle after every automation pipeline run.

## Contributing
1. Install dependencies with `npm install`.
2. Run targeted checks (`npm run lint`, `npm run test:all`, etc.) before pushing.
3. Reference the linked issue in branch names/PR bodies and document any automation impact.
4. See [docs/automation.md](docs/automation.md) for expectations around project updates and troubleshooting.
