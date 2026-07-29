import { NextResponse } from 'next/server';
import {
  updateTrack,
  deleteTrack,
  TrackNotFoundError,
  DefaultTrackForbiddenError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

// PATCH /api/tracks/:id
// { name, audioTypeIds } を受け取り、名前と音声タイプ割り当てを全置換する
// (楽曲管理機能 概要設計 3章)。
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, audioTypeIds } = (body ?? {}) as { name?: unknown; audioTypeIds?: unknown };
  if (typeof name !== 'string' || name.length === 0) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (!Array.isArray(audioTypeIds) || !audioTypeIds.every((v) => typeof v === 'number')) {
    return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
  }

  try {
    const track = updateTrack(id, { name, audioTypeIds });
    return NextResponse.json({ track });
  } catch (err) {
    if (err instanceof TrackNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof DefaultTrackForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
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

// DELETE /api/tracks/:id
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    await deleteTrack(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof TrackNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof DefaultTrackForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
