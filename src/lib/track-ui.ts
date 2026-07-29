// 楽曲管理画面のクライアント側ユーティリティ(純粋関数のみ)。
// schedule-ui.ts と同じ役割: 画面固有のロジックをコンポーネントから切り離し、
// 単体でテストできるようにする。

import type { Track, TrackOrigin } from './types';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// 音声タイプバッジのクリック時に次の audioTypeIds を計算する(画面詳細設計 6.2節)。
export function toggleAudioTypeId(current: number[], id: number): number[] {
  return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
}

// origin が "user" の楽曲のみ名前変更・削除ができる(画面詳細設計 4.2節)。
export function isEditableOrigin(origin: TrackOrigin): boolean {
  return origin === 'user';
}

export function sortTracksByName(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => a.name.localeCompare(b.name));
}

interface TrackErrorBody {
  error?: string;
  field?: 'name' | 'file_path';
}

// /api/tracks・/api/tracks/:id のエラーレスポンス(body)を画面表示用の文言に変換する
// (画面詳細設計 7章)。
export function describeTrackError(body: unknown): string {
  const { error, field } = (body ?? {}) as TrackErrorBody;
  switch (error) {
    case 'invalid_extension':
      return '.wav 形式のファイルのみアップロードできます。';
    case 'file_too_large':
      return 'ファイルサイズが大きすぎます(上限10MB)。';
    case 'invalid_file_name':
      return 'ファイル名に使用できない文字が含まれています。';
    case 'file_missing':
      return 'ファイルが選択されていません。';
    case 'invalid_form_data':
      return 'リクエストの形式が不正です。';
    case 'invalid_json':
      return 'リクエストの形式が不正です。';
    case 'invalid_id':
      return '楽曲の指定が不正です。一覧を更新してください。';
    case 'conflict':
      if (field === 'name') return '同じ表示名の楽曲が既に存在します。';
      if (field === 'file_path') return '同名のファイルが既に存在します。';
      return '入力内容が既存のデータと重複しています。';
    case 'invalid_audio_type_ids':
      return '音声タイプの指定が不正です。';
    case 'invalid_name':
      return '名前を入力してください。';
    case 'not_found':
      return '対象の楽曲が見つかりませんでした(一覧を更新してください)。';
    case 'forbidden':
      return 'この楽曲は変更できません。';
    default:
      return 'サーバーとの通信でエラーが発生しました。';
  }
}
