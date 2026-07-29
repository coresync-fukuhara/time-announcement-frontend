import { NextResponse } from 'next/server';
import { listAudioTypes } from '@/lib/track-store';

// DB I/O を行うため Node.js ランタイムで動かす。都度最新値を返すためキャッシュしない。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audio-types
// audio_types 一覧を返す(読み取り専用。楽曲管理機能 概要設計 3章)。
export async function GET(): Promise<NextResponse> {
  try {
    const audioTypes = listAudioTypes();
    return NextResponse.json({ audioTypes });
  } catch {
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
