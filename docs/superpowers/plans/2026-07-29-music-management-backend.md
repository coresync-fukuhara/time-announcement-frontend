# 楽曲管理機能(データ層 + API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `db/music.sqlite3` を Drizzle ORM(`node:sqlite` ドライバ)経由で読み書きするデータ層と、`/api/tracks`・`/api/audio-types` の Route Handlers を実装する。

**Architecture:** `drizzle-kit pull` で生成した `schema.ts` を唯一のスキーマ定義として使い、`src/lib/db/client.ts` の単一接続経由で `src/lib/track-store.ts`(高レベル操作)を実装、その上に Route Handlers を薄く被せる。既存の `schedule-store.ts`/`/api/schedules` と同じレイヤリングを踏襲する。

**Tech Stack:** Drizzle ORM(`drizzle-orm@1.0.0-rc.4`)+ `node:sqlite`(Node.js 22 組み込み)。スキーマ取り込み専用に `drizzle-kit@1.0.0-rc.4` + `better-sqlite3` を devDependencies に追加。

**本計画の範囲外:** `/tracks` 画面(UI)と Playwright E2E テストは、別途 `frontend-design` でのブレインストーミングを経てから別計画で実装する。本計画はデータ層・API・関連テスト(ユニット/API)のみを対象とする。

## Global Constraints

- Node.js は `>=22`(`package.json` の `engines` に既存設定あり。変更不要)。
- `drizzle-orm` は `1.0.0-rc.4` を**キャレットなしで正確に固定**する(dependencies)。安定版(`latest`=0.45.2)には `drizzle-orm/node-sqlite` が存在しないことを実機検証済み。
- `drizzle-kit` は `1.0.0-rc.4` をキャレットなしで正確に固定する(devDependencies)。
- `better-sqlite3` は `^13.0.2`(devDependencies)。`drizzle-kit pull` のスキーマ取り込み専用で、アプリ実行時には一切使わない(実行時ドライバは `node:sqlite`)。
- `pnpm-workspace.yaml` の `strictDepBuilds: true` により、`better-sqlite3`(prebuild-install)と `esbuild`(drizzle-kit の transitive dependency)の2つを `allowBuilds` に追加しないと `pnpm install` が失敗する(node:22-slim の Docker ビルドで実機確認済み。ビルドツール追加は不要、prebuild バイナリで解決する)。
- **`db.transaction()` のコールバックは必ず同期関数にし、`.run()`/`.get()`/`.all()` で終端すること。`async`コールバック+`await`を使うと、throw時にロールバックが機能しない(コミットが先に走ってしまう)ことを実機検証で確認済みの既知の罠。**
- 接続確立時に `PRAGMA journal_mode = WAL;` と `PRAGMA foreign_keys = ON;` を必ず発行する(後者を忘れると `track_audio_types` の `ON DELETE CASCADE` が効かない)。
- `wav_tracks.file_path` は DB 上で絶対/相対どちらの可能性もあるため、比較前に必ず `path.resolve()` で正規化する。
- アップロードは `.wav` 拡張子のみ・10MB 上限・`sounds/user/` 内でのファイル名重複は 409。
- `sounds/default/` 由来の楽曲(`origin: "default"`)は名前変更・削除を拒否(403)。音声タイプ割り当ての変更は可。
- 生成物(`src/lib/db/generated/**`)は `drizzle-kit pull` の出力そのままとし、手動編集しない。

---

## Task 1: 依存関係の追加とスキーマ取り込み

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `drizzle.config.ts`
- Create: `src/lib/db/generated/schema.ts`(生成物)
- Create: `src/lib/db/generated/relations.ts`(生成物)
- Create: `src/lib/db/generated/<timestamp>_<name>/migration.sql`(生成物。フォルダ名は実行のたびにランダムな値になる)
- Create: `src/lib/db/generated/<timestamp>_<name>/snapshot.json`(生成物)

**Interfaces:**
- Produces: `src/lib/db/generated/schema.ts` が export する `wavTracks`・`audioTypes`・`trackAudioTypes`(いずれも `sqliteTable` オブジェクト、カラムは camelCase: `id`/`name`/`filePath`/`createdAt`/`updatedAt`・`description`・`trackId`/`audioTypeId`)。以降の全タスクがこれを import する。

この開発環境には devcontainer 経由で実際の `db/music.sqlite3`(`wav_tracks`・`audio_types`・`track_audio_types` の3テーブル)がバインドマウントされている前提。

- [ ] **Step 1: `package.json` に依存関係を追加**

`dependencies` に追加:
```json
"drizzle-orm": "1.0.0-rc.4"
```

`devDependencies` に追加:
```json
"drizzle-kit": "1.0.0-rc.4",
"better-sqlite3": "^13.0.2"
```

- [ ] **Step 2: `pnpm-workspace.yaml` の `allowBuilds` に2件追加**

既存のコメント(`strictDepBuilds: true` のため未承認ビルドはエラーになる、という説明)の下に追記する形で、`allowBuilds` を以下のように変更する:

```yaml
allowBuilds:
  core-js: false
  msw: false
  sharp: false
  # better-sqlite3: drizzle-kit pull のスキーマ取り込み専用(実行時は node:sqlite を使うため
  # アプリには含まれない)。prebuild-install でプリビルドバイナリを取得するだけで
  # コンパイラは不要(node:22-slim での Docker ビルドで確認済み)。
  better-sqlite3: true
  # esbuild: drizzle-kit の transitive dependency。postinstall はプラットフォーム別バイナリの
  # ダウンロードのみ(コンパイル不要)。
  esbuild: true
```

- [ ] **Step 3: install 実行**

Run: `pnpm install`
Expected: `better-sqlite3`・`drizzle-kit`・`drizzle-orm`・`esbuild` が `+` 表示され、`ERR_PNPM_IGNORED_BUILDS` が出ずに完了する。

- [ ] **Step 4: `drizzle.config.ts` を作成**

```typescript
import { defineConfig } from 'drizzle-kit';
import path from 'node:path';

const dbDir = process.env.DB_DIR ?? path.join(process.cwd(), 'db');

export default defineConfig({
  dialect: 'sqlite',
  out: './src/lib/db/generated',
  dbCredentials: {
    url: `file:${path.join(dbDir, 'music.sqlite3')}`,
  },
});
```

- [ ] **Step 5: `package.json` の `scripts` に `db:pull` を追加**

```json
"db:pull": "drizzle-kit pull"
```

- [ ] **Step 6: スキーマを取り込む**

Run: `pnpm db:pull`
Expected: 以下3行が表示される。
```
[✓] Your SQL migration ➜ src/lib/db/generated/<timestamp>_<name>/migration.sql 🚀
[✓] Your schema file is ready ➜ src/lib/db/generated/schema.ts 🚀
[✓] Your relations file is ready ➜ src/lib/db/generated/relations.ts 🚀
```

- [ ] **Step 7: 生成物を目視確認**

`src/lib/db/generated/schema.ts` を開き、以下をすべて確認する:
- `wavTracks`・`audioTypes`・`trackAudioTypes` の3テーブルが export されている
- `trackAudioTypes` が複合PK(`primaryKey({ columns: [table.trackId, table.audioTypeId] })`)を持つ
- `trackAudioTypes.trackId`/`audioTypeId` に `.references(() => ..., { onDelete: "cascade" })` が付いている
- `wavTracks`・`audioTypes` それぞれに `uniqueIndex("ix_wav_tracks_name"...)` / `uniqueIndex("ix_audio_types_name"...)` がある(name にも UNIQUE 制約がある点に注意)

`src/lib/db/generated/<timestamp>_<name>/migration.sql` を開き、`CREATE TABLE`/`CREATE UNIQUE INDEX` 文一式がコメントアウト(`/* ... */`)された状態で入っていることを確認する(Task 3 でこれをテスト用DB構築に使う)。

- [ ] **Step 8: コミット**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml drizzle.config.ts src/lib/db/generated
git commit -m "feat: Drizzle ORM(RC)を導入しmusic.sqlite3のスキーマを取り込む"
```

---

## Task 2: `src/lib/paths.ts` に DB/sounds 用パス関数を追加

**Files:**
- Modify: `src/lib/paths.ts`
- Test: `src/__tests__/paths.test.ts`(新規。既存の `paths.ts` にテストファイルがまだ無ければ作成。既存の場合は追記)

**Interfaces:**
- Produces: `getDbDir(): string`・`getDbPath(): string`・`getSoundsDir(): string`・`getSoundsDefaultDir(): string`・`getSoundsUserDir(): string`。Task 3(`db/client.ts`)・Task 4〜7(`track-store.ts`)が使用する。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/paths.test.ts`(新規ファイル):
```typescript
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/__tests__/paths.test.ts`
Expected: FAIL(`getDbDir` などが `@/lib/paths` からエクスポートされていない)

- [ ] **Step 3: `src/lib/paths.ts` に実装を追加**

既存の `getSettingsDir` 等の下に追記:

```typescript
// DB(music.sqlite3)ディレクトリ。SETTINGS_DIR と同じパターンで DB_DIR から解決する
// (楽曲管理機能 概要設計 2章)。開発時(devcontainer)は未設定なら cwd 直下の db/ を使う。
export function getDbDir(): string {
  const dir = process.env.DB_DIR;
  return dir && dir.length > 0 ? dir : path.join(process.cwd(), 'db');
}

export function getDbPath(): string {
  return path.join(getDbDir(), 'music.sqlite3');
}

// サウンドファイルのルート。SOUNDS_DIR から解決し、配下に default/・user/ を持つ前提
// (楽曲管理機能 概要設計 5章)。
export function getSoundsDir(): string {
  const dir = process.env.SOUNDS_DIR;
  return dir && dir.length > 0 ? dir : path.join(process.cwd(), 'sounds');
}

export function getSoundsDefaultDir(): string {
  return path.join(getSoundsDir(), 'default');
}

export function getSoundsUserDir(): string {
  return path.join(getSoundsDir(), 'user');
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/__tests__/paths.test.ts`
Expected: PASS(4件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/paths.ts src/__tests__/paths.test.ts
git commit -m "feat: DB/soundsディレクトリ解決用のパス関数を追加"
```

---

## Task 3: `src/lib/db/client.ts`(接続シングルトン)とテスト用DB構築ヘルパー

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/create-test-db.ts`
- Test: `src/lib/db/client.test.ts`

**Interfaces:**
- Consumes: `getDbPath()`(Task 2)、`src/lib/db/generated/schema.ts` の `wavTracks`・`audioTypes`・`trackAudioTypes`(Task 1)
- Produces: `getDb(): ReturnType<typeof drizzle>`・`resetDbForTests(): void`(`src/lib/db/client.ts`)。`createTestDb(dbFilePath: string): void`(`src/lib/db/create-test-db.ts`)。Task 4 以降のすべてのテストがこの2つを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/db/client.test.ts`(新規。`@vitest-environment node` が必要):
```typescript
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/lib/db/client.test.ts`
Expected: FAIL(`./create-test-db` と `./client` が存在しない)

- [ ] **Step 3: `src/lib/db/create-test-db.ts` を実装**

```typescript
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const GENERATED_DIR = path.join(process.cwd(), 'src/lib/db/generated');

// drizzle-kit pull は CREATE TABLE 一式を drizzle/<timestamp>_<name>/migration.sql に
// コメントアウト(/* ... */)した状態で出力する(誤って再適用されるのを防ぐデフォルト挙動)。
// pull を再実行するたびにフォルダ名(タイムスタンプ+ランダム語)が変わるため、都度探索する。
function findMigrationSqlPath(): string {
  const entries = readdirSync(GENERATED_DIR, { recursive: true }) as string[];
  const match = entries.find((entry) => entry.endsWith('migration.sql'));
  if (!match) {
    throw new Error(
      `migration.sql が ${GENERATED_DIR} 配下に見つからない。先に \`pnpm db:pull\` を実行すること。`,
    );
  }
  return path.join(GENERATED_DIR, match);
}

function extractStatements(rawSql: string): string[] {
  const uncommented = rawSql
    .split('\n')
    .filter((line) => !line.startsWith('--') || line.includes('statement-breakpoint'))
    .filter((line) => line.trim() !== '/*' && line.trim() !== '*/')
    .join('\n');

  return uncommented
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

// テスト用に、drizzle-kit pull が生成した migration.sql から空の SQLite ファイルを構築する。
// 手動でコピーしたフィクスチャを持たないため、schema.ts と常に同じ内容になる
// (楽曲管理機能 概要設計 6章)。
export function createTestDb(dbFilePath: string): void {
  const rawSql = readFileSync(findMigrationSqlPath(), 'utf-8');
  const statements = extractStatements(rawSql);

  const db = new DatabaseSync(dbFilePath);
  try {
    for (const statement of statements) {
      db.exec(statement);
    }
  } finally {
    db.close();
  }
}
```

- [ ] **Step 4: `src/lib/db/client.ts` を実装**

```typescript
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { getDbPath } from '../paths';

type Db = ReturnType<typeof drizzle>;

let dbInstance: Db | undefined;

// 接続はモジュールスコープのシングルトンで使い回す(schedule-store.ts と同じ方針)。
// PRAGMA は接続ごとに効くため、生成のたびに必ず発行する。
//  - journal_mode=WAL: Python 側の cron と同じ music.sqlite3 に同時アクセスするため必須
//  - foreign_keys=ON: SQLite は接続ごとにデフォルト無効。無いと track_audio_types の
//    ON DELETE CASCADE が効かない
export function getDb(): Db {
  if (!dbInstance) {
    const sqlite = new DatabaseSync(getDbPath());
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    dbInstance = drizzle({ client: sqlite });
  }
  return dbInstance;
}

// テストで DB_DIR を切り替えた後にシングルトンを作り直すためのリセット関数
// (validator.ts の resetValidatorCache と同じ役割)。
export function resetDbForTests(): void {
  dbInstance = undefined;
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `pnpm exec vitest run src/lib/db/client.test.ts`
Expected: PASS(2件)

- [ ] **Step 6: コミット**

```bash
git add src/lib/db/client.ts src/lib/db/create-test-db.ts src/lib/db/client.test.ts
git commit -m "feat: Drizzle接続シングルトンとテスト用DB構築ヘルパーを実装"
```

---

## Task 4: `src/lib/track-store.ts` — `listTracks`/`listAudioTypes`

**Files:**
- Create: `src/lib/track-store.ts`
- Test: `src/lib/track-store.test.ts`

**Interfaces:**
- Consumes: `getDb()`(Task 3)、`getSoundsDefaultDir()`/`getSoundsUserDir()`(Task 2)、`wavTracks`・`audioTypes`・`trackAudioTypes`(Task 1)
- Produces: `TrackAudioTypeSummary { id: number; name: string }`・`TrackRecord { id: number; name: string; filePath: string; origin: 'default' | 'user'; audioTypes: TrackAudioTypeSummary[] }`・`listTracks(): TrackRecord[]`・`listAudioTypes(): TrackAudioTypeSummary[]`。Task 5〜10 がこれらの型・関数を使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/track-store.test.ts`(新規。`@vitest-environment node`):
```typescript
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: FAIL(`./track-store` が存在しない)

- [ ] **Step 3: 最小実装**

`src/lib/track-store.ts`(新規。以降のタスクで追記していく):
```typescript
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: PASS(3件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/track-store.ts src/lib/track-store.test.ts
git commit -m "feat: track-store に listTracks/listAudioTypes を実装"
```

---

## Task 5: `track-store.ts` — `createTrackFromUpload`

**Files:**
- Modify: `src/lib/track-store.ts`
- Modify: `src/lib/track-store.test.ts`

**Interfaces:**
- Consumes: `groupJoinedRows`・`selectJoined`(Task 4 内部関数。同ファイル内なのでそのまま使える)
- Produces: `CreateTrackInput { fileName: string; fileBuffer: Buffer; audioTypeIds: number[] }`・`createTrackFromUpload(input: CreateTrackInput): Promise<TrackRecord>`・エラークラス `InvalidFileNameError`・`TrackConflictError`・`InvalidAudioTypeError`・`TrackNotFoundError`(`TrackNotFoundError` は Task 6 でも使う)。Task 9(`POST /api/tracks`)が `createTrackFromUpload` を使う。

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/track-store.test.ts` の末尾に追記:
```typescript
import { readFile } from 'node:fs/promises';
import {
  createTrackFromUpload,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
} from './track-store';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: FAIL(`createTrackFromUpload`・`InvalidFileNameError`・`TrackConflictError`・`InvalidAudioTypeError` が存在しない)

- [ ] **Step 3: 実装を追記**

`src/lib/track-store.ts` の先頭 import に追加:
```typescript
import { writeFile, unlink } from 'node:fs/promises';
```

ファイル末尾に追記:
```typescript
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/track-store.ts src/lib/track-store.test.ts
git commit -m "feat: track-store に createTrackFromUpload を実装"
```

---

## Task 6: `track-store.ts` — `updateTrack`

**Files:**
- Modify: `src/lib/track-store.ts`
- Modify: `src/lib/track-store.test.ts`

**Interfaces:**
- Consumes: `TrackNotFoundError`・`DefaultTrackForbiddenError`・`TrackConflictError`・`InvalidAudioTypeError`・`mapDbError`・`getTrackByIdOrThrow`・`nowSqliteTimestamp`(Task 5)
- Produces: `UpdateTrackInput { name: string; audioTypeIds: number[] }`・`updateTrack(id: number, input: UpdateTrackInput): TrackRecord`。Task 10(`PATCH /api/tracks/:id`)が使う。

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/track-store.test.ts` 末尾に追記:
```typescript
import { updateTrack, DefaultTrackForbiddenError, TrackNotFoundError } from './track-store';

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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: FAIL(`updateTrack`・`DefaultTrackForbiddenError` が存在しない。`DefaultTrackForbiddenError` は Task 5 で既に定義済みなので `updateTrack` 未定義分のみ FAIL するはず)

- [ ] **Step 3: 実装を追記**

`src/lib/track-store.ts` 末尾に追記:
```typescript
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/track-store.ts src/lib/track-store.test.ts
git commit -m "feat: track-store に updateTrack を実装"
```

---

## Task 7: `track-store.ts` — `deleteTrack`

**Files:**
- Modify: `src/lib/track-store.ts`
- Modify: `src/lib/track-store.test.ts`

**Interfaces:**
- Consumes: `TrackNotFoundError`・`DefaultTrackForbiddenError`(Task 5)
- Produces: `deleteTrack(id: number): Promise<void>`。Task 10(`DELETE /api/tracks/:id`)が使う。

- [ ] **Step 1: 失敗するテストを追記**

`src/lib/track-store.test.ts` 末尾に追記:
```typescript
import { deleteTrack } from './track-store';
import { access } from 'node:fs/promises';

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
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: FAIL(`deleteTrack` が存在しない)

- [ ] **Step 3: 実装を追記**

`src/lib/track-store.ts` の先頭 import に `unlink` は既に Task 5 で追加済み。末尾に追記:
```typescript
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/track-store.ts src/lib/track-store.test.ts
git commit -m "feat: track-store に deleteTrack を実装"
```

---

## Task 8: `GET /api/audio-types`

**Files:**
- Create: `src/app/api/audio-types/route.ts`
- Create: `src/app/api/audio-types/route.test.ts`

**Interfaces:**
- Consumes: `listAudioTypes()`(Task 4)
- Produces: `GET` ハンドラ。レスポンス形式 `{ audioTypes: TrackAudioTypeSummary[] }`

- [ ] **Step 1: 失敗するテストを書く**

`src/app/api/audio-types/route.test.ts`(新規):
```typescript
// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import { listAudioTypes } from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, listAudioTypes: vi.fn() };
});

const mockList = listAudioTypes as unknown as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/audio-types', () => {
  it('200 で一覧を返す', async () => {
    mockList.mockReturnValue([
      { id: 1, name: 'DEFAULT' },
      { id: 2, name: 'NOTIFICATION' },
    ]);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          audioTypes: [
            { id: 1, name: 'DEFAULT' },
            { id: 2, name: 'NOTIFICATION' },
          ],
        });
      },
    });
  });

  it('DB I/O失敗なら500 io_error', async () => {
    mockList.mockImplementation(() => {
      throw new Error('disk gone');
    });
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'io_error' });
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/app/api/audio-types/route.test.ts`
Expected: FAIL(`./route` が存在しない)

- [ ] **Step 3: 実装**

`src/app/api/audio-types/route.ts`(新規):
```typescript
import { NextResponse } from 'next/server';
import { listAudioTypes } from '@/lib/track-store';

// DB I/O を行うため Node.js ランタイムで動かす。都度最新値を返すためキャッシュしない。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/audio-types
// audio_types 一覧を返す(読み取り専用。楽曲管理機能 概要設計 3章)。
export async function GET(): Promise<NextResponse> {
  try {
    const audioTypes = listAudioTypes();
    return NextResponse.json({ audioTypes });
  } catch {
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/app/api/audio-types/route.test.ts`
Expected: PASS(2件)

- [ ] **Step 5: コミット**

```bash
git add src/app/api/audio-types/route.ts src/app/api/audio-types/route.test.ts
git commit -m "feat: GET /api/audio-types を実装"
```

---

## Task 9: `GET`/`POST /api/tracks`

**Files:**
- Create: `src/app/api/tracks/route.ts`
- Create: `src/app/api/tracks/route.test.ts`

**Interfaces:**
- Consumes: `listTracks()`(Task 4)、`createTrackFromUpload()`・`InvalidFileNameError`・`TrackConflictError`・`InvalidAudioTypeError`(Task 5)
- Produces: `GET`/`POST` ハンドラ。`GET` は `{ tracks: TrackRecord[] }`、`POST` 成功時は `{ track: TrackRecord }` を 201 で返す。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/api/tracks/route.test.ts`(新規):
```typescript
// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import {
  listTracks,
  createTrackFromUpload,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, listTracks: vi.fn(), createTrackFromUpload: vi.fn() };
});

const mockList = listTracks as unknown as Mock;
const mockCreate = createTrackFromUpload as unknown as Mock;

const track = {
  id: 1,
  name: 'chime',
  filePath: '/data/sounds/user/chime.wav',
  origin: 'user' as const,
  audioTypes: [{ id: 1, name: 'DEFAULT' }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/tracks', () => {
  it('200 で一覧を返す', async () => {
    mockList.mockReturnValue([track]);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ tracks: [track] });
      },
    });
  });

  it('I/O失敗なら500 io_error', async () => {
    mockList.mockImplementation(() => {
      throw new Error('disk gone');
    });
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'io_error' });
      },
    });
  });
});

function buildForm(opts: { fileName?: string; contentType?: string; audioTypeIds?: string } = {}): FormData {
  const form = new FormData();
  const file = new File(['dummy'], opts.fileName ?? 'chime.wav', {
    type: opts.contentType ?? 'audio/wav',
  });
  form.set('file', file);
  if (opts.audioTypeIds !== undefined) form.set('audioTypeIds', opts.audioTypeIds);
  return form;
}

describe('POST /api/tracks', () => {
  it('201でアップロード結果を返す', async () => {
    mockCreate.mockResolvedValue(track);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm({ audioTypeIds: '[1]' }) });
        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ track });
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ fileName: 'chime.wav', audioTypeIds: [1] }),
        );
      },
    });
  });

  it('.wav以外の拡張子は400 invalid_extension', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm({ fileName: 'chime.mp3' }) });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_extension' });
        expect(mockCreate).not.toHaveBeenCalled();
      },
    });
  });

  it('10MB超は413 file_too_large', async () => {
    const bigForm = new FormData();
    const bigFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.wav', { type: 'audio/wav' });
    bigForm.set('file', bigFile);
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: bigForm });
        expect(res.status).toBe(413);
        expect(await res.json()).toEqual({ error: 'file_too_large' });
        expect(mockCreate).not.toHaveBeenCalled();
      },
    });
  });

  it('fileフィールドが無いと400 file_missing', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: new FormData() });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'file_missing' });
      },
    });
  });

  it('InvalidFileNameErrorは400 invalid_file_name', async () => {
    mockCreate.mockRejectedValue(new InvalidFileNameError('../x.wav'));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm() });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_file_name' });
      },
    });
  });

  it('TrackConflictErrorは409 conflict', async () => {
    mockCreate.mockRejectedValue(new TrackConflictError('name'));
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm() });
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'conflict', field: 'name' });
      },
    });
  });

  it('InvalidAudioTypeErrorは400 invalid_audio_type_ids', async () => {
    mockCreate.mockRejectedValue(new InvalidAudioTypeError());
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST', body: buildForm({ audioTypeIds: '[999]' }) });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_audio_type_ids' });
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run src/app/api/tracks/route.test.ts`
Expected: FAIL(`./route` が存在しない)

- [ ] **Step 3: 実装**

`src/app/api/tracks/route.ts`(新規):
```typescript
import { NextResponse } from 'next/server';
import {
  listTracks,
  createTrackFromUpload,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

// ファイル I/O・DB I/O を行うため Node.js ランタイムで動かす。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB(楽曲管理機能 概要設計 3章)

// GET /api/tracks
export async function GET(): Promise<NextResponse> {
  try {
    const tracks = listTracks();
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}

function parseAudioTypeIds(raw: FormDataEntryValue | null): number[] | 'invalid' {
  if (raw === null) return [];
  if (typeof raw !== 'string') return 'invalid';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'invalid';
  }
  if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === 'number')) {
    return 'invalid';
  }
  return parsed;
}

// POST /api/tracks
// multipart/form-data でファイル本体を受け取り、sounds/user/ へ保存 + wav_tracks へ INSERT する
// (楽曲管理機能 概要設計 3章)。
export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_missing' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.wav')) {
    return NextResponse.json({ error: 'invalid_extension' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 413 });
  }

  const audioTypeIds = parseAudioTypeIds(form.get('audioTypeIds'));
  if (audioTypeIds === 'invalid') {
    return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const track = await createTrackFromUpload({ fileName: file.name, fileBuffer, audioTypeIds });
    return NextResponse.json({ track }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidFileNameError) {
      return NextResponse.json({ error: 'invalid_file_name' }, { status: 400 });
    }
    if (err instanceof TrackConflictError) {
      return NextResponse.json({ error: 'conflict', field: err.field }, { status: 409 });
    }
    if (err instanceof InvalidAudioTypeError) {
      return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run src/app/api/tracks/route.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/app/api/tracks/route.ts src/app/api/tracks/route.test.ts
git commit -m "feat: GET/POST /api/tracks を実装"
```

---

## Task 10: `PATCH`/`DELETE /api/tracks/:id`

**Files:**
- Create: `src/app/api/tracks/[id]/route.ts`
- Create: `src/app/api/tracks/[id]/route.test.ts`

**Interfaces:**
- Consumes: `updateTrack()`(Task 6)、`deleteTrack()`(Task 7)、`TrackNotFoundError`・`DefaultTrackForbiddenError`・`TrackConflictError`・`InvalidAudioTypeError`(Task 5・6)
- Produces: `PATCH`/`DELETE` ハンドラ。`PATCH` 成功時は `{ track: TrackRecord }`、`DELETE` 成功時は 204。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/api/tracks/[id]/route.test.ts`(新規):
```typescript
// @vitest-environment node
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import {
  updateTrack,
  deleteTrack,
  TrackNotFoundError,
  DefaultTrackForbiddenError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, updateTrack: vi.fn(), deleteTrack: vi.fn() };
});

const mockUpdate = updateTrack as unknown as Mock;
const mockDelete = deleteTrack as unknown as Mock;

const track = {
  id: 1,
  name: 'renamed',
  filePath: '/data/sounds/user/renamed.wav',
  origin: 'user' as const,
  audioTypes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PATCH /api/tracks/:id', () => {
  it('200で更新結果を返す', async () => {
    mockUpdate.mockReturnValue(track);
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'renamed', audioTypeIds: [] }),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ track });
        expect(mockUpdate).toHaveBeenCalledWith(1, { name: 'renamed', audioTypeIds: [] });
      },
    });
  });

  it('idが数値でなければ400 invalid_id', async () => {
    await testApiHandler({
      appHandler,
      params: { id: 'abc' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_id' });
      },
    });
  });

  it('TrackNotFoundErrorは404 not_found', async () => {
    mockUpdate.mockImplementation(() => {
      throw new TrackNotFoundError(1);
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      },
    });
  });

  it('DefaultTrackForbiddenErrorは403 forbidden', async () => {
    mockUpdate.mockImplementation(() => {
      throw new DefaultTrackForbiddenError(1);
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'forbidden' });
      },
    });
  });

  it('TrackConflictErrorは409 conflict', async () => {
    mockUpdate.mockImplementation(() => {
      throw new TrackConflictError('name');
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [] }),
        });
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: 'conflict', field: 'name' });
      },
    });
  });

  it('InvalidAudioTypeErrorは400 invalid_audio_type_ids', async () => {
    mockUpdate.mockImplementation(() => {
      throw new InvalidAudioTypeError();
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'x', audioTypeIds: [999] }),
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_audio_type_ids' });
      },
    });
  });
});

describe('DELETE /api/tracks/:id', () => {
  it('204で削除する', async () => {
    mockDelete.mockResolvedValue(undefined);
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(204);
        expect(mockDelete).toHaveBeenCalledWith(1);
      },
    });
  });

  it('TrackNotFoundErrorは404 not_found', async () => {
    mockDelete.mockRejectedValue(new TrackNotFoundError(1));
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      },
    });
  });

  it('DefaultTrackForbiddenErrorは403 forbidden', async () => {
    mockDelete.mockRejectedValue(new DefaultTrackForbiddenError(1));
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'DELETE' });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: 'forbidden' });
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `pnpm exec vitest run "src/app/api/tracks/[id]/route.test.ts"`
Expected: FAIL(`./route` が存在しない)

- [ ] **Step 3: 実装**

`src/app/api/tracks/[id]/route.ts`(新規):
```typescript
import { NextResponse } from 'next/server';
import {
  updateTrack,
  deleteTrack,
  TrackNotFoundError,
  DefaultTrackForbiddenError,
  TrackConflictError,
  InvalidAudioTypeError,
} from '@/lib/track-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

// PATCH /api/tracks/:id
// { name, audioTypeIds } を受け取り、名前と音声タイプ割り当てを全置換する
// (楽曲管理機能 概要設計 3章)。
export async function PATCH(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, audioTypeIds } = (body ?? {}) as { name?: unknown; audioTypeIds?: unknown };
  if (typeof name !== 'string' || name.length === 0) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (!Array.isArray(audioTypeIds) || !audioTypeIds.every((v) => typeof v === 'number')) {
    return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
  }

  try {
    const track = updateTrack(id, { name, audioTypeIds });
    return NextResponse.json({ track });
  } catch (err) {
    if (err instanceof TrackNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof DefaultTrackForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof TrackConflictError) {
      return NextResponse.json({ error: 'conflict', field: err.field }, { status: 409 });
    }
    if (err instanceof InvalidAudioTypeError) {
      return NextResponse.json({ error: 'invalid_audio_type_ids' }, { status: 400 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}

// DELETE /api/tracks/:id
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    await deleteTrack(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof TrackNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof DefaultTrackForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `pnpm exec vitest run "src/app/api/tracks/[id]/route.test.ts"`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add "src/app/api/tracks/[id]/route.ts" "src/app/api/tracks/[id]/route.test.ts"
git commit -m "feat: PATCH/DELETE /api/tracks/:id を実装"
```

---

## Task 11: デプロイ構成の更新と最終確認

**Files:**
- Modify: `deploy/docker-compose.yaml`

**Interfaces:**
- Consumes: なし(既存の `docker-compose.yaml` への追記のみ)

- [ ] **Step 1: `deploy/docker-compose.yaml` に `db`・`sounds` volume を追加**

```yaml
services:
  schedule-ui:
    build:
      context: ..
      dockerfile: deploy/Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - settings:/data/settings
      - db:/data/db
      - sounds:/data/sounds
    environment:
      - SETTINGS_DIR=/data/settings
      - DB_DIR=/data/db
      - SOUNDS_DIR=/data/sounds
    restart: unless-stopped

volumes:
  settings:
    external: true
  db:
    external: true
  sounds:
    external: true
```

- [ ] **Step 2: Docker ビルドで依存解決を確認(実機のみ・任意)**

Run: `docker compose -f deploy/docker-compose.yaml build`
Expected: `better-sqlite3`・`esbuild` の postinstall がエラーにならず完了する(Task 1 で `allowBuilds` を追加済みのため成功するはず)。

- [ ] **Step 3: 型チェック**

Run: `pnpm exec tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: 全体テスト実行**

Run: `pnpm test`
Expected: 既存テスト(schedules 関連)+ 本計画で追加したテストがすべて PASS

- [ ] **Step 5: コミット**

```bash
git add deploy/docker-compose.yaml
git commit -m "feat: db/soundsのnamed volumeをdocker-composeに追加"
```

---

## Self-Review Notes

- **Spec coverage**: 概要設計書の全節(1章 スコープ、2章 データ層、3章 API設計、5章 デプロイ構成)に対応するタスクを用意した。4章(画面)・E2Eは計画の範囲外(冒頭に明記)。
- **Placeholder scan**: 全ステップに具体的なコード・コマンド・期待値を記載。「適切にエラー処理する」等の曖昧な指示は無し。
- **Type consistency**: `TrackRecord`・`TrackAudioTypeSummary`・各エラークラス名は Task 4〜10 を通して同一のものを使い回している(Task 4 で定義 → Task 5・6・7 で追加定義 → Task 8・9・10 で import して使用)。
