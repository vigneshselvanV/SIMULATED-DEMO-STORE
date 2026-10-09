import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPath;

if (process.env.DATABASE_PATH) {
  dbPath = path.resolve(__dirname, '../../', process.env.DATABASE_PATH);
} else if (process.env.VERCEL) {
  // In Vercel serverless functions, only /tmp is writable
  const tmpDir = '/tmp';
  dbPath = path.join(tmpDir, 'shopsphere.db');

  // Copy bundled pre-seeded database if /tmp/shopsphere.db does not exist yet
  const bundledDbPath = path.resolve(__dirname, '../db/shopsphere.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(bundledDbPath) && fs.statSync(bundledDbPath).size > 0) {
    try {
      fs.copyFileSync(bundledDbPath, dbPath);
      console.log('[Vercel DB] Successfully initialized /tmp/shopsphere.db from bundled database.');
    } catch (copyErr) {
      console.warn('[Vercel DB] Could not copy bundled database to /tmp, will initialize fresh:', copyErr.message);
    }
  }
} else {
  dbPath = path.resolve(__dirname, '../db/shopsphere.db');
}

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode or fallback, set busy timeout, and enable foreign keys
try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  try {
    db.pragma('journal_mode = DELETE');
  } catch (_) {}
}
db.pragma('busy_timeout = 10000');
db.pragma('foreign_keys = ON');

export default db;
