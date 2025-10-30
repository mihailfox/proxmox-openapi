# Project Automation Runbook

This document describes the GitHub automation that keeps the Proxmox OpenAPI delivery board in sync, plus the fallback steps when human intervention is required.

## Stage Sync Workflow
- **Location:** `.github/workflows/project-stage-sync.yml`
- **Purpose:** Align the "Stage" single-select on Project #4 with each item's Status so the board reflects real progress.
- **Triggers:** Hourly cron, manual `workflow_dispatch`, issue activity, and `project_card` events (created/edited).
- **Token usage:** The job requests `repository-projects: write`. It prefers the `PROJECT_AUTOMATION_TOKEN` secret for broader scopes and automatically falls back to the default `GITHUB_TOKEN` when the PAT is absent.
- **Beta handling:** Issues attached to milestones containing "beta" are promoted to the Beta stage even if Status is still "In Progress".

### Pipeline Modes & Flags
- `npm run automation:pipeline` drives the scrape → normalize → generate flow implemented in `tools/automation/src/pipeline.ts`.
- **CI mode (`--mode=ci`)** is the default. It operates offline, reuses cached snapshots, and validates existing artifacts.
- **Full mode (`--mode=full`)** performs a live scrape using Playwright and honours `--offline`/`--fallback-to-cache` overrides:
  - `--fallback-to-cache` / `--no-fallback-to-cache` control whether cached snapshots are reused when scraping fails.
  - `--offline` forces cache usage even in full mode (useful for air-gapped runners).
- All stages respect optional output paths: `--raw-output`, `--ir-output`, `--openapi-dir`, and `--basename`.
- Pass `--report <path>` to emit an automation summary (see `var/automation-summary.json`). The summary feeds status updates and PR notes.

### Regression Summary & Reporting
- The pipeline logs a QA digest via `logRegressionReport()`—checksum comparisons against `tools/automation/data/regression/openapi.sha256.json`,
  normalization counts, and JSON↔YAML parity checks.
- Convert summary JSON into Markdown using `tsx tools/automation/scripts/format-summary.ts --input var/automation-summary.json`.
- Refresh baseline hashes after intentional schema changes with `npm run regression:record` (wraps `tools/automation/scripts/update-regression-baseline.ts`).
- Regression Vitest specs (`tests/regression`) gate merges on checksum parity, tag counts, and repo hygiene (no generated artifacts in `docs/openapi/`).

## Manual Overrides
If automation is paused or lacks access, update Stage manually for affected items:
1. Open the project item in GitHub (Project #4, "Proxmox OpenAPI Delivery").
2. Set the Status column to the desired value. When the workflow resumes, it will reconcile Stage automatically.
3. For urgent fixes, run the workflow manually (`Actions` → `Project Stage Sync` → `Run workflow`).
4. Should an item need to bypass automation (e.g., experimental branches), pin the desired Stage and leave a comment on the issue explaining why; revisit once the condition clears.

## Troubleshooting
- **Workflow permissions:** Ensure `PROJECT_AUTOMATION_TOKEN` is defined with `project` scope if the default token cannot write project fields.
- **Audit logs:** Workflow logs show each item updated (`Updated Stage for #<number>`). Use `toJSON` helpers or add local logging inside the script for deeper debugging.
- **Rate limits:** The job processes the first 100 items per run. If the project grows, adjust the query pagination (`items(first: ...)`).
- **Rollback:** If a bad update lands, revert by re-running the workflow after correcting Status, or manually set Stage to the expected value following the steps above.

## Release Checklist
Use this checklist when tagging a new release:

1. **Prepare artifacts**
   - Run `npm run automation:pipeline -- --mode=ci --report var/automation-summary.json` locally or in CI.
   - Confirm `npm run regression:test` and `npm run openapi:validate` succeed.
   - Stage schema bundles with `npm run openapi:release:prepare -- <tag>` if you need to preview release notes.

2. **Tag and push**
   - Create an annotated tag (for example `git tag -a v1.2.0 -m "Proxmox OpenAPI v1.2.0"`).
   - Push the tag (`git push origin v1.2.0`).

3. **Automated workflows**
   - `.github/workflows/openapi-release.yml` regenerates artifacts, writes release notes, and publishes assets via `softprops/action-gh-release@v2`.
   - `.github/workflows/npm-package.yml` builds and publishes `@mihailfox/proxmox-openapi` to GitHub Packages with provenance.

4. **Post-publish validation**
   - Download archives from the GitHub release and verify checksums (`openapi.sha256.json`).
   - Install the npm package using `npm install @mihailfox/proxmox-openapi --registry=https://npm.pkg.github.com` to confirm distribution succeeds.

5. **Documentation updates**
   - Update `docs/releases.md` and `docs/packages.md` with any noteworthy changes.
   - Ensure the changelog entry captures schema diffs or CLI behaviour updates since the last release.
