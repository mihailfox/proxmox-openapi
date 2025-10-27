#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ -f "${PROJECT_ROOT}/scripts/common.sh" ]]; then
  # shellcheck source=../../../scripts/common.sh
  source "${PROJECT_ROOT}/scripts/common.sh"
else
  log(){ printf '[devcontainers-cli] %s\n' "$*"; }
  warn(){ log "$*"; }
  err(){ log "$*"; }
fi

if ! declare -f ensure_npm_package >/dev/null 2>&1; then
  ensure_npm_package(){
    local package="$1"
    local version="${2:-}"
    local spec="$package"

    if [[ -n "$version" ]]; then
      spec="${package}@${version}"
    fi

    npm install --silent --quiet --location=global "$spec" >/dev/null
  }
fi

VERSION="${VERSION:-${version:-latest}}"

if ! command -v node >/dev/null 2>&1; then
  err "Node.js runtime is required to install @devcontainers/cli."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  err "npm is required to install @devcontainers/cli."
  exit 1
fi

log "Installing @devcontainers/cli (${VERSION})..."
ensure_npm_package "@devcontainers/cli" "${VERSION}" "devcontainer"
log "@devcontainers/cli installation complete."
