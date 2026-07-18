// @vitest-environment node
import { validateSchedules, resetValidatorCache } from '@/lib/validator';

const validData = {
  monday: [{ hour: 9, minutes: [0, 30] }],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  holiday: [],
  minute_settings: { default: { sound: 'chime.wav' } },
};

describe('validateSchedules(settings/schema.json を Ajv でコンパイル)', () => {
  beforeEach(() => resetValidatorCache());

  it('妥当なスケジュールデータで valid: true を返す', () => {
    const result = validateSchedules(validData);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it('hour が範囲外(25)なら valid: false でエラー配列を返す', () => {
    const result = validateSchedules({
      ...validData,
      monday: [{ hour: 25, minutes: [0] }],
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
