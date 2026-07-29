# 008: 楽曲管理画面(`/tracks`)の実装

- ステータス: 完了
- 関連文書: [楽曲管理画面(`/tracks`)画面詳細設計](../../docs/superpowers/specs/2026-07-29-music-management-screen-design.md)

## 概要

データ層・API(`/api/tracks`・`/api/tracks/:id`・`/api/audio-types`。楽曲管理機能
概要設計書に基づき実装済み)の上に、`/tracks` 画面を実装した。全操作を即時に
サーバーへ反映する方式とし、`src/app/page.tsx`(スケジュール設定画面)との間を
ヘッダーのアイコン切替(`NavSwitcher`)で行き来できるようにした。

## 完了条件

- [x] `/tracks` にアクセスすると、`user` 楽曲は「アップロード済み」、
      `default`/`unknown` 楽曲は「初期音源・その他(名前変更・削除不可)」に
      分けて表示される
- [x] 常設ドロップゾーンから `.wav` をアップロードすると一覧に即時反映される
      (複数ファイル同時ドロップ・拡張子違反・10MB超はクライアント側で弾く)
- [x] `user` 楽曲の名前をインライン編集すると即時に `PATCH` される
- [x] 音声タイプのバッジをクリックすると即時に `PATCH` される
      (`origin` を問わず操作できる)
- [x] `user` 楽曲の削除は既存の `ConfirmDialog` での確認を経てから `DELETE` される
- [x] 各操作の失敗は既存の `ErrorDialog`(`description` prop を追加して汎用化)で表示される
- [x] ヘッダーの `NavSwitcher`(🕐/🎵)で `/` と `/tracks` を行き来できる
- [x] `pnpm test` で green(コンポーネント: `TrackRow`・`TrackSection`・
      `UploadDropzone`・`NavSwitcher`・`track-ui`・`ErrorDialog` 追加分・
      `tracks/page`。既存 `page.test.tsx` も引き続き green)
- [x] `pnpm test:e2e` で green(楽曲管理の主要シナリオ1本を追加)
