#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

if [[ -f "${PROJECT_ROOT}/scripts/common.sh" ]]; then
  # shellcheck source=../../../scripts/common.sh
  source "${PROJECT_ROOT}/scripts/common.sh"
else
  log(){ printf '[jq-familly] %s\n' "$*"; }
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

export DEBIAN_FRONTEND=noninteractive
log "Installing jq, yq, and gojq..."
ensure_apt_packages jq yq gojq
if declare -f apt_cleanup >/dev/null 2>&1; then
  apt_cleanup
fi
log "jq family installation complete."
