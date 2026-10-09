import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, SessionClient } from './testHelper.js';
import db from '../src/config/db.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { auditLogger } from '../src/services/auditLogger.js';
import { validateSessionSecret, FALLBACK_SESSION_SECRET } from '../src/config/session.js';
import { SqliteSessionStore } from '../src/config/sessionStore.js';

describe('Phase 0: Prerequisite Fixes & Security Hardening', () => {
  let appInstance;
  let client;
  let customerEmail = `p0_test_${Date.now()}@example.com`;

  before(async () => {
    appInstance = await createTestApp();
    client = new SessionClient(appInstance.baseUrl);
  });

  after(async () => {
    try {
      db.prepare(`
        DELETE FROM orders WHERE user_id IN (
          SELECT id FROM users WHERE email = ?
        )
      `).run(customerEmail);
      db.prepare('DELETE FROM users WHERE email = ?').run(customerEmail);
    } catch (e) {
      // ignore
    }
    await appInstance.close();
  });

  test('Migration Runner tracks applied migrations and is idempotent', () => {
    const result = runMigrations(db);
    assert.ok(result.total >= 3, 'Should have at least 3 migrations');
    assert.equal(result.applied, 0, 'Re-running should apply 0 new migrations');
    assert.equal(result.skipped, result.total, 'All migrations should be skipped as already applied');

    const applied = db.prepare('SELECT count(*) as count FROM migrations').get().count;
    assert.ok(applied >= 3, 'Database should record applied migrations');
  });

  test('SqliteSessionStore persists sessions to SQLite table', async () => {
    const store = new SqliteSessionStore({ db });
    const testSid = `test_session_${Date.now()}`;
    const testData = { userId: 42, role: 'customer', cookie: { maxAge: 3600000 } };

    // Set session
    await new Promise((resolve, reject) => {
      store.set(testSid, testData, (err) => (err ? reject(err) : resolve()));
    });

    // Verify row exists directly in database table
    const row = db.prepare('SELECT sid, sess FROM sessions WHERE sid = ?').get(testSid);
    assert.ok(row, 'Session row must exist in SQLite sessions table');
    const parsed = JSON.parse(row.sess);
    assert.equal(parsed.userId, 42);

    // Retrieve via store
    const retrieved = await new Promise((resolve, reject) => {
      store.get(testSid, (err, sess) => (err ? reject(err) : resolve(sess)));
    });
    assert.equal(retrieved.userId, 42);

    // Destroy session
    await new Promise((resolve, reject) => {
      store.destroy(testSid, (err) => (err ? reject(err) : resolve()));
    });

    const deletedRow = db.prepare('SELECT sid FROM sessions WHERE sid = ?').get(testSid);
    assert.equal(deletedRow, undefined, 'Session should be deleted after destroy');
  });

  test('Production SESSION_SECRET validator refuses empty or fallback secret', () => {
    // Should throw if fallback secret used in production
    assert.throws(
      () => validateSessionSecret(FALLBACK_SESSION_SECRET, 'production'),
      /CRITICAL SECURITY ERROR/
    );

    // Should throw if empty or unset
    assert.throws(
      () => validateSessionSecret('', 'production'),
      /CRITICAL SECURITY ERROR/
    );

    // Should succeed with a strong unique production secret
    assert.doesNotThrow(() => {
      validateSessionSecret('a_very_strong_production_secret_key_123456789!', 'production');
    });

    // In development mode, fallback secret should be accepted without throwing
    assert.doesNotThrow(() => {
      validateSessionSecret(FALLBACK_SESSION_SECRET, 'development');
    });
  });

  test('Registration rotates session and sets user context', async () => {
    const res = await client.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Phase0 User',
        email: customerEmail,
        password: 'Password@123'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, customerEmail);

    // Verify authenticated session
    const meRes = await client.request('/api/auth/me');
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.authenticated, true);
    assert.equal(meRes.body.user.email, customerEmail);
  });

  test('Checkout Idempotency: duplicate submission does not double-decrement stock or duplicate orders', async () => {
    const sampleProduct = db.prepare('SELECT * FROM products WHERE stock_quantity >= 5 LIMIT 1').get();
    const initialStock = sampleProduct.stock_quantity;

    // Add 1 item to cart
    const addRes = await client.request('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId: sampleProduct.id, quantity: 1 })
    });
    assert.equal(addRes.status, 200);

    const idempotencyKey = `idemp_test_${Date.now()}`;
    const checkoutPayload = {
      customerName: 'Phase0 User',
      customerEmail: customerEmail,
      customerPhone: '+91 98765 43210',
      shippingAddress: '42 Security Blvd',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      idempotencyKey
    };

    // First checkout call
    const firstRes = await client.request('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutPayload)
    });
    assert.equal(firstRes.status, 201);
    assert.equal(firstRes.body.success, true);
    const orderNumber1 = firstRes.body.data.order_number;

    // Stock should be decremented by 1
    const stockAfterFirst = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(sampleProduct.id).stock_quantity;
    assert.equal(stockAfterFirst, initialStock - 1);

    // Second checkout call with EXACT same idempotency key
    const secondRes = await client.request('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify(checkoutPayload)
    });
    assert.equal(secondRes.status, 201);
    assert.equal(secondRes.body.success, true);
    assert.equal(secondRes.body.data.order_number, orderNumber1);
    assert.equal(secondRes.body.idempotentReplay, true, 'Should flag response as idempotent replay');

    // Verify stock was NOT decremented again!
    const stockAfterSecond = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(sampleProduct.id).stock_quantity;
    assert.equal(stockAfterSecond, stockAfterFirst, 'Stock must not be decremented on idempotent replay');

    // Verify only ONE order exists for this orderNumber
    const orderCount = db.prepare('SELECT count(*) as count FROM orders WHERE order_number = ?').get(orderNumber1).count;
    assert.equal(orderCount, 1, 'Only 1 order record must exist');
  });

  test('AuditLogger appends logs and enforces engine-level immutability', () => {
    const entry = auditLogger.log({
      actorType: 'customer',
      actorId: '123',
      action: 'SECURITY_AUDIT_TEST',
      entityType: 'TEST',
      entityId: '999',
      beforeState: { password: 'secret_password_here', status: 'before' },
      afterState: { status: 'after' },
      metadata: { apiKey: 'secret_api_key_here', note: 'safe note' }
    });

    assert.ok(entry.id > 0);

    // Verify data sanitization
    const fetched = auditLogger.getById(entry.id);
    assert.ok(fetched);
    assert.match(fetched.before_state, /\[REDACTED\]/, 'Passwords must be redacted in audit logs');
    assert.match(fetched.metadata, /\[REDACTED\]/, 'API keys must be redacted in audit logs');

    // Verify append-only engine level protection: UPDATE should throw SqliteError
    assert.throws(() => {
      db.prepare('UPDATE audit_logs SET action = ? WHERE id = ?').run('TAMPERED_ACTION', entry.id);
    }, /Audit log records are immutable/);

    // Verify append-only engine level protection: DELETE should throw SqliteError
    assert.throws(() => {
      db.prepare('DELETE FROM audit_logs WHERE id = ?').run(entry.id);
    }, /Audit log records are append-only/);
  });
});
