# Contributing

Thanks for contributing to Proxmox OpenAPI. This guide summarizes how to propose changes and the documentation style we use repo‑wide.

## Getting Started
- Fork the repository and create a feature branch from `main`.
- Install dependencies with `npm install`.
- Run checks locally:
  - `npm run lint`
  - `npm run test:all`
  - `npm run action:verify` (verifies action `dist/` is up to date)

## Conventional Commits
- Use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`).
- Scope changes when helpful (`fix(ci):`, `docs(action):`).
- Keep commits focused and small.

## Changelog
- Update `CHANGELOG.md` under the “Unreleased” section using Common Changelog categories:
  - Added, Changed, Deprecated, Removed, Fixed, Security
- The release workflow uses the “Unreleased” section as the next release body.

## Documentation Style
We use a “Conventional Docs” structure so documentation reads consistently across files.

- Section Order
  - Purpose: one sentence that states what this thing does.
  - Requirements: versions, OS, auth.
  - Installation: commands (if applicable).
  - Usage: primary commands or workflow steps.
  - Options/Inputs: tables for flags or action inputs.
  - Outputs/Results: what files or artifacts appear and where.
  - Examples: short, copy‑pasteable snippets.
  - Versioning & Release: how this piece participates in releases.
  - Notes: constraints, caveats, callouts.

- Style Rules
  - Present tense, imperative voice. Avoid “will/would/should/might”.
  - One task per code block; always specify the language for fences.
  - Use short bullets and the same table headings across files.
  - Prefer “Do X” over “You can/You should X”.
  - Keep cross‑links near Usage or Versioning sections.

- Tables
  - For options/inputs include columns: Name/Flag, Description, Default, Required.
  - Use `—` to indicate “no default”.

## Opening a PR
- Link the issue in the PR description and branch name when possible.
- Describe user‑visible changes and whether automation artifacts change.
- If docs change, confirm they follow the style above.

## Code of Conduct
- Be respectful, collaborative, and constructive in issues and reviews.

