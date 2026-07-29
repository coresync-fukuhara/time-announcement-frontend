# 楽曲管理機能 概要設計書

作成日: 2026-07-29
ステータス: 確定(画面の詳細設計は別途 `frontend-design` でのブレインストーミングに委ねる)

## 1. 目的・背景・スコープ

### 目的

`sounds/user/` への音源ファイル(`.wav`)アップロードと、それに紐づく
`db/music.sqlite3`(`wav_tracks`・`audio_types`・`track_audio_types`)の
レコード管理を、ブラウザ UI から行えるようにする。

### 背景

DB のスキーマ作成・マイグレーションは Python 側(`src/music_db.py` +
`scripts/migrate_music_db.py`、別リポジトリ)の責務のまま変わらない。
このフロントエンドは既存 DB に対する**クライアント**を持つだけで、
スキーマ自体は変更しない。DB ファイル(`db/music.sqlite3`)自体は
`db/.gitignore` で除外されており、本リポジトリには含まれない
(devcontainer では別リポジトリ側が作成したファイルをバインドマウントする)。

### スコープ

| 項目 | 対象 |
| --- | --- |
| 対象 | 音源ファイル(`.wav`)のアップロード、楽曲(`wav_tracks`)の一覧・名前変更・削除、楽曲への音声タイプ(`DEFAULT`/`NOTIFICATION`/`ALARM`)割り当て変更 |
| 対象外 | `audio_types` マスタ自体の追加・編集(3値固定として扱う)、`schedules.json`(`minute_settings`)との連携(将来フェーズで別途検討。今回は着手しない)、DB スキーマ変更・マイグレーション(Python 側の責務)、画面の詳細設計(レイアウト・操作フロー。別途 `frontend-design` でのブレインストーミングにより作成する) |
| 備考 | `sounds/default/` 配下の初期音源(`wav_tracks` に登録済み)は一覧表示のみとし、名前変更・削除は不可。音声タイプ割り当ての変更のみ可能とする。本書は API/データ層/デプロイに必要な前提のみ記載する |

## 2. データ層(Drizzle ORM + `node:sqlite`)

### 接続方式

- ドライバは `node:sqlite`(Node.js 22 組み込み、追加のネイティブ依存なし)。
  `drizzle-orm/node-sqlite` 経由で利用する。
  **バージョンに関する注意(実機検証済み)**: `drizzle-orm/node-sqlite` は
  安定版(`latest` タグ、執筆時点 0.45.2)にはまだ存在せず、次期メジャー
  (1.0)の release candidate(`drizzle-orm@rc`、執筆時点 `1.0.0-rc.4`。
  `drizzle-kit@rc` も同様)にのみ含まれる。両バージョンを実際にインストールし
  export 一覧を比較して確認済み。RC を採用する方針としたため、
  `package.json` には `drizzle-orm`/`drizzle-kit` とも `rc` タグのバージョンを
  明記する。1.0 正式リリース後、stable への切り戻しを検討する。
- DB パスはハードコードせず、既存の `SETTINGS_DIR` と同じパターンで
  環境変数 `DB_DIR` から解決する(`src/lib/paths.ts` に `getDbPath()` を追加)。
  開発時(devcontainer)は未設定なら `cwd` 直下の `db/music.sqlite3` を使う。
- 接続確立時に以下の PRAGMA を必ず発行する(⭐私のオススメ。SQLite の定石だが、
  `node:sqlite` が自動でやってくれるわけではない):
  - `PRAGMA journal_mode = WAL;` — Python 側の cron ジョブとこの Node プロセスが
    同じ DB ファイルに同時アクセスするため必須(運用ルールで指定済み)。
  - `PRAGMA foreign_keys = ON;` — **重要な注意点**: SQLite は接続ごとに外部キー
    制約がデフォルト無効。これを入れないと `track_audio_types` の
    `ON DELETE CASCADE` が実際には効かない(スキーマにはあるが無視される)。
- 接続は単一のシングルトンモジュール(`src/lib/db/client.ts`)で保持し、
  `schedule-store.ts` と同様にモジュールスコープで使い回す。

### スキーマ取り込み

- `schema.ts` / `relations.ts` / meta スナップショット / SQL migration ファイルは
  `drizzle-kit pull` で生成し、**手書き・手動編集は禁止**。生成物は `src/lib/db/`
  配下に置き、通常の TS ソースとしてコミットする(DB ファイル自体は
  `db/.gitignore` で除外されたまま)。
- 実行コマンド: `npx drizzle-kit pull --dialect=sqlite --url=file:$DB_DIR/music.sqlite3`
  (drizzle-kit 自体の DB 接続には `better-sqlite3` が必要。アプリ実行時の
  ドライバ(`node:sqlite`)とは別物であり、`better-sqlite3` は devDependencies に
  `drizzle-kit` 実行用としてのみ追加する)。
- 運用ルール: Python 側でテーブル定義が変わったら → マイグレーション再実行 →
  `drizzle-kit pull` を再実行して生成物一式を更新する(手動編集しない)。
- 生成直後は必ず目視確認する項目:
  - `track_audio_types` の複合PK(`track_id`, `audio_type_id`)と複合FK
    (`ON DELETE CASCADE`)が正しく拾えているか
  - `wav_tracks.name` と `audio_types.name` にはそれぞれ `UNIQUE INDEX`
    (`ix_wav_tracks_name` / `ix_audio_types_name`)が張られている(実機の
    DB を `drizzle-kit pull` して確認済み)。`audio_types.name` は
    `DEFAULT`/`NOTIFICATION`/`ALARM` の3値運用だが、DB スキーマ上は
    CHECK 制約のない単なる文字列(UNIQUE ではあるが値の制限はない)ため、
    **アプリ側で許容値をバリデーションする**

### 高レベル操作層(`src/lib/track-store.ts`)

`schedule-store.ts` に相当する薄いラッパーとして以下を実装する。

- `listTracks()`: `wav_tracks` を `track_audio_types` 経由で `audio_types` と
  JOIN し、各楽曲に割り当て済みタイプ配列を付けて返す。`file_path` を絶対パス化した
  上で `getSoundsDefaultDir()` / `getSoundsUserDir()` と前方一致するかを判定し、
  `origin: "default" | "user"` を付与して返す。
- `createTrackFromUpload(file, audioTypeIds)`: ファイル書き込み + DB INSERT
  (`wav_tracks` + `track_audio_types`)をトランザクションでまとめ、片方が
  失敗したらもう片方を巻き戻す(ファイル書き込み成功後に DB INSERT が失敗したら
  書き込み済みファイルを削除する)。
- `updateTrack(id, { name, audioTypeIds })`: `name` 更新と
  `track_audio_types` の全置換(delete→insert)を1トランザクションで行う。
  `origin: "default"` の楽曲に対しては `name` 変更を拒否する。
- `deleteTrack(id)`: `origin: "default"` なら拒否。`origin: "user"` なら
  DB 行削除(CASCADE で `track_audio_types` も消える)と実ファイル削除を
  まとめて行う。

**`file_path` の絶対パス化に関する既知の注意点**: Python 側は `file_path` を
相対パス文字列で保存している可能性があり、TS 側プロセスの実行ディレクトリ次第では
存在確認や `origin` 判定が期待通り動かないおそれがある。`origin` 判定・実ファイル
アクセスの両方で、`path.resolve()` により常に絶対パスへ正規化してから比較・操作する。

## 3. API 設計(BFF)

既存の `/api/schedules` と同じ Next.js Route Handlers 方式。ベースパスは
`/api/tracks`。

| メソッド | パス | 役割 |
| --- | --- | --- |
| GET | `/api/tracks` | 楽曲一覧を返す(`wav_tracks` + 割り当て済み音声タイプ + `origin`) |
| GET | `/api/audio-types` | `audio_types` 一覧を返す(読み取り専用。選択肢表示用) |
| POST | `/api/tracks` | `multipart/form-data` でファイル本体を受け取り、`sounds/user/` へ保存 + `wav_tracks` へ INSERT。`audioTypeIds`(任意、省略時は空)も同時に登録する |
| PATCH | `/api/tracks/:id` | `{ name, audioTypeIds }` を受け取り、名前と音声タイプ割り当てを全置換する |
| DELETE | `/api/tracks/:id` | DB 行 + 実ファイルを削除する |

### バリデーション・エラー

| ステータス | 条件 |
| --- | --- |
| 400 | 拡張子/MIME が `.wav` 以外、`audioTypeIds` に存在しないIDが含まれる、ファイル名が不正(サニタイズ違反) |
| 409 | `file_path` 重複(同名ファイルが既に `sounds/user/` に存在)、または `name` 重複(表示名がアップロード時の自動生成・`PATCH` での変更いずれかで既存レコードと衝突) |
| 413 | ファイルサイズが上限(10MB)超過 |
| 404 | `PATCH`/`DELETE` で存在しない `id` |
| 403 | `origin: "default"` の楽曲への `DELETE`、または `name` 変更 |
| 500 | ファイル I/O・DB I/O 失敗 |

### アップロード時のファイル名サニタイズ(⭐セキュリティ上必須)

クライアントから受け取ったファイル名をそのまま `path.join(soundsUserDir, filename)`
に使わない。`path.basename()` を通した上で、結果が元の入力と一致することを確認し
(`../` 等によるディレクトリトラバーサル対策)、さらに許可文字(英数字・ハイフン・
アンダースコア・ドット程度)のみを許容する正規表現でチェックする。

## 4. 画面(概要)

新規ルート `/tracks` を追加し、既存のスケジュール画面(`/`)との間を行き来できる
ナビゲーションを設ける。一覧・アップロード・名前変更・削除・音声タイプ割り当て変更の
操作が行える画面とする。**レイアウト・操作フローの詳細設計は本書の対象外とし、
別途 `frontend-design` でのブレインストーミングにより作成する。**

## 5. デプロイ構成(volume 追加)

既存の `settings` named volume と同じパターンで、`db`・`sounds` も backend 側
リポジトリが作成する named volume を `external: true` で参照する。

```yaml
services:
  schedule-ui:
    volumes:
      - settings:/data/settings
      - db:/data/db
      - sounds:/data/sounds
    environment:
      - SETTINGS_DIR=/data/settings
      - DB_DIR=/data/db
      - SOUNDS_DIR=/data/sounds

volumes:
  settings:
    external: true
  db:
    external: true
  sounds:
    external: true
```

- `SOUNDS_DIR` 配下に `default/`・`user/` のサブディレクトリがある前提(現状の
  devcontainer 構成と同じ)。`getSoundsDefaultDir()` / `getSoundsUserDir()` は
  この `SOUNDS_DIR` からの相対パスとして解決する。
- 所有権・作成責務は `db`・`sounds` volume も backend 側リポジトリのままとし、
  このリポジトリは `external: true` 参照のみ(`settings` と同じ整理)。

## 6. テスト方針

既存の3層ピラミッド(Vitest ユニット/API + Playwright E2E)を踏襲する。

| レイヤー | 対象 | 方針 |
| --- | --- | --- |
| ユニット | `src/lib/track-store.ts` | `@vitest-environment node`。テスト用の一時ディレクトリに一時 SQLite ファイルを作成し、後述の方法でスキーマを流し込んでから検証する。実ファイル(`.wav`)は数バイトのダミーバッファで代用 |
| API | `/api/tracks`・`/api/tracks/:id`・`/api/audio-types` | next-test-api-route-handler。`DB_DIR`/`SOUNDS_DIR` をテスト用一時ディレクトリに向けて実行 |
| E2E | 楽曲管理の主要シナリオ1本 | Playwright。アップロード→一覧に反映→音声タイプ変更→削除、を一連で確認(ユニット/APIで担保できる細かいバリデーション分岐は重複させない) |

### テスト用DBの構築方法(⭐私のオススメ)

`drizzle-kit pull` は `schema.ts`/`relations.ts` に加えて、`drizzle/0000_xxxx.sql`
という CREATE TABLE 一式の SQL migration ファイルも同時生成する(実機の
`db/music.sqlite3` に対して実際に `drizzle-kit pull` を実行し、生成物を確認済み。
内容はデフォルトでコメントアウトされているが、そのまま剥がせば実行可能な
正しい DDL である)。この migration ファイルは `pull` を再実行するたびに
`schema.ts` と一緒に再生成されるため、**テスト用フィクスチャを手動で
コピー・維持する必要がない**。

テストの `beforeEach` では、この `drizzle/0000_xxxx.sql` を読み込み、コメントを
除去した上で `--> statement-breakpoint` 区切りで分割し、一時 SQLite ファイルに
順に実行するヘルパー(`src/lib/db/__tests__/create-test-db.ts` 程度)を1つ用意する。
Python 側スキーマ変更時も `drizzle-kit pull` を再実行するだけで、テスト用DBの
構築方法も自動的に追従する。

## 7. ベストプラクティス準拠状況の整理

| 設計判断 | 位置づけ |
| --- | --- |
| Drizzle ORM + `node:sqlite` | 決定事項(ユーザー指定)。Node.js 22 組み込みでネイティブ依存が増えない |
| `drizzle-orm@rc`/`drizzle-kit@rc`(1.0 release candidate)の採用 | 確定。ユーザー判断(RCのAPI変更リスクを許容し、node:sqlite対応を優先。実機検証で安定版に該当exportが無いことを確認済み) |
| `drizzle-kit pull` でスキーマ取り込み(手書き禁止) | 決定事項。スキーマは Python 側が真実の源(source of truth) |
| `PRAGMA journal_mode = WAL` | 決定事項(ユーザー指定)。複数プロセス(cron + Node)同時アクセス対策 |
| `PRAGMA foreign_keys = ON` | ⭐私のオススメ。SQLite はデフォルト無効のため明示しないと CASCADE が効かない |
| ファイル名サニタイズ(`path.basename` + 許可文字チェック) | ⭐私のオススメ。パストラバーサル対策(公式手順ではないが必須級) |
| アップロード=ファイル書き込み+DB INSERT のトランザクション化 | ⭐私のオススメ。片方失敗時の不整合(孤立ファイル/存在しないファイルを指すDB行)を防ぐ |
| `drizzle/0000_xxxx.sql` を使ったテスト用DB構築 | ⭐私のオススメ。手動フィクスチャ同期のリスクを排除(実機で生成物を確認済み) |
| default 楽曲(`sounds/default`)は編集・削除不可 | 確定。ユーザー判断 |
| アップロード時 `.wav` 限定・10MB上限・重複エラー | 確定。ユーザー判断 |
| 削除時に実ファイルも道連れで削除 | 確定。ユーザー判断 |
| 表示名はファイル名から自動生成 | 確定。ユーザー判断 |
| `audio_types` マスタ自体はUI管理対象外(3値固定) | 確定。ユーザー判断 |
| 画面詳細設計は別途 `frontend-design` でブレスト | 確定。ユーザー判断(本書はAPI/データ層/デプロイの前提のみ記載) |
