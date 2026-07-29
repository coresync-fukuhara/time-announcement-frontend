import path from 'node:path';
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
