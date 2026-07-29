// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import {
  updateTrack,
  deleteTrack,
  TrackNotFoundError,
  DefaultTrackForbiddenError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, updateTrack: vi.fn(), deleteTrack: vi.fn() };
});

const mockUpdate = updateTrack as unknown as Mock;
const mockDelete = deleteTrack as unknown as Mock;

const track = {
  id: 1,
  name: 'renamed',
  filePath: '/data/sounds/user/renamed.wav',
  origin: 'user' as const,
  audioTypes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/tracks/:id', () => {
  it('200で更新結果を返す', async () => {
    mockUpdate.mockReturnValue(track);
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'renamed', audioTypeIds: [] }),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ track });
        expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'renamed', audioTypeIds: [] });
      },
    });
  });

  it('idが数値でなければ400 invalid_id', async () => {
    await testApiHandler({
      appHandler,
      params: { id: 'abc' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_id' });
      },
    });
  });

  it('TrackNotFoundErrorは404 not_found', async () => {
    mockUpdate.mockImplementation(() => {
      throw new TrackNotFoundError(1);
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      },
    });
  });

  it('DefaultTrackForbiddenErrorは403 forbidden', async () => {
    mockUpdate.mockImplementation(() => {
      throw new DefaultTrackForbiddenError(1);
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'forbidden' });
      },
    });
  });

  it('TrackConflictErrorは409 conflict', async () => {
    mockUpdate.mockImplementation(() => {
      throw new TrackConflictError('name');
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'conflict', field: 'name' });
      },
    });
  });

  it('InvalidAudioTypeErrorは400 invalid_audio_type_ids', async () => {
    mockUpdate.mockImplementation(() => {
      throw new InvalidAudioTypeError();
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [999] }),
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_audio_type_ids' });
      },
    });
  });
});

describe('DELETE /api/tracks/:id', () => {
  it('204で削除する', async () => {
    mockDelete.mockResolvedValue(undefined);
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(204);
        expect(mockDelete).toHaveBeenCalledWith(1);
      },
    });
  });

  it('TrackNotFoundErrorは404 not_found', async () => {
    mockDelete.mockRejectedValue(new TrackNotFoundError(1));
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      },
    });
  });

  it('DefaultTrackForbiddenErrorは403 forbidden', async () => {
    mockDelete.mockRejectedValue(new DefaultTrackForbiddenError(1));
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'forbidden' });
      },
    });
  });
});
