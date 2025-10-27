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

    local tmp_dir deb_path
    tmp_dir="$(mktemp -d)"
    deb_path="${tmp_dir}/${package}_${version}.deb"

    log "Downloading ${package} ${version} from ${url}..."
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
    if (( $# == 0 )); then
      warn "ensure_apt_packages fallback received no packages."
      return
    fi
    export DEBIAN_FRONTEND=noninteractive
    if declare -f _sudo_exec >/dev/null 2>&1; then
      _sudo_exec apt-get update -qqy
      _sudo_exec apt-get install -qqy --no-install-recommends "$@"
    else
      apt-get update -qqy
      apt-get install -qqy --no-install-recommends "$@"
    fi
  }
fi

if ! declare -f apt_cleanup >/dev/null 2>&1; then
  apt_cleanup(){
    if command -v apt-get >/dev/null 2>&1; then
      if declare -f _sudo_exec >/dev/null 2>&1; then
        _sudo_exec apt-get clean >/dev/null 2>&1 || true
      else
        apt-get clean >/dev/null 2>&1 || true
      fi
    fi
    if [[ -d /var/lib/apt/lists ]]; then
      if declare -f _sudo_exec >/dev/null 2>&1; then
        _sudo_exec rm -rf /var/lib/apt/lists/* /var/lib/apt/lists/partial >/dev/null 2>&1 || true
      else
        rm -rf /var/lib/apt/lists/* /var/lib/apt/lists/partial >/dev/null 2>&1 || true
      fi
    fi
  }
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

feature_option_value(){
  local name="$1"
  local default="$2"
  local upper_name="${name^^}"
  local lower_name="${name,,}"
  local value="${!upper_name:-${!lower_name:-$default}}"
  printf '%s\n' "${value}"
}

normalize_tag(){
  local value="$1"
  if [[ -z "${value}" ]]; then
    return 0
  fi
  if [[ "${value}" == v* ]]; then
    printf '%s\n' "${value}"
  else
    printf 'v%s\n' "${value}"
  fi
}

detect_arch(){
  local machine
  machine="$(uname -m)"
  case "${machine}" in
    x86_64|amd64)
      printf 'amd64'
      ;;
    aarch64|arm64)
      printf 'arm64'
      ;;
    *)
      err "Unsupported architecture: ${machine}"
      exit 1
      ;;
  esac
}

install_binary(){
  local name="$1"
  local url="$2"

  local tmp_dir tmp_file
  tmp_dir="$(mktemp -d)"
  tmp_file="${tmp_dir}/${name}"

  log "Downloading ${name} from ${url}..."
  curl -fsSL -o "${tmp_file}" "${url}"
  chmod +x "${tmp_file}"

  if declare -f _sudo_exec >/dev/null 2>&1; then
    _sudo_exec install -m 0755 "${tmp_file}" "/usr/local/bin/${name}"
  else
    install -m 0755 "${tmp_file}" "/usr/local/bin/${name}"
  fi

  rm -rf "${tmp_dir}"
  log "${name} installed."
}

install_tar_binary(){
  local name="$1"
  local url="$2"
  local target_name="${3:-$1}"

  local tmp_dir archive extracted
  tmp_dir="$(mktemp -d)"
  archive="${tmp_dir}/archive.tar.gz"

  log "Downloading ${name} from ${url}..."
  curl -fsSL -o "${archive}" "${url}"
  tar -xzf "${archive}" -C "${tmp_dir}"

  extracted="$(find "${tmp_dir}" -type f -name "${target_name}" -perm /111 | head -n1 || true)"
  if [[ -z "${extracted}" ]]; then
    extracted="$(find "${tmp_dir}" -type f -name "${target_name}" | head -n1 || true)"
  fi

  if [[ -z "${extracted}" ]]; then
    err "Unable to locate ${target_name} in archive ${url}"
    rm -rf "${tmp_dir}"
    exit 1
  fi

  chmod +x "${extracted}" || true

  if declare -f _sudo_exec >/dev/null 2>&1; then
    _sudo_exec install -m 0755 "${extracted}" "/usr/local/bin/${name}"
  else
    install -m 0755 "${extracted}" "/usr/local/bin/${name}"
  fi

  rm -rf "${tmp_dir}"
  log "${name} installed."
}

install_ripgrep(){
  local version="${RIPGREP_VERSION:-14.1.1-1}"
  local tag="${RIPGREP_TAG:-14.1.1}"
  local url="https://github.com/BurntSushi/ripgrep/releases/download/${tag}/ripgrep_${version}_${DEB_ARCH}.deb"
  download_and_install_package "ripgrep" "${version}" "${url}"
}

install_fd(){
  local version="${FD_VERSION:-10.3.0}"
  local tag="${FD_TAG:-v10.3.0}"
  local url="https://github.com/sharkdp/fd/releases/download/${tag}/fd_${version}_${DEB_ARCH}.deb"
  download_and_install_package "fd" "${version}" "${url}"
}

install_bat(){
  local version="${BAT_VERSION:-0.25.0}"
  local tag="${BAT_TAG:-v0.25.0}"
  local url="https://github.com/sharkdp/bat/releases/download/${tag}/bat_${version}_${DEB_ARCH}.deb"
  download_and_install_package "bat" "${version}" "${url}"
}

install_lsd(){
  local version="${LSD_VERSION:-1.1.5}"
  local tag="${LSD_TAG:-v1.1.5}"
  local url="https://github.com/lsd-rs/lsd/releases/download/${tag}/lsd_${version}_${DEB_ARCH}.deb"
  download_and_install_package "lsd" "${version}" "${url}"
}

install_delta(){
  local version="${DELTA_VERSION:-0.18.2}"
  local tag="${DELTA_TAG:-0.18.2}"
  local url="https://github.com/dandavison/delta/releases/download/${tag}/git-delta_${version}_${DEB_ARCH}.deb"
  download_and_install_package "delta" "${version}" "${url}" "git-delta"
}

install_helix(){
  local version="${HELIX_VERSION:-25.7.1-1}"
  local tag="${HELIX_TAG:-25.07.1}"
  local url="https://github.com/helix-editor/helix/releases/download/${tag}/helix_${version}_${DEB_ARCH}.deb"
  download_and_install_package "helix" "${version}" "${url}"
}

install_fzf(){
  local method
  method="$(feature_option_value "fzf_method" "gh-release")"
  method="${method,,}"

  case "${method}" in
    apt)
      ensure_apt_packages fzf
      ;;
    gh-release)
      local version="${FZF_VERSION:-latest}"
      local tag
      if [[ "${version}" == "latest" ]]; then
        log "Resolving latest fzf release tag..."
        tag="$(curl -fsSL https://api.github.com/repos/junegunn/fzf/releases/latest | awk -F'\"' '/\"tag_name\"/ {print $4; exit}')"
        if [[ -z "${tag}" ]]; then
          err "Failed to resolve fzf release tag."
          exit 1
        fi
      else
        tag="${version}"
      fi
      tag="$(normalize_tag "${tag}")"
      local asset_version="${tag#v}"
      local asset="fzf-${asset_version}-linux_${BIN_ARCH}.tar.gz"
      local url="https://github.com/junegunn/fzf/releases/download/${tag}/${asset}"

      local tmp_dir archive
      tmp_dir="$(mktemp -d)"
      archive="${tmp_dir}/fzf.tar.gz"

      log "Downloading ${asset} from ${tag}..."
      curl -fsSL -o "${archive}" "${url}"
      tar -xzf "${archive}" -C "${tmp_dir}"

      if declare -f _sudo_exec >/dev/null 2>&1; then
        _sudo_exec install -m 0755 "${tmp_dir}/fzf" /usr/local/bin/fzf
        if [[ -f "${tmp_dir}/fzf-tmux" ]]; then
          _sudo_exec install -m 0755 "${tmp_dir}/fzf-tmux" /usr/local/bin/fzf-tmux
        fi
      else
        install -m 0755 "${tmp_dir}/fzf" /usr/local/bin/fzf
        if [[ -f "${tmp_dir}/fzf-tmux" ]]; then
          install -m 0755 "${tmp_dir}/fzf-tmux" /usr/local/bin/fzf-tmux
        fi
      fi

      rm -rf "${tmp_dir}"
      ;;
    *)
      err "Unsupported fzf installation method: ${method}"
      exit 1
      ;;
  esac
}

install_jq(){
  ensure_apt_packages jq
}

install_yq(){
  local version="${YQ_VERSION:-4.48.1}"
  local tag="${YQ_TAG:-v${version}}"
  local url="https://github.com/mikefarah/yq/releases/download/${tag}/yq_linux_${BIN_ARCH}"
  install_binary "yq" "${url}"
}

install_gojq(){
  local version="${GOJQ_VERSION:-0.12.17}"
  local tag="${GOJQ_TAG:-v${version}}"
  local asset="gojq_${tag}_linux_${BIN_ARCH}.tar.gz"
  local url="https://github.com/itchyny/gojq/releases/download/${tag}/${asset}"
  install_tar_binary "gojq" "${url}" "gojq"
}

DEB_ARCH="$(detect_arch)"
BIN_ARCH="${DEB_ARCH}"

if feature_option_enabled "fzf" "true"; then
  install_fzf
else
  log "Skipping fzf installation."
fi

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

if feature_option_enabled "jq" "true"; then
  install_jq
else
  log "Skipping jq installation."
fi

if feature_option_enabled "yq" "true"; then
  install_yq
else
  log "Skipping yq installation."
fi

if feature_option_enabled "gojq" "true"; then
  install_gojq
else
  log "Skipping gojq installation."
fi

if feature_option_enabled "lynx" "true"; then
  ensure_apt_packages lynx
else
  log "Skipping lynx installation."
fi

if declare -f apt_cleanup >/dev/null 2>&1; then
  apt_cleanup
fi

log "cli-tools feature completed."
