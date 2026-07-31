import {
  DAY_TABS,
  dayLabel,
  toHourMap,
  fromHourMap,
  toEditableSchedules,
  fromEditableSchedules,
  emptyEditableSchedules,
  toggleMinute,
  copyDay,
  diffHourMinutes,
  getMinuteSound,
  setMinuteSoundTrack,
  setMinuteSoundTypes,
  clearMinuteSound,
} from '@/lib/schedule-ui';
import type { AudioType, DaySchedule, Schedules } from '@/lib/types';

describe('DAY_TABS / dayLabel', () => {
  it('月〜日 + holiday の 8 タブを曜日順に持つ', () => {
    expect(DAY_TABS.map((d) => d.key)).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
      'holiday',
    ]);
  });

  it('holiday を含む各曜日のラベルを返す', () => {
    expect(dayLabel('monday')).toBe('月');
    expect(dayLabel('holiday')).toBe('祝');
  });
});

describe('toHourMap / fromHourMap', () => {
  it('hour をキーにしたマップへ変換し、fromHourMap で hour 昇順の配列に戻す', () => {
    const day: DaySchedule = [
      { hour: 17, minutes: [0, 30] },
      { hour: 9, minutes: [0], minute_settings: { '0': { sound_file_name: 'a.wav' } } },
    ];
    const map = toHourMap(day);
    expect(map[17]).toEqual({ hour: 17, minutes: [0, 30] });
    expect(map[9].minute_settings).toEqual({ '0': { sound_file_name: 'a.wav' } });

    const roundTripped = fromHourMap(map);
    expect(roundTripped).toEqual([
      { hour: 9, minutes: [0], minute_settings: { '0': { sound_file_name: 'a.wav' } } },
      { hour: 17, minutes: [0, 30] },
    ]);
  });
});

describe('toEditableSchedules / fromEditableSchedules', () => {
  it('Schedules 全体を往復させても内容が保たれる(minute_settings も温存)', () => {
    const schedules = {
      monday: [{ hour: 9, minutes: [0, 30], minute_settings: { '0': { sound_file_name: 'a.wav' } } }],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
      holiday: [],
    } as unknown as Schedules;

    const editable = toEditableSchedules(schedules);
    expect(editable.monday[9]).toEqual({
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'a.wav' } },
    });

    const roundTripped = fromEditableSchedules(editable);
    expect(roundTripped).toEqual(schedules);
  });
});

describe('emptyEditableSchedules', () => {
  it('全曜日が空のマップになる', () => {
    const empty = emptyEditableSchedules();
    expect(Object.keys(empty)).toHaveLength(8);
    expect(empty.monday).toEqual({});
    expect(empty.holiday).toEqual({});
  });
});

describe('toggleMinute', () => {
  it('未選択の分を追加する(昇順を保つ)', () => {
    const entry = { hour: 9, minutes: [0] };
    expect(toggleMinute(entry, 30)).toEqual({ hour: 9, minutes: [0, 30] });
  });

  it('選択済みの分を削除する', () => {
    const entry = { hour: 9, minutes: [0, 30] };
    expect(toggleMinute(entry, 0)).toEqual({ hour: 9, minutes: [30] });
  });

  it('minutes が無い場合も追加できる', () => {
    const entry = { hour: 9 };
    expect(toggleMinute(entry, 15)).toEqual({ hour: 9, minutes: [15] });
  });

  it('minute_settings など他のフィールドは変更しない', () => {
    const entry = {
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'a.wav' } },
    };
    expect(toggleMinute(entry, 30)).toEqual({
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'a.wav' } },
    });
  });
});

describe('copyDay', () => {
  it('指定した対象曜日だけを上書きし、他の曜日は変更しない', () => {
    const editable = emptyEditableSchedules();
    editable.monday = { 9: { hour: 9, minutes: [0, 30] } };
    editable.tuesday = { 14: { hour: 14, minutes: [0] } };
    editable.saturday = {};

    const result = copyDay(editable, 'monday', ['saturday']);
    expect(result.saturday).toEqual({ 9: { hour: 9, minutes: [0, 30] } });
    expect(result.tuesday).toEqual({ 14: { hour: 14, minutes: [0] } });
    expect(result.monday).toEqual({ 9: { hour: 9, minutes: [0, 30] } });
  });

  it('複数の対象曜日へ同時にコピーできる', () => {
    const editable = emptyEditableSchedules();
    editable.monday = { 9: { hour: 9, minutes: [0] } };
    const result = copyDay(editable, 'monday', ['saturday', 'sunday']);
    expect(result.saturday).toEqual({ 9: { hour: 9, minutes: [0] } });
    expect(result.sunday).toEqual({ 9: { hour: 9, minutes: [0] } });
  });

  it('コピー先はコピー元と独立したオブジェクトになる(参照を共有しない)', () => {
    const editable = emptyEditableSchedules();
    editable.monday = { 9: { hour: 9, minutes: [0] } };
    const result = copyDay(editable, 'monday', ['tuesday']);
    result.tuesday[9].minutes?.push(30);
    expect(result.monday[9].minutes).toEqual([0]);
  });
});

describe('diffHourMinutes', () => {
  it('コピー元にのみ存在する時間は added として扱う', () => {
    const rows = diffHourMinutes({ 10: { hour: 10, minutes: [0] } }, {});
    expect(rows).toEqual([{ hour: 10, beforeText: '―', afterText: '00', status: 'added' }]);
  });

  it('コピー先にのみ存在する時間は removed として扱う', () => {
    const rows = diffHourMinutes({}, { 10: { hour: 10, minutes: [0] } });
    expect(rows).toEqual([{ hour: 10, beforeText: '00', afterText: '―', status: 'removed' }]);
  });

  it('両方に存在し内容が同じなら same', () => {
    const rows = diffHourMinutes(
      { 9: { hour: 9, minutes: [0, 30] } },
      { 9: { hour: 9, minutes: [0, 30] } },
    );
    expect(rows).toEqual([{ hour: 9, beforeText: '00,30', afterText: '00,30', status: 'same' }]);
  });

  it('両方に存在し内容が違えば changed', () => {
    const rows = diffHourMinutes(
      { 9: { hour: 9, minutes: [0] } },
      { 9: { hour: 9, minutes: [30] } },
    );
    expect(rows).toEqual([{ hour: 9, beforeText: '30', afterText: '00', status: 'changed' }]);
  });

  it('どちらにも無い時間の行は作らない', () => {
    const rows = diffHourMinutes({ 9: { hour: 9, minutes: [0] } }, { 9: { hour: 9, minutes: [0] } });
    expect(rows.every((r) => r.hour === 9)).toBe(true);
    expect(rows).toHaveLength(1);
  });
});

describe('getMinuteSound', () => {
  it('minute_settings が無ければ none', () => {
    expect(getMinuteSound({ hour: 9, minutes: [0] }, 0)).toEqual({ mode: 'none' });
  });

  it('sound_file_name が非空なら track(sound_types があっても track を優先する)', () => {
    const entry = {
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'sample', sound_types: ['ALARM'] as AudioType[] } },
    };
    expect(getMinuteSound(entry, 0)).toEqual({ mode: 'track', name: 'sample' });
  });

  it('sound_file_name が空文字で sound_types があれば types', () => {
    const entry = {
      hour: 9,
      minutes: [30],
      minute_settings: { '30': { sound_file_name: '', sound_types: ['DEFAULT', 'ALARM'] as AudioType[] } },
    };
    expect(getMinuteSound(entry, 30)).toEqual({ mode: 'types', types: ['DEFAULT', 'ALARM'] });
  });

  it('sound_file_name が空文字で sound_types も無ければ none', () => {
    const entry = { hour: 9, minutes: [0], minute_settings: { '0': { sound_file_name: '' } } };
    expect(getMinuteSound(entry, 0)).toEqual({ mode: 'none' });
  });

  it('他の分の設定には影響されない', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    };
    expect(getMinuteSound(entry, 30)).toEqual({ mode: 'none' });
  });
});

describe('setMinuteSoundTrack', () => {
  it('指定した分に sound_file_name をセットする', () => {
    const entry = { hour: 9, minutes: [0] };
    expect(setMinuteSoundTrack(entry, 0, 'sample')).toEqual({
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    });
  });

  it('既存の sound_types は除去する', () => {
    const entry = {
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: '', sound_types: ['ALARM'] as AudioType[] } },
    };
    expect(setMinuteSoundTrack(entry, 0, 'sample')).toEqual({
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    });
  });

  it('他の分の minute_settings は温存する', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '30': { sound_file_name: 'other' } },
    };
    expect(setMinuteSoundTrack(entry, 0, 'sample')).toEqual({
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '30': { sound_file_name: 'other' }, '0': { sound_file_name: 'sample' } },
    });
  });
});

describe('setMinuteSoundTypes', () => {
  it('指定した分に sound_file_name: "" と sound_types をセットする', () => {
    const entry = { hour: 9, minutes: [30] };
    expect(setMinuteSoundTypes(entry, 30, ['DEFAULT', 'ALARM'])).toEqual({
      hour: 9,
      minutes: [30],
      minute_settings: { '30': { sound_file_name: '', sound_types: ['DEFAULT', 'ALARM'] } },
    });
  });
});

describe('clearMinuteSound', () => {
  it('指定した分の minute_settings キーを削除する', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'sample' }, '30': { sound_file_name: 'other' } },
    };
    expect(clearMinuteSound(entry, 0)).toEqual({
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '30': { sound_file_name: 'other' } },
    });
  });

  it('対象の分に設定が無ければ何もしない(同じ内容を返す)', () => {
    const entry = { hour: 9, minutes: [0] };
    expect(clearMinuteSound(entry, 0)).toEqual({ hour: 9, minutes: [0] });
  });

  it('minutes など他フィールドは変更しない', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    };
    expect(clearMinuteSound(entry, 0)).toEqual({ hour: 9, minutes: [0, 30] });
  });
});
