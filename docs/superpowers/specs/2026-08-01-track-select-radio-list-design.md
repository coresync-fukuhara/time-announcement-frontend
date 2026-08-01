# 「曲を指定」モードの選択UIをラジオボタンリストに変更する詳細設計

作成日: 2026-08-01
ステータス: 確定(ブレインストーミング済み・実装計画待ち)

## 1. 位置づけ

[design/006](../../../tasks/design/006-schedule-sound-assignment-design.md)(および
[詳細設計書](2026-07-31-schedule-sound-assignment-design.md))3.2節で、`SoundAssignDialog`の
「曲を指定」モードの選択UIはネイティブ`<select>`ドロップダウンと決定され、
[implementation/009](../../../tasks/implementation/009-schedule-sound-assignment.md)で
実装・完了済みだった。運用開始後のユーザーフィードバック(2026-08-01)により、
選択肢が増えると`<select>`が使いづらいという指摘を受け、本書でその選択UI部分のみを
改訂する。

ブレインストーミング中の検討の流れ:
1. 最初は「チェックボックス形式」への変更を要望されたが、バックエンドの
   `sound_file_name`が単一文字列で複数曲を同時指定できない制約(design/006 §2、
   `src/main.py`実機確認済み)があるため、複数選択はできないことを確認
2. 制約を踏まえ、単一選択であることが見た目からも分かる**ラジオボタン**に変更する
   ことで合意
3. レイアウトは実際に動くモックアップ(縦並びリスト案/チップグリッド案)を比較し、
   縦並びリスト案を採用
4. 曲数が増えたときに`default`(初期音源)/`user`(アップロード済み)の区別が
   つくよう、`/tracks`画面と同じグループ分けを追加することで合意

対象範囲は`SoundAssignDialog.tsx`・`SoundAssignDialog.module.css`・その取得ロジック
のみ。`src/lib/schedule-ui.ts`のデータ層(`MinuteSoundState`型・4関数)、
`/api/schedules`・`/api/tracks`のBFF、`settings/schema.json`は無改修。

## 2. 前提の確認(design/006 §2 を継続)

- `sound_file_name`(`settings/schema.json`で`type: string`、単一文字列)が
  非空なら最優先でその名前の楽曲を再生する。複数曲を並べて指定することはできず、
  1分に実際に鳴る曲は常に1つ
- よってUIも常に単一選択のまま変わらない。今回の変更は見た目・操作感の改善のみで、
  データモデル(`MinuteSoundState`の`{ mode: 'track'; name: string }`)には影響しない

## 3. UI設計

### 3.1 レイアウト: 縦並びスクロールリスト(採用)

- `dialog.module.css`の`.detail`と同じ枠パターン(`max-height`+
  `overflow-y: auto`+`var(--bg)`背景+`var(--panel-border)`枠線)を
  `SoundAssignDialog.module.css`に追加して踏襲する
- チップグリッド案(「タイプで指定」欄と統一される代わりに、曲名が長いと
  折り返しが増えて見づらい)は不採用

### 3.2 選択コントロール: ネイティブ`<input type="radio">`

- 現行の`<select>`を、1行 = `<input type="radio" name="track">` + 曲名ラベルの
  縦リストに置き換える
- ネイティブradioのため、矢印キーでの選択・スクリーンリーダー対応(グループ化)は
  追加実装不要
- 何もcheckされていない状態(`trackName === ''`)がそのまま「未選択」を表し、
  適用ボタンの非活性ロジック(`canApply`: `mode === 'track' && trackName !== ''`)は
  変更しない

### 3.3 origin別グループ分け

[/tracks画面](../../../src/app/tracks/page.tsx)と同じ判定・同じグループ名を流用する:

- 「アップロード済み」: `isEditableOrigin(origin)`(`src/lib/track-ui.ts`)が
  true(`origin === 'user'`)の曲
- 「初期音源・その他」: それ以外(`default`・`unknown`)の曲

各グループ内は名前順(`localeCompare`)。空グループは見出しごと非表示にする
(`/tracks`画面のような空メッセージは、ダイアログのスペースが限られるため出さない)。

現在DBに見つからない曲(`hasUnknownCurrentTrack`。取得した一覧に存在しない
= 名前変更・削除済みの、以前設定されていた値)はorigin判定ができないため、
どちらのグループにも属させず、リスト最上部に単独行として維持する(「(現在DBに
見つかりません)」の注記も既存のまま、黙って消さない方針を継続)。

2グループの`<input>`はすべて同じ`name`属性にし、見た目のグループ分けとは関係なく
ダイアログ全体で単一の選択になるようにする。

### 3.4 データ取得の変更

現状`/api/tracks`のレスポンスから`name`のみ抽出している
(`(json.tracks as { name: string }[]).map((t) => t.name)`)のを、`origin`も
保持するように変更する(`{ name: string; origin: TrackOrigin }[]`)。

グループ分けは`src/lib/track-ui.ts`の`isEditableOrigin`をそのままimportして使い、
判定ロジックの重複を避ける。取得失敗時のフォールバック(`tracksError`時に
「曲を指定」を無効化する)は変更しない。

## 4. スコープ外(今回やらない)

- 複数曲の同時指定(バックエンド制約により不可、design/006 §2で確認済み)
- `schedule-ui.ts`のデータ層(`MinuteSoundState`型・4関数)の変更
- `/api/tracks`・`/api/schedules`・スキーマの変更
- `/tracks`画面側の変更(グループ分け表示ロジックを流用するのみで、画面自体は
  無改修)

## 5. テスト方針

既存の3層ピラミッドのうち、コンポーネント層のみ変更する(design/006 §6の方針を
継続、API/E2E層の追加は無し)。

- `SoundAssignDialog.test.tsx`: `selectOptions`/`getByLabelText('曲を選択')`
  (select前提)のアサーションを`getByRole('radio', { name: ... })` + クリックに
  置き換える
- 新規: origin別グループ見出しの出し分け(空グループ非表示を含む)、
  `hasUnknownCurrentTrack`行がどちらのグループにも属さず単独表示されることを
  table-drivenで検証
- 新規: 2グループにまたがる複数トラックが同じradio nameで排他選択になること
  (片方を選ぶともう片方が外れる)を検証
