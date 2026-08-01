# 010: 楽曲試し聴き機能の実装

- ステータス: 完了
- 関連文書: [design/007](../design/007-track-preview-playback-design.md)、
  [実装計画](../../docs/superpowers/plans/2026-08-01-track-preview-playback.md)

## 概要

design/007 の詳細設計に基づき、`src/lib/track-store.ts` への
`getTrackFilePathOrThrow` 追加、新規 `GET /api/tracks/:id/audio`(音声配信API)、
`TrackRow`/`TrackSection` への再生ボタン・状態中継の追加、`TracksPage` への
共有 `<audio>` 要素の配線をサブエージェント駆動(タスクごとに実装→レビュー→
修正)で行った。最終ブランチレビューで発見された、再生中トラックの削除で
共有プレイヤーが止まらない不具合、および `onEnded`・複数行間の再生切り替え
(設計 §3.1 で明記されていたが未テストだった)のテスト不足も追加で修正した。

## 完了条件

- [x] `/tracks` の各行に▶/⏸ボタンが表示され、クリックで試し聴きできる
- [x] 同時に再生されるのは常に1曲(別行を再生すると前の再生は自動的に止まる)
- [x] `origin`(`default`/`user`/`unknown`)を問わず再生でき、既存の `busy`
      状態(名前変更・削除処理中)によって再生ボタンが無効化されない
- [x] 再生失敗時は既存の `ErrorDialog` で「再生に失敗しました」を表示する
- [x] 再生中のトラックを削除すると、共有プレイヤーが停止し再生状態が解除される
      (最終レビューで発見・修正)
- [x] `pnpm test` で green(ユニット・API・コンポーネント。253件)
- [x] `pnpm test:e2e` で green(既存の楽曲管理シナリオへ試し聴きのステップを追加)
