# 採用フレームワークの公式 MCP サーバー キャッチアップ調査

## 概要
本プロジェクトで採用が固まったフレームワーク(Next.js, React, Vitest, Playwright, MSW, Ajv)について、
開発元(公式)が MCP(Model Context Protocol)サーバーを公開しているかを調査した。
MCP サーバーを Claude Code に接続すると、ブラウザ操作や実行中の開発サーバーの内部状態を
エージェントが直接参照・操作できるようになり、TDD のデバッグ効率が上がる。

## 前提知識
- MCP(Model Context Protocol)の基本概念(ツール・リソースをLLMに公開する標準プロトコル)
- Claude Code での MCP サーバー設定方法(`.mcp.json` またはプロジェクト設定)

## 調査結果サマリー

| フレームワーク | 公式 MCP サーバー | 判定 | 備考 |
| --- | --- | --- | --- |
| Playwright | `microsoft/playwright-mcp`(npm: `@playwright/mcp`) | 採用 | Microsoft = Playwright 開発元。アクセシビリティツリー経由でブラウザ操作 |
| Next.js | `vercel/next-devtools-mcp` | 採用 | Vercel = Next.js 開発元。Next.js 16+ の組み込みエンドポイント `/_next/mcp` に接続する薄いコネクタ |
| Vitest | `vitest-community/mcp` | 非採用 | `vitest-dev` ではなく別 organization。README に "Work in progress" と明記、開発初期段階のため公式扱いしない |
| React(単体) | 該当なし | — | Next.js の MCP に内包される想定 |
| MSW | 該当なし | — | 調査時点で公式MCPは確認できず |
| Ajv | 該当なし | — | 調査時点で公式MCPは確認できず |
| Vercel(プラットフォーム全体) | 公式 Vercel MCP あり | 対象外 | デプロイ管理用。本プロジェクトはVercelにデプロイしない自前Docker運用のため不要 |

## 推奨学習リソース

| リソース | 種別 | URL | 特徴 |
| --- | --- | --- | --- |
| Playwright MCP 公式リポジトリ | 公式 | https://github.com/microsoft/playwright-mcp | インストール・設定・ツール一覧 |
| Playwright MCP ドキュメント | 公式 | https://playwright.dev/docs/getting-started-mcp | Playwright本体ドキュメントからの案内 |
| Next.js DevTools MCP 公式リポジトリ | 公式 | https://github.com/vercel/next-devtools-mcp | インストール・対応クライアント一覧 |
| Next.js MCP ガイド | 公式 | https://nextjs.org/docs/app/guides/mcp | Next.js 本体側の `/_next/mcp` エンドポイントの説明 |
| Model Context Protocol 仕様 | 公式 | https://modelcontextprotocol.io/ | MCP自体の仕様・用語 |

## 推奨学習順序
1. **MCP の基本概念** — ツール/リソースをLLMに公開する仕組みの理解
2. **Playwright MCP** — ブラウザ操作をエージェントに任せる仕組み、E2Eテストのデバッグへの活用
3. **Next.js DevTools MCP** — 実行中の開発サーバー内部(ビルドエラー・ルーティング等)をエージェントが参照する仕組み

## 推定学習時間
半日程度(概念理解 + 実際に `.mcp.json` を設定して動作確認するまで)
