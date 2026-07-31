# 009: スケジュール画面からの音設定の実装

- ステータス: 完了
- 関連文書: [design/006](../design/006-schedule-sound-assignment-design.md)、
  [実装計画](../../docs/superpowers/plans/2026-07-31-schedule-sound-assignment.md)

## 概要

design/006 の詳細設計に基づき、`src/lib/schedule-ui.ts` への純粋関数追加
(`getMinuteSound`・`setMinuteSoundTrack`・`setMinuteSoundTypes`・`clearMinuteSound`)、
新規 `SoundAssignDialog`、`TimeGrid` への音バッジ配線、`page.tsx` への組み込みを
サブエージェント駆動(タスクごとに実装→レビュー→修正)で行った。最終ブランチ
レビューで発見された、曜日間コピーの確認ダイアログが音設定の差分を見逃す不具合、
および新ペイロード形状(`sound_types`)の実 Ajv スキーマでの検証不足も追加で修正した。

## 完了条件

- [x] ONの分にバッジを表示し、クリックで曲/タイプを設定できる
- [x] 「曲を指定」は `/api/tracks` から取得した楽曲一覧から1つ選択する
      (未登録の値も選択肢として保持し、黙って消さない)
- [x] 「タイプで指定」は DEFAULT/NOTIFICATION/ALARM を複数選択できる
      (schema 順に正規化して保存)
- [x] 保存は既存の「保存」ボタンまで反映しない(ダイアログの適用はクライアント側
      状態の更新のみ。`PUT /api/schedules` は呼ばない)
- [x] 曜日間コピーの確認ダイアログが、音設定のみが異なる場合も「変更なし」と
      誤表示しないようにする(最終レビューで発見・修正)
- [x] 新しい `minute_settings` の形(`sound_file_name: ''` + `sound_types`)を
      実 Ajv バリデータ(`settings/schema.json`)でテストする(最終レビューで発見・追加)
- [x] `pnpm test` で green(ユニット・コンポーネント。229件)
- [x] `pnpm test:e2e` で green(既存シナリオへの追加ステップ)
