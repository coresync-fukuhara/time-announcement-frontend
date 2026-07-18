// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import {
  readSchedules,
  writeSchedules,
  ScheduleValidationError,
} from '@/lib/schedule-store';

// ファイル I/O(schedule-store)はモックし、Route Handler の入出力契約のみを検証する
// (テスト設計 4.2)。ScheduleValidationError は instanceof 判定のため実体を残す。
vi.mock('@/lib/schedule-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/schedule-store')>();
  return {
    ...actual,
    readSchedules: vi.fn(),
    writeSchedules: vi.fn(),
  };
});

const mockRead = readSchedules as unknown as Mock;
const mockWrite = writeSchedules as unknown as Mock;

const sampleSchedules = {
  monday: [{ hour: 9, minutes: [0] }],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  holiday: [],
  minute_settings: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/schedules', () => {
  it('ファイルがあれば 200 で内容を返す', async () => {
    mockRead.mockResolvedValue({ initialized: true, schedules: sampleSchedules });
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ initialized: true, schedules: sampleSchedules });
      },
    });
  });

  it('未初期化(missing/invalid)なら 200 で initialized: false を返す', async () => {
    mockRead.mockResolvedValue({ initialized: false, reason: 'missing' });
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ initialized: false });
      },
    });
  });

  it('I/O 失敗なら 500 io_error', async () => {
    mockRead.mockRejectedValue(new Error('disk gone'));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'io_error' });
      },
    });
  });
});

describe('PUT /api/schedules', () => {
  it('妥当なボディを書き込み 200 + 保存後の内容を返す', async () => {
    mockWrite.mockResolvedValue(sampleSchedules);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleSchedules),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ initialized: true, schedules: sampleSchedules });
        expect(mockWrite).toHaveBeenCalledWith(sampleSchedules);
      },
    });
  });

  it('スキーマ違反なら 400 validation_failed + details(書き込みしない)', async () => {
    const errors = [{ instancePath: '/monday/0/hour', message: 'must be <= 23' }];
    mockWrite.mockRejectedValue(new ScheduleValidationError(errors as never));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleSchedules),
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'validation_failed', details: errors });
      },
    });
  });

  it('ボディが不正な JSON なら 400 invalid_json(store を呼ばない)', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: '{ not json',
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_json' });
        expect(mockWrite).not.toHaveBeenCalled();
      },
    });
  });

  it('書き込み I/O 失敗なら 500 io_error', async () => {
    mockWrite.mockRejectedValue(new Error('rename failed'));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleSchedules),
        });
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'io_error' });
      },
    });
  });
});
