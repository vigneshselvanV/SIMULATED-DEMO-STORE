import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, SessionClient } from './testHelper.js';
import db from '../src/config/db.js';

describe('Cart & Checkout APIs', () => {
  let appInstance;
  let clientA;
  let clientB;
  let customerEmailA = `custA_${Date.now()}@example.com`;
  let customerEmailB = `custB_${Date.now()}@example.com`;
  let sampleProduct;
  let initialStock;

  before(async () => {
    appInstance = await createTestApp();
    clientA = new SessionClient(appInstance.baseUrl);
    clientB = new SessionClient(appInstance.baseUrl);

    // Register User A
    await clientA.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'User A', email: customerEmailA, password: 'Password@123' })
    });

    // Register User B
    await clientB.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'User B', email: customerEmailB, password: 'Password@123' })
    });

    sampleProduct = db.prepare('SELECT * FROM products WHERE stock_quantity >= 5 LIMIT 1').get();
    initialStock = sampleProduct.stock_quantity;
  });

  after(async () => {
    try {
      // Due to foreign key ON DELETE RESTRICT on orders, delete orders first
      db.prepare(`
        DELETE FROM orders WHERE user_id IN (
          SELECT id FROM users WHERE email IN (?, ?)
        )
      `).run(customerEmailA, customerEmailB);
      db.prepare('DELETE FROM users WHERE email IN (?, ?)').run(customerEmailA, customerEmailB);
    } catch (e) {
      console.error('Cleanup warning:', e.message);
    }
    await appInstance.close();
  });

  test('POST /api/cart/items should add product to cart', async () => {
    const res = await clientA.request('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId: sampleProduct.id, quantity: 2 })
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].quantity, 2);
    assert.equal(res.body.data.items[0].productId, sampleProduct.id);
  });

  test('POST /api/cart/items should reject adding quantity beyond available stock', async () => {
    const res = await clientA.request('/api/cart/items', {
      method: 'POST',
      body: JSON.stringify({ productId: sampleProduct.id, quantity: initialStock + 10 })
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('GET /api/cart should calculate server-side subtotal and total', async () => {
    const res = await clientA.request('/api/cart');
    assert.equal(res.status, 200);
    const cart = res.body.data;
    const expectedSubtotal = 2 * sampleProduct.price_paise;
    assert.equal(cart.subtotalPaise, expectedSubtotal);
    assert.ok(cart.totalPaise >= expectedSubtotal);
  });

  let createdOrder;

  test('POST /api/orders/checkout should place order, reduce stock, and empty cart', async () => {
    const res = await clientA.request('/api/orders/checkout', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'User A',
        customerEmail: customerEmailA,
        customerPhone: '+91 99999 88888',
        shippingAddress: '123 Test Street, Cyber Hub',
        city: 'Gurugram',
        state: 'Haryana',
        postalCode: '122002'
      })
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    createdOrder = res.body.data;
    assert.ok(createdOrder.order_number.startsWith('SPH-'));
    assert.equal(createdOrder.items.length, 1);
    assert.equal(createdOrder.items[0].quantity, 2);

    // Verify stock was reduced in DB
    const freshProduct = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(sampleProduct.id);
    assert.equal(freshProduct.stock_quantity, initialStock - 2);

    // Verify cart is now empty
    const cartRes = await clientA.request('/api/cart');
    assert.equal(cartRes.body.data.items.length, 0);
  });

  test('GET /api/orders should list placed order in user order history', async () => {
    const res = await clientA.request('/api/orders');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.some((o) => o.id === createdOrder.id));
  });

  test('Order ownership: User B cannot access User A order (403 Forbidden)', async () => {
    const res = await clientB.request(`/api/orders/${createdOrder.id}`);
    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});
