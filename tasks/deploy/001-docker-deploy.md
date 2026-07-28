# 008: Docker 化・docker-compose 構成

- ステータス: 完了
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 8章

## 概要

リポジトリ直下のアプリ本体を `output: 'standalone'` でビルドし、Ubuntu ホスト上で
Docker コンテナとして起動できるようにする。

## 完了条件

- [x] `deploy/Dockerfile`(マルチステージビルド, `node:22-slim` ベース)を作成する
- [x] `deploy/docker-compose.yaml` で `ports: 3000:3000`、`volumes: settings:/data/settings`(named volume、`external: true`)を設定する
- [x] `.dockerignore`(リポジトリ直下 = ビルドコンテキストの起点)を作成する
- [x] `SETTINGS_DIR` 環境変数でファイルパスを受け取れるようにする(ハードコードしない)
- [x] `restart: unless-stopped` を設定する([003](./003-container-startup-policy.md) で確定済み)

## 補足

- `settings/` は backend 側リポジトリが作成する named volume(`settings`)を
  `external: true` で参照する([002](./002-host-uid-gid.md) で確定済み)。
  ホストへの bind mount は行わないため、ホスト側 UID/GID の確認は不要。
- `Dockerfile`・`docker-compose.yaml` は `deploy/` にまとめる。ビルドコンテキストは
  `src/`・`package.json` 等一式が必要なためリポジトリ直下を指す
  (`docker-compose.yaml` の `build.context: ..`)。起動は
  `docker compose -f deploy/docker-compose.yaml up -d`。
- **frontend コンテナは root で実行する**: backend が作成する named volume の所有者
  (通常 root)と frontend コンテナの非 root ユーザーの UID が一致せず書き込みに失敗する
  ことを実機検証で確認したため、UID 調整はせず root 実行で回避する(概要設計 8章に追記)。
- `docker compose build`・実際のコンテナ起動・`/api/schedules` の GET/PUT・`.bak` 生成
  まで実機で動作確認済み。
