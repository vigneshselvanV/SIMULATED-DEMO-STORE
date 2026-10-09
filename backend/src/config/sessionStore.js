import session from 'express-session';
import db from './db.js';

export class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.db = options.db || db;
    this.tableName = options.tableName || 'sessions';
    this.cleanupIntervalMs = options.cleanupIntervalMs || 15 * 60 * 1000;

    // Prepared statements for high concurrency
    this.getStmt = this.db.prepare(`SELECT sess FROM ${this.tableName} WHERE sid = ? AND expired > ?`);
    this.setStmt = this.db.prepare(`
      INSERT INTO ${this.tableName} (sid, sess, expired)
      VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expired = excluded.expired
    `);
    this.destroyStmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE sid = ?`);
    this.touchStmt = this.db.prepare(`UPDATE ${this.tableName} SET expired = ? WHERE sid = ?`);
    this.cleanStmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE expired <= ?`);

    // Clean expired records periodically
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), this.cleanupIntervalMs);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  get(sid, callback) {
    try {
      const now = Date.now();
      const row = this.getStmt.get(sid, now);
      if (!row) {
        return callback(null, null);
      }
      const sess = JSON.parse(row.sess);
      return callback(null, sess);
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie?.maxAge || 24 * 60 * 60 * 1000;
      const expired = Date.now() + maxAge;
      const sessStr = JSON.stringify(sessionData);
      this.setStmt.run(sid, sessStr, expired);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.destroyStmt.run(sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  touch(sid, sessionData, callback) {
    try {
      const maxAge = sessionData.cookie?.maxAge || 24 * 60 * 60 * 1000;
      const expired = Date.now() + maxAge;
      this.touchStmt.run(expired, sid);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
    }
  }

  cleanupExpired() {
    try {
      this.cleanStmt.run(Date.now());
    } catch (e) {
      // Silently ignore cleanup errors
    }
  }
}

export default SqliteSessionStore;
