#!/usr/bin/env bash
set -euo pipefail

workspace_folder="${WORKSPACE_FOLDER:-/workspaces/workspace}"

args=("$@")

if [[ ${#args[@]} -eq 0 ]]; then
  args=(up)
fi

needs_workspace=true
for arg in "${args[@]}"; do
  case "$arg" in
    --workspace-folder|--workspace-folder=*)
      needs_workspace=false
      break
      ;;
  esac
done

if $needs_workspace; then
  args+=(--workspace-folder "${workspace_folder}")
fi

exec devcontainer "${args[@]}"
