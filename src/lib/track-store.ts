import path from 'node:path';
import { writeFile, unlink } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { wavTracks, audioTypes, trackAudioTypes } from './db/generated/schema';
import { getSoundsDefaultDir, getSoundsUserDir } from './paths';

export interface TrackAudioTypeSummary {
  id: number;
  name: string;
}

export interface TrackRecord {
  id: number;
  name: string;
  filePath: string;
  origin: 'default' | 'user';
  audioTypes: TrackAudioTypeSummary[];
}

// file_path は Python 側で相対パスの可能性があるため、比較前に必ず絶対パス化する
// (楽曲管理機能 概要設計 2章の既知の注意点)。
function resolveOrigin(filePath: string): 'default' | 'user' {
  const resolved = path.resolve(filePath);
  const defaultDir = path.resolve(getSoundsDefaultDir());
  const userDir = path.resolve(getSoundsUserDir());
  if (resolved === defaultDir || resolved.startsWith(defaultDir + path.sep)) return 'default';
  if (resolved === userDir || resolved.startsWith(userDir + path.sep)) return 'user';
  throw new Error(`file_path が sounds/default・sounds/user のいずれの配下でもない: ${filePath}`);
}

interface JoinedRow {
  id: number;
  name: string;
  filePath: string;
  audioTypeId: number | null;
  audioTypeName: string | null;
}

function groupJoinedRows(rows: JoinedRow[]): TrackRecord[] {
  const byId = new Map<number, TrackRecord>();
  for (const row of rows) {
    let track = byId.get(row.id);
    if (!track) {
      track = {
        id: row.id,
        name: row.name,
        filePath: row.filePath,
        origin: resolveOrigin(row.filePath),
        audioTypes: [],
      };
      byId.set(row.id, track);
    }
    if (row.audioTypeId !== null && row.audioTypeName !== null) {
      track.audioTypes.push({ id: row.audioTypeId, name: row.audioTypeName });
    }
  }
  return [...byId.values()];
}

function selectJoined(trackId?: number): JoinedRow[] {
  const query = getDb()
    .select({
      id: wavTracks.id,
      name: wavTracks.name,
      filePath: wavTracks.filePath,
      audioTypeId: audioTypes.id,
      audioTypeName: audioTypes.name,
    })
    .from(wavTracks)
    .leftJoin(trackAudioTypes, eq(trackAudioTypes.trackId, wavTracks.id))
    .leftJoin(audioTypes, eq(audioTypes.id, trackAudioTypes.audioTypeId));

  if (trackId !== undefined) {
    return query.where(eq(wavTracks.id, trackId)).all();
  }
  return query.all();
}

export function listTracks(): TrackRecord[] {
  return groupJoinedRows(selectJoined());
}

export function listAudioTypes(): TrackAudioTypeSummary[] {
  return getDb().select({ id: audioTypes.id, name: audioTypes.name }).from(audioTypes).all();
}

export class InvalidFileNameError extends Error {
  constructor(readonly fileName: string) {
    super(`invalid file name: ${fileName}`);
    this.name = 'InvalidFileNameError';
  }
}

export class TrackNotFoundError extends Error {
  constructor(readonly id: number) {
    super(`track not found: ${id}`);
    this.name = 'TrackNotFoundError';
  }
}

export class DefaultTrackForbiddenError extends Error {
  constructor(readonly id: number) {
    super(`default track cannot be modified: ${id}`);
    this.name = 'DefaultTrackForbiddenError';
  }
}

export class TrackConflictError extends Error {
  constructor(readonly field: 'name' | 'file_path') {
    super(`track conflict on ${field}`);
    this.name = 'TrackConflictError';
  }
}

export class InvalidAudioTypeError extends Error {
  constructor() {
    super('invalid audio type id');
    this.name = 'InvalidAudioTypeError';
  }
}

// 英数字・.・-・_ のみ、かつ .wav 拡張子を強制する(パストラバーサル・不正文字対策)。
// ルート層(POST /api/tracks)でも拡張子チェックはするが、ここでも二重に検証する
// (track-store はファイルシステムに直接触れるため、呼び出し元を信用しない)。
const SAFE_FILE_NAME_RE = /^[A-Za-z0-9._-]+\.wav$/i;

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName);
  if (base !== fileName || !SAFE_FILE_NAME_RE.test(base)) {
    throw new InvalidFileNameError(fileName);
  }
  return base;
}

function nowSqliteTimestamp(): string {
  // 既存データ(Python側)は "YYYY-MM-DD HH:MM:SS.ffffff" 形式。ミリ秒精度(3桁)まで
  // しか出せないが、created_at/updated_at は参照専用の記録用途のため許容する。
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

// DrizzleQueryError.cause(node:sqlite が投げる元エラー)のメッセージから、
// どの制約に違反したかを判定してドメインエラーへ変換する。
function mapDbError(err: unknown): Error {
  const cause = (err as { cause?: { message?: string } } | undefined)?.cause;
  const message = cause?.message ?? '';
  if (message.includes('UNIQUE constraint failed: wav_tracks.name')) {
    return new TrackConflictError('name');
  }
  if (message.includes('UNIQUE constraint failed: wav_tracks.file_path')) {
    return new TrackConflictError('file_path');
  }
  if (message.includes('FOREIGN KEY constraint failed')) {
    return new InvalidAudioTypeError();
  }
  return err instanceof Error ? err : new Error(String(err));
}

function getTrackByIdOrThrow(id: number): TrackRecord {
  const [track] = groupJoinedRows(selectJoined(id));
  if (!track) throw new TrackNotFoundError(id);
  return track;
}

export interface CreateTrackInput {
  fileName: string;
  fileBuffer: Buffer;
  audioTypeIds: number[];
}

// ファイル書き込み + DB INSERT をまとめる。片方が失敗したらもう片方を巻き戻す
// (楽曲管理機能 概要設計 2章)。
//
// 重要: getDb().transaction() のコールバックは同期関数にすること。async にすると
// throw時にロールバックされない(実機検証済みの既知の罠。Global Constraints 参照)。
export async function createTrackFromUpload(input: CreateTrackInput): Promise<TrackRecord> {
  const safeFileName = sanitizeFileName(input.fileName);
  const displayName = safeFileName.replace(/\.wav$/i, '');
  const targetPath = path.join(getSoundsUserDir(), safeFileName);

  try {
    // wx: 既に存在する場合は EEXIST で失敗させる(存在確認→書き込みのTOCTOUを避ける)。
    await writeFile(targetPath, input.fileBuffer, { flag: 'wx' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new TrackConflictError('file_path');
    }
    throw err;
  }

  let insertedId: number;
  try {
    const now = nowSqliteTimestamp();
    insertedId = getDb().transaction((tx) => {
      const row = tx
        .insert(wavTracks)
        .values({ name: displayName, filePath: targetPath, createdAt: now, updatedAt: now })
        .returning({ id: wavTracks.id })
        .get();
      for (const audioTypeId of input.audioTypeIds) {
        tx.insert(trackAudioTypes).values({ trackId: row.id, audioTypeId, createdAt: now }).run();
      }
      return row.id;
    });
  } catch (err) {
    await unlink(targetPath).catch(() => {});
    throw mapDbError(err);
  }

  return getTrackByIdOrThrow(insertedId);
}

export interface UpdateTrackInput {
  name: string;
  audioTypeIds: number[];
}

// name変更とtrack_audio_typesの全置換を1トランザクションで行う(全体置換の方針。
// 楽曲管理機能 概要設計 2章)。origin: default の楽曲はここで拒否する。
export function updateTrack(id: number, input: UpdateTrackInput): TrackRecord {
  const current = getDb().select().from(wavTracks).where(eq(wavTracks.id, id)).get();
  if (!current) throw new TrackNotFoundError(id);
  if (resolveOrigin(current.filePath) === 'default') throw new DefaultTrackForbiddenError(id);

  try {
    const now = nowSqliteTimestamp();
    getDb().transaction((tx) => {
      tx.update(wavTracks).set({ name: input.name, updatedAt: now }).where(eq(wavTracks.id, id)).run();
      tx.delete(trackAudioTypes).where(eq(trackAudioTypes.trackId, id)).run();
      for (const audioTypeId of input.audioTypeIds) {
        tx.insert(trackAudioTypes).values({ trackId: id, audioTypeId, createdAt: now }).run();
      }
    });
  } catch (err) {
    throw mapDbError(err);
  }

  return getTrackByIdOrThrow(id);
}

// DB削除(CASCADEでtrack_audio_typesも消える)→実ファイル削除の順で行う
// (ユーザー判断。楽曲管理機能 概要設計 2章)。DB側が正であるため、
// 万一ファイル削除だけ失敗しても孤立ファイルが残るだけで、DBの整合性は壊れない。
export async function deleteTrack(id: number): Promise<void> {
  const current = getDb().select().from(wavTracks).where(eq(wavTracks.id, id)).get();
  if (!current) throw new TrackNotFoundError(id);
  if (resolveOrigin(current.filePath) === 'default') throw new DefaultTrackForbiddenError(id);

  getDb().transaction((tx) => {
    tx.delete(wavTracks).where(eq(wavTracks.id, id)).run();
  });

  await unlink(current.filePath).catch((err) => {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  });
}
