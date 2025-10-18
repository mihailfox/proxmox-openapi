# Proxmox OpenAPI Release Artifacts

This guide describes how schema bundles are produced, what each artifact contains, and how to consume the published
assets.

## Artifact Inventory

Each GitHub release publishes the following files:

| File | Contents |
| ---- | -------- |
| `proxmox-openapi-schema-<tag>.tgz` | Tarball containing the OpenAPI JSON, YAML, checksum manifest, automation summary, and release notes. |
| `proxmox-openapi-schema-<tag>.zip` | ZIP archive of the same contents for Windows consumers. |
| `proxmox-ve.json` | Generated OpenAPI 3.1 document in JSON format. |
| `proxmox-ve.yaml` | Generated OpenAPI 3.1 document in YAML format. |
| `openapi.sha256.json` | Checksums (SHA-256) for the JSON/YAML payloads. |
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

- Releases are triggered manually from the `main` branch once the automation pipeline has generated fresh artifacts.
- The workflow `.github/workflows/openapi-release.yml` rebuilds the schema, runs validation (`npm run openapi:validate`),
  and uploads archives.
- Before tagging, ensure `npm run regression:test` passes so the baseline remains current.
- Use `npm run automation:summary -- --input var/automation-summary.json` to inspect the current artifact layout when
  preparing release notes.
