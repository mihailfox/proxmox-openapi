# SPA Deployment & Pages Workflow

This guide covers how the single-page application (SPA) is produced, deployed with GitHub Pages, and safely rolled back
when needed. It complements the automation runbook and focuses on the assets that live under `app/`.

## Build & Deployment Pipeline

- CI runs `.github/workflows/pages.yml` on pushes to `main` or manual dispatches.
- The workflow executes `npm run automation:pipeline -- --mode=ci --report var/automation-summary.json` to refresh the
  raw snapshot, normalized intermediate representation, and OpenAPI bundles.
- `npm run pages:build` copies the OpenAPI artifacts into `dist/openapi/`, writes a `404.html` fallback, and stages the
  compiled SPA inside `var/pages/` for deployment.
- `actions/deploy-pages@v4` publishes the artifact to the `github-pages` environment. The `VITE_SITE_BASE` environment
  variable ensures the site is scoped to `/proxmox-openapi/`.

### Manual Publish

To generate the same artifact locally (useful for debugging or preview builds):

```bash
npm install
npm run automation:pipeline -- --mode=full --report var/automation-summary.json
npm run pages:build
```

The packaged site will be available under `var/pages/`. You can inspect it locally with a static server, e.g.
`npx serve var/pages`.

## Publishing Cadence

- The Pages workflow is the source of truth and runs automatically on every `main` push that touches SPA or schema
  inputs.
- Feature branches should rely on the preview provided by `npm run ui:dev`. Only merge once the targeted unit suites and
  UI end-to-end tests pass locally.
- Schedule a manual dispatch before major releases if automation has been paused or when a regenerated schema needs to
  ship independently of code changes.

## API Explorer Responsiveness

- The explorer payload is lazy loaded. End users must click **Load API Explorer** inside the placeholder panel; this
  keeps the initial route fast on GitHub Pages.
- Schema documents are fetched and sanitised before mounting Swagger UI so large inline examples do not freeze the UI.
  Expect operation panels to open with collapsed content (`docExpansion: none`) and alphabetically sorted tags/paths.
- Syntax highlighting remains enabled. If a future schema change reintroduces slowness, capture a performance profile
  and consider trimming oversized examples or deferring additional components via the Swagger UI plugin API.
- In dark mode the primary explorer button uses a blue gradient for AA contrast, and the **host**/**port** inputs render
  with light text to maintain readability.

## Rollback Procedure

1. Identify the previous good commit SHA from the `main` history.
2. Create a hotfix branch and revert the offending changes (`git revert <sha>`), or cherry-pick the last known-good SPA
   commit onto a new branch.
3. Merge the fix into `main`; the Pages workflow will redeploy automatically with the restored assets.
4. If an immediate revert is not possible, re-run the Pages workflow using the "Run workflow" button and specify the
   earlier commit via the workflow dispatch input.

Document the incident in the pull request or project tracker, including Lighthouse results and any remediation steps.
