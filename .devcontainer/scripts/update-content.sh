#!/usr/bin/env bash
set -euo pipefail
#set -x

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPTS_DIR}/../../scripts/common.sh"

log "This script is run after on-create.sh"


SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${SCRIPTS_DIR}/../.env" ]]; then
  set -a
  log "Loading environment variables..."
  # shellcheck disable=SC1091
  source "${SCRIPTS_DIR}/../.env"
  set +a
fi

cd "${SCRIPTS_DIR}/.."

log "Installing/updating project packages..."
npm install --silent --quiet &>/dev/null

log "Installing/updating Playwright dependencies in the background..."
npx --yes playwright install --only-shell --with-deps chromium &>/dev/null &
