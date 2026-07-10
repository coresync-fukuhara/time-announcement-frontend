# 設計ドキュメント

スケジュール設定フロントエンドの設計書一式です。

| 文書 | 内容 |
| --- | --- |
| [概要設計書](./schedule-ui-overview-design.md) | 目的・スコープ・技術選定(TypeScript / Next.js / React) |
| [要件不足事項一覧](./schedule-ui-open-questions.md) | 決定済み事項と保留中の事項 |
| [テスト設計書](./schedule-ui-testing-design.md) | TDD 方針、テストピラミッド(Vitest / RTL / Playwright / MSW / Ajv) |
| [MCP サーバー導入設計書](./mcp-servers-design.md) | 開発時にエージェントが接続する MCP サーバー(Playwright MCP / Next.js DevTools MCP)の選定理由 |

## スコープ(概要設計書より抜粋)

- 対象: スケジュール(月〜日および `holiday` の hour / minutes)の閲覧・追加・変更・削除、`schedules.json` への保存
- 対象外: `minute_settings` の編集、音声の再生そのもの、楽曲 DB のマイグレーション、サウンドファイルのアップロード

## 技術スタック(予定)

- 言語: TypeScript
- フレームワーク: Next.js / React
- バリデーション: Ajv(既存 `settings/schema.json` を流用)
- テスト: Vitest, React Testing Library, next-test-api-route-handler, MSW, Playwright

## 関連教材

技術選定の調査過程をまとめたキャッチアップ教材は [catch-up/](./catch-up) を参照してください。
