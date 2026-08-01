// @vitest-environment node
import { mkdtemp, mkdir, rm, readFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createTestDb } from './db/create-test-db';
import { getDb, resetDbForTests } from './db/client';
import { audioTypes, wavTracks, trackAudioTypes } from './db/generated/schema';
import {
  listTracks,
  listAudioTypes,
  updateTrack,
  createTrackFromUpload,
  deleteTrack,
  getTrackFilePathOrThrow,
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
  it('sounds/default・sounds/user のいずれの配下でもない file_path は origin: unknown を返し、一覧全体は落ちない', () => {
    seed();
    const now = new Date().toISOString();
    getDb().transaction((tx) => {
      tx.insert(wavTracks)
        .values({
          name: 'mystery',
          filePath: path.join(tmpDir, 'elsewhere', 'mystery.wav'),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });

    const tracks = listTracks();
    expect(tracks).toHaveLength(3);
    const mystery = tracks.find((t) => t.name === 'mystery')!;
    expect(mystery.origin).toBe('unknown');
  });

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

    const conflictPath = path.join(process.env.SOUNDS_DIR!, 'user', 'sample.wav');
    await expect(access(conflictPath)).rejects.toThrow();
  });

  it('audioTypeIds に重複したidを渡しても成功し、1回だけ割り当てられる', async () => {
    seed();
    const track = await createTrackFromUpload({
      fileName: 'dup_type.wav',
      fileBuffer: Buffer.from('x'),
      audioTypeIds: [2, 2],
    });

    expect(track.audioTypes).toEqual([{ id: 2, name: 'NOTIFICATION' }]);
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

  it('origin: default の楽曲はnameを変更しようとするとDefaultTrackForbiddenErrorを投げる', () => {
    seed();
    const sample = listTracks().find((t) => t.name === 'sample')!;
    expect(() => updateTrack(sample.id, { name: 'renamed', audioTypeIds: [] })).toThrow(
      DefaultTrackForbiddenError,
    );
  });

  it('origin: default の楽曲でもnameを変更しなければaudioTypeIdsのみの更新は成功する', () => {
    seed();
    const sample = listTracks().find((t) => t.name === 'sample')!;
    expect(sample.audioTypes).toEqual([{ id: 1, name: 'DEFAULT' }]);

    const updated = updateTrack(sample.id, { name: sample.name, audioTypeIds: [2] });

    expect(updated.name).toBe('sample');
    expect(updated.audioTypes).toEqual([{ id: 2, name: 'NOTIFICATION' }]);

    const refetched = listTracks().find((t) => t.id === sample.id)!;
    expect(refetched.audioTypes).toEqual([{ id: 2, name: 'NOTIFICATION' }]);
  });

  it('origin: unknown の楽曲はnameを変更しようとするとDefaultTrackForbiddenErrorを投げる', () => {
    seed();
    const now = new Date().toISOString();
    const mysteryId = getDb().transaction((tx) => {
      const row = tx
        .insert(wavTracks)
        .values({
          name: 'mystery',
          filePath: path.join(tmpDir, 'elsewhere', 'mystery.wav'),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: wavTracks.id })
        .get();
      return row.id;
    });

    expect(() => updateTrack(mysteryId, { name: 'renamed', audioTypeIds: [] })).toThrow(
      DefaultTrackForbiddenError,
    );
  });

  it('origin: unknown の楽曲でもnameを変更しなければaudioTypeIdsのみの更新は成功する', () => {
    seed();
    const now = new Date().toISOString();
    const mysteryId = getDb().transaction((tx) => {
      const row = tx
        .insert(wavTracks)
        .values({
          name: 'mystery2',
          filePath: path.join(tmpDir, 'elsewhere', 'mystery2.wav'),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: wavTracks.id })
        .get();
      return row.id;
    });

    const updated = updateTrack(mysteryId, { name: 'mystery2', audioTypeIds: [1] });

    expect(updated.origin).toBe('unknown');
    expect(updated.audioTypes).toEqual([{ id: 1, name: 'DEFAULT' }]);
  });

  it('audioTypeIds に重複したidを渡しても成功し、1回だけ割り当てられる', () => {
    seed();
    const chime = listTracks().find((t) => t.name === 'my_chime')!;

    const updated = updateTrack(chime.id, { name: chime.name, audioTypeIds: [2, 2] });

    expect(updated.audioTypes).toEqual([{ id: 2, name: 'NOTIFICATION' }]);
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

describe('deleteTrack', () => {
  it('DBレコードと実ファイルの両方を削除する', async () => {
    seed();
    const uploaded = await createTrackFromUpload({
      fileName: 'to_delete.wav',
      fileBuffer: Buffer.from('x'),
      audioTypeIds: [1],
    });

    await deleteTrack(uploaded.id);

    expect(listTracks().find((t) => t.id === uploaded.id)).toBeUndefined();
    await expect(access(uploaded.filePath)).rejects.toThrow();
  });

  it('存在しないidはTrackNotFoundErrorを投げる', async () => {
    seed();
    await expect(deleteTrack(9999)).rejects.toThrow(TrackNotFoundError);
  });

  it('origin: default の楽曲はDefaultTrackForbiddenErrorを投げ、削除されない', async () => {
    seed();
    const sample = listTracks().find((t) => t.name === 'sample')!;
    await expect(deleteTrack(sample.id)).rejects.toThrow(DefaultTrackForbiddenError);
    expect(listTracks().find((t) => t.id === sample.id)).toBeDefined();
  });

  it('origin: unknown の楽曲もDefaultTrackForbiddenErrorを投げ、削除されない', async () => {
    seed();
    const now = new Date().toISOString();
    const mysteryId = getDb().transaction((tx) => {
      const row = tx
        .insert(wavTracks)
        .values({
          name: 'mystery',
          filePath: path.join(tmpDir, 'elsewhere', 'mystery.wav'),
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: wavTracks.id })
        .get();
      return row.id;
    });

    await expect(deleteTrack(mysteryId)).rejects.toThrow(DefaultTrackForbiddenError);
    expect(listTracks().find((t) => t.id === mysteryId)).toBeDefined();
  });
});

describe('getTrackFilePathOrThrow', () => {
  it('存在するidはfilePathを返す', () => {
    seed();
    const chime = listTracks().find((t) => t.name === 'my_chime')!;
    expect(getTrackFilePathOrThrow(chime.id)).toBe(chime.filePath);
  });

  it('存在しないidはTrackNotFoundErrorを投げる', () => {
    seed();
    expect(() => getTrackFilePathOrThrow(9999)).toThrow(TrackNotFoundError);
  });
});

describe('file_path のDB制約(テストDBが本番と同じUNIQUE制約を持つことの回帰テスト)', () => {
  it('createTestDb で作成したテストDBは wav_tracks.file_path に対するUNIQUE制約を強制する', () => {
    // drizzle-kit pull は SQLite の暗黙インデックス(inline な UNIQUE (file_path) 由来の
    // sqlite_autoindex_wav_tracks_1)を migration.sql に出力しないため、createTestDb() が
    // 明示的に追加している(src/lib/db/create-test-db.ts 参照)。この制約が将来
    // 静かに失われていないかを直接確認する。
    const now = new Date().toISOString();
    const dup = path.join(process.env.SOUNDS_DIR!, 'user', 'same_path.wav');
    getDb().transaction((tx) => {
      tx.insert(wavTracks)
        .values({ name: 'first', filePath: dup, createdAt: now, updatedAt: now })
        .run();
    });

    // drizzle は node:sqlite が投げる元エラーを DrizzleQueryError でラップし、
    // 元のSQLiteメッセージは .cause に入る(mapDbError が読んでいるのと同じ形。
    // track-store.ts 参照)。
    let caught: unknown;
    try {
      getDb().transaction((tx) => {
        tx.insert(wavTracks)
          .values({ name: 'second', filePath: dup, createdAt: now, updatedAt: now })
          .run();
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    const cause = (caught as { cause?: { message?: string } }).cause;
    expect(cause?.message).toMatch(/UNIQUE constraint failed: wav_tracks\.file_path/);
  });
});
