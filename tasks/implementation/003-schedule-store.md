# 003: `lib/schedule-store.ts`(読み書き・アトミック書き込み・`.bak`)の実装

- ステータス: 未着手
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 7章、[テスト設計書](../../docs/schedule-ui-testing-design.md) 4.1節・4.2節

## 概要

`settings/schedules.json` の読み書きを担うモジュールを実装する。
再生側(`src/main.py`)が毎分ファイルを読むため、壊れたファイルを書かないことが必須要件。

## 完了条件

- [ ] 書き込み前に `lib/validator.ts` でバリデーションし、違反時はファイルに触れない
- [ ] アトミック書き込み(同一ディレクトリに `.tmp` を書いて `fsync` 後に `rename(2)`)を実装
- [ ] 書き込みを 1 本のキュー(Promise チェーン)に直列化する
- [ ] UTF-8 / LF / インデント 2 スペースで整形して書き込む
- [ ] 書き込み前に既存ファイルを `schedules.json.bak` として 1 世代分残す(上書き)
- [ ] `minute_settings` を破壊せず温存する(既存データを読み込んで書き戻す際に消えない)
- [ ] ファイルが存在しない/バリデーションエラーの場合を検出できる(`initialized: false` 判定に使う)
- [ ] ユニットテスト(Vitest, `vi.mock` でファイル I/O を差し替え)が green
