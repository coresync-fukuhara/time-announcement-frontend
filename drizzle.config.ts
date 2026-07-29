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
