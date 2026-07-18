# 009: `settings/` の共有方式の確定(旧: ホスト UID/GID 確認)

- ステータス: 完了
- 関連文書: [要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.8

## 概要

当初はホストの `settings/` を bind mount する前提で、コンテナとホストの
ファイル権限(UID/GID)を合わせる必要があったが、ホスト側で `src/main.py` を
cron 実行しているユーザーの UID/GID が未確認のため保留になっていた。

その後、backend(Python 側)も別リポジトリでコンテナ化する方針に変更したため、
ホストへの bind mount 自体をやめ、Docker の **named volume** を frontend/backend
両コンテナで共有する方式に変更した。volume の作成・所有権管理は backend 側
リポジトリの責務とし、このリポジトリの `docker-compose.yaml` は
`external: true` で参照するのみとする。これによりホスト側 cron 実行ユーザーの
UID/GID を事前に確認する必要はなくなった。

## 決定内容

- `settings/` は bind mount ではなく named volume(`settings`)で共有する。
- volume の作成は backend 側リポジトリの compose の責務。このリポジトリでは
  `external: true` で参照するのみ。

## 完了条件

- [x] `settings/` の共有方式(bind mount か named volume か)を決定する
- [x] [概要設計書](../../docs/schedule-ui-overview-design.md) 4章・8章を確定内容に更新する
- [x] [要件不足事項一覧](../../docs/schedule-ui-open-questions.md) を確定内容に更新する
