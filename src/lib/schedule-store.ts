import { open, rename, copyFile, readFile } from 'node:fs/promises';
import type { ErrorObject } from 'ajv';
import { getSchedulesPath, getBackupPath, getTmpPath, getSettingsDir } from './paths';
import { validateSchedules } from './validator';
import type { ReadResult, Schedules } from './types';

// スキーマ違反を表すエラー。Route Handler 側で 400 + details に変換する。
export class ScheduleValidationError extends Error {
  readonly errors: ErrorObject[];
  constructor(errors: ErrorObject[]) {
    super('schedule validation failed');
    this.name = 'ScheduleValidationError';
    this.errors = errors;
  }
}

// schedules.json を読み込む。
// 存在しない/JSON 壊れ/スキーマ違反は initialized: false を返し(UI の初期化ダイアログ起点)、
// それ以外の I/O エラーは呼び出し元へ伝播させる(→ 500)。
export async function readSchedules(): Promise<ReadResult> {
  let raw: string;
  try {
    raw = await readFile(getSchedulesPath(), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { initialized: false, reason: 'missing' };
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { initialized: false, reason: 'invalid_json' };
  }

  const result = validateSchedules(parsed);
  if (!result.valid) {
    return { initialized: false, reason: 'validation_failed' };
  }
  return { initialized: true, schedules: parsed as Schedules };
}

// 書き込みは 1 本の Promise チェーンに直列化する(概要設計 7.3。Node は単一プロセスのためこれで十分)。
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  // 直前の成否に関わらずキューを継続させる(呼び出し元の reject は run 側で受け取る)。
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

// アトミック書き込み: 同一ディレクトリに一時ファイルを書き、fsync 後に rename(2) で置換する
// (概要設計 7.2)。cron(毎分)が書き込み途中の半端なファイルを読む事故を構造的に防ぐ。
async function atomicWrite(targetPath: string, tmpPath: string, contents: string): Promise<void> {
  const fh = await open(tmpPath, 'w');
  try {
    await fh.writeFile(contents, 'utf-8');
    await fh.sync(); // fsync: 中身をディスクへ確定させてから rename する
  } finally {
    await fh.close();
  }
  await rename(tmpPath, targetPath);
  await fsyncDir(getSettingsDir());
}

// rename の永続化のため親ディレクトリも fsync する(POSIX の定石)。
// 一部プラットフォームではディレクトリ fsync が失敗し得るため握りつぶす。
async function fsyncDir(dir: string): Promise<void> {
  let dh;
  try {
    dh = await open(dir, 'r');
    await dh.sync();
  } catch {
    // best-effort
  } finally {
    await dh?.close();
  }
}

// スケジュールを書き込む。
//  1) 書き込み前バリデーション(違反時はファイルに一切触れず throw)
//  2) 既存ファイルを .bak として 1 世代残す(No.11)
//  3) アトミック書き込み(tmp + fsync + rename)
//  4) 書き込みは直列化
// UTF-8 / LF / インデント 2 スペース / 末尾改行で整形する(概要設計 7.4)。
export async function writeSchedules(data: unknown): Promise<Schedules> {
  const result = validateSchedules(data);
  if (!result.valid) {
    // ここで throw することで、キューにもファイルにも一切触れない。
    throw new ScheduleValidationError(result.errors);
  }

  return enqueue(async () => {
    const schedulesPath = getSchedulesPath();

    // 既存ファイルがあれば .bak を上書き作成(世代管理はしない)。
    try {
      await copyFile(schedulesPath, getBackupPath());
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err; // 既存ファイルはあるがバックアップに失敗 → 中断(本ファイルは未変更)
      }
      // ENOENT(初回書き込み)は .bak を作らずに続行。
    }

    const contents = `${JSON.stringify(data, null, 2)}\n`;
    await atomicWrite(schedulesPath, getTmpPath(), contents);

    return data as Schedules;
  });
}
