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

log "Installing GitHub MCP..."
download_and_install_package "github-mcp-server" "latest" "https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server_Linux_x86_64.tar.gz"

log "Installing openai/codex cli..."
download_and_install_package "codex" "latest" "https://github.com/openai/codex/releases/latest/download/codex-x86_64-unknown-linux-musl.zst"

log "Installing claude-code using web install script..."
# ensure_npm_package @anthropic-ai/claude-code latest
if ! curl -fsSL https://claude.ai/install.sh | bash &>/dev/null; then
  err "Failed to install claude-code, enable debug to troubleshoot (set -x)"
fi

ensure_npm_package @steipete/claude-code-mcp latest
