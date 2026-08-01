import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getTrackFilePathOrThrow, TrackNotFoundError } from '@/lib/track-store';

// ファイル I/O を行うため Node.js ランタイムで動かす。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

// GET /api/tracks/:id/audio
// 試し聴き用に .wav 本体をそのまま返す(試し聴き機能 詳細設計 2章)。
// Rangeヘッダ非対応、毎回ファイル全体を返す。
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let filePath: string;
  try {
    filePath = getTrackFilePathOrThrow(id);
  } catch (err) {
    if (err instanceof TrackNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }

  try {
    const buffer = await readFile(path.resolve(filePath));
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'content-type': 'audio/wav' },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'file_not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
