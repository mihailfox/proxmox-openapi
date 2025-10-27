#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ -f "${PROJECT_ROOT}/scripts/common.sh" ]]; then
  # shellcheck source=../../../scripts/common.sh
  source "${PROJECT_ROOT}/scripts/common.sh"
else
  log(){ printf '[cli-tools] %s\n' "$*"; }
  warn(){ log "$*"; }
  err(){ log "$*"; }
fi

if ! declare -f download_and_install_package >/dev/null 2>&1; then
  download_and_install_package(){
    local package="$1"
    local version="$2"
    local url="$3"
    local package_id="${4:-$package}"

    log "Downloading ${package} ${version} from ${url}..."
    local tmp_dir
    tmp_dir="$(mktemp -d)"
    local deb_path="${tmp_dir}/${package}_${version}.deb"
    curl -fsSL -o "${deb_path}" "${url}"
    if declare -f _sudo_exec >/dev/null 2>&1; then
      _sudo_exec dpkg -i "${deb_path}"
    else
      dpkg -i "${deb_path}"
    fi
    rm -rf "${tmp_dir}"
    log "${package_id} ${version} installed."
  }
fi

if ! declare -f ensure_apt_packages >/dev/null 2>&1; then
  ensure_apt_packages(){
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qqy
    apt-get install -qqy --no-install-recommends "$@"
  }
fi

if ! declare -f apt_cleanup >/dev/null 2>&1; then
  apt_cleanup(){ rm -rf /var/lib/apt/lists/* /var/lib/apt/lists/partial 2>/dev/null || true; }
fi

feature_option_enabled(){
  local name="$1"
  local default="$2"
  local upper_name="${name^^}"
  local lower_name="${name,,}"
  local value="${!upper_name:-${!lower_name:-$default}}"

  case "${value,,}" in
    true|1|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

detect_arch(){
  local machine
  machine="$(uname -m)"
  case "$machine" in
    x86_64|amd64)
      printf 'amd64'
      ;;
    *)
      err "Unsupported architecture: ${machine}. cli-tools feature currently supports amd64."
      exit 1
      ;;
  esac
}

install_ripgrep(){
  local version="${RIPGREP_VERSION:-14.1.1-1}"
  local tag="${RIPGREP_TAG:-14.1.1}"
  local url="https://github.com/BurntSushi/ripgrep/releases/download/${tag}/ripgrep_${version}_${DEB_ARCH}.deb"
  log "Installing ripgrep ${version}..."
  download_and_install_package "ripgrep" "${version}" "${url}"
}

install_fd(){
  local version="${FD_VERSION:-10.3.0}"
  local tag="${FD_TAG:-v10.3.0}"
  local url="https://github.com/sharkdp/fd/releases/download/${tag}/fd_${version}_${DEB_ARCH}.deb"
  log "Installing fd ${version}..."
  download_and_install_package "fd" "${version}" "${url}"
}

install_bat(){
  local version="${BAT_VERSION:-0.25.0}"
  local tag="${BAT_TAG:-v0.25.0}"
  local url="https://github.com/sharkdp/bat/releases/download/${tag}/bat_${version}_${DEB_ARCH}.deb"
  log "Installing bat ${version}..."
  download_and_install_package "bat" "${version}" "${url}"
}

install_lsd(){
  local version="${LSD_VERSION:-1.1.5}"
  local tag="${LSD_TAG:-v1.1.5}"
  local url="https://github.com/lsd-rs/lsd/releases/download/${tag}/lsd_${version}_${DEB_ARCH}.deb"
  log "Installing lsd ${version}..."
  download_and_install_package "lsd" "${version}" "${url}"
}

install_delta(){
  local version="${DELTA_VERSION:-0.18.2}"
  local tag="${DELTA_TAG:-0.18.2}"
  local url="https://github.com/dandavison/delta/releases/download/${tag}/git-delta_${version}_${DEB_ARCH}.deb"
  log "Installing git-delta ${version}..."
  download_and_install_package "delta" "${version}" "${url}" "git-delta"
}

install_helix(){
  local version="${HELIX_VERSION:-25.7.1-1}"
  local tag="${HELIX_TAG:-25.07.1}"
  local url="https://github.com/helix-editor/helix/releases/download/${tag}/helix_${version}_${DEB_ARCH}.deb"
  log "Installing helix ${version}..."
  download_and_install_package "helix" "${version}" "${url}"
}

DEB_ARCH="$(detect_arch)"

if feature_option_enabled "ripgrep" "true"; then
  install_ripgrep
else
  log "Skipping ripgrep installation."
fi

if feature_option_enabled "fd" "true"; then
  install_fd
else
  log "Skipping fd installation."
fi

if feature_option_enabled "bat" "true"; then
  install_bat
else
  log "Skipping bat installation."
fi

if feature_option_enabled "lsd" "true"; then
  install_lsd
else
  log "Skipping lsd installation."
fi

if feature_option_enabled "delta" "true"; then
  install_delta
else
  log "Skipping git-delta installation."
fi

if feature_option_enabled "helix" "true"; then
  install_helix
else
  log "Skipping helix installation."
fi

if feature_option_enabled "lynx" "true"; then
  export DEBIAN_FRONTEND=noninteractive
  log "Installing lynx via apt..."
  ensure_apt_packages lynx
  if declare -f apt_cleanup >/dev/null 2>&1; then
    apt_cleanup
  fi
else
  log "Skipping lynx installation."
fi

log "cli-tools feature completed."
