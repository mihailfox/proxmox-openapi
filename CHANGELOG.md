# Changelog

All notable changes to this project are documented here. The format follows
Common Changelog with the sections: Added, Changed, Deprecated, Removed, Fixed, Security.

Notes for maintainers:
- Keep the Unreleased section up-to-date. Our release workflow uses its
  content as the body of the GitHub release notes for the next tag.
- Dates use ISO format (YYYY-MM-DD). The project requires Node.js 24+.

## Unreleased

### Changed
- CI/Pages: simplify GitHub Pages workflow to reduce steps.

### Fixed
- CI/Actions: reference the local bundled action to avoid resolution issues (#74).
- CI/Release: use generated action in release workflow for consistent behaviour (#73).

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

## npm package line — v2.2.x (2025-10-19)

The repository also tags npm-focused versions to track the CLI/library payload:

### v2.2.3 – v2.2.7
- Build: align npm release payload with v2.2.5 and refine packaging (#37).

### v2.2.4 – v2.2.5
- Package visibility and access updates for public publication.

### v2.2.3
- Build: fix `tsup`/tsconfig alignment (#35).

---

Historical notes:
- 2025-10-27: devcontainer standardized for local development (#48).
- 2025-11-01: enforce runtime‑only artifacts and add Biome pre‑commit hook.
