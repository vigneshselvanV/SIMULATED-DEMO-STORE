import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, SessionClient } from './testHelper.js';
import db from '../src/config/db.js';

describe('Admin APIs & Authorization', () => {
  let appInstance;
  let unauthClient;
  let customerClient;
  let adminClient;
  let customerEmail = `customer_adm_${Date.now()}@example.com`;

  before(async () => {
    appInstance = await createTestApp();
    unauthClient = new SessionClient(appInstance.baseUrl);
    customerClient = new SessionClient(appInstance.baseUrl);
    adminClient = new SessionClient(appInstance.baseUrl);

    // Register a standard customer
    await customerClient.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Standard Cust', email: customerEmail, password: 'Password@123' })
    });

    // Login as pre-seeded admin
    const adminLoginRes = await adminClient.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@shopsphere.com', password: 'Admin@123456' })
    });
    assert.equal(adminLoginRes.status, 200);
  });

  after(async () => {
    db.prepare('DELETE FROM users WHERE email = ?').run(customerEmail);
    await appInstance.close();
  });

  test('Unauthenticated user gets 401 when accessing admin metrics', async () => {
    const res = await unauthClient.request('/api/admin/metrics');
    assert.equal(res.status, 401);
  });

  test('Customer role gets 403 Forbidden when accessing admin metrics', async () => {
    const res = await customerClient.request('/api/admin/metrics');
    assert.equal(res.status, 403);
    assert.match(res.body.message, /Administrator privileges/);
  });

  test('Admin can fetch dashboard sales and catalog metrics', async () => {
    const res = await adminClient.request('/api/admin/metrics');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.data.totalProducts === 'number');
    assert.ok(typeof res.body.data.totalRevenuePaise === 'number');
  });

  let createdProductId;

  test('Admin can create a new product', async () => {
    const res = await adminClient.request('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Admin Test Gadget',
        description: 'A high tech testing device created by admin.',
        category: 'Electronics',
        pricePaise: 499900,
        stockQuantity: 20,
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.name, 'Admin Test Gadget');
    createdProductId = res.body.data.id;
  });

  test('Admin can update product stock', async () => {
    const res = await adminClient.request(`/api/admin/products/${createdProductId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stockQuantity: 35 })
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.stock_quantity, 35);
  });

  test('Admin can update order status', async () => {
    const ordersRes = await adminClient.request('/api/admin/orders');
    assert.equal(ordersRes.status, 200);
    assert.ok(ordersRes.body.data.length > 0);

    const targetOrder = ordersRes.body.data[0];
    const updateRes = await adminClient.request(`/api/admin/orders/${targetOrder.id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Shipped' })
    });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.status, 'Shipped');
  });
});
