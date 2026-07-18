# 010: コンテナ起動管理方式の確定

- ステータス: 完了
- 関連文書: [要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.12

## 概要

フロント用コンテナの起動管理を、手動 `docker compose up` にするか、
ホスト起動時に自動起動にするかが未確定だった。

## 決定内容

`restart: unless-stopped` のみで運用する。`docker.service` 自体の自動起動
(通常デフォルトで有効)により、ホスト再起動時も既存コンテナが自動的に
復帰するため、自前の systemd unit は用意しない。ただし `docker compose down`
でコンテナを削除した場合は再起動ポリシーの対象外になるため、削除後は
改めて `docker compose up -d` が必要。

## 完了条件

- [x] 運用要件(常時稼働 or オンデマンド)を確認する → 常時稼働(`unless-stopped`)
- [x] `docker-compose.yaml` の `restart` ポリシーを確定内容に合わせる
- [x] [概要設計書](../../docs/schedule-ui-overview-design.md) 8章・[要件不足事項一覧](../../docs/schedule-ui-open-questions.md) を確定内容に更新する
