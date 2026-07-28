// スケジュールデータの型。実際の妥当性検証は settings/schema.json(Ajv)が正であり、
// この型は TypeScript 上の利便のための表現(概要設計 2章・5章の構造に対応)。

export type AudioType = 'DEFAULT' | 'NOTIFICATION' | 'ALARM';

// 分ごとのサウンド指定。UI の編集対象外だが保存時も温存する(No.1 確定)。
// schema.json 上は各 hour エントリの minute_settings(分文字列キー)にネストする。
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
