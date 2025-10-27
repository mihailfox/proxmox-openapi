#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../common.sh
source "${SCRIPT_DIR}/../common.sh"

usage() {
  cat <<'EOF'
Usage: scripts/devcontainer/container-cleanup.sh [options]

By default the script stops and removes Docker containers that look like
devcontainers (names ending with "_devcontainer" or starting with "vscode-"/
"vsc-").

Options:
  --all               Remove all containers and, unless overridden, all images and volumes.
  --include-images    Remove images associated with the targeted containers.
  --include-volumes   Remove named volumes associated with the targeted containers.
  --dry-run           Print the actions without executing them.
  --yes, -y           Skip confirmation prompts (use with --all).
  -h, --help          Show this message and exit.
EOF
}

is_devcontainer_name(){
  local name="$1"
  case "$name" in
    *_devcontainer|devcontainer-*|vscode-*|vsc-*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

collect_target_containers(){
  local mode="$1"
  local -n ids_ref="$2"
  local -n names_ref="$3"

  mapfile -t lines < <(docker ps -a --format '{{.ID}} {{.Names}}' || true)
  declare -A seen=()

  for line in "${lines[@]}"; do
    [[ -z "$line" ]] && continue
    local id name
    id="${line%% *}"
    name="${line#* }"
    name="${name%%,*}"

    [[ -z "$id" || -z "$name" ]] && continue
    if [[ "$mode" != "all" ]] && ! is_devcontainer_name "$name"; then
      continue
    fi

    if [[ -n "${seen[$id]:-}" ]]; then
      continue
    fi

    seen[$id]=1
    ids_ref+=("$id")
    names_ref+=("$name")
  done
}

collect_container_volumes(){
  local -n ids_ref="$1"
  local -n volumes_ref="$2"
  declare -A volume_seen=()

  for id in "${ids_ref[@]}"; do
    mapfile -t vol_names < <(
      docker inspect -f '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{"\n"}}{{end}}{{end}}' "$id" 2>/dev/null || true
    )
    for vol in "${vol_names[@]}"; do
      [[ -z "$vol" ]] && continue
      if [[ -z "${volume_seen[$vol]:-}" ]]; then
        volume_seen[$vol]=1
        volumes_ref+=("$vol")
      fi
    done
  done
}

collect_container_images(){
  local -n ids_ref="$1"
  local -n images_ref="$2"
  declare -A image_seen=()

  for id in "${ids_ref[@]}"; do
    local image
    image="$(docker inspect -f '{{.Image}}' "$id" 2>/dev/null || true)"
    [[ -z "$image" ]] && continue
    if [[ -z "${image_seen[$image]:-}" ]]; then
      image_seen[$image]=1
      images_ref+=("$image")
    fi
  done
}

mode="devcontainer"
include_images=false
include_volumes=false
dry_run=false
skip_confirm=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      mode="all"
      include_images=true
      include_volumes=true
      shift
      ;;
    --include-images)
      include_images=true
      shift
      ;;
    --include-volumes)
      include_volumes=true
      shift
      ;;
    --dry-run)
      dry_run=true
      shift
      ;;
    --yes|-y)
      skip_confirm=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      err "unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  err "docker executable not found in PATH"
  exit 1
fi

declare -a container_ids=()
declare -a container_names=()
collect_target_containers "$mode" container_ids container_names

declare -a volume_names=()
declare -a image_ids=()

if [[ "$mode" == "all" ]]; then
  if $include_volumes; then
    mapfile -t volume_names < <(docker volume ls -q || true)
  fi
  if $include_images; then
    mapfile -t image_ids < <(docker image ls -q || true)
  fi
else
  if $include_volumes && ((${#container_ids[@]} > 0)); then
    collect_container_volumes container_ids volume_names
  fi
  if $include_images && ((${#container_ids[@]} > 0)); then
    collect_container_images container_ids image_ids
  fi
fi

if [[ "$mode" == "all" && $dry_run == false && $skip_confirm == false ]]; then
  components=("containers")
  if $include_images; then components+=("images"); fi
  if $include_volumes; then components+=("volumes"); fi
  summary="${components[*]}"
  warn "About to remove all Docker ${summary}."
  read -r -p "Proceed? [y/N] " answer
  case "$answer" in
    [yY][eE][sS]|[yY]) ;;
    *)
      warn "Aborted."
      exit 0
      ;;
  esac
fi

if ((${#container_ids[@]} > 0)); then
  log "Stopping/removing ${#container_ids[@]} container(s)"
  for idx in "${!container_ids[@]}"; do
    id="${container_ids[$idx]}"
    name="${container_names[$idx]}"
    if $dry_run; then
      log "[dry-run] Would remove container ${name} (${id})"
      continue
    fi
    docker container stop "$id" >/dev/null 2>&1 || true
    docker container rm "$id" >/dev/null 2>&1 || true
    log "Removed container ${name} (${id})"
  done
else
  log "No matching containers found."
fi

if $include_images && ((${#image_ids[@]} > 0)); then
  if $dry_run; then
    log "[dry-run] Would remove ${#image_ids[@]} image(s)"
  else
    log "Removing ${#image_ids[@]} image(s)"
    for image in "${image_ids[@]}"; do
      [[ -z "$image" ]] && continue
      docker image rm "$image" >/dev/null 2>&1 || true
    done
  fi
fi

if $include_volumes && ((${#volume_names[@]} > 0)); then
  if $dry_run; then
    log "[dry-run] Would remove ${#volume_names[@]} volume(s)"
  else
    log "Removing ${#volume_names[@]} volume(s)"
    for volume in "${volume_names[@]}"; do
      [[ -z "$volume" ]] && continue
      docker volume rm "$volume" >/dev/null 2>&1 || true
    done
  fi
fi

if $dry_run; then
  log "Dry run complete. No changes were made."
fi

exit 0
