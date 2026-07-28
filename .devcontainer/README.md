# Dev Container

VS Code Dev Containers での開発環境定義です。

- ベースイメージ: `mcr.microsoft.com/devcontainers/base:debian`(Debianの最新安定版を指すfloatingタグ。
  2026-07時点ではDebian 13 trixieを指す。特定バージョンに固定する理由がないため`bookworm`(12)から変更)
- 含まれるもの: Node.js 22、GitHub CLI、Claude Code
- ワークスペース: ホストの `.` を `/app` に bind mount
- Claude Code の設定(`~/.claude`)は volume `claude-code-config` に永続化
- **前提: `time-announcement-backend` リポジトリが、このリポジトリと同じ階層
  (`../time-announcement-backend`)に clone されていること。** 本番は Docker の
  named volume で backend と `settings/` を共有する(deploy/002 確定)が、
  devcontainer 単体では named volume を組み立てられないため、開発時は backend
  リポジトリの `settings/`・`sounds/`・`db/` を直接 bind mount する
  (`schema.json` 等を dev 用ダミーとして手元で二重管理しないための対応)。
  - `settings/` → `/app/settings`(`SETTINGS_DIR` 未設定時のデフォルト解決先。
    [paths.ts](../src/lib/paths.ts) 参照)
  - `sounds/`・`db/` → `/app/sounds`・`/app/db`。このフロントエンドのコード上は
    未使用(音声再生・DB はスコープ外)だが、実データを参照できるように同様に
    mount する。`/app` 配下以外にマウントすると VS Code のエクスプローラー
    (ワークスペースは `/app` のみ表示)から見えなくなるため、必ず `/app` 配下に
    マウントすること

`COREPACK_ENABLE_DOWNLOAD_PROMPT=0` を `containerEnv` に設定し、`corepack prepare`
実行時のダウンロード確認プロンプトを抑制している。

## セットアップ処理(`post-created.sh`)

コンテナ作成後に自動実行されます。

- `corepack` 経由で `pnpm` を有効化(`package.json` 追加後は `pnpm install` を実行)
- `git config --global --add safe.directory /app`
- `~/.claude` の所有者を `vscode` に変更(root でマウントされるため)
- [APM(Agent Package Manager, microsoft/apm)](https://github.com/microsoft/apm) を
  公式インストールスクリプト経由(`curl -sSL https://aka.ms/apm-unix | sh`)で導入
  (選定理由は [agent-tool-management キャッチアップ教材](../docs/catch-up/agent-tool-management/concepts/06-microsoft-apm.html) を参照)。
  続けて `apm install --frozen`(`apm.yml`/`apm.lock.yaml` から MCP サーバー等の依存を復元)を実行する

## APM が管理するファイル

APM 公式の "What to commit" 指針([microsoft/apm の apm-usage スキル](https://github.com/microsoft/apm/blob/main/packages/apm-guide/.apm/skills/apm-usage/workflow.md)より)
に従い、`apm.yml`・`apm.lock.yaml`・`.apm/`・`.claude/` 等の各ランタイム向け展開ファイルはコミットし、
ダウンロードした依存の実体である `apm_modules/` のみ `.gitignore` で除外する。

## MCP サーバー

開発時にエージェント(Claude Code)が接続する MCP サーバーは `apm.yml` で宣言し、
`apm install` が生成する `.mcp.json` 経由で読み込まれます(`.mcp.json` は生成物だがコミット対象)。
選定理由は [MCP サーバー導入設計書](../docs/mcp-servers-design.md) を参照してください。

- Playwright MCP(ブラウザ操作・E2E デバッグ)
- Next.js DevTools MCP(開発サーバーの内部状態調査)
