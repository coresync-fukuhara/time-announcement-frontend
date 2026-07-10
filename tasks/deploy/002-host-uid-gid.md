# 009: ホスト側 `settings/` の UID/GID 確認

- ステータス: 保留
- 関連文書: [要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.8

## 概要

bind mount した `settings/` はコンテナとホストでファイル権限(UID/GID)を
合わせる必要があるが、ホスト側で `src/main.py` を cron 実行しているユーザーの
UID/GID が未確認のため保留。

## 何が決まれば着手できるか

ホストで Python(cron)を動かしているユーザーの UID/GID。

## 暫定案(設計書での仮置き)

コンテナ実行ユーザーをホストと同一 UID に合わせる運用とする。

## 完了条件

- [ ] ホストの cron 実行ユーザーの UID/GID を確認する
- [ ] `frontend/Dockerfile` の実行ユーザーをホストと同一 UID/GID に設定する
- [ ] [概要設計書](../../docs/schedule-ui-overview-design.md) 8章・[要件不足事項一覧](../../docs/schedule-ui-open-questions.md) を確定内容に更新する
