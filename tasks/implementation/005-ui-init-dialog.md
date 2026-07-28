# 005: 初期化選択ダイアログの実装

- ステータス: 完了
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 5章、[要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.9

## 概要

`GET /api/schedules` が `initialized: false` を返した場合(ファイルが無い/壊れている場合)、
画面遷移前に「空の週間スケジュールで始める」か「サンプル設定からコピーして始める」かを
選択させるダイアログを表示する。

`src/components/InitDialog.tsx` に実装。「サンプル設定からコピー」用に、`sample_schedules.json`
を読み込む `GET /api/sample-schedules` を新規追加した(既存の BFF には無かったため)。

## 完了条件

- [x] `initialized: false` のとき初期化ダイアログを表示する
- [x] 「空の週間スケジュールで始める」を選ぶと空データで画面に遷移する
- [x] 「サンプル設定からコピーして始める」を選ぶと `sample_schedules.json` の内容で画面に遷移する
- [x] コンポーネントテスト(Vitest + React Testing Library)が green
