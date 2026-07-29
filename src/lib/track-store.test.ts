// @vitest-environment node
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createTestDb } from './db/create-test-db';
import { getDb, resetDbForTests } from './db/client';
import { audioTypes, wavTracks, trackAudioTypes } from './db/generated/schema';
import { listTracks, listAudioTypes } from './track-store';

let tmpDir: string;
let prevDbDir: string | undefined;
let prevSoundsDir: string | undefined;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'track-store-'));
  await mkdir(path.join(tmpDir, 'sounds', 'default'), { recursive: true });
  await mkdir(path.join(tmpDir, 'sounds', 'user'), { recursive: true });
  const dbDir = path.join(tmpDir, 'db');
  await mkdir(dbDir, { recursive: true });
  createTestDb(path.join(dbDir, 'music.sqlite3'));

  prevDbDir = process.env.DB_DIR;
  prevSoundsDir = process.env.SOUNDS_DIR;
  process.env.DB_DIR = dbDir;
  process.env.SOUNDS_DIR = path.join(tmpDir, 'sounds');
  resetDbForTests();
});

afterEach(async () => {
  if (prevDbDir === undefined) delete process.env.DB_DIR;
  else process.env.DB_DIR = prevDbDir;
  if (prevSoundsDir === undefined) delete process.env.SOUNDS_DIR;
  else process.env.SOUNDS_DIR = prevSoundsDir;
  resetDbForTests();
  await rm(tmpDir, { recursive: true, force: true });
});

function seed(): void {
  const now = new Date().toISOString();
  getDb().transaction((tx) => {
    tx.insert(audioTypes)
      .values([
        { id: 1, name: 'DEFAULT', createdAt: now },
        { id: 2, name: 'NOTIFICATION', createdAt: now },
      ])
      .run();
    const defaultTrack = tx
      .insert(wavTracks)
      .values({
        name: 'sample',
        filePath: path.join(process.env.SOUNDS_DIR!, 'default', 'sample.wav'),
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: wavTracks.id })
      .get();
    tx.insert(trackAudioTypes).values({ trackId: defaultTrack.id, audioTypeId: 1, createdAt: now }).run();

    const userTrack = tx
      .insert(wavTracks)
      .values({
        name: 'my_chime',
        filePath: path.join(process.env.SOUNDS_DIR!, 'user', 'my_chime.wav'),
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: wavTracks.id })
      .get();
    tx.insert(trackAudioTypes)
      .values([
        { trackId: userTrack.id, audioTypeId: 1, createdAt: now },
        { trackId: userTrack.id, audioTypeId: 2, createdAt: now },
      ])
      .run();
  });
}

describe('listTracks', () => {
  it('origin と割り当て済み音声タイプを含めて返す', () => {
    seed();
    const tracks = listTracks();
    expect(tracks).toHaveLength(2);

    const sample = tracks.find((t) => t.name === 'sample')!;
    expect(sample.origin).toBe('default');
    expect(sample.audioTypes).toEqual([{ id: 1, name: 'DEFAULT' }]);

    const chime = tracks.find((t) => t.name === 'my_chime')!;
    expect(chime.origin).toBe('user');
    expect(chime.audioTypes).toEqual(
      expect.arrayContaining([
        { id: 1, name: 'DEFAULT' },
        { id: 2, name: 'NOTIFICATION' },
      ]),
    );
  });

  it('音声タイプが1つも割り当てられていない楽曲は空配列を返す', () => {
    const now = new Date().toISOString();
    getDb().transaction((tx) => {
      tx.insert(wavTracks)
        .values({
          name: 'untyped',
          filePath: path.join(process.env.SOUNDS_DIR!, 'user', 'untyped.wav'),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });
    const tracks = listTracks();
    expect(tracks).toEqual([
      expect.objectContaining({ name: 'untyped', origin: 'user', audioTypes: [] }),
    ]);
  });
});

describe('listAudioTypes', () => {
  it('audio_types 一覧を返す', () => {
    seed();
    expect(listAudioTypes()).toEqual(
      expect.arrayContaining([
        { id: 1, name: 'DEFAULT' },
        { id: 2, name: 'NOTIFICATION' },
      ]),
    );
  });
});
