# 006: 曜日タブ・時刻グリッド画面の実装

- ステータス: 完了
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 5章、[要件不足事項一覧](../../docs/schedule-ui-open-questions.md) No.1・No.2・No.6・No.10・No.13

## 概要

曜日タブ(`holiday` 含む全 8 タブ)+ 時刻グリッドの 1 画面 UI を実装する。

`src/components/`(DayTabs・TimeGrid・AddHourDialog・CopyDialog・ConfirmDialog・ErrorDialog・
CopyDiff)と `src/app/page.tsx` に実装。行削除・曜日コピー(上書き)は実行前に確認ダイアログを
挟み、コピー確認では対象曜日ごとの差分(変更前→変更後)を表示する。保存前バリデーションエラーは
エラーダイアログでそのまま内容を表示する。曲(`minute_settings.sound_file_name`)の割り当て UI は
見た目のみ `TimeGrid.tsx` 内にコメントアウトで用意し、配線はしていない(実データ連携が無いため)。
このスタブは [implementation/009](./009-schedule-sound-assignment.md) で実配線された。

## 完了条件

- [x] 画面は既定で閲覧(確認)モードとして開き、右上ボタン(「編集」⇔「保存」)で編集モードと行き来できる。閲覧モードでは時刻ボタン・行の追加削除・曜日コピーが非活性になる
- [x] 曜日タブ(月〜日 + holiday)の切り替えができる
- [x] 時間行の追加(`[+ 時間を追加]`、0〜23 時から未使用の時間を選択)ができる
- [x] 時間行の削除ができる
- [x] 各時間行に 0/5/10/…/55 の 5 分刻みボタン(12 個)があり、クリックで ON/OFF をトグルする
- [x] 曜日間コピー機能(ある曜日の設定を他曜日へコピー)がある
- [x] 未保存の変更がある場合にインジケーターが表示され、保存後に消える
- [x] `[保存]` ボタン押下で `PUT /api/schedules` に送信する(トグル即時保存はしない)
- [x] 保存前バリデーションエラー時は画面遷移しない
- [x] `minute_settings` は編集対象外(UI に出さない)。※後に [implementation/009](./009-schedule-sound-assignment.md) で編集対象化された
- [x] コンポーネントテスト(Vitest + React Testing Library)が green
