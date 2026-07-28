import { NextResponse } from 'next/server';
import { readSampleSchedules } from '@/lib/schedule-store';

// ファイル I/O を行うため Node.js ランタイムで動かす。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sample-schedules
// 初期化ダイアログの「サンプル設定からコピーして始める」用(No.9 確定)。
// sample_schedules.json が無い/壊れている場合は found: false を返す(schedules.json とは
// 異なり参照専用データのため、初期化ダイアログ側でその選択肢を諦めさせる程度の扱いでよい)。
export async function GET(): Promise<NextResponse> {
  try {
    const result = await readSampleSchedules();
    if (result.found) {
      return NextResponse.json({ found: true, schedules: result.schedules });
    }
    return NextResponse.json({ found: false });
  } catch {
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
