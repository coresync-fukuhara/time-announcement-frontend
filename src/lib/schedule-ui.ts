// スケジュール編集 UI 用のユーティリティ。
// settings/schema.json の配列表現(DaySchedule = HourEntry[])は、
// 「特定の hour の行を追加/削除/トグルする」という UI 操作には不向きなため、
// 画面の状態としては hour をキーにしたマップ(EditableSchedules)を持ち、
// GET/PUT の境界でのみ配列表現と相互変換する。

import type { DaySchedule, HourEntry, Schedules, Weekday } from './types';

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

// minute のトグル。minute_settings など他フィールドには触れない(温存)。
export function toggleMinute(entry: HourEntry, minute: number): HourEntry {
  const minutes = entry.minutes ?? [];
  const has = minutes.includes(minute);
  const nextMinutes = has
    ? minutes.filter((m) => m !== minute)
    : [...minutes, minute].sort((a, b) => a - b);
  return { ...entry, minutes: nextMinutes };
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
}

function minutesText(entry: HourEntry | undefined): string {
  const minutes = entry?.minutes ?? [];
  return minutes.length > 0 ? minutes.map(pad2).join(',') : '―';
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
      else status = beforeText === afterText ? 'same' : 'changed';
      return { hour, beforeText, afterText, status };
    });
}
