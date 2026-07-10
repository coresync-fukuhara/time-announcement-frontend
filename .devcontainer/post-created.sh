#!/usr/bin/env bash
set -euo pipefail

# Node.js / pnpm の依存関係のセットアップ (package.json がまだ無い段階でも失敗しない)
setup_node() {
    # corepack 経由で pnpm を有効化する (Node.js 同梱の公式手順)
    corepack enable
    corepack prepare pnpm@latest --activate
    if [ -f package.json ]; then
        if [ -f pnpm-lock.yaml ]; then
            pnpm install --frozen-lockfile
        else
            pnpm install
        fi
    fi
}

# Git の設定
configure_git() {
    git config --global --add safe.directory /app
}

# .claude の所有者を変更する (root でマウントされるため)
claude_ownership() {
    sudo chown -R vscode:vscode ~/.claude
}

main() {
    setup_node
    configure_git
    claude_ownership
}

main "$@"
