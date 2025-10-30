# Proxmox OpenAPI Release Artifacts

This guide describes how schema bundles are produced, what each artifact contains, and how to consume the published assets.

## Triggering Releases

Pushing tags that match any of the following patterns kicks off `.github/workflows/openapi-release.yml`:

- `v*`
- `v*.*.*`
- `v*.*.*-alpha.*`
- `v*.*.*-beta.*`
- `v*.*.*-rc.*`

Tags that include `-alpha.`, `-beta.`, or `-rc.` are published as prereleases. All other tags are considered stable.

## Artifact Inventory

Each GitHub release publishes the following files:

| File | Contents |
| ---- | -------- |
| `proxmox-openapi-schema-<tag>.tgz` | Tarball containing the OpenAPI JSON, YAML, checksum manifest, automation summary, and release notes. |
| `proxmox-openapi-schema-<tag>.zip` | ZIP archive of the same contents for Windows consumers. |
| `proxmox-ve.json` | Generated OpenAPI 3.1 document in JSON format. |
| `proxmox-ve.yaml` | Generated OpenAPI 3.1 document in YAML format. |
| `openapi.sha256.json` | SHA-256 checksums for the JSON/YAML payloads. |
| `automation-summary.json` | Structured output from the automation pipeline run. |
| `AUTOMATION_SUMMARY.md` | Human-readable summary of artifact locations. |

## Download Examples

### curl + tar

```bash
TAG="v1.0.0"
BASE_URL="https://github.com/mihailfox/proxmox-openapi/releases/download/${TAG}"
curl -sSLO "${BASE_URL}/proxmox-openapi-schema-${TAG}.tgz"
tar -xzf "proxmox-openapi-schema-${TAG}.tgz"
```

### curl + jq

```bash
TAG="v1.0.0"
BASE_URL="https://github.com/mihailfox/proxmox-openapi/releases/download/${TAG}"
curl -sSLO "${BASE_URL}/openapi.sha256.json"
jq '.' openapi.sha256.json
```

### npm (GitHub Packages)

The OpenAPI JSON can also be fetched through GitHub Packages:

```bash
npm install --registry=https://npm.pkg.github.com/@mihailfox/proxmox-openapi
```

## Verification

1. Download `openapi.sha256.json` from the release assets.
2. Compute local hashes:
   ```bash
   shasum -a 256 proxmox-ve.json
   shasum -a 256 proxmox-ve.yaml
   ```
3. Compare each output with the manifest.

## Release Cadence

- The workflow `.github/workflows/openapi-release.yml` rebuilds the schema, runs validation (`npm run openapi:validate`), and uploads archives via `softprops/action-gh-release@v2`.
- `.github/workflows/npm-package.yml` publishes `@mihailfox/proxmox-openapi` to GitHub Packages for every release tag (including prereleases).
- Tags containing prerelease suffixes are published as prereleases; stable tags are marked as latest.
- Before tagging, ensure `npm run openapi:validate` passes so the bundle is ready for publication.
- Use `npm run automation:summary -- --input var/automation-summary.json` to inspect the current artifact layout when preparing release notes.
