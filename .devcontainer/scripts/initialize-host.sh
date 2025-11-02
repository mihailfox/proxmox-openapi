#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# shellcheck source=../scripts/common.sh
source "${repo_root}/scripts/common.sh"

resolve_local_env_placeholders() {
  local value="$1"
  local var replacement

  while [[ "$value" =~ \$\{localEnv:([^}]+)\} ]]; do
    var="${BASH_REMATCH[1]}"
    replacement="${!var:-}"
    value="${value/\$\{localEnv:${var}\}/$replacement}"
  done

  printf '%s\n' "$value"
}

ensure_bind_mount_path() {
  local source_path="$1"
  local target_path="$2"
  local resolved_source

  resolved_source="$(resolve_local_env_placeholders "$source_path")"
  if [[ -z "$resolved_source" ]]; then
    warn "Unable to resolve source path for mount: ${source_path}"
    return
  fi

  case "$target_path" in
    */.codex|*/.claude)
      mkdir -p "$resolved_source"
      ;;
    *)
      mkdir -p "$(dirname "$resolved_source")"
      touch "$resolved_source"
      ;;
  esac
}

collect_mount_entries() {
  local devcontainer_config="${repo_root}/.devcontainer/devcontainer.json"
  local mounts_decl=""

  DEVCONTAINER_JSON="$devcontainer_config"
  mounts_decl="$(command_get_config mounts)" || return 0
  mounts_decl="${mounts_decl//$'\n'/ }"
  [[ -z "$mounts_decl" ]] && return 0

  eval "$mounts_decl"
  if declare -p MOUNTS >/dev/null 2>&1; then
    local entry
    for entry in "${MOUNTS[@]}"; do
      printf '%s\n' "$entry"
    done
  fi
}

while IFS= read -r mount_entry; do
  [[ -z "$mount_entry" ]] && continue

  local source_value=""
  local target_value=""
  local part
  local -a parts=()

  IFS=',' read -r -a parts <<<"$mount_entry"
  for part in "${parts[@]}"; do
    case "$part" in
      source=*)
        source_value="${part#source=}"
        ;;
      target=*)
        target_value="${part#target=}"
        ;;
    esac
  done

  if [[ -z "$source_value" || -z "$target_value" ]]; then
    warn "Skipping mount entry without source/target: $mount_entry"
    continue
  fi

  ensure_bind_mount_path "$source_value" "$target_value"
done < <(collect_mount_entries)
