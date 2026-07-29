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
    // 実DB(db/music.sqlite3)の wav_tracks は file_path に対する inline な
    // `UNIQUE (file_path)` テーブルレベル制約を持つ(PRAGMA index_list('wav_tracks') で
    // 確認すると sqlite_autoindex_wav_tracks_1 という暗黙のインデックスとして現れる)。
    // drizzle-kit pull はこの SQLite 側が自動生成する暗黙のインデックスを
    // schema.ts / migration.sql に出力しないため、上記の migration.sql から
    // 組み立てたテストDBにはこの制約が欠落してしまう。track-store.ts の mapDbError()
    // は file_path の UNIQUE 制約違反を TrackConflictError('file_path') に変換するが、
    // その分岐がテストで一切踏まれなくなるのを防ぐため、ここで明示的に同等の
    // UNIQUE インデックスを追加して本番DBと振る舞いを一致させる。
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_test_wav_tracks_file_path ON wav_tracks(file_path);');
  } finally {
    db.close();
  }
}
