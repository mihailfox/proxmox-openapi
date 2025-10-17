#!/usr/bin/env bash
set -euo pipefail
#set -x

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPTS_DIR}/../../scripts/common.sh"

log "Installing Context7 MCP..."
ensure_npm_package @upstash/context7-mcp latest

log "Installing Playwright MCP..."
ensure_npm_package @playwright/mcp latest

log "Installing GitHub MCP..."0.18.0
download_and_install_package "github-mcp-server" "0.18.0" "https://github.com/github/github-mcp-server/releases/download/v0.18.0/github-mcp-server_Linux_x86_64.tar.gz"

log "Installing codex cli using dotslash..."
mkdir -p ~/.local/bin
curl -L --fail --show-error --progress-bar \
  -o ~/.local/bin/codex \
  https://github.com/openai/codex/releases/latest/download/codex
chmod +x ~/.local/bin/codex

