#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ -f "${PROJECT_ROOT}/scripts/common.sh" ]]; then
  # shellcheck source=../../../scripts/common.sh
  source "${PROJECT_ROOT}/scripts/common.sh"
else
  log(){ printf '[fzf] %s\n' "$*"; }
  warn(){ log "$*"; }
  err(){ log "$*"; }
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

METHOD="${METHOD:-${method:-apt}}"
METHOD="${METHOD,,}"

log "Installing fzf via ${METHOD}"

case "$METHOD" in
  apt)
    export DEBIAN_FRONTEND=noninteractive
    ensure_apt_packages fzf
    if declare -f apt_cleanup >/dev/null 2>&1; then
      apt_cleanup
    fi
    ;;
  gh-release)
    install_dir="$(mktemp -d)"
    trap 'rm -rf "${install_dir}"' EXIT

    arch="$(uname -m)"
    case "$arch" in
      x86_64|amd64) asset_arch="amd64" ;;
      aarch64|arm64) asset_arch="arm64" ;;
      *)
        err "Unsupported architecture: ${arch}"
        exit 1
        ;;
    esac

    version="${FZF_VERSION:-${VERSION:-latest}}"
    if [[ "${version}" == "latest" ]]; then
      log "Resolving latest fzf release tag..."
      if ! tag="$(curl -fsSL https://api.github.com/repos/junegunn/fzf/releases/latest | awk -F'"' '/"tag_name"/ {print $4; exit}')"; then
        err "Failed to resolve fzf release information."
        exit 1
      fi
    else
      tag="${version}"
    fi

    if [[ "${tag}" != v* ]]; then
      tag="v${tag}"
    fi

    asset_version="${tag#v}"
    asset="fzf-${asset_version}-linux_${asset_arch}.tar.gz"
    url="https://github.com/junegunn/fzf/releases/download/${tag}/${asset}"

    log "Downloading ${asset}..."
    curl -fsSL -o "${install_dir}/fzf.tar.gz" "${url}"

    tar -xzf "${install_dir}/fzf.tar.gz" -C "${install_dir}"

    if declare -f _sudo_exec >/dev/null 2>&1; then
      _sudo_exec install -m 0755 "${install_dir}/fzf" /usr/local/bin/fzf
      if [[ -f "${install_dir}/fzf-tmux" ]]; then
        _sudo_exec install -m 0755 "${install_dir}/fzf-tmux" /usr/local/bin/fzf-tmux
      fi
    else
      install -m 0755 "${install_dir}/fzf" /usr/local/bin/fzf
      if [[ -f "${install_dir}/fzf-tmux" ]]; then
        install -m 0755 "${install_dir}/fzf-tmux" /usr/local/bin/fzf-tmux
      fi
    fi
    ;;
  *)
    err "Unsupported installation method: ${METHOD}"
    exit 1
    ;;
esac

log "fzf installation complete."
