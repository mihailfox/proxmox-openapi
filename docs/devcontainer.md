# Devcontainer Reference

The repository ships a Node‑based Devcontainer image with a curated toolchain for building, testing, and releasing the
Proxmox OpenAPI tooling.

## Base Image & Features

The workspace is built on `mcr.microsoft.com/devcontainers/typescript-node:24-bookworm` and layers several features:

- Docker outside of Docker
- GitHub CLI
- Local `cli-tools` bundle (ripgrep, fd, bat, lsd, git-delta, helix, jq, yq, gojq, fzf, shellcheck, shfmt, lynx, zstd)
- Devcontainers CLI

### Custom CLI Feature

The repo defines `.devcontainer/features/cli-tools`. Each tool can toggle between APT packages or GitHub release assets
and supports per-tool overrides. Example configuration:

```jsonc
"./features/cli-tools": {
  "fzfMethod": "gh-release",
  "fzfVersion": "0.66.1",
  "yqTag": "v4.48.0",
  "shellcheckMethod": "gh-release",
  "shellcheckVersion": "0.10.0",
  "shfmtMethod": "apt"
}
```

- `*Method` — choose the install source (`apt` or `gh-release`).
- `*Version` — plain semantic version; `latest` resolves the newest release.
- `*Tag` — explicit Git tag (takes precedence over version).

When no overrides are provided, the installer fetches the latest GitHub release (or uses the package manager).

- Zstd archives are now first-class citizens: enabling the `zstd` option installs the system package, and the common
  installer handles `.zst` / `.tar.zst` payloads via `unzstd`.

### Default Behavior

- GitHub-hosted tools install the newest published release when `*Version` and `*Tag` are omitted.
- The feature prefers authenticated `gh` lookups and automatically falls back to anonymous REST calls.
- APT-backed tools reuse the distro packages unless explicitly toggled to `gh-release`.

## Host Initialization

Before the container starts, `.devcontainer/scripts/initialize-host.sh` runs on the host to create bind mount targets.
The script reuses `command_get_config` from `scripts/common.sh`
to enumerate the `mounts` array in `devcontainer.json`, resolve `${localEnv:...}` placeholders, and pre-create the
corresponding files or directories. This prevents Docker from failing when optional configuration files are absent
locally while still allowing host ↔ container synchronization.

## Lifecycle Scripts

`.devcontainer/scripts/` contains:

- `on-create.sh` — runs on first container creation (npm updates, shell configuration).
- `update-content.sh` — refreshes project dependencies and Playwright artifacts.
- `post-create.sh` — post-provision hooks (if any).

Shared logic (logging, devcontainer JSON helpers, package installers) lives in `scripts/common.sh`.

## Useful Commands

- Query config values: `DEVCONTAINER_JSON=.devcontainer/devcontainer.json scripts/common.sh devcontainer_get_config_value features`
- Clean up stale containers: `scripts/devcontainer/container-cleanup.sh --help`
- Inspect or rebuild locally: `devcontainer up --workspace-folder .`

## Authentication

The Devcontainer exposes the host's `GH_PAT`/`GH_TOKEN`/`GITHUB_TOKEN` via `containerEnv`. When authenticated, the CLI
feature prefers GitHub's GraphQL/REST APIs (via `gh`) for release resolution, falling back to anonymous requests if
needed. `GITHUB_PERSONAL_ACCESS_TOKEN` is also forwarded for workflows that expect that specific variable name.
