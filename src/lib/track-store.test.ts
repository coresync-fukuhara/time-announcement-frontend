// @vitest-environment node
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createTestDb } from './db/create-test-db';
import { getDb, resetDbForTests } from './db/client';
import { audioTypes, wavTracks, trackAudioTypes } from './db/generated/schema';
import { listTracks, listAudioTypes, updateTrack } from './track-store';
import { readFile } from 'node:fs/promises';
import {
  createTrackFromUpload,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
  TrackNotFoundError,
  DefaultTrackForbiddenError,
} from './track-store';

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

describe('createTrackFromUpload', () => {
  it('sounds/user/ にファイルを書き込み、DBに登録する', async () => {
    seed();
    const track = await createTrackFromUpload({
      fileName: 'new_chime.wav',
      fileBuffer: Buffer.from('dummy wav bytes'),
      audioTypeIds: [2],
    });

    expect(track.name).toBe('new_chime');
    expect(track.origin).toBe('user');
    expect(track.audioTypes).toEqual([{ id: 2, name: 'NOTIFICATION' }]);

    const written = await readFile(track.filePath, 'utf-8');
    expect(written).toBe('dummy wav bytes');
  });

  it('ディレクトリトラバーサルを含むファイル名は拒否する', async () => {
    await expect(
      createTrackFromUpload({
        fileName: '../../etc/passwd.wav',
        fileBuffer: Buffer.from('x'),
        audioTypeIds: [],
      }),
    ).rejects.toThrow(InvalidFileNameError);
  });

  it('許可文字以外を含むファイル名は拒否する', async () => {
    await expect(
      createTrackFromUpload({
        fileName: 'あいうえお.wav',
        fileBuffer: Buffer.from('x'),
        audioTypeIds: [],
      }),
    ).rejects.toThrow(InvalidFileNameError);
  });

  it('sounds/user/ に同名ファイルが既に存在する場合は409相当のエラーを投げ、ファイルを上書きしない', async () => {
    seed();
    await createTrackFromUpload({
      fileName: 'dup.wav',
      fileBuffer: Buffer.from('first'),
      audioTypeIds: [],
    });

    await expect(
      createTrackFromUpload({
        fileName: 'dup.wav',
        fileBuffer: Buffer.from('second'),
        audioTypeIds: [],
      }),
    ).rejects.toThrow(TrackConflictError);

    const tracks = listTracks();
    const dup = tracks.find((t) => t.name === 'dup')!;
    const written = await readFile(dup.filePath, 'utf-8');
    expect(written).toBe('first');
  });

  it('表示名(name)が既存レコードと重複する場合は409相当のエラーを投げ、書き込み済みファイルを削除する', async () => {
    seed();
    await expect(
      createTrackFromUpload({
        fileName: 'sample.wav', // seed() の default 楽曲 "sample" と name が衝突
        fileBuffer: Buffer.from('x'),
        audioTypeIds: [],
      }),
    ).rejects.toThrow(TrackConflictError);

    const { access } = await import('node:fs/promises');
    const conflictPath = path.join(process.env.SOUNDS_DIR!, 'user', 'sample.wav');
    await expect(access(conflictPath)).rejects.toThrow();
  });

  it('存在しない audioTypeId を指定すると400相当のエラーを投げ、書き込み済みファイルを削除する', async () => {
    seed();
    await expect(
      createTrackFromUpload({
        fileName: 'bad_type.wav',
        fileBuffer: Buffer.from('x'),
        audioTypeIds: [999],
      }),
    ).rejects.toThrow(InvalidAudioTypeError);

    const { access } = await import('node:fs/promises');
    const p = path.join(process.env.SOUNDS_DIR!, 'user', 'bad_type.wav');
    await expect(access(p)).rejects.toThrow();
  });
});

describe('updateTrack', () => {
  it('nameとaudioTypeIdsを全置換する', () => {
    seed();
    const before = listTracks().find((t) => t.name === 'my_chime')!;

    const updated = updateTrack(before.id, { name: 'renamed_chime', audioTypeIds: [2] });

    expect(updated.name).toBe('renamed_chime');
    expect(updated.audioTypes).toEqual([{ id: 2, name: 'NOTIFICATION' }]);
  });

  it('存在しないidはTrackNotFoundErrorを投げる', () => {
    seed();
    expect(() => updateTrack(9999, { name: 'x', audioTypeIds: [] })).toThrow(TrackNotFoundError);
  });

  it('origin: default の楽曲はDefaultTrackForbiddenErrorを投げる', () => {
    seed();
    const sample = listTracks().find((t) => t.name === 'sample')!;
    expect(() => updateTrack(sample.id, { name: 'renamed', audioTypeIds: [] })).toThrow(
      DefaultTrackForbiddenError,
    );
  });

  it('他レコードと同名にするとTrackConflictErrorを投げ、対象レコードは変更されない', () => {
    seed();
    const chime = listTracks().find((t) => t.name === 'my_chime')!;
    expect(() => updateTrack(chime.id, { name: 'sample', audioTypeIds: [] })).toThrow(
      TrackConflictError,
    );
    expect(listTracks().find((t) => t.id === chime.id)!.name).toBe('my_chime');
  });
});
