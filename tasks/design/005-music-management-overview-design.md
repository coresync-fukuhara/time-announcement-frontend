# 005: 楽曲管理機能 概要設計書の作成

- ステータス: 完了
- 関連文書: [楽曲管理機能 概要設計書](../../docs/music-management-overview-design.md)

## 概要

楽曲(`db/music.sqlite3`)管理機能(音源アップロード・楽曲の一覧/名前変更/削除・
音声タイプ割り当て変更)のスコープ、Drizzle ORM + `node:sqlite` によるデータ層設計、
API 設計、デプロイ構成(volume 追加)、テスト方針を確定する。

## 完了条件

- [x] 目的・背景・スコープ(対象外含む)を明記する
- [x] データ層設計(Drizzle ORM 接続方式・スキーマ取り込み運用・高レベル操作層)を決定する
- [x] API 設計(`/api/tracks`・`/api/audio-types` の GET/POST/PATCH/DELETE とエラー設計)を確定する
- [x] デプロイ構成(`db`・`sounds` named volume の追加)を記載する
- [x] テスト方針(テスト用DB構築方法を含む)を確定する
- [x] 画面の詳細設計は対象外とし、別途 `frontend-design` に委ねる旨を明記する
