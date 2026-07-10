# 005: 初期化選択ダイアログの実装

- ステータス: 未着手
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 5章、[要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.9

## 概要

`GET /api/schedules` が `initialized: false` を返した場合(ファイルが無い/壊れている場合)、
画面遷移前に「空の週間スケジュールで始める」か「サンプル設定からコピーして始める」かを
選択させるダイアログを表示する。

## 完了条件

- [ ] `initialized: false` のとき初期化ダイアログを表示する
- [ ] 「空の週間スケジュールで始める」を選ぶと空データで画面に遷移する
- [ ] 「サンプル設定からコピーして始める」を選ぶと `sample_schedules.json` の内容で画面に遷移する
- [ ] コンポーネントテスト(Vitest + React Testing Library)が green
