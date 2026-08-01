// スケジュール編集 UI 用のユーティリティ。
// settings/schema.json の配列表現(DaySchedule = HourEntry[])は、
// 「特定の hour の行を追加/削除/トグルする」という UI 操作には不向きなため、
// 画面の状態としては hour をキーにしたマップ(EditableSchedules)を持ち、
// GET/PUT の境界でのみ配列表現と相互変換する。

import type { AudioType, DaySchedule, HourEntry, Schedules, Weekday } from './types';

export const DAY_TABS: { key: Weekday; label: string }[] = [
  { key: 'monday', label: '月' },
  { key: 'tuesday', label: '火' },
  { key: 'wednesday', label: '水' },
  { key: 'thursday', label: '木' },
  { key: 'friday', label: '金' },
  { key: 'saturday', label: '土' },
  { key: 'sunday', label: '日' },
  { key: 'holiday', label: '祝' },
];

export function dayLabel(key: Weekday): string {
  return DAY_TABS.find((d) => d.key === key)?.label ?? key;
}

// 5 分刻みボタン(No.10 確定)。
export const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export type HourMap = Record<number, HourEntry>;
export type EditableSchedules = Record<Weekday, HourMap>;

export function toHourMap(day: DaySchedule): HourMap {
  const map: HourMap = {};
  day.forEach((entry) => {
    map[entry.hour] = entry;
  });
  return map;
}

export function fromHourMap(map: HourMap): DaySchedule {
  return Object.values(map).sort((a, b) => a.hour - b.hour);
}

export function toEditableSchedules(schedules: Schedules): EditableSchedules {
  const result = {} as EditableSchedules;
  DAY_TABS.forEach(({ key }) => {
    result[key] = toHourMap(schedules[key] ?? []);
  });
  return result;
}

export function fromEditableSchedules(editable: EditableSchedules): Schedules {
  const result = {} as Schedules;
  DAY_TABS.forEach(({ key }) => {
    result[key] = fromHourMap(editable[key] ?? {});
  });
  return result;
}

export function emptyEditableSchedules(): EditableSchedules {
  const result = {} as EditableSchedules;
  DAY_TABS.forEach(({ key }) => {
    result[key] = {};
  });
  return result;
}

// minute のトグル。ONにする場合は他フィールドに触れない(温存)。OFFにする場合は
// その分の minute_settings をリセットする(2026-08-01 確定: 温存すると再度ONに
// したときに古い音設定が意図せず復活してしまうため)。
export function toggleMinute(entry: HourEntry, minute: number): HourEntry {
  const minutes = entry.minutes ?? [];
  const has = minutes.includes(minute);
  const nextMinutes = has
    ? minutes.filter((m) => m !== minute)
    : [...minutes, minute].sort((a, b) => a - b);
  const nextEntry = { ...entry, minutes: nextMinutes };
  return has ? clearMinuteSound(nextEntry, minute) : nextEntry;
}

// 曜日間コピー。指定した対象曜日だけを上書きし、それ以外(コピー元含む)は変更しない。
// コピー先はコピー元と参照を共有しない(deep clone)。
export function copyDay(
  editable: EditableSchedules,
  sourceDay: Weekday,
  targetDays: Weekday[],
): EditableSchedules {
  const sourceClone = JSON.parse(JSON.stringify(editable[sourceDay])) as HourMap;
  const next = { ...editable };
  targetDays.forEach((day) => {
    next[day] = JSON.parse(JSON.stringify(sourceClone)) as HourMap;
  });
  return next;
}

export interface MinuteDiffRow {
  hour: number;
  beforeText: string;
  afterText: string;
  status: 'added' | 'removed' | 'same' | 'changed';
  // minutes は同じだが minute_settings(音の割り当て)が異なるために changed になった行の場合のみ true。
  // コピー確認ダイアログで「minutes 表示は同じなのに音設定が上書きされる」ことを黙って見逃さないための目印。
  soundChanged?: boolean;
}

function minutesText(entry: HourEntry | undefined): string {
  const minutes = entry?.minutes ?? [];
  return minutes.length > 0 ? minutes.map(pad2).join(',') : '―';
}

// minute_settings の値の等価性を比較する(未設定・空オブジェクトはどちらも「無し」として扱う)。
// minutes が一致していても minute_settings が異なる場合を見逃さないために使う
// (曜日コピーで音の割り当てが黙って上書きされるのを防ぐ、レビュー指摘対応)。
function minuteSettingsEqual(a: HourEntry | undefined, b: HourEntry | undefined): boolean {
  const aSettings = a?.minute_settings ?? {};
  const bSettings = b?.minute_settings ?? {};
  return JSON.stringify(aSettings) === JSON.stringify(bSettings);
}

// 曜日コピーの確認ダイアログ用: コピー先(before)とコピー元(after)を hour ごとに比較する。
export function diffHourMinutes(source: HourMap, target: HourMap): MinuteDiffRow[] {
  const hours = new Set<number>();
  Object.keys(source).forEach((h) => hours.add(Number(h)));
  Object.keys(target).forEach((h) => hours.add(Number(h)));

  return Array.from(hours)
    .sort((a, b) => a - b)
    .map((hour) => {
      const before = target[hour];
      const after = source[hour];
      const beforeText = minutesText(before);
      const afterText = minutesText(after);
      let status: MinuteDiffRow['status'];
      if (!before && after) status = 'added';
      else if (before && !after) status = 'removed';
      else if (beforeText !== afterText) status = 'changed';
      else if (!minuteSettingsEqual(before, after)) {
        // minutes の表示上は同じでも音の割り当てが異なる場合は、コピーで上書きされることが
        // 分かるよう changed 扱いにし、目印として soundChanged を立てる。
        return { hour, beforeText, afterText, status: 'changed', soundChanged: true };
      } else status = 'same';
      return { hour, beforeText, afterText, status };
    });
}

// スケジュール画面から曲/タイプを割り当てる機能(minute_settings の編集)。
// バックエンド(別リポジトリの src/main.py)の優先順位に合わせ、sound_file_name が
// 非空なら track、そうでなく sound_types があれば types、どちらも無ければ none とする
// (詳細設計 2章)。
export type MinuteSoundState =
  | { mode: 'none' }
  | { mode: 'track'; name: string }
  | { mode: 'types'; types: AudioType[] };

export function getMinuteSound(entry: HourEntry, minute: number): MinuteSoundState {
  const setting = entry.minute_settings?.[String(minute)];
  if (!setting) return { mode: 'none' };
  if (setting.sound_file_name) return { mode: 'track', name: setting.sound_file_name };
  if (setting.sound_types && setting.sound_types.length > 0) {
    return { mode: 'types', types: setting.sound_types };
  }
  return { mode: 'none' };
}

// 指定した分以外(hour・minutes・他の分の minute_settings)には触れない(toggleMinute と同じ方針)。
export function setMinuteSoundTrack(entry: HourEntry, minute: number, trackName: string): HourEntry {
  return {
    ...entry,
    minute_settings: {
      ...entry.minute_settings,
      [String(minute)]: { sound_file_name: trackName },
    },
  };
}

export function setMinuteSoundTypes(entry: HourEntry, minute: number, types: AudioType[]): HourEntry {
  return {
    ...entry,
    minute_settings: {
      ...entry.minute_settings,
      [String(minute)]: { sound_file_name: '', sound_types: types },
    },
  };
}

export function clearMinuteSound(entry: HourEntry, minute: number): HourEntry {
  if (!entry.minute_settings || !(String(minute) in entry.minute_settings)) return entry;
  const nextSettings = { ...entry.minute_settings };
  delete nextSettings[String(minute)];
  // nextSettings が空になった場合は minute_settings 自体を結果に含めない
  // (空の "minute_settings": {} をファイルに書き込まないため。意図的な挙動)
  if (Object.keys(nextSettings).length === 0) {
    const { minute_settings, ...rest } = entry;
    return rest;
  }
  return { ...entry, minute_settings: nextSettings };
}
