# スケジュール画面からの音設定(`minute_settings`)詳細設計

作成日: 2026-07-31
ステータス: 確定(ブレインストーミング済み・実装計画待ち)

## 1. 位置づけ

[概要設計書](../../schedule-ui-overview-design.md)・[要件不足事項一覧](../../schedule-ui-open-questions.md)
No.1 で「`minute_settings` は編集対象外とし、保存時も破壊せず温存する」と決定され、
[tasks/implementation/006](../../../tasks/implementation/006-ui-schedule-grid.md) でも
その方針のまま実装された(`TimeGrid.tsx` に見た目だけのUIスタブがコメントアウトで
残っている)。[楽曲管理機能 概要設計書](../../music-management-overview-design.md) 1章でも
「`schedules.json`(`minute_settings`)との連携は将来フェーズで別途検討、今回は着手しない」
と明示的にスコープ外にされていた。

楽曲管理機能(`/tracks`、`/api/tracks`・`/api/audio-types`)の実装が完了し、「曲一覧を
扱うAPIが無いため配線しない」という当時の制約が解消されたため、本書でその「将来フェーズ」
の詳細設計を行う。対象範囲は`minute_settings`(`sound_file_name`・`sound_types`)の編集
UIのみ。`audio_types`マスタ自体の編集・DBスキーマ変更は既存スコープ外のまま変わらない。

## 2. 前提: バックエンド側の実際の解釈(実機・`src/main.py`確認済み)

このリポジトリには含まれない別リポジトリの`src/main.py`の実装を確認した結果、
以下が判明している。設計はこれに従う。

- `sound_file_name`(文字列1つ、拡張子`.wav`の有無どちらでも可): 非空であれば
  **最優先**でこの名前の楽曲(DB上の`wav_tracks.name`)を再生する。`sound_types`は無視される。
  複数曲を並べて指定することはできない。
- `sound_types`(配列、複数指定可): `sound_file_name`が空のときだけ使われる。
  main.py:104-118 の実装により、指定タイプをシャッフルして順に検索し、
  **最初にDB上でトラックが見つかったタイプから1曲だけランダム再生**する
  (「全部鳴らす」ではなく、フォールバック的なOR条件)。
- `sound_types`を省略/空にすると`ALARM`がデフォルト扱いになる(main.py:198)。
  `minute_settings`エントリ自体が無い場合も同様の扱いになる。
- 1分の設定で実際に鳴るのは常に1曲のみ。同時に複数曲を再生する機能はない。
- 選べるタイプは`DEFAULT`/`NOTIFICATION`/`ALARM`の3種固定(`settings/schema.json`)。

**既知のデータ不整合(本書では対応しない)**: 現状DB(`db/music.sqlite3`)には`ALARM`
タイプが割り当てられた楽曲が1件も無い(`off_notify`/`on_notify`は`DEFAULT`+`NOTIFICATION`、
`sample`は`DEFAULT`のみ)。このため`ALARM`指定(または`sound_types`未指定によるデフォルト
扱い)は現状再生に失敗する状態にある。これは別問題として切り離し、本機能のスコープには
含めない(タイプに紐づく楽曲が0件であることをUI上で警告する機能も、今回は対象外)。

## 3. UI設計

### 3.1 配置: 各分ボタンへのバッジ重ね方式(採用)

ブレインストーミング時のモックアップで3案(A: 各分にバッジを重ねる/B: 時間行に既定値を
置き分単位で上書き/C: グリッドは触らず別リストで編集)を比較し、**A案**を採用した。

- ONになっている分ボタンの右下に小さい♪バッジを表示する(`TimeGrid.tsx` 77-100行目の
  既存スタブをベースに実配線する)
- バッジの見た目は現在の状態で変える: 未設定/曲指定/タイプ指定 の3パターン
- OFFの分にはバッジを出さない(元のスタブと同じ、`{on && (...)}`条件を踏襲)
- 閲覧モード(`viewMode`)ではバッジをクリックできない。他の編集操作(時刻ボタン・
  行の追加削除・曜日コピー)と同じく非活性にする(概要設計書 No.13 の方針を踏襲)

不採用の理由:
- B案(時間行レベルの既定値): schemaに「時間の既定」という概念が無く、保存時は結局
  ON各分に同じ値をコピーして書き込む必要がある(内部変換が増える)。「継承 vs 上書き」
  の視覚的な見分けも複雑になるため、今回はYAGNIとして見送る。
- C案(別リスト): グリッドと一覧を目で行き来する必要があり、同じ「分」の情報が
  2箇所に表示される冗長さがある。

### 3.2 `SoundAssignDialog`(新規コンポーネント)

既存の`AddHourDialog`・`CopyDialog`・`ConfirmDialog`と同じ作法
(`dialog.module.css`、`open`propで表示制御)に合わせる。

- モード選択: 「未設定」「曲を指定」「タイプで指定」のラジオボタン
- 「曲を指定」: `/api/tracks`から取得した楽曲一覧のセレクト。現在の値がDB上に
  見つからない(名前変更・削除済み)場合も選択肢として保持し、黙って消さない
  (`Track`の`origin: unknown`と同じ「安全側に倒す」考え方を踏襲)
- 「タイプで指定」: `DEFAULT`/`NOTIFICATION`/`ALARM`のチェックボックス(複数可)。
  0件のときは保存(適用)ボタンを非活性にする(`sound_types`はschema上
  `minItems: 1`のため、空配列は書き込めない)
- 「曲を指定」に切り替えた直後で未選択の場合も同様に、トラックを1つ選ぶまで
  適用ボタンを非活性にする(空文字の`sound_file_name`を意図せず書き込むことを防ぐ)
- `/api/tracks`はダイアログを開いたときに遅延取得する(スケジュール画面に
  楽曲APIへの常時依存を持ち込まない)。取得失敗時は「曲を指定」を無効化し、
  「タイプで指定」「未設定」は引き続き使える(部分的な機能低下に留める)

## 4. データ/ロジック層

`src/lib/schedule-ui.ts`に、既存の`toggleMinute`と同様の純粋関数を追加する。
いずれも対象の分以外(`hour`・`minutes`・他の分の`minute_settings`)には触れない。

```ts
type MinuteSoundState =
  | { mode: 'none' }
  | { mode: 'track'; name: string }
  | { mode: 'types'; types: AudioType[] };

function getMinuteSound(entry: HourEntry, minute: number): MinuteSoundState;
function setMinuteSoundTrack(entry: HourEntry, minute: number, trackName: string): HourEntry;
function setMinuteSoundTypes(entry: HourEntry, minute: number, types: AudioType[]): HourEntry;
function clearMinuteSound(entry: HourEntry, minute: number): HourEntry;
```

- `getMinuteSound`: `sound_file_name`が非空なら`track`(バックエンドの優先順位と一致
  させる)、そうでなく`sound_types`があれば`types`、どちらも無ければ`none`
- `setMinuteSoundTrack`: `{ sound_file_name: trackName }`をセットし`sound_types`は除去
- `setMinuteSoundTypes`: `{ sound_file_name: '', sound_types: types }`をセット
  (`sound_file_name`は空文字。schema上`type: string`のみで`minLength`指定が無いため
  空文字は妥当)
- `clearMinuteSound`: その分の`minute_settings`キー自体を削除(未設定=バックエンドの
  ALARMデフォルト扱いに戻す)
- `toggleMinute`(既存関数): ONにする場合は他フィールドに触れないが、**OFFにする場合は
  その分の`minute_settings`も`clearMinuteSound`でリセットする**(2026-08-01 追加決定)。
  温存すると、後で同じ分を再度ONにしたときに古い音設定が意図せず復活してしまうため

`src/lib/types.ts`・`settings/schema.json`は変更不要(既存の型・スキーマが
そのまま対応済み)。`src/lib/validator.ts`・`/api/schedules`のBFFも無改修。

## 5. 保存タイミング

既存のスケジュール画面のモデル(編集モード + 明示的な保存ボタン)にそのまま合わせる。
ダイアログの「適用」はクライアント側の`EditableSchedules`状態を更新するだけで、
実際のサーバー反映は既存の「保存」ボタン(`PUT /api/schedules`)まで行わない。
即時保存(楽曲管理画面と同じ方式)は採用しない。理由: `minute_settings`は
`schedules.json`という単一ファイルの一部であり、他の分トグルと保存単位を分けると
同じ画面内に保存モデルが2つ混在してしまう。

曜日間コピー(`copyDay`)は既にエントリ全体をディープクローンしているため、
追加改修なしで音設定もコピー対象になる(確認済み、既存動作の変更なし)。

## 6. テスト方針

既存の3層ピラミッド(Vitest ユニット/API + Playwright E2E)を踏襲する。
API層・E2E層の新規追加は無い(`/api/schedules`のスキーマ・BFFが無改修のため)。

| レイヤー | 対象 | 方針 |
| --- | --- | --- |
| ユニット | `src/lib/schedule-ui.ts` の4関数 | 状態遷移(none→track→types→none)、対象外フィールドの温存を table-driven で検証 |
| コンポーネント | `SoundAssignDialog` | モード切替、`sound_types`0件時の保存不可、`/api/tracks`取得失敗時のフォールバック(「曲を指定」無効化) |
| コンポーネント | `TimeGrid` | バッジの3状態表示分岐、閲覧モードでの非活性 |
| E2E | 既存の主要シナリオに軽微な追加のみ | 新規シナリオは追加せず、既存の「編集→保存→再読み込み」シナリオに音設定の変更を1ステップ混ぜる程度に留める |

## 7. スコープ外(今回やらない)

- 時間行レベルのデフォルト値・複数分への一括適用(B案不採用に伴う)
- 選択したタイプに紐づく楽曲が0件であることの警告表示
- `ALARM`タイプの楽曲が0件というDB側データ不整合の是正(backend側の別問題)
- `audio_types`マスタ自体の追加・編集
- DBスキーマ変更・マイグレーション(Python側の責務)
