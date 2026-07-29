// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from './create-test-db';
import { getDb, resetDbForTests } from './client';
import { wavTracks, audioTypes, trackAudioTypes } from './generated/schema';

let tmpDir: string | undefined;
let prevDbDir: string | undefined;

afterEach(async () => {
  resetDbForTests();
  if (prevDbDir === undefined) delete process.env.DB_DIR;
  else process.env.DB_DIR = prevDbDir;
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

function useTempDb(): void {
  prevDbDir = process.env.DB_DIR;
  process.env.DB_DIR = tmpDir;
  resetDbForTests();
}

describe('getDb', () => {
  it('生成済みスキーマに対して select できる', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'db-client-'));
    createTestDb(path.join(tmpDir, 'music.sqlite3'));
    useTempDb();

    const rows = getDb().select().from(wavTracks).all();
    expect(rows).toEqual([]);
  });

  it('PRAGMA foreign_keys=ON によりCASCADE削除が効く', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'db-client-'));
    createTestDb(path.join(tmpDir, 'music.sqlite3'));
    useTempDb();

    const db = getDb();
    const now = new Date().toISOString();
    // audio_types に1件、wav_tracks に1件、track_audio_types に1件入れてから
    // wav_tracks 側を削除し、track_audio_types が連鎖削除されることを確認する。
    db.transaction((tx) => {
      tx.insert(audioTypes).values({ id: 1, name: 'DEFAULT', createdAt: now }).run();
      const track = tx
        .insert(wavTracks)
        .values({ name: 'foo', filePath: '/x/foo.wav', createdAt: now, updatedAt: now })
        .returning({ id: wavTracks.id })
        .get();
      tx.insert(trackAudioTypes).values({ trackId: track.id, audioTypeId: 1, createdAt: now }).run();
    });

    db.transaction((tx) => {
      tx.delete(wavTracks).run();
    });

    const remaining = db.select().from(trackAudioTypes).all();
    expect(remaining).toEqual([]);
  });
});
