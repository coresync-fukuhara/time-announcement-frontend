# 008: Docker 化・docker-compose 構成

- ステータス: 未着手
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 8章

## 概要

`frontend/` を `output: 'standalone'` でビルドし、Ubuntu ホスト上で
Docker コンテナとして起動できるようにする。

## 完了条件

- [ ] `frontend/Dockerfile`(マルチステージビルド, `node:22-slim` ベース)を作成する
- [ ] `docker-compose.yaml` で `ports: 3000:3000`、`volumes: settings:/data/settings`(named volume、`external: true`)を設定する
- [ ] `SETTINGS_DIR` 環境変数でファイルパスを受け取れるようにする(ハードコードしない)
- [ ] `restart: unless-stopped` を設定する([003](./003-container-startup-policy.md) で確定済み)

## 補足

`settings/` は backend 側リポジトリが作成する named volume(`settings`)を
`external: true` で参照する([002](./002-host-uid-gid.md) で確定済み)。
ホストへの bind mount は行わないため、ホスト側 UID/GID の確認は不要。
