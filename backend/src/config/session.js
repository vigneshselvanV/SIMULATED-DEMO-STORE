import session from 'express-session';
import dotenv from 'dotenv';
import { SqliteSessionStore } from './sessionStore.js';
import db from './db.js';

dotenv.config();

export const FALLBACK_SESSION_SECRET = 'shopsphere_secure_fallback_secret_key_2026';

export function validateSessionSecret(secret, env = process.env.NODE_ENV) {
  if (env === 'production') {
    if (!secret || typeof secret !== 'string' || secret.trim() === '' || secret === FALLBACK_SESSION_SECRET) {
      if (process.env.VERCEL) {
        console.warn(
          '⚠️ [Session Warning] SESSION_SECRET is not set in Vercel. Using fallback secret. Please set SESSION_SECRET in Vercel Project Settings for production hardening.'
        );
        return;
      }
      throw new Error(
        'CRITICAL SECURITY ERROR: SESSION_SECRET must be configured with a strong, non-default secret in production environment.'
      );
    }
  }
}

// Perform validation on startup
validateSessionSecret(process.env.SESSION_SECRET);

const isProduction = process.env.NODE_ENV === 'production';
export const sessionStore = new SqliteSessionStore({ db });

export const sessionMiddleware = session({
  name: 'shopsphere.sid',
  secret: process.env.SESSION_SECRET || FALLBACK_SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction || Boolean(process.env.VERCEL),
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

export default sessionMiddleware;

