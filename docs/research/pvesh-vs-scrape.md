# pvesh API Definitions vs. Scraped Viewer Data

## Data sources
- **Official Perl modules**: Parsed from the upstream Proxmox repositories (`pve-manager`, `pve-cluster`, `pve-storage`, `pve-firewall`, `pve-ha-manager`, `pve-access-control`, `pve-container`, `qemu-server`, and `pve-network`). The script at `tools/analysis/src/pvesh-comparison.ts` walks each checkout (including `src/` subtrees) and inspects every `package PVE::API2::*` for `register_method` calls to reconstruct the REST tree.
- **Scraped dataset**: `var/cache/api-normalizer/ir/proxmox-openapi-ir.json` generated from the interactive API viewer. The comparison script loads every normalized endpoint and aggregates them by method and path.

## How to reproduce
Run the TypeScript helper after cloning the upstream Perl repositories alongside this project:

```bash
npx tsx --tsconfig tools/analysis/tsconfig.json \
  tools/analysis/src/pvesh-comparison.ts \
  --official /path/to/pve-manager \
  --official /path/to/pve-cluster \
  --official /path/to/pve-storage \
  --official /path/to/pve-firewall \
  --official /path/to/pve-ha-manager \
  --official /path/to/pve-access-control \
  --official /path/to/pve-container \
  --official /path/to/qemu-server \
  --official /path/to/pve-network \
  --output docs/research/pvesh-comparison.json
```

The script prints a human-readable summary and emits `docs/research/pvesh-comparison.json` for downstream analysis.

## High-Level Parity
| Metric | Official Perl modules | Scraped viewer |
| --- | --- | --- |
| Endpoints discovered | 429 | 628 |
| Shared endpoints | 428 | 428 |
| Exclusive endpoints | 1 (root directory index) | 200 |

The JSON report captures the exact counts for the combined dataset.

### HTTP verbs
The HTTP method mix is close, but the viewer advertises many more operations overall—especially `GET` and `POST` variants under `nodes/*` and `cluster/*` that are not defined in the parsed Perl modules.

### Top-level resource coverage
Official modules span the same major resource trees as the viewer, but they stop short of the complete set of child operations published online. The viewer lists an additional 200 endpoints concentrated under `/nodes`, `/cluster`, and `/access`.

| Resource | Official | Scraped |
| --- | --- | --- |
| `/nodes` | 198 | 345 |
| `/cluster` | 190 | 226 |
| `/access` | 27 | 44 |
| `/storage` | 5 | 5 |
| `/pools` | 7 | 7 |
| `/version` | 1 | 1 |

These values are copied directly from the comparison report’s top-level aggregates.

## Shared coverage
Nearly the entire tree (428 endpoints) lines up one-to-one. This includes:
- Core administrative APIs (`/cluster/config`, `/cluster/log`, `/nodes/{node}/status/*`).
- Guest management operations for both QEMU and LXC (`/nodes/{node}/qemu/{vmid}/status/*`, `/nodes/{node}/lxc/{vmid}/config`, etc.).
- Storage, backup, replication, and task management routes.

The only official-only endpoint is `GET /`, the directory index that seeds the viewer with top-level collections. The browser-based viewer does not expose that raw root listing.

## Viewer-only endpoints (200 total)
The unmatched endpoints fall into three buckets (counts derived via `jq` grouping of the JSON report):

| Top-level path | Endpoints | Notes |
| --- | --- | --- |
| `/nodes` | 147 | Primarily Ceph lifecycle helpers (e.g., `/nodes/{node}/ceph/mds`, `/nodes/{node}/ceph/mgr`, `/nodes/{node}/ceph/osd`) and other node plugins that register sub-commands through runtime helper functions rather than explicit `register_method` calls. |
| `/cluster` | 36 | Cluster firewall alias/IP set rule management (e.g., `/cluster/firewall/aliases`, `/cluster/firewall/ipset`) that are built from mixin classes such as `PVE::API2::Firewall::AliasesBase`. These handlers execute `register_method` indirectly when `register_handlers` runs, so static inspection misses them. |
| `/access` | 17 | Interactive authentication flows introduced in newer builds (TFA management, API token CRUD, password reset helpers). They appear in the hosted viewer but are absent from the open-source `pve-access-control` snapshot used in this comparison. |

These gaps underline two important behaviors:
1. **Runtime registration** – Several Perl classes rely on helper routines that call `$class->register_method` dynamically. The static scanner only sees the definitions on the base class, so the derived API namespaces (e.g., `PVE::API2::Firewall::ClusterAliases`) look empty even though runtime code wires them up. Supporting these requires either executing the Perl modules or embedding a heuristic that propagates base‑class registrations to each subclass encountered.
2. **Proprietary or newer features** – Viewer-only endpoints under `/access` track two-factor configuration and token workflows that are not present in the public `pve-access-control` repository revision. This matches the upstream split where certain enterprise features land before the source drops or remain proprietary.

## Takeaways
- The automated scraper captures far more operations than the static Perl tree visible in public repositories—especially for Ceph management, firewall configuration, and identity workflows. Consumers relying on the open-source modules must account for these dynamic or proprietary extensions.
- Static analysis remains useful for validating shared coverage (428 routes) and ensuring that module-level regressions are caught quickly. Augmenting the analysis with runtime introspection helps close the gap for mixin-based namespaces.
- The generated JSON (`docs/research/pvesh-comparison.json`) serves as a durable artifact for diffs; rerunning the script after upstream updates immediately highlights any shifts in the intersection/variance counts.
