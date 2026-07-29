import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import {
  getDbDir,
  getDbPath,
  getSoundsDir,
  getSoundsDefaultDir,
  getSoundsUserDir,
} from '@/lib/paths';

const envKeys = ['DB_DIR', 'SOUNDS_DIR'] as const;
const originalEnv: Record<string, string | undefined> = {};
for (const key of envKeys) originalEnv[key] = process.env[key];

afterEach(() => {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe('getDbDir/getDbPath', () => {
  it('DB_DIR未設定時は cwd 直下の db/ を使う', () => {
    delete process.env.DB_DIR;
    expect(getDbDir()).toBe(path.join(process.cwd(), 'db'));
    expect(getDbPath()).toBe(path.join(process.cwd(), 'db', 'music.sqlite3'));
  });

  it('DB_DIR設定時はそちらを使う', () => {
    process.env.DB_DIR = '/data/db';
    expect(getDbDir()).toBe('/data/db');
    expect(getDbPath()).toBe(path.join('/data/db', 'music.sqlite3'));
  });
});

describe('getSoundsDir/getSoundsDefaultDir/getSoundsUserDir', () => {
  it('SOUNDS_DIR未設定時は cwd 直下の sounds/ を使う', () => {
    delete process.env.SOUNDS_DIR;
    expect(getSoundsDir()).toBe(path.join(process.cwd(), 'sounds'));
    expect(getSoundsDefaultDir()).toBe(path.join(process.cwd(), 'sounds', 'default'));
    expect(getSoundsUserDir()).toBe(path.join(process.cwd(), 'sounds', 'user'));
  });

  it('SOUNDS_DIR設定時はそちらを使う', () => {
    process.env.SOUNDS_DIR = '/data/sounds';
    expect(getSoundsDefaultDir()).toBe(path.join('/data/sounds', 'default'));
    expect(getSoundsUserDir()).toBe(path.join('/data/sounds', 'user'));
  });
});
