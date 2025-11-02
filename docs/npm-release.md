# npm Package Release Checklist

Follow these steps when publishing `@mihailfox/proxmox-openapi` to GitHub Packages.

1. **Pre-release validation**
   - Run `npm run automation:pipeline -- --mode=full --report var/automation-summary.json`.
   - Ensure `npm run openapi:validate` passes.
   - Update the changelog and documentation for the upcoming version.
   - Ensure the top “Unreleased” section in `CHANGELOG.md` accurately summarizes user‑visible changes (it becomes the release body).

2. **Versioning & tagging**
   - Bump the package version in `packages/proxmox-openapi/package.json`.
   - Commit the change and tag it (`git tag -a vX.Y.Z -m "Proxmox OpenAPI npm vX.Y.Z"`).
   - Push the tag to origin.

3. **Automated publish**
   - The workflows `.github/workflows/openapi-release.yml` and `.github/workflows/npm-package.yml` rebuild and publish artifacts on tag push (GitHub release + npm package).

4. **Post-publish verification**
   - Install the package using `npm install @mihailfox/proxmox-openapi --registry=https://npm.pkg.github.com` to confirm availability.
   - Verify CLI execution (`npx @mihailfox/proxmox-openapi --mode ci`).

5. **Docs update**
   - Update `docs/packages.md` and the changelog with any new flags or usage notes.
