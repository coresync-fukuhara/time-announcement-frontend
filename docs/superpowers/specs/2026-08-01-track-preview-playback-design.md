# 楽曲管理画面(/tracks)への試し聴き機能 追加設計

作成日: 2026-08-01
ステータス: 確定(ブレインストーミング済み・実装計画待ち)

## 1. 位置づけ・目的

[/tracks画面](../../../src/app/tracks/page.tsx)(楽曲管理機能、
[概要設計書](../../music-management-overview-design.md))は現状、一覧・
アップロード・名前変更・削除・音声タイプ割り当てのみで、登録済みの`.wav`を
実際に聴いて確認する手段がない。本書は各行に再生ボタンを追加し、クリックで
その場で試し聴きできるようにする機能追加の詳細設計。

対象は`TrackRow`・`TrackSection`・`TracksPage`(UI層)と、新規追加する音声配信
APIおよび`track-store.ts`への追加関数のみ。既存のアップロード・名前変更・削除・
音声タイプ割り当てのロジック・APIは無改修。`origin`(`default`/`user`/`unknown`)
による編集可否の制限は再生には適用しない(どの`origin`の曲でも再生できる)。

## 2. 配信API設計

### 2.1 エンドポイント

`GET /api/tracks/:id/audio`(新規: `src/app/api/tracks/[id]/audio/route.ts`)。
既存の`src/app/api/tracks/[id]/route.ts`と同じ`export const runtime = 'nodejs'`・
`parseId()`パターンを踏襲する。

- `id`が数値でない → 400 `{ error: 'invalid_id' }`
- DBに該当行が無い → 404 `{ error: 'not_found' }`
- DBには行があるが実ファイルが`ENOENT`(孤立レコード) → 404
  `{ error: 'file_not_found' }`
- その他のファイルI/Oエラー → 500 `{ error: 'io_error' }`
- 成功時: `Content-Type: audio/wav`でファイル本体をそのまま返す。
  `Content-Disposition`は付けない(ダウンロードではなく`<audio>`再生用途のため)

### 2.2 Rangeヘッダ

**対応しない。** 毎回ファイル全体を返す。時報用途の`.wav`は短時間を想定しており、
シーク操作もほぼ発生しない。将来的に長い音声を扱うようになった場合に改めて
検討する。

### 2.3 `track-store.ts`への追加

`getTrackByIdOrThrow`相当のDB検索ロジックを再利用し、新規関数
`getTrackFilePathOrThrow(id: number): string`を追加する。既存の
`updateTrack`/`deleteTrack`と異なり、`origin`による権限チェックは行わない
(再生はorigin問わず許可する方針のため)。見つからない場合は既存の
`TrackNotFoundError`を投げる(新規エラークラスは追加しない)。

ファイルI/Oは`node:fs/promises`の`readFile()`を使い、`path.resolve()`で
絶対パス化してから読む(`resolveOrigin()`と同じ流儀を踏襲。DB由来のパスで
外部入力ではないためpath traversalのリスクは無いが、既存コードの慣習に合わせる)。

## 3. UI設計

### 3.1 再生方式: ▶ボタン + 単一の共有プレイヤー

複数行に個別の`<audio controls>`を埋め込むのではなく、`TracksPage`が非表示の
`<audio>`要素を1つだけ保持し、どの行の再生ボタンを押してもその1要素を使い回す。
同時に再生されるのは常に1曲のみで、別の行の再生ボタンを押すと前の再生は自動的に
止まる。

- `TracksPage`が`playingId: number | null`を状態として持つ
- `togglePlay(id)`:
  - `playingId === id`(自分自身が再生中) → `audio.pause()`して`playingId`を`null`に
  - それ以外 → `audio.src`を`` `/api/tracks/${id}/audio` ``に差し替えて`audio.play()`、
    `playingId`を`id`に更新
- `<audio>`の`onEnded`イベントで自然終了時も`playingId`を`null`に戻す
- `<audio>`の`onError`イベントで再生失敗を検知(詳細は4章)

### 3.2 `TrackRow`の見た目

ブレインストーミング中にモックアップで確認・確定した案(A+Cハイブリッド):

- 行の先頭(名前の左)に28×28pxの丸ボタン(既存の`.deleteBtn`/`.lockIcon`と
  同サイズ)を配置。中身は停止中`▶`・再生中`⏸`
- 再生ボタン自体は停止中・再生中とも**枠線(border)を保持**する
  (再生中は`border-color: var(--accent)`、背景は`var(--panel)`のまま浮き上がる
  ようにする。透明にはしない)
- 再生中は**行全体**(`.row`)の背景を`var(--accent-soft)`にして薄くハイライトする。
  名前ラベルの文字色も`var(--accent-ink)`にする
- `aria-label`: 停止中は`` `${track.name} を再生` ``、再生中は
  `` `${track.name} を停止` ``

### 3.3 Props・コンポーネント間の受け渡し

- `TrackRow`に`playing: boolean`・`onTogglePlay: () => void`を追加
- `TrackSection`に`playingTrackId: number | null`を追加し、
  `track.id === playingTrackId`を`playing`として`TrackRow`へ中継、
  `onTogglePlay`は`() => onTogglePlay(track.id)`の形で中継する
  (既存の`onRename`/`onToggleAudioType`/`onDelete`と同じパターン)

### 3.4 既存操作との関係

再生中でも名前変更・削除・音声タイプ切替えなど他の操作は一切制限しない
(既存の`busy`状態と再生状態は独立)。再生ボタン自体も既存の`busy`
(PATCH/DELETE進行中)によって無効化しない。

## 4. エラー処理

- `<audio>`の`onError`イベント発生時(取得失敗・404など)、既存の`ErrorDialog`を
  再利用して「再生に失敗しました」+ 既存の`NETWORK_ERROR_DESCRIPTION`相当の
  説明文を表示し、`playingId`を`null`に戻す
- `audio.play()`はブラウザによってはPromiseを返しrejectすることがあるが、
  `onError`イベント側の処理に一本化し、二重にエラーダイアログを出さないようにする
- 削除済み・存在しないトラックへの再生試行(競合状態)は、配信APIが404を返し
  `onError`経由で同じエラーダイアログに自然に落ちる。特別な分岐は設けない

## 5. スコープ外(今回やらない)

- Rangeヘッダ対応(2.2節)
- 音量・シークバーなどの詳細な再生UI(ブラウザ標準の`<audio controls>`は使わず、
  独自の▶/⏸ボタンのみ)
- 再生中の他操作の制限
- `schedules.json`側(スケジュール画面)への試し聴き機能の追加(本書は
  `/tracks`画面のみが対象)

## 6. テスト方針

既存の3層ピラミッド(`docs/schedule-ui-testing-design.md`)に沿う。

| 層 | 対象 | 内容 |
| --- | --- | --- |
| ユニット | `track-store.test.ts`に追加 | `getTrackFilePathOrThrow`: 存在するidでfilePathを返す、存在しないidで`TrackNotFoundError` |
| API | 新規`api/tracks/[id]/audio/route.test.ts` | 200(`Content-Type: audio/wav`・ボディがファイル内容と一致)、不正id→400、存在しないid→404、DB行はあるがファイル無し→404 |
| コンポーネント | `TrackRow.test.tsx`に追加 | ボタンクリックで`onTogglePlay`が呼ばれる、`playing` propに応じてアイコン(▶/⏸)・`aria-label`・ハイライトが切り替わる |
| E2E | 既存の楽曲管理シナリオ(1本)にステップ追加。新規ファイルは作らない | 再生ボタンクリック→アイコンが⏸に変わる・`/api/tracks/:id/audio`へのリクエストが発生することを確認。実際の音声出力の検証はしない |

コンポーネント/統合テストでは`HTMLMediaElement.prototype.play`/`pause`が
jsdomに未実装のため、`vi.fn()`でモックする(`TracksPage`側の統合テストを
書く場合も同様)。
