# shellcheck disable=SC2148

_log_source_tag(){
  local utils_path="${BASH_SOURCE[0]}"
  local source_file=""

  for source_file in "${BASH_SOURCE[@]:1}"; do
    if [[ -n "$source_file" && "$source_file" != "$utils_path" ]]; then
      break
    fi
  done

  if [[ -z "$source_file" || "$source_file" == "$utils_path" ]]; then
    source_file="$utils_path"
  fi

  source_file="${source_file##*/}"
  source_file="${source_file%.*}"

  if [[ -z "$source_file" ]]; then
    source_file="script"
  fi

  printf '%s' "$source_file"
}

_log_colors_enabled(){
  if [[ -n "${NO_COLOR:-}" ]]; then
    return 1
  fi
  local stream="$1"
  case "$stream" in
    stdout)
      [[ -t 1 ]]
      ;;
    stderr)
      [[ -t 2 ]]
      ;;
    *)
      return 1
      ;;
  esac
}

_log_emit(){
  local severity="$1"
  local stream="$2"
  shift 2
  local message="$*"
  local tag
  tag="[$(_log_source_tag)]"
  local indicator=""
  local color=""
  local reset=""

  case "$severity" in
    info)
      indicator=""
      ;;
    warn)
      indicator="[WARN]"
      color="\033[33m"
      ;;
    error)
      indicator="[ERROR]"
      color="\033[31m"
      ;;
    *)
      indicator="[${severity^^}]"
      ;;
  esac

  if [[ -n "$color" ]] && _log_colors_enabled "$stream"; then
    reset="\033[0m"
  else
    color=""
    reset=""
  fi

  local prefix="$tag$indicator"
  if [[ -n "$color" ]]; then
    prefix="${color}${prefix}${reset}"
  fi

  if [[ "$stream" == "stderr" ]]; then
    printf '%s %s\n' "$prefix" "$message" >&2
  else
    printf '%s %s\n' "$prefix" "$message"
  fi
}

log(){ _log_emit info stdout "$*"; }
warn(){ _log_emit warn stderr "$*"; }
err(){ _log_emit error stderr "$*"; }

_sudo_exec(){
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    "$@"
  fi
}

sanitize_devcontainer_json(){
  local file="$1"
  local tmp
  tmp="$(mktemp)" || return 1
  if ! sed -E 's/^[[:space:]]*\/\/.*$//' "$file" >"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  printf '%s\n' "$tmp"
}

devcontainer_get_config_value(){
  local path="$1"
  local file="${2:-${DEVCONTAINER_JSON:-.devcontainer/devcontainer.json}}"
  local prefix="${3:-}"
  local envlines="${4:-0}"

  if [[ -z "$path" ]]; then
    echo "usage: devcontainer_get_config_value <json.path> [file] [prefix] [envlines]" >&2
    return 2
  fi

  if [[ ! -f "$file" ]]; then
    echo "file not found: $file" >&2
    return 2
  fi

  local last name
  last="${path##*.}"
  name="$(sed -E 's/([a-z0-9])([A-Z])_/\1_\2_/g; s/([a-z0-9])([A-Z])/\1_\2/g; s/[^A-Za-z0-9_]/_/g' <<<"$last" | tr '[:lower:]' '[:upper:]')"

  local jq_filter jq_tmp json_tmp jq_output

  read -r -d '' jq_filter <<'JQ' || true
def parse_path($p):
  $p
  | split(".")
  | map(if test("^[0-9]+$") then (tonumber) else . end);

def as_bash_array:
  "(" + ( map(@sh) | join(" ") ) + ")";

def env_key:
  .
  | gsub("\\."; "_")
  | gsub("([a-z0-9])([A-Z])"; "\\1_\\2")
  | ascii_upcase
  | $prefix + .;

def env_lines:
  to_entries | map( (.key|env_key) + "=" + (.value|@sh) ) | .[];

def flatten:
  (paths(scalars) as $p
    | { ( $p | map(tostring) | join(".") ) : getpath($p) }
  ) | add;

def print_scalar($name):
  ($prefix + $name) + "=" + ( . | @sh );

def print_value($name):
  if type == "null" then
    empty
  elif type == "object" then
    if $envlines == 1 then
      (flatten | env_lines)
    elif ($p == "containerEnv") then
      env_lines
    else
      tojson
    end
  elif type == "array" then
    ($prefix + $name) + "=" + (as_bash_array)
  else
    print_scalar($name)
  end;

(getpath(parse_path($p)) // empty) as $v
| if $v == null then
    empty
  else
    $v | print_value($name)
  end
JQ

  jq_tmp="$(mktemp)" || return 1
  printf '%s\n' "$jq_filter" >"$jq_tmp"

  if ! json_tmp="$(sanitize_devcontainer_json "$file")"; then
    rm -f "$jq_tmp"
    echo "failed to sanitize $file" >&2
    return 2
  fi

  if ! jq_output="$(
    jq -r --arg p "$path" --arg name "$name" --arg prefix "$prefix" --argjson envlines "$envlines" -f "$jq_tmp" "$json_tmp"
  )"; then
    rm -f "$jq_tmp" "$json_tmp"
    echo "failed to read $path from $file" >&2
    return 2
  fi

  rm -f "$jq_tmp" "$json_tmp"

  if [[ -z "$jq_output" ]]; then
    echo "path not found: $path" >&2
    return 2
  fi

  printf '%s\n' "$jq_output"
}

APT_UPDATED=false

download_and_install_package(){
  local package="$1"
  local version="$2"
  local url="$3"
  local package_id="${4:-$package}"

  if [[ -z "$package" || -z "$version" || -z "$url" ]]; then
    err "download_and_install_package requires package, version, and url arguments."
    return 1
  fi

  local sanitized_url="${url%%\?*}"
  sanitized_url="${sanitized_url%%\#*}"

  case "$sanitized_url" in
    *.deb)
      _install_from_deb "$package" "$version" "$url" "$package_id"
      ;;
    *.tar.gz|*.tgz)
      _install_from_archive "$package" "$version" "$url" "tar"
      ;;
    *.zip)
      _install_from_archive "$package" "$version" "$url" "zip"
      ;;
    *)
      err "Unsupported package format for ${package}: ${url}"
      return 1
      ;;
  esac
}

_install_from_deb(){
  local package="$1"
  local version="$2"
  local url="$3"
  local package_id="${4:-$package}"

  local installed_version=""
  if dpkg -s "$package_id" >/dev/null 2>&1; then
    installed_version="$(dpkg-query -W -f='${Version}' "$package_id" 2>/dev/null || true)"
    if [[ "$installed_version" == "$version" ]]; then
      log "${package} ${version} already installed; skipping download."
      return
    fi
  fi

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local deb_path="${tmp_dir}/${package}_${version}.deb"

  log "Installing ${package} ${version}..."
  curl -L --fail --show-error --progress-bar -o "$deb_path" "$url"
  _sudo_exec dpkg -i "$deb_path"
  rm -rf "$tmp_dir"
}

_install_from_archive(){
  local package="$1"
  local version="$2"
  local url="$3"
  local archive_type="$4"

  local tmp_dir
  tmp_dir="$(mktemp -d)"
  local sanitized_url="${url%%\?*}"
  sanitized_url="${sanitized_url%%\#*}"
  local archive_name
  archive_name="$(basename "$sanitized_url")"
  local archive_path="${tmp_dir}/${archive_name}"
  local extract_dir="${tmp_dir}/contents"

  mkdir -p "$extract_dir"

  log "Installing ${package} ${version} from archive..."
  curl -L --fail --show-error --progress-bar -o "$archive_path" "$url"

  case "$archive_type" in
    tar)
      tar -xf "$archive_path" -C "$extract_dir"
      ;;
    zip)
      if ! command -v unzip >/dev/null 2>&1; then
        rm -rf "$tmp_dir"
        err "unzip command not found; install unzip to continue."
        return 1
      fi
      unzip -q "$archive_path" -d "$extract_dir"
      ;;
    *)
      rm -rf "$tmp_dir"
      err "Unsupported archive type: ${archive_type}"
      return 1
      ;;
  esac

  local -a executables=()
  while IFS= read -r -d '' candidate; do
    executables+=("$candidate")
  done < <(find "$extract_dir" -type f -perm /111 -print0)

  if (( ${#executables[@]} == 0 )); then
    # Some archives might not preserve executable bits; fall back to a single file.
    local -a files=()
    while IFS= read -r -d '' candidate; do
      files+=("$candidate")
    done < <(find "$extract_dir" -type f -print0)

    if (( ${#files[@]} == 1 )); then
      executables=("${files[0]}")
      chmod +x "${executables[0]}"
    fi
  fi

  if (( ${#executables[@]} == 0 )); then
    rm -rf "$tmp_dir"
    err "No executable file found in archive for ${package}."
    return 1
  fi

  if (( ${#executables[@]} > 1 )); then
    rm -rf "$tmp_dir"
    err "Multiple executable files found in archive for ${package}; unable to determine target binary."
    return 1
  fi

  local source_binary="${executables[0]}"
  local destination="/usr/local/bin/${package}"

  _sudo_exec install -m 0755 "$source_binary" "$destination"
  rm -rf "$tmp_dir"
  log "${package} ${version} installed to ${destination}"
}


ensure_apt_packages() {
  if (( $# == 0 )); then
    warn "ensure_apt_packages received no package names; skipping."
    return
  fi
  local -a packages=("$@")
  local -a missing=()

  for pkg in "${packages[@]}"; do
    if ! dpkg -s "$pkg" >/dev/null 2>&1; then
      missing+=("$pkg")
    fi
  done

  if (( ${#missing[@]} )); then
    if [[ "${APT_UPDATED}" != true ]]; then
      log "Updating apt package index..."
      _sudo_exec apt-get update -qqy &>/dev/null
      APT_UPDATED=true
    fi
    log "Installing missing packages: ${missing[*]}..."
    _sudo_exec apt-get -qq -o Dpkg::Use-Pty=0 install -y "${missing[@]}"
  else
    log "apt packages already installed: ${packages[*]}"
  fi
}

apt_cleanup(){
  if command -v apt-get >/dev/null 2>&1; then
    _sudo_exec apt-get clean >/dev/null 2>&1 || true
  fi

  if [[ -d /var/lib/apt/lists ]]; then
    _sudo_exec rm -rf /var/lib/apt/lists/* /var/lib/apt/lists/partial >/dev/null 2>&1 || true
  fi
}

ensure_gem_installed() {
  local gem_name="${1:-}"
  local command_name="${2:-$gem_name}"

  if [[ -z "${gem_name}" ]]; then
    err "ensure_gem_installed requires a gem name."
    return 1
  fi

  if command -v "$command_name" >/dev/null 2>&1; then
    log "Command ${command_name} already available; skipping gem install for ${gem_name}."
    return
  fi

  if gem list -i "$gem_name" >/dev/null 2>&1; then
    log "Gem ${gem_name} already installed; skipping."
    return
  fi

  log "Installing gem ${gem_name}..."
  _sudo_exec gem install --no-document "$gem_name"
}

ensure_npm_package() {
  local package="${1:-}"
  local version="${2:-}"
  local command_name="${3:-$package}"

  if [[ -z "$package" ]]; then
    err "ensure_npm_package requires a package name."
    return 1
  fi

  local package_spec="$package"
  if [[ -n "$version" ]]; then
    package_spec="${package}@${version}"
  fi

  local npm_list_output=""
  local npm_list_status=0
  npm_list_output="$(npm list --location=global --depth=0 "$package" 2>/dev/null)" || npm_list_status=$?

  local installed_version=""
  if (( npm_list_status == 0 )); then
    installed_version="$(awk -F@ '/@/ {print $NF; exit}' <<<"$npm_list_output")"
  fi

  if [[ -n "$version" && "$installed_version" == "$version" ]]; then
    log "npm package ${package}@${version} already installed globally; skipping."
    return
  fi

  if [[ -z "$version" && -n "$installed_version" ]]; then
    log "npm package ${package} already installed globally; skipping."
    return
  fi

  if [[ -z "$version" && -n "$command_name" ]]; then
    if command -v "$command_name" >/dev/null 2>&1; then
      log "Command ${command_name} already available; skipping npm install for ${package}."
      return
    fi
  fi

  if [[ -n "$installed_version" && -n "$version" && "$installed_version" != "$version" ]]; then
    log "Updating npm package ${package} from ${installed_version} to ${version} globally..."
  else
    log "Installing npm package ${package_spec} globally..."
  fi

  npm install --silent --quiet --location=global "$package_spec" >/dev/null
}
