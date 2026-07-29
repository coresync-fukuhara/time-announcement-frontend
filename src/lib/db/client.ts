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
