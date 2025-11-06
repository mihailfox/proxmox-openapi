# Changelog

All notable changes to this project are documented here. The format follows
Common Changelog with the sections: Added, Changed, Deprecated, Removed, Fixed, Security.

Notes for maintainers:
- Keep the Unreleased section up-to-date. Our release workflow copies it into
  the release notes whenever a tagged heading is missing, so remember to move
  entries into the new version section right after publishing.
- Dates use ISO format (YYYY-MM-DD). The project requires Node.js 24+.

## Unreleased

### Added
- CI/Pages: run Lighthouse audits after deployment and commit reports to the `performance-reports` branch for historical tracking.

### Changed
- CI: enforce GitHub concurrency groups across every workflow so superseded runs cancel automatically.
- CI/Pages: install the latest published CLI from GitHub Packages before automation runs.
- Release workflow: push version bumps back to `main` after publishing.
- Release tooling: append the artifact inventory after changelog-driven release notes for consistent release bodies (#101).
- Devcontainer: persist shell history via `${HOME}/.dev_con_bash_history` to isolate workspaces (#101).

### Fixed
- Release tooling: stabilize changelog-driven release notes fallback logic (#100).
- CI/Actions: reference the local bundled action to avoid resolution issues (#74).
- CI/Release: use generated action in release workflow for consistent behaviour (#73).
- GitHub Action: build the local CLI workspace when the published package is unavailable.

### Removed
- Devcontainer: drop the claude-code installer from post-create provisioning (#101).

## v0.2.9 — 2025-11-02

### Changed
- CI/Release: consume published CLI within release workflow for end‑to‑end validation.
- CI/Release: refactor workflow orchestration for clarity and reliability.

### Fixed
- CLI: ensure `proxmox-openapi` binary is linked before artifact generation.
- CI/Release: specify the GitHub registry in the npm availability check.

## v0.2.8 — 2025-11-02

### Changed
- Devcontainer: expand zstd support for faster local operations.

## v0.2.7 — 2025-11-02

### Fixed
- Automation: build CLI before generating OpenAPI artifacts (#63).

## v0.2.6 — 2025-11-02

### Fixed
- Release authentication: address npm registry auth issues during release (#71, #70).
- CI: use dedicated release token for registry checks.

## v0.2.5 — 2025-11-02

### Fixed
- Release: correct npm availability step to use the GitHub registry.

## v0.2.4 — 2025-10-19

### Added
- OpenAPI: group operations by category to improve explorer navigation (#46).

### Fixed
- SPA: smoother Swagger UI loading experience (#43).

### Changed
- CI: unify release pipeline configuration (#41).

## v0.2.3 — 2025-10-19

### Fixed
- Workflows: normalize release tag handling for prereleases and RCs.
- Release hygiene and dynamic versioning (#38).

## v0.2.2 — 2025-10-19

### Security
- npm provenance: grant `id-token` permission to enable signed attestations (#34).

## v0.2.1 — 2025-10-19

### Added
- Repository licensing: add GPL-3.0 LICENSE file (#33).

## v0.2.0 — 2025-10-19

### Added
- npm: initial publication of `@mihailfox/proxmox-openapi` package (#27, #28).
- SPA: initial Swagger Explorer app and automation runbook/docs (#17, #18).
- GitHub Action: v1 release assets for generating OpenAPI artifacts (#19).

### Changed
- Package visibility: mark as public; set npm access to public.
- Build: align `tsup`/TypeScript configs; unblock declaration builds (#31, #35).
