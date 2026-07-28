// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import { readSampleSchedules } from '@/lib/schedule-store';

// ファイル I/O(schedule-store)はモックし、Route Handler の入出力契約のみを検証する
// (テスト設計 4.2)。
vi.mock('@/lib/schedule-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/schedule-store')>();
  return {
    ...actual,
    readSampleSchedules: vi.fn(),
  };
});

const mockRead = readSampleSchedules as unknown as Mock;

const sampleSchedules = {
  monday: [{ hour: 9, minutes: [0] }],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  holiday: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/sample-schedules', () => {
  it('ファイルがあれば 200 で内容を返す', async () => {
    mockRead.mockResolvedValue({ found: true, schedules: sampleSchedules });
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ found: true, schedules: sampleSchedules });
      },
    });
  });

  it('ファイルが無い/壊れている場合は 200 で found: false を返す', async () => {
    mockRead.mockResolvedValue({ found: false });
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ found: false });
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
