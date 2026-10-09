import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, SessionClient } from './testHelper.js';

describe('Product APIs', () => {
  let appInstance;
  let client;

  before(async () => {
    appInstance = await createTestApp();
    client = new SessionClient(appInstance.baseUrl);
  });

  after(async () => {
    await appInstance.close();
  });

  test('GET /api/products returns paginated product list', async () => {
    const res = await client.request('/api/products');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length > 0);
    assert.ok(res.body.pagination.total > 0);
  });

  test('GET /api/products?category=Electronics filters by category', async () => {
    const res = await client.request('/api/products?category=Electronics');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    for (const p of res.body.data) {
      assert.equal(p.category, 'Electronics');
    }
  });

  test('GET /api/products?search=Laptop searches by query string', async () => {
    const res = await client.request('/api/products?search=Laptop');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length > 0);
    assert.match(res.body.data[0].name.toLowerCase(), /laptop/);
  });

  test('GET /api/products/:id returns specific product with related items', async () => {
    const listRes = await client.request('/api/products');
    const firstProduct = listRes.body.data[0];

    const detailRes = await client.request(`/api/products/${firstProduct.id}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.data.id, firstProduct.id);
    assert.ok(Array.isArray(detailRes.body.related));
  });

  test('GET /api/products/categories returns categories with counts', async () => {
    const res = await client.request('/api/products/categories');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((c) => c.category === 'Electronics'));
    assert.ok(res.body.data.some((c) => c.category === 'Books'));
  });
});
