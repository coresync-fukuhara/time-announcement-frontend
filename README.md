# タイムアナウンスメント スケジュール設定フロントエンド

`settings/schedules.json` に記述された曜日×時×分のスケジュールに従って `.wav` を
再生する「タイムアナウンスメント」アプリ(再生側は `src/main.py`)向けに、
スケジュールをブラウザ UI から編集できるようにするフロントエンドです。

現状は設計フェーズで、実装コードはまだありません。

## 現在のステータス

- 主要事項は確定済み。残る保留事項は [要件不足事項一覧](./docs/schedule-ui-open-questions.md) の No.8・No.12 のみ
- 実装は未着手(TDD で Red→Green→Refactor サイクルを回す予定)

## ディレクトリ構成

| ディレクトリ | 内容 |
| --- | --- |
| [docs/](./docs) | 設計書一式(概要設計・テスト設計・MCP サーバー導入・要件不足事項) |
| [tasks/](./tasks) | TODO 管理(設計→実装→デプロイのフェーズ別サブディレクトリ、全体は [tasks/TASKS.md](./tasks/TASKS.md) で一覧) |
| [.devcontainer/](./.devcontainer) | VS Code Dev Container 定義・開発環境セットアップ |

各ディレクトリの README を参照してください。
