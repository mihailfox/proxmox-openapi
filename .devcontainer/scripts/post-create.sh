#!/usr/bin/env bash
set -euo pipefail
#set -x

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "${SCRIPTS_DIR}/../../scripts/common.sh"

ensure_npm_package @upstash/context7-mcp latest

ensure_npm_package @playwright/mcp latest

download_and_install_package "github-mcp-server" "latest" "https://github.com/github/github-mcp-server/releases/latest/download/github-mcp-server_Linux_x86_64.tar.gz"

download_and_install_package "codex" "latest" "https://github.com/openai/codex/releases/latest/download/codex-x86_64-unknown-linux-musl.zst"

