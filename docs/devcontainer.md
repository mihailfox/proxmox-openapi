# Devcontainer Reference

The repository ships a Node‑based Devcontainer image with a curated toolchain for building, testing, and releasing the
Proxmox OpenAPI tooling.

## Base Image & Features

The workspace is built on `mcr.microsoft.com/devcontainers/typescript-node:24-bookworm` and layers several features:

- Docker outside of Docker
- GitHub CLI
- Facebook's `dotslash`
- Local `cli-tools` bundle (ripgrep, fd, bat, lsd, git-delta, helix, jq, yq, gojq, fzf, shellcheck, shfmt, lynx)
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
needed.
