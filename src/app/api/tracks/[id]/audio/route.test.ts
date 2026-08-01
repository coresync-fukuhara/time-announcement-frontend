// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import { getTrackFilePathOrThrow, TrackNotFoundError } from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, getTrackFilePathOrThrow: vi.fn() };
});

const mockGetPath = getTrackFilePathOrThrow as unknown as Mock;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'track-audio-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/tracks/:id/audio', () => {
  it('200でファイル本体を audio/wav として返す', async () => {
    const filePath = path.join(tmpDir, 'sample.wav');
    await writeFile(filePath, Buffer.from('RIFF-dummy-wav-bytes'));
    mockGetPath.mockReturnValue(filePath);

    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('audio/wav');
        const body = Buffer.from(await res.arrayBuffer());
        expect(body.toString()).toBe('RIFF-dummy-wav-bytes');
      },
    });
  });

  it('idが数値でなければ400 invalid_id', async () => {
    await testApiHandler({
      appHandler,
      params: { id: 'abc' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_id' });
      },
    });
  });

  it('TrackNotFoundErrorは404 not_found', async () => {
    mockGetPath.mockImplementation(() => {
      throw new TrackNotFoundError(1);
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      },
    });
  });

  it('DBにはあるが実ファイルが無い場合は404 file_not_found', async () => {
    mockGetPath.mockReturnValue(path.join(tmpDir, 'missing.wav'));
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'file_not_found' });
      },
    });
  });
});
