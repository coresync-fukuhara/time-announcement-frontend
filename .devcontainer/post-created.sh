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

# APM (Agent Package Manager, microsoft/apm) を導入する
setup_apm() {
    curl -sSL https://aka.ms/apm-unix | sh
    # apm.yml がまだ無い段階でも失敗しない (setup_node の package.json チェックと同じパターン)
    if [ -f apm.yml ]; then
        # .claude/ は空ディレクトリのため git 経由では復元されない。
        # 無い状態で apm install が Claude Code 向け設定の書き込みをスキップするため先に作る
        mkdir -p .claude
        if [ -f apm.lock.yaml ]; then
            apm install --frozen
        else
            apm install
        fi
    fi
}

main() {
    setup_node
    configure_git
    claude_ownership
    setup_apm
}

main "$@"
