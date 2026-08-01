// スケジュールデータの型。実際の妥当性検証は settings/schema.json(Ajv)が正であり、
// この型は TypeScript 上の利便のための表現(概要設計 2章・5章の構造に対応)。

export type AudioType = 'DEFAULT' | 'NOTIFICATION' | 'ALARM';

// 分ごとのサウンド指定。ONの分に対して UI から曲/タイプを割り当てられる
// (src/lib/schedule-ui.ts の getMinuteSound・setMinuteSoundTrack・
// setMinuteSoundTypes・clearMinuteSound 参照)。編集対象外の分は保存時も
// 温存する。schema.json 上は各 hour エントリの minute_settings(分文字列キー)
// にネストする。
export interface MinuteSetting {
  sound_file_name: string;
  sound_types?: AudioType[];
}

export interface HourEntry {
  hour: number;
  minutes?: number[];
  minute_settings?: Record<string, MinuteSetting>;
}

export type DaySchedule = HourEntry[];

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'holiday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type Schedules = {
  [K in Weekday]: DaySchedule;
};

// GET /api/schedules・readSchedules の結果。
export type ReadResult =
  | { initialized: true; schedules: Schedules }
  | { initialized: false; reason: 'missing' | 'invalid_json' | 'validation_failed' };

// GET /api/sample-schedules・readSampleSchedules の結果。
export type ReadSampleResult = { found: true; schedules: Schedules } | { found: false };

// 楽曲管理機能の型。実際の妥当性検証は DB 側(wav_tracks・audio_types・
// track_audio_types)が真であり、これは API レスポンス(GET/POST/PATCH
// /api/tracks・/api/audio-types)の形に対応する TypeScript 上の表現
// (画面詳細設計 8章)。src/lib/track-store.ts と型を分離するのは、
// track-store.ts が node:sqlite 等サーバー専用の依存を持つため、
// クライアントコンポーネントから直接 import しないようにするため。

export type TrackOrigin = 'default' | 'user' | 'unknown';

export interface TrackAudioType {
  id: number;
  name: string;
}

export interface Track {
  id: number;
  name: string;
  filePath: string;
  origin: TrackOrigin;
  audioTypes: TrackAudioType[];
}
