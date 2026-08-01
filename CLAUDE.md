# CLAUDE.md

このファイルは、このリポジトリで作業する Claude Code (claude.ai/code) への
ガイドです。

## リポジトリの現状

**このリポジトリ自体がフロントエンド(Next.js)専用**で、`frontend/` のような
サブディレクトリでは区切らず、リポジトリ直下が Next.js の `src/` ディレクトリ構成の
アプリ本体になっている。スケジュール設定画面(`/`)・楽曲管理画面(`/tracks`)とも
UI・BFF・データ層まで実装完了している(`tasks/TASKS.md` の design/implementation/deploy
全項目が完了済み)。最新の実装状況・今後の予定は必ず [tasks/TASKS.md](tasks/TASKS.md)
で確認すること。

パッケージ管理は **pnpm**(corepack 経由。バージョンは `package.json` の `packageManager`
で固定)。標準コマンドは `pnpm test`(Vitest: ユニット + API)、`pnpm test:e2e`
(Playwright)、`pnpm dev`(開発サーバー)、`pnpm exec tsc --noEmit`(型チェック)。
pnpm のセキュリティ設定は `pnpm-workspace.yaml`(`minimumReleaseAge`・`strictDepBuilds`
など)にあり、依存のビルドスクリプトは `allowBuilds:` で個別に許可/拒否を明示する。

設計文書は `settings/schedules.json`・`settings/schema.json`・`db/music.sqlite3`
(スキーマ作成・マイグレーション)・`src/main.py` を「既存のもの」として参照していますが、
これらは別リポジトリでコンテナ化される Python アプリ(実際の「タイムアナウンスメント」
再生プログラムと、その DB スキーマ管理)側のものです。**このリポジトリが担当するのは
`schedules.json`・DB(`music.sqlite3`)・音源ファイル(`sounds/`)に対するブラウザ UI +
BFF(クライアント)のみ**で、スキーマ自体の作成・変更や実際の再生処理には関与しません。
実行時は Docker の named volume(`time-announcement-settings`・`time-announcement-db`・
`time-announcement-sounds`。いずれも backend 側リポジトリが作成し、このリポジトリは
`external: true` で参照するのみ)経由で連携するだけで、**これらのファイルは本リポジトリ
には含まれません**(`settings/`・`db/`・`sounds/` は dev 用ダミー/gitignore 対象)。

## このプロジェクトは何か

2つの設定をブラウザ UI から編集できるようにするフロントエンドです。

- `settings/schedules.json`(曜日×時×分のスケジュール): 別リポジトリの
  Python アプリ(`src/main.py`)が cron で毎分読み込み、`.wav` を再生する
- `db/music.sqlite3`(`wav_tracks`・`audio_types`。楽曲管理): `sounds/user/` への
  `.wav` アップロードと、それに紐づく DB レコードの一覧・名前変更・削除・
  音声タイプ割り当てを行う

UI が責任を持つのはそれぞれ妥当なファイル/DB状態を書き出すことのみで、
再生処理自体やDBスキーマの管理には関与しません。両者の連携(スケジュールから
楽曲を選択する等)は現時点では未着手・将来フェーズ検討中です
(`docs/music-management-overview-design.md` 1章「対象外」参照)。

## どこに何があるか

- **[src/](src/)** — アプリ本体。`src/app/`(Next.js App Router: スケジュール画面
  `page.tsx` + `api/schedules/route.ts`、楽曲管理画面 `tracks/page.tsx` +
  `api/tracks/route.ts`・`api/tracks/[id]/route.ts`・`api/tracks/[id]/audio/route.ts`
  (試し聴き用の音声配信)・`api/audio-types/route.ts`)、
  `src/lib/`(`validator.ts` = Ajv、`schedule-store.ts`・`track-store.ts` =
  アトミック書き込み/DB操作・直列化、`paths.ts`、`types.ts`、`db/`(Drizzle ORM。
  `client.ts` = シングルトン接続、`generated/` = `drizzle-kit pull` 生成物・
  手書き禁止))、`src/components/`(`TrackRow`・`TrackSection`・`UploadDropzone`・
  `NavSwitcher` など)、`src/__tests__/`(ユニットテスト)。`mocks/`(MSW)・
  `e2e/`(Playwright)・`settings/`・`db/`・`sounds/`(いずれも dev 用ダミー。
  gitignore 対象)も直下にある。
- **[docs/](docs/)** — 設計文書(スコープ・API 設計・ファイル同期の安全規則・
  テスト方針の正)。「何を作るか」はまずここを見る。スケジュールUIは
  `schedule-ui-overview-design.md`、楽曲管理は `music-management-overview-design.md`。
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
  5. `minute_settings` は編集対象(ONの分に曲/タイプを割り当てる。詳細は
     [docs/superpowers/specs/2026-07-31-schedule-sound-assignment-design.md](docs/superpowers/specs/2026-07-31-schedule-sound-assignment-design.md)
     参照)。編集対象外の分・他のフィールドは GET→PUT で無傷のまま温存する
- **認証なし・楽観ロックなし**: 家庭内 LAN・単一利用者運用のため、
  後勝ち(最後の保存が有効)とする。

## 楽曲管理機能(docs/music-management-overview-design.md より)

`/tracks` 画面。`sounds/user/` への `.wav` アップロードと `db/music.sqlite3`
(`wav_tracks`・`audio_types`・`track_audio_types`)の CRUD を行う。DB スキーマ
自体は Python 側(別リポジトリ)の責務で、このリポジトリは既存 DB へのクライアント。

- **データ層**: `drizzle-orm`/`drizzle-kit` は **`rc` タグ固定**(`node:sqlite`
  ドライバが安定版にまだ無いため。1.0 正式リリース後に stable へ切り戻し検討)。
  接続時に `PRAGMA journal_mode = WAL`(Python 側 cron との同時アクセス対策)と
  `PRAGMA foreign_keys = ON`(SQLite は既定オフ。入れないと `ON DELETE CASCADE`
  が無視される)を必ず発行する。
- **env vars**: `DB_DIR`(`music.sqlite3` の親ディレクトリ)、`SOUNDS_DIR`
  (配下に `default/`・`user/` を持つ前提)。`SETTINGS_DIR` と同じパターンで
  未設定時は `cwd` 直下(`db/`・`sounds/`)を使う。
- **`origin` による保護**: 各楽曲は `file_path` から `default`/`user`/`unknown`
  を判定して付与する。`default`・`unknown` は「名前変更・削除不可、音声タイプ
  割り当てのみ変更可」として安全側に倒す。
- **⚠️ 罠(実機検証済み)**: 本番では `sounds` だけ `SOUNDS_DIR` のマウント先が
  `settings`/`db`(`/data/...`)と異なり `/app/sounds` になる(backend 側が
  `wav_tracks.file_path` にその絶対パスを書き込む規約のため)。ここを揃えると
  `origin` 判定が全滅し `GET /api/tracks` ごと失敗する。
- **アップロードのファイル名サニタイズは必須**: `path.basename()` +
  許可文字チェックでパストラバーサル対策をする(`src/lib/track-store.ts`)。

## テスト方針(docs/schedule-ui-testing-design.md より)

TDD、3 層のテストピラミッド。最も下のレイヤーから先にテストを書く。

| レイヤー | ツール | 対象 |
| --- | --- | --- |
| ユニット/コンポーネント | Vitest + React Testing Library | `src/lib/schedule-store.ts`・`track-store.ts`、`src/lib/validator.ts`、UI コンポーネント |
| API | Vitest + next-test-api-route-handler | `/api/schedules`・`/api/tracks`・`/api/audio-types` の GET/PUT/PATCH/DELETE、エラー系、ファイル I/O(モック) |
| E2E | Playwright | 画面をまたぐ主要シナリオのみ(初期化ダイアログ、編集→保存→再読み込み、未保存インジケーター、楽曲アップロード→一覧反映→タイプ変更→試し聴き→削除)。ユニット/API で担保できる内容は重複させない |

標準コマンドは `pnpm test`(Vitest: ユニット + API)と `pnpm test:e2e`(Playwright)。
ユニット/API テストは既定 jsdom 環境で動き、ファイル I/O・DB・Route Handler を扱う
テスト(`schedule-store.test.ts`・`track-store.test.ts`・`validator.test.ts`・
`route.test.ts` 各種)はファイル先頭の `// @vitest-environment node` で node 環境に
切り替える。`track-store.test.ts` は一時 SQLite ファイルに `drizzle-kit pull` 生成の
`drizzle/0000_xxxx.sql` を流し込んでスキーマを作る(手動フィクスチャ不要。詳細は
`docs/music-management-overview-design.md` 6章)。実際のディレクトリ構成は
`docs/schedule-ui-testing-design.md` 6章を参照(リポジトリ直下が Next.js の `src/`
ディレクトリ構成)。

## ドキュメントは日本語

このリポジトリの `docs/`・`tasks/` 配下の設計文書・タスクファイル・README は
すべて日本語で書かれています。これらを作成・編集する際は同じ言語で記述してください。
