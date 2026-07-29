import {
  MAX_UPLOAD_BYTES,
  toggleAudioTypeId,
  isEditableOrigin,
  sortTracksByName,
  describeTrackError,
} from '@/lib/track-ui';
import type { Track } from '@/lib/types';

describe('track-ui', () => {
  it('MAX_UPLOAD_BYTES は10MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  describe('toggleAudioTypeId', () => {
    it('未割り当てのidを渡すと追加する', () => {
      expect(toggleAudioTypeId([1], 2)).toEqual([1, 2]);
    });

    it('割り当て済みのidを渡すと除去する', () => {
      expect(toggleAudioTypeId([1, 2], 2)).toEqual([1]);
    });

    it('元の配列を変更しない', () => {
      const original = [1];
      toggleAudioTypeId(original, 2);
      expect(original).toEqual([1]);
    });
  });

  describe('isEditableOrigin', () => {
    it('user のみ true', () => {
      expect(isEditableOrigin('user')).toBe(true);
      expect(isEditableOrigin('default')).toBe(false);
      expect(isEditableOrigin('unknown')).toBe(false);
    });
  });

  describe('sortTracksByName', () => {
    it('名前の昇順で並べ替える(元の配列は変更しない)', () => {
      const tracks: Track[] = [
        { id: 1, name: 'school_bell', filePath: '/a', origin: 'user', audioTypes: [] },
        { id: 2, name: 'chime_intro', filePath: '/b', origin: 'user', audioTypes: [] },
      ];
      const sorted = sortTracksByName(tracks);
      expect(sorted.map((t) => t.name)).toEqual(['chime_intro', 'school_bell']);
      expect(tracks.map((t) => t.name)).toEqual(['school_bell', 'chime_intro']);
    });
  });

  describe('describeTrackError', () => {
    it('conflict + field=name のとき名前重複メッセージを返す', () => {
      expect(describeTrackError({ error: 'conflict', field: 'name' })).toBe(
        '同じ表示名の楽曲が既に存在します。',
      );
    });

    it('conflict + field=file_path のときファイル重複メッセージを返す', () => {
      expect(describeTrackError({ error: 'conflict', field: 'file_path' })).toBe(
        '同名のファイルが既に存在します。',
      );
    });

    it('forbidden のとき変更不可メッセージを返す', () => {
      expect(describeTrackError({ error: 'forbidden' })).toBe('この楽曲は変更できません。');
    });

    it('not_found のとき見つからないメッセージを返す', () => {
      expect(describeTrackError({ error: 'not_found' })).toBe(
        '対象の楽曲が見つかりませんでした(一覧を更新してください)。',
      );
    });

    it('未知のエラーコード・nullのときは汎用メッセージを返す', () => {
      expect(describeTrackError(null)).toBe('サーバーとの通信でエラーが発生しました。');
      expect(describeTrackError({ error: 'io_error' })).toBe('サーバーとの通信でエラーが発生しました。');
    });

    it('invalid_form_data のときリクエスト形式が不正というメッセージを返す', () => {
      expect(describeTrackError({ error: 'invalid_form_data' })).toBe('リクエストの形式が不正です。');
    });

    it('invalid_id のときIDが不正というメッセージを返す', () => {
      expect(describeTrackError({ error: 'invalid_id' })).toBe(
        '楽曲の指定が不正です。一覧を更新してください。',
      );
    });

    it('invalid_json のときリクエスト形式が不正というメッセージを返す', () => {
      expect(describeTrackError({ error: 'invalid_json' })).toBe('リクエストの形式が不正です。');
    });

    it('conflict + field なし のとき汎用の重複メッセージを返す', () => {
      expect(describeTrackError({ error: 'conflict' })).toBe('入力内容が既存のデータと重複しています。');
    });

    it('conflict + field が不正な値 のとき汎用の重複メッセージを返す', () => {
      expect(describeTrackError({ error: 'conflict', field: 'unknown' as any })).toBe(
        '入力内容が既存のデータと重複しています。',
      );
    });
  });
});
