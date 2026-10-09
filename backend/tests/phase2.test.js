import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/config/db.js';
import toolRegistry, {
  orderTools,
  paymentTools,
  warehouseTools,
  trackingTools,
  supportTools,
  returnTools,
  refundTools,
  exportTools
} from '../src/agents/tools/index.js';
import { sanitizeCsvCell } from '../src/agents/tools/exportTools.js';
import { ToolDispatcher } from '../src/agents/dispatcher.js';

describe('Phase 2: Domain Tools & Business Logic Suite', () => {
  let testUserId;
  let otherUserId;
  let testProductId;
  let testOrderId;
  let testOrderNumber;

  before(() => {
    // 1. Create test users
    const userRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Phase2 Customer', 'phase2_cust@example.com', 'hashed_pw', 'customer')
    `).run();
    testUserId = userRes.lastInsertRowid;

    const otherUserRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Other Customer', 'other_cust@example.com', 'hashed_pw', 'customer')
    `).run();
    otherUserId = otherUserRes.lastInsertRowid;

    // 2. Create test product
    const prodRes = db.prepare(`
      INSERT INTO products (name, description, category, price_paise, stock_quantity, image_url)
      VALUES ('Phase2 Headphones', 'Test audio equipment', 'Electronics', 500000, 20, 'https://example.com/p2.jpg')
    `).run();
    testProductId = prodRes.lastInsertRowid;

    // 3. Create test order
    testOrderNumber = `SPH-P2-${Date.now()}`;
    const orderRes = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address, city, state, postal_code, subtotal_paise, shipping_paise, total_paise,
        status, payment_method, payment_status
      ) VALUES (?, ?, 'Phase2 Customer', 'phase2_cust@example.com', '9876543210',
        '123 MG Road', 'Bengaluru', 'Karnataka', '560001', 500000, 5000, 505000,
        'Pending', 'Demo UPI', 'Paid - Demo')
    `).run(testOrderNumber, testUserId);
    testOrderId = orderRes.lastInsertRowid;

    // 4. Create order item
    db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
      ) VALUES (?, ?, 'Phase2 Headphones', 500000, 1, 500000, 'https://example.com/p2.jpg')
    `).run(testOrderId, testProductId);
  });

  after(() => {
    // Cleanup test records
    try {
      db.prepare('DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id = ?)').run(testOrderId);
      db.prepare('DELETE FROM shipments WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM refunds WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM returns WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM payments WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM inventory_reservations WHERE product_id = ?').run(testProductId);
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM orders WHERE id = ?').run(testOrderId);
      db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);
      db.prepare('DELETE FROM support_messages WHERE sender_id = ?').run(String(testUserId));
      db.prepare('DELETE FROM support_conversations WHERE user_id = ?').run(testUserId);
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(testUserId, otherUserId);
    } catch (e) {
      // ignore cleanup errors
    }
  });

  // ==========================================
  // WAREHOUSE TOOLS TESTS
  // ==========================================
  test('WarehouseTools: checks stock and manages inventory reservations', async () => {
    // 1. Initial stock check
    const stock = await warehouseTools.checkStock({ productId: testProductId });
    assert.equal(stock.stockQuantity, 20);
    assert.equal(stock.reservedQuantity, 0);
    assert.equal(stock.availableQuantity, 20);

    // 2. Reserve 5 units
    const reserveRes = await warehouseTools.reserveStock({
      productId: testProductId,
      quantity: 5,
      durationMinutes: 15
    });
    assert.equal(reserveRes.success, true);
    assert.ok(reserveRes.reservationId);

    // 3. Available stock should be 15
    const stockAfterReserve = await warehouseTools.checkStock({ productId: testProductId });
    assert.equal(stockAfterReserve.stockQuantity, 20);
    assert.equal(stockAfterReserve.reservedQuantity, 5);
    assert.equal(stockAfterReserve.availableQuantity, 15);

    // 4. Release reservation
    const releaseRes = await warehouseTools.releaseStock({ reservationId: reserveRes.reservationId });
    assert.equal(releaseRes.success, true);

    // 5. Stock should be fully available again
    const stockAfterRelease = await warehouseTools.checkStock({ productId: testProductId });
    assert.equal(stockAfterRelease.availableQuantity, 20);
  });

  test('WarehouseTools: lists low stock, recommends replenishment, adjusts stock, and prepares dispatch', async () => {
    // 1. Adjust stock down to 3
    const adjustRes = await warehouseTools.adjustStock(
      { productId: testProductId, delta: -17, reason: 'Cycle count correction' },
      { role: 'admin', userId: 1 }
    );
    assert.equal(adjustRes.success, true);
    assert.equal(adjustRes.newStock, 3);

    // 2. List low stock with threshold 5
    const lowStock = await warehouseTools.listLowStock({ threshold: 5 });
    const found = lowStock.items.find((i) => i.id === testProductId);
    assert.ok(found);
    assert.equal(found.stockQuantity, 3);

    // 3. Replenishment recommendations
    const replenish = await warehouseTools.recommendReplenishment({ targetStock: 50 });
    const rec = replenish.recommendations.find((r) => r.productId === testProductId);
    assert.ok(rec);
    assert.equal(rec.recommendedReorderUnits, 47);

    // Restore stock back to 20
    await warehouseTools.adjustStock(
      { productId: testProductId, delta: 17, reason: 'Test reset' },
      { role: 'admin', userId: 1 }
    );

    // 4. Prepare dispatch for test order
    const dispatch = await warehouseTools.prepareDispatch(
      { orderId: testOrderId },
      { role: 'admin', userId: 1 }
    );
    assert.equal(dispatch.success, true);
    assert.ok(dispatch.trackingNumber.startsWith('SPH-TRK-'));

    // Check order now has tracking number and Processing status
    const updatedOrder = db.prepare('SELECT status, tracking_number FROM orders WHERE id = ?').get(testOrderId);
    assert.equal(updatedOrder.status, 'Processing');
    assert.equal(updatedOrder.tracking_number, dispatch.trackingNumber);
  });

  // ==========================================
  // TRACKING TOOLS TESTS
  // ==========================================
  test('TrackingTools: retrieves tracking, updates shipment milestones, and estimates delivery', async () => {
    const order = db.prepare('SELECT tracking_number FROM orders WHERE id = ?').get(testOrderId);
    const trackingNumber = order.tracking_number;
    assert.ok(trackingNumber);

    // 1. Customer can view own tracking
    const tracking = await trackingTools.getTracking(
      { trackingNumber },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(tracking.trackingNumber, trackingNumber);
    assert.equal(tracking.status, 'label_created');
    assert.equal(tracking.events.length, 1);

    // 2. Another customer cannot view tracking
    await assert.rejects(
      () => trackingTools.getTracking({ trackingNumber }, { userId: otherUserId, role: 'customer' }),
      /Forbidden/
    );

    // 3. Milestone update: in_transit
    await trackingTools.updateShipmentStatus(
      { trackingNumber, status: 'in_transit', location: 'Bengaluru Sort Facility' },
      { role: 'admin' }
    );

    // 4. Milestone update: delivered
    await trackingTools.updateShipmentStatus(
      { trackingNumber, status: 'delivered', location: 'Customer Doorstep' },
      { role: 'admin' }
    );

    // Verify order status updated to Delivered
    const orderAfterDelivery = db.prepare('SELECT status FROM orders WHERE id = ?').get(testOrderId);
    assert.equal(orderAfterDelivery.status, 'Delivered');

    // 5. Timeline reflects all 3 events
    const timeline = await trackingTools.getTimeline(
      { trackingNumber },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(timeline.timeline.length, 3);
    assert.equal(timeline.currentStatus, 'delivered');

    // 6. Delivery estimate for delivered item
    const estimate = await trackingTools.estimateDelivery(
      { trackingNumber },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(estimate.status, 'delivered');
  });

  // ==========================================
  // SUPPORT TOOLS TESTS
  // ==========================================
  test('SupportTools: opens tickets, threads customer messages, and escalates to human', async () => {
    // 1. Create ticket
    const ticket = await supportTools.createTicket(
      {
        subject: 'Inquiry regarding package delivery',
        category: 'order',
        priority: 'normal',
        initialMessage: 'Where was the package left?'
      },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(ticket.success, true);
    assert.ok(ticket.ticketNumber.startsWith('TKT-'));

    // 2. Add message to thread
    const reply = await supportTools.addMessage(
      {
        ticketNumber: ticket.ticketNumber,
        message: 'Could you please check with security desk?'
      },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(reply.success, true);

    // 3. Escalate ticket to human
    const escalation = await supportTools.escalateToHuman(
      {
        ticketNumber: ticket.ticketNumber,
        reason: 'Customer requested human supervisor'
      },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(escalation.escalatedToHuman, true);
    assert.equal(escalation.priority, 'high');

    // 4. Retrieve ticket thread and verify messages
    const thread = await supportTools.getTicket(
      { ticketNumber: ticket.ticketNumber },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(thread.messages.length, 3); // initial + customer reply + system escalation message
    assert.equal(thread.escalatedToHuman, true);

    // 5. Unauthorized customer cannot view thread
    await assert.rejects(
      () => supportTools.getTicket({ ticketNumber: ticket.ticketNumber }, { userId: otherUserId, role: 'customer' }),
      /Forbidden/
    );
  });

  // ==========================================
  // RETURN TOOLS TESTS
  // ==========================================
  test('ReturnTools: validates policy eligibility, creates return requests, and handles warehouse restock', async () => {
    // 1. Check return eligibility (Order is Delivered)
    const eligibility = await returnTools.checkReturnEligibility(
      { orderId: testOrderId, productId: testProductId },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.items[0].availableToReturn, 1);

    // 2. Create return request
    const returnReq = await returnTools.createReturnRequest(
      {
        orderId: testOrderId,
        productId: testProductId,
        quantity: 1,
        reason: 'Audio jack defective'
      },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(returnReq.success, true);
    assert.ok(returnReq.returnNumber.startsWith('RET-'));

    // 3. Second return request for same item should fail (no available returnable qty left)
    await assert.rejects(
      () => returnTools.createReturnRequest(
        { orderId: testOrderId, productId: testProductId, quantity: 1, reason: 'Duplicate' },
        { userId: testUserId, role: 'customer' }
      ),
      /Return not eligible|exceeds available/
    );

    // 4. Mark received and restock by admin
    const initialStock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProductId).stock_quantity;
    const markRes = await returnTools.markReceived(
      { returnNumber: returnReq.returnNumber, restock: true, adminNotes: 'Inspected and verified' },
      { role: 'admin', userId: 1 }
    );
    assert.equal(markRes.success, true);
    assert.equal(markRes.restocked, true);

    const stockAfterRestock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProductId).stock_quantity;
    assert.equal(stockAfterRestock, initialStock + 1);
  });

  // ==========================================
  // REFUND TOOLS TESTS
  // ==========================================
  test('RefundTools: calculates integer paise refund and executes idempotent simulated refunds', async () => {
    // 1. Calculate refund
    const calc = await refundTools.calculateRefund(
      { orderId: testOrderId, includeShipping: false },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(calc.itemsSubtotalPaise, 500000);
    assert.equal(calc.proposedRefundPaise, 500000);

    // 2. Issue mock refund with custom idempotency key
    const idemKey = `IDEM-TEST-${Date.now()}`;
    const refundRes1 = await refundTools.createMockRefund(
      {
        orderId: testOrderId,
        amountPaise: 500000,
        reason: 'Defective item returned',
        idempotencyKey: idemKey
      },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(refundRes1.success, true);
    assert.equal(refundRes1.amountPaise, 500000);
    assert.ok(refundRes1.refundNumber.startsWith('RFD-'));

    // 3. Repeat identical refund with same idempotency key: must be safe replay
    const refundRes2 = await refundTools.createMockRefund(
      {
        orderId: testOrderId,
        amountPaise: 500000,
        reason: 'Defective item returned',
        idempotencyKey: idemKey
      },
      { userId: testUserId, role: 'customer' }
    );
    assert.equal(refundRes2.success, true);
    assert.equal(refundRes2.idempotent, true);
    assert.equal(refundRes2.refundNumber, refundRes1.refundNumber);

    // 4. Total refunds in database must still be only 1
    const refundsCount = db.prepare('SELECT count(*) as count FROM refunds WHERE order_id = ?').get(testOrderId).count;
    assert.equal(refundsCount, 1);

    // 5. Excess refund exceeding balance should fail
    await assert.rejects(
      () => refundTools.createMockRefund(
        { orderId: testOrderId, amountPaise: 100000, reason: 'Excess' },
        { userId: testUserId, role: 'customer' }
      ),
      /exceeds order refundable balance/
    );
  });

  // ==========================================
  // EXPORT TOOLS & CSV SANITIZATION
  // ==========================================
  test('ExportTools: sanitizes CSV against formula injection and formats export reports', async () => {
    // Test formula injection characters: =, +, -, @, \t, \r
    assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(sanitizeCsvCell('+12345'), "'+12345");
    assert.equal(sanitizeCsvCell('-54321'), "'-54321");
    assert.equal(sanitizeCsvCell('@cmd'), "'@cmd");
    assert.equal(sanitizeCsvCell('\tmalicious'), "'\tmalicious");
    assert.equal(sanitizeCsvCell('\rmalicious'), "\"'\rmalicious\"");

    // Standard string with comma requires RFC 4180 quotes
    assert.equal(sanitizeCsvCell('Hello, World'), '"Hello, World"');

    // Orders export
    const ordersCsv = await exportTools.exportOrdersCsv(
      { limit: 10 },
      { userId: testUserId, role: 'customer' }
    );
    assert.ok(ordersCsv.csv.includes('Order Number,Customer Name'));
    assert.ok(ordersCsv.rowCount >= 1);

    // Inventory export
    const invCsv = await exportTools.exportInventoryCsv(
      {},
      { role: 'admin', userId: 1 }
    );
    assert.ok(invCsv.csv.includes('Product ID,Name,Category'));
    assert.ok(invCsv.rowCount >= 1);
  });

  // ==========================================
  // TOOL REGISTRY & DISPATCHER INTEGRATION
  // ==========================================
  test('ToolRegistry & Dispatcher: all domain tools registered and enforce security boundaries', async () => {
    // 1. Verify all 22 tools are registered in toolRegistry
    const expectedTools = [
      'getOrder', 'listMyOrders', 'cancelEligibleOrder', 'updateStatus',
      'getPaymentStatus', 'simulatePayment', 'retryPayment', 'reconcile',
      'checkStock', 'listLowStock', 'reserveStock', 'releaseStock',
      'recommendReplenishment', 'prepareDispatch', 'adjustStock',
      'getTracking', 'getTimeline', 'updateShipmentStatus', 'estimateDelivery',
      'createTicket', 'getTicket', 'addMessage', 'escalateToHuman',
      'checkReturnEligibility', 'createReturnRequest', 'getReturnStatus', 'markReceived',
      'calculateRefund', 'createMockRefund', 'getRefundStatus',
      'exportOrdersCsv', 'exportInventoryCsv'
    ];

    for (const toolName of expectedTools) {
      assert.ok(toolRegistry.hasTool(toolName), `Tool "${toolName}" is registered in toolRegistry`);
    }

    // 2. Dispatcher enforces admin role on admin tools
    const dispatcher = new ToolDispatcher();
    const unauthorizedResult = await dispatcher.dispatch({
      agentName: 'OrderAgent',
      allowedTools: ['updateStatus'],
      toolName: 'updateStatus',
      arguments: { orderId: testOrderId, status: 'Shipped' },
      userContext: { user: { id: testUserId, role: 'customer' } }
    });
    assert.equal(unauthorizedResult.success, false);
    assert.ok(unauthorizedResult.error.includes('administrator privileges'));

    // 3. Dispatcher blocks tools not in agent allowedTools
    const notAllowedResult = await dispatcher.dispatch({
      agentName: 'TrackingAgent',
      allowedTools: ['getTracking'],
      toolName: 'adjustStock',
      arguments: { productId: testProductId, delta: 5 },
      userContext: { user: { id: 1, role: 'admin' } }
    });
    assert.equal(notAllowedResult.success, false);
    assert.ok(notAllowedResult.error.includes('Security Violation'));
  });
});
