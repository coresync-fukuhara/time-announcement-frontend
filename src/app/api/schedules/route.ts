import { NextResponse } from 'next/server';
import {
  readSchedules,
  writeSchedules,
  ScheduleValidationError,
} from '@/lib/schedule-store';

// ファイル I/O を行うため Node.js ランタイムで動かす。GET はファイルの現在値を返すためキャッシュしない。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/schedules
// ファイルがあれば内容を返す。無い/壊れている場合は initialized: false を返し、
// UI 側の初期化ダイアログ(No.9)の起点とする。
export async function GET(): Promise<NextResponse> {
  try {
    const result = await readSchedules();
    if (result.initialized) {
      return NextResponse.json({ initialized: true, schedules: result.schedules });
    }
    return NextResponse.json({ initialized: false });
  } catch {
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}

// PUT /api/schedules
// リクエストボディ(週間スケジュール全体)を検証して書き込む。全体置換(概要設計 6章)。
export async function PUT(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // ボディが JSON として壊れている(スキーマ検証以前の問題)。
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const saved = await writeSchedules(body);
    return NextResponse.json({ initialized: true, schedules: saved });
  } catch (err) {
    if (err instanceof ScheduleValidationError) {
      // スキーマ違反。writeSchedules はこの場合ファイルに一切触れていない。
      return NextResponse.json(
        { error: 'validation_failed', details: err.errors },
        { status: 400 },
      );
    }
    // それ以外(ファイル I/O 失敗など)。
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
