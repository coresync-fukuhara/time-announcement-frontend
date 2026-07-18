# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) への
ガイドです。

## リポジトリの現状

このリポジトリには現時点で**設計文書とタスク管理のみ**が存在します。
`package.json` も `frontend/` ディレクトリもアプリケーションコードも
まだありません。ビルド/lint/テストのコマンドが存在すると仮定せず、
何かを実行する前に [tasks/TASKS.md](tasks/TASKS.md) で実際に何が
実装済みかを確認してください。

設計文書は `settings/schedules.json`・`settings/schema.json`・`src/main.py` を
「既存のもの」として参照していますが、これらは別リポジトリでコンテナ化される
Python アプリ(実際の「タイムアナウンスメント」再生プログラム)側のものです。
このフロントエンドは実行時に Docker の named volume(`settings`。backend 側
リポジトリが作成し、このリポジトリは `external: true` で参照するのみ)経由で
連携するだけで、**これらのファイルは本リポジトリには含まれません**。

## このプロジェクトは何か

`settings/schedules.json`(曜日×時×分のスケジュール)をブラウザ UI から
編集できるようにするフロントエンド(これから実装)です。別リポジトリの
Python アプリ(`src/main.py`)が cron で毎分このファイルを読み込み、`.wav` を再生します。
UI が責任を持つのは妥当な `schedules.json` を書き出すことのみで、再生処理自体には関与しません。

## どこに何があるか

- **[docs/](docs/)** — 設計文書(スコープ・API 設計・ファイル同期の安全規則・
  テスト方針の正)。「何を作るか」はまずここを見る。
- **[docs/catch-up/](docs/catch-up/)** — `docs/` の技術選定を裏付ける調査・学習教材。
- **[tasks/](tasks/)** — TODO 管理。`design/`・`implementation/`・`deploy/` の
  フェーズ別サブディレクトリに分かれている。**全体のステータスは
  [tasks/TASKS.md](tasks/TASKS.md) が唯一の管理場所**であり、各フェーズの
  `README.md` はもはやステータス表を持たず `TASKS.md` へのリンクのみ。
  タスクのステータスが変わったら `TASKS.md` だけを更新すること。
- **[.devcontainer/](.devcontainer/)** — VS Code Dev Container 定義。
  `post-created.sh` が何をセットアップするか(corepack 経由の pnpm、
  git safe directory、`.claude` の所有者変更)は `.devcontainer/README.md` 参照。
- **`.mcp.json`** — 開発時にエージェントが使える MCP サーバー(ブラウザ/E2E
  デバッグ用の Playwright MCP、開発サーバー内部状態調査用の Next.js DevTools MCP)。
  選定理由は `docs/mcp-servers-design.md` 参照。

## 想定アーキテクチャ(docs/schedule-ui-overview-design.md より)

実装後は、フロントエンドと BFF を 1 つの Next.js(App Router)アプリ・
1 コンテナに同居させる構成になる(独立したバックエンドサーバーは置かない)。

- **UI**: 1 画面構成。曜日タブ(月〜日 + `holiday`)× 時刻グリッドで、
  5 分刻みのトグルボタンで鳴動時刻を編集する。明示的な保存ボタン方式
  (トグル時の自動保存はしない)。
- **BFF**: `/api/schedules` の Next.js Route Handlers(`GET`/`PUT`、
  PATCH ではなく全体置換)。書き込み前に既存の `settings/schema.json` を
  **Ajv** で検証する。
- **ファイル同期の安全規則(妥協不可 — 壊れたファイルは cron の再生処理を
  毎分エラーにする)**:
  1. 書き込み前に必ずペイロード全体をバリデーションする
  2. アトミック書き込み: 同一ディレクトリに一時ファイルを書き、`fsync` 後に
     `rename(2)` で本ファイルを置き換える
  3. 書き込みを 1 本のキューに直列化する(Node.js は単一プロセスなので
     Promise チェーンで十分)
  4. 書き込み前に既存ファイルを `schedules.json.bak` として 1 世代分残す
     (世代管理はしない)
  5. `minute_settings` には触れない・消さない — 編集対象外だが
     GET→PUT で無傷のまま温存されなければならない
- **認証なし・楽観ロックなし**: 家庭内 LAN・単一利用者運用のため、
  後勝ち(最後の保存が有効)とする。

## テスト方針(docs/schedule-ui-testing-design.md より)

TDD、3 層のテストピラミッド。最も下のレイヤーから先にテストを書く。

| レイヤー | ツール | 対象 |
| --- | --- | --- |
| ユニット/コンポーネント | Vitest + React Testing Library | `src/lib/schedule-store.ts`、`src/lib/validator.ts`、UI コンポーネント |
| API | Vitest + next-test-api-route-handler | `/api/schedules` の GET/PUT、エラー系、ファイル I/O(モック) |
| E2E | Playwright | 画面をまたぐ主要シナリオのみ(初期化ダイアログ、編集→保存→再読み込み、未保存インジケーター)。ユニット/API で担保できる内容は重複させない |

`frontend/` ができたら、標準コマンドは `npm run test`(Vitest)と
`npm run test:e2e`(Playwright)になる予定。セットアップタスクは
`tasks/implementation/001-frontend-scaffold.md`、想定ディレクトリ構成は
`docs/schedule-ui-testing-design.md` 6章を参照(`frontend/` 配下は Next.js の
`src/` ディレクトリ構成を採用する)。

## ドキュメントは日本語

このリポジトリの `docs/`・`tasks/` 配下の設計文書・タスクファイル・README は
すべて日本語で書かれています。これらを作成・編集する際は同じ言語で記述してください。
