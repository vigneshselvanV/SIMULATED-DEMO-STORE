/**
 * api/index.js
 * Vercel Serverless Function entry point for ShopSphere Backend API.
 * Handles serverless cold-start database setup, migrations, and seeds into writable /tmp.
 */

import app from '../backend/src/app.js';
import { initializeDatabase } from '../backend/src/db/initDb.js';
import { seedDatabase } from '../backend/src/db/seed.js';
import { keyManager } from '../backend/src/agents/llm/keyManager.js';
import db from '../backend/src/config/db.js';

let isInitialized = false;

export function ensureReady() {
  if (isInitialized) return;
  try {
    // Run schema migrations
    initializeDatabase();

    // Verify if products table has seed records
    const productCount = db.prepare('SELECT count(*) as count FROM products').get()?.count || 0;
    if (productCount === 0) {
      console.log('[Vercel Serverless] Products table empty, executing seed...');
      seedDatabase();
    }

    // Validate LLM environment configurations
    keyManager.validateStartupEnv();
  } catch (err) {
    console.error('[Vercel Serverless Init Error]:', err.message);
  }
  isInitialized = true;
}

// Cold start initial trigger
try {
  ensureReady();
} catch (e) {
  console.warn('[Vercel Cold Start Trigger Warning]:', e.message);
}

/**
 * Standard Vercel Serverless Function Handler
 */
export default async function handler(req, res) {
  ensureReady();
  return app(req, res);
}

export { app };
