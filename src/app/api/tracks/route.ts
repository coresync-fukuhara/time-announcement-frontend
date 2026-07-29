import { NextResponse } from 'next/server';
import {
  listTracks,
  createTrackFromUpload,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';
import { MAX_UPLOAD_BYTES } from '@/lib/track-ui';

// ファイル I/O・DB I/O を行うため Node.js ランタイムで動かす。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/tracks
export async function GET(): Promise<NextResponse> {
  try {
    const tracks = listTracks();
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}

function parseAudioTypeIds(raw: FormDataEntryValue | null): number[] | 'invalid' {
  if (raw === null) return [];
  if (typeof raw !== 'string') return 'invalid';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'invalid';
  }
  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'number')) {
    return 'invalid';
  }
  return parsed;
}

// POST /api/tracks
// multipart/form-data でファイル本体を受け取り、sounds/user/ へ保存 + wav_tracks へ INSERT する
// (楽曲管理機能 概要設計 3章)。
export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_missing' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.wav')) {
    return NextResponse.json({ error: 'invalid_extension' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 });
  }

  const audioTypeIds = parseAudioTypeIds(form.get('audioTypeIds'));
  if (audioTypeIds === 'invalid') {
    return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const track = await createTrackFromUpload({ fileName: file.name, fileBuffer, audioTypeIds });
    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidFileNameError) {
      return NextResponse.json({ error: 'invalid_file_name' }, { status: 400 });
    }
    if (err instanceof TrackConflictError) {
      return NextResponse.json({ error: 'conflict', field: err.field }, { status: 409 });
    }
    if (err instanceof InvalidAudioTypeError) {
      return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
