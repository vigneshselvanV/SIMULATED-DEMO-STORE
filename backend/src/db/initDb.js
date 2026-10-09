import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { runMigrations } from './migrationRunner.js';

export function initializeDatabase() {
  const result = runMigrations(db);
  console.log(`Database initialized via migrations (Total: ${result.total}, Applied: ${result.applied}, Skipped: ${result.skipped}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    initializeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}
