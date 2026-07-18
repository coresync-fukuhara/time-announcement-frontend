// @vitest-environment node
import { mkdtemp, copyFile, readFile, writeFile, rm, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  readSchedules,
  writeSchedules,
  ScheduleValidationError,
} from '@/lib/schedule-store';
import { resetValidatorCache } from '@/lib/validator';

type Schedules = Record<string, unknown>;

function makeSchedules(overrides: Partial<Schedules> = {}): Schedules {
  return {
    monday: [{ hour: 9, minutes: [0, 30] }],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
    holiday: [],
    minute_settings: { default: { sound: 'chime.wav' } },
    ...overrides,
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

let tmpDir: string;
let prevSettingsDir: string | undefined;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'sched-store-'));
  // validator は SETTINGS_DIR/schema.json を読むため、ダミースキーマを temp にコピーする。
  await copyFile(path.resolve('settings/schema.json'), path.join(tmpDir, 'schema.json'));
  prevSettingsDir = process.env.SETTINGS_DIR;
  process.env.SETTINGS_DIR = tmpDir;
  resetValidatorCache();
});

afterEach(async () => {
  if (prevSettingsDir === undefined) delete process.env.SETTINGS_DIR;
  else process.env.SETTINGS_DIR = prevSettingsDir;
  resetValidatorCache();
  await rm(tmpDir, { recursive: true, force: true });
});

describe('readSchedules', () => {
  it('ファイルが無ければ initialized: false / reason: missing', async () => {
    const result = await readSchedules();
    expect(result).toEqual({ initialized: false, reason: 'missing' });
  });

  it('JSON として壊れていれば initialized: false / reason: invalid_json', async () => {
    await writeFile(path.join(tmpDir, 'schedules.json'), '{ broken', 'utf-8');
    const result = await readSchedules();
    expect(result).toEqual({ initialized: false, reason: 'invalid_json' });
  });

  it('スキーマ違反なら initialized: false / reason: validation_failed', async () => {
    await writeFile(
      path.join(tmpDir, 'schedules.json'),
      JSON.stringify(makeSchedules({ monday: [{ hour: 99, minutes: [0] }] })),
      'utf-8',
    );
    const result = await readSchedules();
    expect(result).toEqual({ initialized: false, reason: 'validation_failed' });
  });

  it('妥当なファイルなら initialized: true で内容を返す', async () => {
    const data = makeSchedules();
    await writeFile(path.join(tmpDir, 'schedules.json'), JSON.stringify(data), 'utf-8');
    const result = await readSchedules();
    expect(result).toEqual({ initialized: true, schedules: data });
  });
});

describe('writeSchedules', () => {
  it('妥当なデータを書き込み、読み戻せる(minute_settings も温存)', async () => {
    const data = makeSchedules({ minute_settings: { keep: { sound: 'a.wav' } } });
    const saved = await writeSchedules(data);
    expect(saved).toEqual(data);

    const result = await readSchedules();
    expect(result).toEqual({ initialized: true, schedules: data });
    // minute_settings が消えていないこと
    expect((result as { schedules: Schedules }).schedules.minute_settings).toEqual({
      keep: { sound: 'a.wav' },
    });
  });

  it('UTF-8 / LF / 2スペース整形 / 末尾改行で書き込む', async () => {
    await writeSchedules(makeSchedules());
    const raw = await readFile(path.join(tmpDir, 'schedules.json'), 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).not.toContain('\r'); // CRLF でない
    expect(raw).toContain('\n  "monday"'); // 2 スペースインデント
  });

  it('スキーマ違反はファイルに触れず ScheduleValidationError を投げる', async () => {
    await expect(
      writeSchedules(makeSchedules({ monday: [{ hour: 25, minutes: [0] }] })),
    ).rejects.toBeInstanceOf(ScheduleValidationError);
    // ファイルは作られていない
    expect(await fileExists(path.join(tmpDir, 'schedules.json'))).toBe(false);
  });

  it('書き込み後に一時ファイル(.schedules.json.tmp)が残らない(アトミック)', async () => {
    await writeSchedules(makeSchedules());
    expect(await fileExists(path.join(tmpDir, '.schedules.json.tmp'))).toBe(false);
  });

  it('書き込み前に既存ファイルを .bak として 1 世代残す', async () => {
    const first = makeSchedules({ monday: [{ hour: 8, minutes: [0] }] });
    const second = makeSchedules({ monday: [{ hour: 20, minutes: [15] }] });
    await writeSchedules(first);
    await writeSchedules(second);

    const bak = JSON.parse(await readFile(path.join(tmpDir, 'schedules.json.bak'), 'utf-8'));
    const current = JSON.parse(await readFile(path.join(tmpDir, 'schedules.json'), 'utf-8'));
    expect(bak).toEqual(first); // 直前の世代
    expect(current).toEqual(second);
  });

  it('初回書き込み(既存ファイル無し)では .bak を作らない', async () => {
    await writeSchedules(makeSchedules());
    expect(await fileExists(path.join(tmpDir, 'schedules.json.bak'))).toBe(false);
  });

  it('並行書き込みを直列化し、ファイルを破損させない', async () => {
    const a = makeSchedules({ monday: [{ hour: 1, minutes: [0] }] });
    const b = makeSchedules({ monday: [{ hour: 2, minutes: [0] }] });
    // await せず同時に投入 → キューで直列化される
    await Promise.all([writeSchedules(a), writeSchedules(b)]);

    const current = JSON.parse(await readFile(path.join(tmpDir, 'schedules.json'), 'utf-8'));
    // 最後に投入した b が残る(後勝ち)。壊れた JSON にならない。
    expect(current).toEqual(b);
    const bak = JSON.parse(await readFile(path.join(tmpDir, 'schedules.json.bak'), 'utf-8'));
    expect(bak).toEqual(a);
  });
});
