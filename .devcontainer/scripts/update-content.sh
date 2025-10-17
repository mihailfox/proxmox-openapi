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

download_and_install_package "ripgrep" "14.1.1-1" "https://github.com/BurntSushi/ripgrep/releases/download/14.1.1/ripgrep_14.1.1-1_amd64.deb"
download_and_install_package "lsd" "1.1.5" "https://github.com/lsd-rs/lsd/releases/download/v1.1.5/lsd_1.1.5_amd64.deb"
download_and_install_package "fd" "10.3.0" "https://github.com/sharkdp/fd/releases/download/v10.3.0/fd_10.3.0_amd64.deb"
download_and_install_package "bat" "0.25.0" "https://github.com/sharkdp/bat/releases/download/v0.25.0/bat_0.25.0_amd64.deb"
download_and_install_package "delta" "0.18.2" "https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_amd64.deb" "git-delta"
download_and_install_package "helix" "25.7.1-1" "https://github.com/helix-editor/helix/releases/download/25.07.1/helix_25.7.1-1_amd64.deb"

ensure_apt_packages "lynx"

cd "${SCRIPTS_DIR}/.."

log "Installing/updating project packages..."
npm install --silent --quiet &>/dev/null

log "Installing/updating playwright dependencies..."
npx --yes playwright install --only-shell --with-deps chromium &>/dev/null
