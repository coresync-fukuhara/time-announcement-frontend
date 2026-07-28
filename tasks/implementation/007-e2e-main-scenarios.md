# 007: E2E 主要シナリオ(Playwright)の実装

- ステータス: 完了
- 関連文書: [テスト設計書](../../docs/schedule-ui-testing-design.md) 4.3節

## 概要

ユニット/API テストで担保できない、画面をまたぐ主要シナリオのみを E2E で確認する。

`e2e/schedule-editing.spec.ts` に実装。`SETTINGS_DIR` 未設定時のフォールバック先である実
`settings/schedules.json` を直接読み書きするため、各テストの前後で元の内容を退避・復元し、
ファイル競合を避けるためファイル内は直列実行(`test.describe.configure({ mode: 'serial' })`)にした。
既存の `e2e/smoke.spec.ts` は UI 実装前の `<h1>` 前提のままだと初期化ダイアログ分岐で落ちるため、
どちらの分岐でも一致する `<title>` の確認に更新した。

## 完了条件

- [x] シナリオ1: `schedules.json` が存在しない状態でアクセス→初期化ダイアログが表示される→
      「空で始める」を選択→保存できる
- [x] シナリオ2: 曜日タブを切り替えて時刻をトグル→保存→ページ再読み込み後も反映されている
- [x] シナリオ3: 保存前に未保存インジケーターが表示され、保存後に消える
- [x] `npm run test:e2e` で green
