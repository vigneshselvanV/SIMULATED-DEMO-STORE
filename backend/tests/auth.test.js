import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, SessionClient } from './testHelper.js';
import db from '../src/config/db.js';

describe('Auth APIs', () => {
  let appInstance;
  let client;
  let testEmail = `test_${Date.now()}@example.com`;

  before(async () => {
    appInstance = await createTestApp();
    client = new SessionClient(appInstance.baseUrl);
  });

  after(async () => {
    db.prepare('DELETE FROM users WHERE email = ?').run(testEmail);
    await appInstance.close();
  });

  test('POST /api/auth/register should create new customer account and set session', async () => {
    const res = await client.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Customer',
        email: testEmail,
        password: 'Password@123'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, testEmail);
    assert.equal(res.body.user.role, 'customer');
    assert.equal(typeof res.body.user.password_hash, 'undefined');
  });

  test('POST /api/auth/register should reject duplicate email', async () => {
    const res = await client.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Another Name',
        email: testEmail,
        password: 'Password@123'
      })
    });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  test('GET /api/auth/me should return authenticated user profile', async () => {
    const res = await client.request('/api/auth/me');

    assert.equal(res.status, 200);
    assert.equal(res.body.authenticated, true);
    assert.equal(res.body.user.email, testEmail);
  });

  test('POST /api/auth/logout should destroy session', async () => {
    const res = await client.request('/api/auth/logout', { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const meRes = await client.request('/api/auth/me');
    assert.equal(meRes.body.authenticated, false);
  });

  test('POST /api/auth/login should reject invalid password', async () => {
    const res = await client.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword'
      })
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('POST /api/auth/login should authenticate with correct credentials', async () => {
    const res = await client.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'Password@123'
      })
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, testEmail);
  });
});
