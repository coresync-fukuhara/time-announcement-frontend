// @vitest-environment node
import { validateSchedules, resetValidatorCache } from '@/lib/validator';

const validData = {
  monday: [
    {
      hour: 9,
      minutes: [0, 30],
      // minute_settings は各 hour エントリにネストする(トップレベルには置けない)。
      minute_settings: { '0': { sound_file_name: 'chime.wav', sound_types: ['DEFAULT'] } },
    },
  ],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  holiday: [],
};

describe('validateSchedules(settings/schema.json を Ajv でコンパイル)', () => {
  beforeEach(() => resetValidatorCache());

  it('妥当なスケジュールデータで valid: true を返す', () => {
    const result = validateSchedules(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  // 実スキーマは hour に minimum/maximum を持たず type: number のみのため、
  // 範囲外(例: 25)は valid 判定になる。型不一致(文字列)を違反ケースとして検証する。
  it('hour が数値でなければ valid: false でエラー配列を返す', () => {
    const result = validateSchedules({
      ...validData,
      monday: [{ hour: '9', minutes: [0] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('必須の曜日キー(sunday)が欠けていれば valid: false', () => {
    const { sunday: _omitted, ...missingSunday } = validData;
    const result = validateSchedules(missingSunday);
    expect(result.valid).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('minutes が配列でなければ valid: false', () => {
    const result = validateSchedules({
      ...validData,
      monday: [{ hour: 9, minutes: 0 }],
    });
    expect(result.valid).toBe(false);
  });

  it('未知のトップレベルキーがあれば valid: false(additionalProperties: false)', () => {
    const result = validateSchedules({ ...validData, bogus: 1 });
    expect(result.valid).toBe(false);
  });
});
