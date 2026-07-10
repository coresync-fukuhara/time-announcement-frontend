# 010: コンテナ起動管理方式の確定

- ステータス: 保留
- 関連文書: [要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.12

## 概要

フロント用コンテナの起動管理を、手動 `docker compose up` にするか、
ホスト起動時に自動起動にするかが未確定。

## 何が決まれば着手できるか

常時稼働が必要か、設定変更時だけ立ち上げれば足りるか(運用要件)。

## 暫定案(設計書での仮置き)

`restart: unless-stopped` で常時稼働。

## 完了条件

- [ ] 運用要件(常時稼働 or オンデマンド)を確認する
- [ ] `docker-compose.yaml` の `restart` ポリシーを確定内容に合わせる
- [ ] [概要設計書](../../docs/schedule-ui-overview-design.md) 8章・[要件不足事項一覧](../../docs/schedule-ui-open-questions.md) を確定内容に更新する
