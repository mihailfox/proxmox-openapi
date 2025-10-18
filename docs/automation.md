# Project Automation Runbook

This document describes the GitHub automation that keeps the Proxmox OpenAPI delivery board in sync, plus the fallback steps when human intervention is required.

## Stage Sync Workflow
- **Location:** `.github/workflows/project-stage-sync.yml`
- **Purpose:** Align the "Stage" single-select on Project #4 with each item's Status so the board reflects real progress.
- **Triggers:** Hourly cron, manual `workflow_dispatch`, issue activity, and `project_card` events (created/edited).
- **Token usage:** The job requests `repository-projects: write`. It prefers the `PROJECT_AUTOMATION_TOKEN` secret for broader scopes and automatically falls back to the default `GITHUB_TOKEN` when the PAT is absent.
- **Beta handling:** Issues attached to milestones containing "beta" are promoted to the Beta stage even if Status is still "In Progress".

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

## GitHub Action Release Checklist
Use this checklist whenever you cut a new release of the Proxmox OpenAPI artifacts action. The workflow at
`.github/workflows/action-release.yml` automates most chores, but manual verification keeps the archive-only
distribution trustworthy.

1. **Prep the workspace**
   - Ensure `main` contains the latest changes destined for the release.
   - Run `npm run action:package` to rebuild `.github/actions/proxmox-openapi-artifacts/dist` locally.
   - Commit the updated dist output, README changes, and changelog entry with a semantic tag (e.g. `feat(action):`).

2. **Tag and publish**
   - Create an annotated tag matching the release (e.g. `git tag -a v1.0.0 -m "Proxmox OpenAPI action v1.0.0"`).
   - Push the tag (`git push origin v1.0.0`). This triggers the `action-release` workflow which rebuilds dist, packages
     `.tgz` and `.zip` bundles, and uploads assets to the GitHub release.

3. **Validate artifacts**
   - Download the uploaded archives and verify they unpack to `proxmox-openapi-artifacts-action/action.yml` + `dist/`.
   - Optionally smoke-test locally by running the action from the unpacked folder using `node dist/index.cjs` with the
     same environment variables the workflow uses.

4. **Update docs**
   - Confirm `README.md` usage instructions reference the new version tag.
   - Append a changelog entry describing notable changes since the last release.

5. **Self-hosted distribution**
   - For environments without marketplace access, publish the `.tgz` link and instructions (see README snippet) so users
     can fetch and unpack the archive into their repositories.
