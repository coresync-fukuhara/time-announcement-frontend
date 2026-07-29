// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import { listAudioTypes } from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, listAudioTypes: vi.fn() };
});

const mockList = listAudioTypes as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/audio-types', () => {
  it('200 で一覧を返す', async () => {
    mockList.mockReturnValue([
      { id: 1, name: 'DEFAULT' },
      { id: 2, name: 'NOTIFICATION' },
    ]);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          audioTypes: [
            { id: 1, name: 'DEFAULT' },
            { id: 2, name: 'NOTIFICATION' },
          ],
        });
      },
    });
  });

  it('DB I/O失敗なら500 io_error', async () => {
    mockList.mockImplementation(() => {
      throw new Error('disk gone');
    });
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
