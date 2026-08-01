# 設計ドキュメント

このフロントエンドの設計書一式です。

| 文書 | 内容 |
| --- | --- |
| [概要設計書](./schedule-ui-overview-design.md) | 目的・スコープ・技術選定(TypeScript / Next.js / React) |
| [要件不足事項一覧](./schedule-ui-open-questions.md) | 決定済み事項と保留中の事項 |
| [テスト設計書](./schedule-ui-testing-design.md) | TDD 方針、テストピラミッド(Vitest / RTL / Playwright / MSW / Ajv) |
| [MCP サーバー導入設計書](./mcp-servers-design.md) | 開発時にエージェントが接続する MCP サーバー(Playwright MCP / Next.js DevTools MCP)の選定理由 |
| [楽曲管理機能 概要設計書](./music-management-overview-design.md) | 楽曲(`db/music.sqlite3`)管理機能のスコープ・Drizzle ORM 導入・API 設計・デプロイ構成 |
| [楽曲管理画面(`/tracks`)画面詳細設計](./superpowers/specs/2026-07-29-music-management-screen-design.md) | `/tracks` 画面のレイアウト・操作フロー・エラー処理・テスト方針 |
| [スケジュール画面からの音設定 詳細設計](./superpowers/specs/2026-07-31-schedule-sound-assignment-design.md) | スケジュール画面のON分に曲/タイプを割り当てる機能のバックエンド解釈・UI配置・データ層設計 |
| [曲指定UIのラジオボタン化 詳細設計](./superpowers/specs/2026-08-01-track-select-radio-list-design.md) | 「曲を指定」の選択UIを`<select>`からorigin別グループ分け付きラジオボタンリストに変更した設計 |

## スコープ(概要設計書より抜粋)

- 対象: スケジュール(月〜日および `holiday` の hour / minutes)の閲覧・追加・変更・削除、`schedules.json` への保存、ON分への曲/タイプ(`minute_settings`)の割り当て
- 対象外: 音声の再生そのもの、楽曲 DB のマイグレーション、サウンドファイルのアップロード

## 技術スタック(予定)

- 言語: TypeScript
- フレームワーク: Next.js / React
- バリデーション: Ajv(既存 `settings/schema.json` を流用)
- テスト: Vitest, React Testing Library, next-test-api-route-handler, MSW, Playwright

## 関連教材

技術選定の調査過程をまとめたキャッチアップ教材は [catch-up/](./catch-up) を参照してください。
