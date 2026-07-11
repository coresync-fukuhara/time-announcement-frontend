# 開発支援 MCP サーバー導入設計書

作成日: 2026-07-10
対象: [概要設計書](./schedule-ui-overview-design.md)、[テスト設計書](./schedule-ui-testing-design.md)
関連キャッチアップ教材: [docs/catch-up/mcp-servers/index.html](./catch-up/mcp-servers/index.html)

## 1. 目的・背景

[テスト設計書](./schedule-ui-testing-design.md)で採用が決まったフレームワーク
(Next.js, React, Vitest, Playwright, MSW, Ajv)について、開発元(公式)が
MCP(Model Context Protocol)サーバーを公開しているかを調査し、
開発時にエージェント(Claude Code)が接続する MCP サーバーを選定する。

MCP サーバーを接続すると、エージェントがブラウザや開発サーバーの内部状態を
直接参照・操作できるようになり、TDD の Red→Green→Refactor サイクルでの
デバッグ(「なぜテストが落ちるか」の原因調査)が効率化される。

## 2. 調査結果と採否

| フレームワーク | 候補 | 採否 | 理由 |
| --- | --- | --- | --- |
| Playwright | `microsoft/playwright-mcp`(npm: `@playwright/mcp`) | **採用** | Microsoft = Playwright 開発元。organization が一致し、Playwright 公式ドキュメントからもリンクされている |
| Next.js | `vercel/next-devtools-mcp` | **採用** | Vercel = Next.js 開発元。Next.js 16+ の組み込みエンドポイント `/_next/mcp` に接続する公式コネクタ |
| Vitest | `vitest-community/mcp` | 非採用 | organization が `vitest-dev`(公式)ではなく `vitest-community`。README に "Work in progress" と明記され開発初期段階のため見送る |
| React(単体) | 該当なし | — | Next.js の MCP に内包される想定のため個別導入なし |
| MSW / Ajv | 該当なし | — | 調査時点(2026年7月)で公式 MCP は確認できず |
| Vercel(プラットフォーム全体) | 公式 Vercel MCP あり | 対象外 | デプロイ管理用。本プロジェクトは Ubuntu ホスト上の Docker 自前運用でVercelにデプロイしないため不要 |

判定基準の詳細は [キャッチアップ教材 01](./catch-up/mcp-servers/concepts/01-overview.html) を参照。

## 3. 採用した MCP サーバーの役割分担

| MCP サーバー | 役割 | 主な利用場面 |
| --- | --- | --- |
| Playwright MCP | ブラウザを実際に操作し、アクセシビリティツリー経由で画面状態を把握する | E2E テスト([テスト設計書](./schedule-ui-testing-design.md) 4.3 節)のデバッグ、画面操作を伴う調査 |
| Next.js DevTools MCP | 実行中の Next.js 開発サーバー(`next dev`)の内部状態を参照する | ビルドエラー・ルーティングなど、サーバー側の挙動調査 |

両者を組み合わせることで、「ブラウザ側で何が起きたか」と「サーバー側で何が起きたか」を
エージェントが横断的に調査できる。

## 4. 設定内容

[APM(Agent Package Manager)](./catch-up/agent-tool-management/concepts/06-microsoft-apm.html)を
真実のソースとして `apm.yml` に MCP サーバーを宣言し、`apm install` が
プロジェクト直下の `.mcp.json` を生成する(APM公式の "What to commit" 指針に従い、
`apm.yml`・`apm.lock.yaml`・`.mcp.json` はいずれもリポジトリにコミットする想定)。

```yaml
# apm.yml(抜粋)
dependencies:
  mcp:
  - name: playwright
    registry: false
    transport: stdio
    command: npx
    args:
    - '@playwright/mcp@latest'
  - name: next-devtools
    registry: false
    transport: stdio
    command: npx
    args:
    - -y
    - next-devtools-mcp@latest
```

```json
// .mcp.json(apm install により生成される内容。手動編集はしない)
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    },
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}
```

- サーバー構成を変更する場合は `apm install --mcp <name> -- <command...>` で `apm.yml` を更新し、
  `apm install` で `.mcp.json` に反映させる(devcontainer 作成時は `post-created.sh` が自動実行する)
- 両サーバーとも `npx` 経由での起動のため、追加のインストール作業は不要
  (Node.js は [devcontainer](../.devcontainer/devcontainer.json) に含まれる `node` feature で導入済み)。
- `next-devtools` は Next.js 16 以上が前提。本プロジェクトは新規構築のため、
  実装時点の最新版を採用すれば要件を満たす。

## 5. 注意事項

- Playwright MCP はブラウザを実際に操作できるため、**開発環境でのみ**有効化する
  (本番運用のコンテナには `.mcp.json` の効果はなく、あくまで開発時のエージェント接続用)
- Next.js DevTools MCP は `next dev` 実行時のみ機能する。本番ビルド/本番運用には影響しない
- 今後、Vitest 公式(`vitest-dev`)から MCP サーバーが公開された場合は改めて採否を検討する

## 6. 参考資料

- [Playwright MCP(公式リポジトリ)](https://github.com/microsoft/playwright-mcp)
- [Playwright MCP ドキュメント](https://playwright.dev/docs/getting-started-mcp)
- [Next.js DevTools MCP(公式リポジトリ)](https://github.com/vercel/next-devtools-mcp)
- [Next.js MCP ガイド](https://nextjs.org/docs/app/guides/mcp)
- [Model Context Protocol 公式サイト](https://modelcontextprotocol.io/)
- [docs/catch-up/mcp-servers/index.html](./catch-up/mcp-servers/index.html)
