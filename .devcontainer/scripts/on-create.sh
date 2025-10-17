#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPTS_DIR}/../../scripts/common.sh"
# shellcheck source=.devcontainer/scripts/config.sh
source "${SCRIPTS_DIR}/config.sh"

log "Updating npm..."
ensure_npm_package "npm" "latest"