# 全タスク一覧

設計・実装・デプロイの全フェーズを横断した、全タスクのフラットな一覧です。
各タスクの詳細(概要・完了条件)は個々のファイルを参照してください。
ここが全体の状態を追うための唯一の場所です(各フェーズの `README.md` の表は削除し、ここに一本化)。

## 設計

- [x] [design/001](./design/001-requirements-hearing.md) 要件ヒアリング・要件不足事項の整理 — 完了
- [x] [design/002](./design/002-overview-design.md) 概要設計書の作成 — 完了
- [x] [design/003](./design/003-testing-design.md) テスト設計書の作成 — 完了
- [x] [design/004](./design/004-mcp-servers-design.md) MCP サーバー導入設計書の作成 — 完了

## 実装

- [x] [implementation/001](./implementation/001-frontend-scaffold.md) Next.js プロジェクト作成(リポジトリ直下・`src/` 構成)— 完了
- [x] [implementation/002](./implementation/002-validator.md) `src/lib/validator.ts`(Ajv バリデータ)の実装 — 完了
- [x] [implementation/003](./implementation/003-schedule-store.md) `src/lib/schedule-store.ts`(読み書き・アトミック書き込み・`.bak`)の実装 — 完了
- [x] [implementation/004](./implementation/004-api-schedules-route.md) `src/app/api/schedules/route.ts`(GET/PUT)の実装 — 完了
- [ ] [implementation/005](./implementation/005-ui-init-dialog.md) 初期化選択ダイアログの実装 — 未着手
- [ ] [implementation/006](./implementation/006-ui-schedule-grid.md) 曜日タブ・時刻グリッド画面の実装 — 未着手
- [ ] [implementation/007](./implementation/007-e2e-main-scenarios.md) E2E 主要シナリオ(Playwright)の実装 — 未着手

## デプロイ

- [ ] [deploy/001](./deploy/001-docker-deploy.md) Docker 化・docker-compose 構成 — 未着手
- [x] [deploy/002](./deploy/002-host-uid-gid.md) `settings/` の共有方式の確定 — 完了(named volume 方式に変更)
- [x] [deploy/003](./deploy/003-container-startup-policy.md) コンテナ起動管理方式の確定 — 完了(`restart: unless-stopped` のみ)
