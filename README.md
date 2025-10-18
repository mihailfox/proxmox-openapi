# Proxmox OpenAPI Tooling

Utilities for scraping the official Proxmox API viewer, normalizing responses, and publishing OpenAPI specs plus a companion SPA.

## Packages
- `app/`: Vite-based SPA that surfaces the generated specifications.
- `tools/`: CLI packages for scraping, normalization, OpenAPI generation, and automation helpers.
- `.github/workflows/`: CI pipelines for validations, artifact generation, GitHub Pages, and project automation.

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
