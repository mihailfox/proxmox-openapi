#!/usr/bin/env bash
set -euo pipefail
# set -x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPT_DIR}/scripts/common.sh"
usage_main() {
  cat <<'EOF'
Usage: ./launcher.sh <command> [options]

Commands:
  vscode        Launch the VS Code devcontainer and optionally attach a shell.
  help          Show this message.
  get_config    Query devcontainer.json with dotted paths, no schema knowledge required.

Run "./launcher.sh <command> --help" for command-specific usage.
EOF
}

usage_vscode() {
  cat <<'EOF'
Usage: ./launcher.sh vscode [options]

Options:
  --container-name <name>   Override devcontainer name (default: ${USER}_<working-dir-name_devcontainer)
  --wait-seconds <n>        Seconds to wait for container startup (default: 120)
  --attach-shell            Open an interactive shell after VS Code launches
  --help                    Show this help
EOF
}

usage_get_config() {
  cat <<'EOF'
Usage: ./launcher.sh get_config [options]

Options:
  -e|--envlines Flatten objects into ENV-style lines
  -p|--prefix STR Prefix for generated keys (applies to -e and containerEnv)

Examples:
  get_config remoteUser # => REMOTE_USER='node'
  get_config -e customizations.vscode.settings # => CUSTOMIZATIONS_VSCODE_SETTINGS_EDITOR_FONTSIZE='16' ...
  get_config -e -p DEV_ customizations.vscode # => DEV_CUSTOMIZATIONS_VSCODE_*
  get_config containerEnv # => GH_PAT='...' ...
  get_config -p DEV_ containerEnv # => DEV_GH_PAT='...' ...
  get_config mounts # => MOUNTS=( ... )
  DEVCONTAINER_JSON=/path/to/devcontainer.json get_config remoteUser
EOF
}

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    err "$path not found"
    exit 1
  fi
}

detect_terminal_command() {
  local candidates=()
  if [[ -n "${TERMINAL:-}" ]]; then
    candidates+=("$TERMINAL")
  fi
  candidates+=(
    x-terminal-emulator
    sensible-terminal
    kitty
    alacritty
    wezterm
    gnome-terminal
    konsole
    xfce4-terminal
    tilix
    mate-terminal
    terminator
    lxterminal
    xterm
    urxvt
    foot
    footclient
  )

  for term in "${candidates[@]}"; do
    if command -v "$term" >/dev/null 2>&1; then
      echo "$term"
      return 0
    fi
  done

  return 1
}

launch_in_terminal() {
  local terminal="$1"
  shift
  local command=("$@")

  local cmd_string=""
  printf -v cmd_string '%q ' "${command[@]}"
  cmd_string="${cmd_string% }"

  case "$(basename "$terminal")" in
    kitty)
      "$terminal" --detach -- bash -lc "$cmd_string"
      ;;
    wezterm)
      "$terminal" start -- bash -lc "$cmd_string"
      ;;
    alacritty)
      "$terminal" -e bash -lc "$cmd_string"
      ;;
    gnome-terminal|gnome-terminal-*)
      "$terminal" -- bash -lc "$cmd_string"
      ;;
    konsole)
      "$terminal" --noclose -e bash -lc "$cmd_string"
      ;;
    xfce4-terminal)
      "$terminal" --hold -e bash -lc "$cmd_string"
      ;;
    mate-terminal)
      "$terminal" -- bash -lc "$cmd_string"
      ;;
    tilix)
      "$terminal" -e bash -lc "$cmd_string"
      ;;
    sensible-terminal|terminator)
      "$terminal" -x bash -lc "$cmd_string"
      ;;
    foot|footclient)
      "$terminal" -e bash -lc "$cmd_string"
      ;;
    *)
      "$terminal" -e bash -lc "$cmd_string"
      ;;
  esac
}

wait_for_container() {
  local name="$1"
  local timeout="${2:-120}"
  local attempt=0
  local container_id=""
  while (( attempt < timeout )); do
    if container_id="$(docker ps --filter "name=^/${name}$" --format '{{.ID}}')" && [[ -n "${container_id:-}" ]]; then
      echo "$container_id"
      return 0
    fi
    sleep 1
    ((attempt++))
  done
  return 1
}

ensure_container_running() {
  local name="$1"
  local container_id=""
  if container_id="$(docker ps --filter "name=^/${name}$" --format '{{.ID}}')" && [[ -n "${container_id:-}" ]]; then
    echo "$container_id"
    return 0
  fi

  if container_id="$(docker ps -a --filter "name=^/${name}$" --format '{{.ID}}')" && [[ -n "${container_id:-}" ]]; then
    log "Starting devcontainer ${name}..."
    if docker start "$container_id" >/dev/null; then
      echo "$container_id"
      return 0
    fi
  fi

  return 1
}

run_docker_command_interactive() {
  local -a docker_command=("$@")
  if terminal_cmd="$(detect_terminal_command)"; then
    log "Launching via ${terminal_cmd}..."
    if ! launch_in_terminal "$terminal_cmd" "${docker_command[@]}"; then
      warn "Failed to launch ${terminal_cmd}; using current shell."
      "${docker_command[@]}"
    fi
  else
    log "No terminal launcher detected; using current shell."
    "${docker_command[@]}"
  fi
}

command_vscode() {
  local dir
  local base
  dir="$(pwd)"
  base="$(basename "$dir")"
  local container_name
  container_name="${base}_devcontainer"
    local wait_seconds=120
  local attach_shell=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --container-name)
        [[ $# -ge 2 ]] || { err "Missing value for --container-name"; usage_vscode; exit 1; }
        container_name="$2"
        shift 2
        ;;
      --wait-seconds)
        [[ $# -ge 2 ]] || { err "Missing value for --wait-seconds"; usage_vscode; exit 1; }
        wait_seconds="$2"
        shift 2
        ;;
      --attach-shell)
        attach_shell=true
        shift
        ;;
      --help)
        usage_vscode
        return 0
        ;;
      *)
        err "Unknown option: $1"
        usage_vscode
        exit 1
        ;;
    esac
  done

  local devcontainer_file=".devcontainer/devcontainer.json"
  require_file "$devcontainer_file"

  if ! command -v code >/dev/null 2>&1; then
    err "VS Code executable not found (command 'code')."
    exit 1
  fi

  if ! command -v docker >/dev/null 2>&1; then
    err "docker executable not found."
    exit 1
  fi

    hex="$(printf '%s' "$dir" | od -A n -t x1 | tr -d ' \t\n')"

  if ! code --folder-uri="vscode-remote://dev-container%2B${hex}/workspaces/${base}"; then
    err "VS Code devcontainer failed to initialize."
    exit 1
  fi

  log "Waiting up to ${wait_seconds}s for devcontainer '${container_name}'..."
  local container_id=""
  if ! container_id="$(wait_for_container "$container_name" "$wait_seconds")"; then
    err "Timed out waiting for devcontainer '${container_name}'."
    exit 2
  fi

  if ! $attach_shell; then
    return 0
  fi

  local sanitized_json
  if ! sanitized_json="$(sanitize_devcontainer_json "$devcontainer_file")"; then
    err "Unable to read $devcontainer_file"
    exit 2
  fi

  local remote_user
  remote_user="$(jq -r '.remoteUser // empty' "$sanitized_json")"
  rm -f "$sanitized_json"

  if [[ -z "$remote_user" ]]; then
    warn "remoteUser not set in devcontainer.json; defaulting to 'node'"
    remote_user="node"
  fi

  local docker_command=(docker exec -it --user "$remote_user" -w "/workspaces/$base" "$container_id" bash)
  run_docker_command_interactive "${docker_command[@]}"
}

command_get_config() {
  local envlines=0 prefix=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -e|--env|--envlines) envlines=1; shift ;;
      -p|--prefix) prefix="$2"; shift 2 ;;
      -h|--help) usage_get_config; return 0 ;; 
      --) shift; break ;;
      -*) echo "unknown option: $1" >&2; return 2 ;;
      *) break ;;
    esac
  done

  local path="${1-}"
  local file="${2:-${DEVCONTAINER_JSON:-.devcontainer/devcontainer.json}}"
 
  if [[ -z "$path" ]]; then
    echo "usage: get_config [-e] [-p PREFIX] <json.path> [file]" >&2
    return 2
  fi

  local jq_output
  if ! jq_output="$(devcontainer_get_config_value "$path" "$file" "$prefix" "$envlines")"; then
    return 2
  fi

  printf '%s\n' "$jq_output"
}


main() {
  if [[ $# -eq 0 ]]; then
    usage_main
    exit 1
  fi

  local cmd="$1"
  shift

  case "$cmd" in
    vscode|code)
      command_vscode "$@"
      ;;
    help|--help|-h)
      usage_main
      ;;
    get_config)
      command_get_config "$@"
      ;;
    *)
      err "Unknown command: $cmd"
      usage_main
      exit 1
      ;;
  esac
}

main "$@"
