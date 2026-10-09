import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(dbInstance = db) {
  const migrationsDir = path.join(__dirname, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Ensure migrations tracking table exists
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    const existing = dbInstance.prepare('SELECT id FROM migrations WHERE name = ?').get(file);
    if (existing) {
      skippedCount++;
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const applyMigration = dbInstance.transaction(() => {
      dbInstance.exec(sql);
      dbInstance.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    });

    applyMigration();
    appliedCount++;
    console.log(`[Migrations] Successfully applied: ${file}`);
  }

  return { total: files.length, applied: appliedCount, skipped: skippedCount };
}

if (process.argv[1] && process.argv[1].endsWith('migrationRunner.js')) {
  try {
    const result = runMigrations();
    console.log(`[Migrations] Done. Total: ${result.total}, Applied: ${result.applied}, Skipped: ${result.skipped}`);
    process.exit(0);
  } catch (err) {
    console.error('[Migrations] Migration failed:', err);
    process.exit(1);
  }
}

export default runMigrations;
