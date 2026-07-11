# Dev Container

VS Code Dev Containers での開発環境定義です。

- ベースイメージ: `mcr.microsoft.com/devcontainers/base:debian`(Debianの最新安定版を指すfloatingタグ。
  2026-07時点ではDebian 13 trixieを指す。特定バージョンに固定する理由がないため`bookworm`(12)から変更)
- 含まれるもの: Node.js 22、GitHub CLI、Claude Code
- ワークスペース: ホストの `.` を `/app` に bind mount
- Claude Code の設定(`~/.claude`)は volume `claude-code-config` に永続化

## セットアップ処理(`post-created.sh`)

コンテナ作成後に自動実行されます。

- `corepack` 経由で `pnpm` を有効化(`package.json` 追加後は `pnpm install` を実行)
- `git config --global --add safe.directory /app`
- `~/.claude` の所有者を `vscode` に変更(root でマウントされるため)
- [APM(Agent Package Manager, microsoft/apm)](https://github.com/microsoft/apm) を
  公式インストールスクリプト経由(`curl -sSL https://aka.ms/apm-unix | sh`)で導入
  (選定理由は [agent-tool-management キャッチアップ教材](../docs/catch-up/agent-tool-management/concepts/06-microsoft-apm.html) を参照)

## MCP サーバー

開発時にエージェント(Claude Code)が接続する MCP サーバーは `.mcp.json` で定義しています。
選定理由は [MCP サーバー導入設計書](../docs/mcp-servers-design.md) を参照してください。

- Playwright MCP(ブラウザ操作・E2E デバッグ)
- Next.js DevTools MCP(開発サーバーの内部状態調査)
