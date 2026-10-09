import app from './src/app.js';
import { initializeDatabase } from './src/db/initDb.js';
import { seedDatabase } from './src/db/seed.js';
import { keyManager } from './src/agents/llm/keyManager.js';
import db from './src/config/db.js';

let isInitialized = false;

export function ensureReady() {
  if (isInitialized) return;
  try {
    initializeDatabase();
    const productCount = db.prepare('SELECT count(*) as count FROM products').get()?.count || 0;
    if (productCount === 0) {
      seedDatabase();
    }
    keyManager.validateStartupEnv();
  } catch (err) {
    console.error('[Backend Init Error]:', err.message);
  }
  isInitialized = true;
}

ensureReady();

export default function handler(req, res) {
  ensureReady();
  return app(req, res);
}

export { app };
