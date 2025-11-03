# npm Package Release

Follow these steps when publishing `@mihailfox/proxmox-openapi` to GitHub Packages. The GitHub Release workflow (`.github/workflows/release.yml`) runs on a “published” release and handles both npm and artifact publication.

1. **Pre-release validation**
   - Run `npm run automation:pipeline -- --mode=full --report var/automation-summary.json`.
   - Ensure `npm run openapi:validate` passes.
   - Update the changelog and documentation for the upcoming version.
   - Ensure the top “Unreleased” section in `CHANGELOG.md` accurately summarizes user‑visible changes (it becomes the release body).

2. **Versioning & tagging**
   - Tag the release (`git tag -a vX.Y.Z -m "Proxmox OpenAPI vX.Y.Z"`). The GitHub release workflow aligns every package.json (root, CLI, GitHub Action) to `X.Y.Z` using `scripts/set-release-version.mjs`.
   - Push the tag to origin.

3. **Automated publish**
   - The workflow `.github/workflows/release.yml` rebuilds, validates, publishes the npm package, commits the version bump back to `main`, and generates GitHub release assets. It also installs only the released `@mihailfox/proxmox-openapi@X.Y.Z` version inside the GitHub Action packaging step.

## Notes
> The package publishes with provenance enabled. The registry is `https://npm.pkg.github.com` and requires authentication.

4. **Post-publish verification**
   - Install the package using `npm install @mihailfox/proxmox-openapi --registry=https://npm.pkg.github.com` to confirm availability.
   - Verify CLI execution (`npx @mihailfox/proxmox-openapi --mode ci`).

5. **Docs update**
   - Update `docs/packages.md` and the changelog with any new flags or usage notes.
