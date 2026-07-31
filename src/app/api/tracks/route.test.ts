// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import {
  listTracks,
  createTrackFromUpload,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, listTracks: vi.fn(), createTrackFromUpload: vi.fn() };
});

const mockList = listTracks as unknown as Mock;
const mockCreate = createTrackFromUpload as unknown as Mock;

const track = {
  id: 1,
  name: 'chime',
  filePath: '/data/sounds/user/chime.wav',
  origin: 'user' as const,
  audioTypes: [{ id: 1, name: 'DEFAULT' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tracks', () => {
  it('200 で一覧を返す', async () => {
    mockList.mockReturnValue([track]);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ tracks: [track] });
      },
    });
  });

  it('I/O失敗なら500 io_error', async () => {
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

function buildForm(opts: { fileName?: string; contentType?: string; audioTypeIds?: string } = {}): FormData {
  const form = new FormData();
  const file = new File(['dummy'], opts.fileName ?? 'chime.wav', {
    type: opts.contentType ?? 'audio/wav',
  });
  form.set('file', file);
  if (opts.audioTypeIds !== undefined) form.set('audioTypeIds', opts.audioTypeIds);
  return form;
}

describe('POST /api/tracks', () => {
  it('201でアップロード結果を返す', async () => {
    mockCreate.mockResolvedValue(track);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm({ audioTypeIds: '[1]' }) });
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ track });
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ fileName: 'chime.wav', audioTypeIds: [1] }),
        );
      },
    });
  });

  it('.wav以外の拡張子は400 invalid_extension', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm({ fileName: 'chime.mp3' }) });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_extension' });
        expect(mockCreate).not.toHaveBeenCalled();
      },
    });
  });

  it('50MB超は413 file_too_large', async () => {
    const bigForm = new FormData();
    const bigFile = new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'big.wav', { type: 'audio/wav' });
    bigForm.set('file', bigFile);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: bigForm });
        expect(res.status).toBe(413);
        expect(await res.json()).toEqual({ error: 'file_too_large' });
        expect(mockCreate).not.toHaveBeenCalled();
      },
    });
  });

  it('fileフィールドが無いと400 file_missing', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: new FormData() });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'file_missing' });
      },
    });
  });

  it('InvalidFileNameErrorは400 invalid_file_name', async () => {
    mockCreate.mockRejectedValue(new InvalidFileNameError('../x.wav'));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm() });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_file_name' });
      },
    });
  });

  it('TrackConflictErrorは409 conflict', async () => {
    mockCreate.mockRejectedValue(new TrackConflictError('name'));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm() });
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'conflict', field: 'name' });
      },
    });
  });

  it('InvalidAudioTypeErrorは400 invalid_audio_type_ids', async () => {
    mockCreate.mockRejectedValue(new InvalidAudioTypeError());
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm({ audioTypeIds: '[999]' }) });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_audio_type_ids' });
      },
    });
  });
});
