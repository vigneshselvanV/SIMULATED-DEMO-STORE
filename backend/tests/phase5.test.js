import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/config/db.js';
import {
  orderAgent,
  paymentAgent,
  warehouseAgent,
  trackingAgent,
  customerSupportAgent,
  returnAgent,
  refundAgent
} from '../src/agents/definitions/index.js';
import { OpenRouterClient } from '../src/agents/llm/openrouterClient.js';
import { KeyManager } from '../src/agents/llm/keyManager.js';
import { BaseAgent } from '../src/agents/baseAgent.js';

describe('Phase 5: OpenRouter Mock Verification, Failover & Full Agent Test Suite', () => {
  let testUserId;
  let testProductId;
  let testOrderId;
  let testOrderNumber;

  before(() => {
    // 1. Seed user
    const userRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Phase5 QA User', 'phase5_qa@example.com', 'hashed_pw', 'customer')
    `).run();
    testUserId = userRes.lastInsertRowid;

    // 2. Seed product
    const prodRes = db.prepare(`
      INSERT INTO products (name, description, category, price_paise, stock_quantity, image_url)
      VALUES ('Phase5 4K Monitor', 'Ultra HD Display', 'Electronics', 3500000, 15, 'https://example.com/mon.jpg')
    `).run();
    testProductId = prodRes.lastInsertRowid;

    // 3. Seed order (Delivered so returns are eligible)
    testOrderNumber = `SPH-P5-${Date.now()}`;
    const orderRes = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address, city, state, postal_code, subtotal_paise, shipping_paise, total_paise,
        status, payment_method, payment_status, tracking_number
      ) VALUES (?, ?, 'Phase5 QA User', 'phase5_qa@example.com', '9876543210',
        '77 Innovation Blvd', 'Hyderabad', 'Telangana', '500081', 3500000, 0, 3500000,
        'Delivered', 'Demo Simulated Card', 'Paid - Demo', 'SPH-TRK-P5-001')
    `).run(testOrderNumber, testUserId);
    testOrderId = orderRes.lastInsertRowid;

    // 4. Seed order item
    db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, price_paise, quantity, subtotal_paise, image_url
      ) VALUES (?, ?, 'Phase5 4K Monitor', 3500000, 1, 3500000, 'https://example.com/mon.jpg')
    `).run(testOrderId, testProductId);

    // 5. Seed shipment
    const shipRes = db.prepare(`
      INSERT INTO shipments (
        order_id, tracking_number, carrier, status, estimated_delivery_date, delivered_at
      ) VALUES (?, 'SPH-TRK-P5-001', 'SphereExpress', 'delivered', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(testOrderId);

    db.prepare(`
      INSERT INTO shipment_events (
        shipment_id, status, location, description
      ) VALUES (?, 'delivered', 'Customer Doorstep', 'Delivered and signed.')
    `).run(shipRes.lastInsertRowid);
  });

  after(() => {
    try {
      db.prepare('DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id = ?)').run(testOrderId);
      db.prepare('DELETE FROM shipments WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM refunds WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM returns WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(testOrderId);
      db.prepare('DELETE FROM orders WHERE id = ?').run(testOrderId);
      db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    } catch (e) {
      // ignore
    }
  });

  // Helper to create mock agent environment
  function setupMockAgent(agent, toolName, toolArgs, finalContent) {
    let callIndex = 0;
    const mockFetch = async () => {
      callIndex++;
      if (callIndex === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  role: 'assistant',
                  tool_calls: [
                    {
                      id: `call_${Date.now()}`,
                      type: 'function',
                      function: {
                        name: toolName,
                        arguments: JSON.stringify(toolArgs)
                      }
                    }
                  ]
                }
              }
            ]
          })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: finalContent
              }
            }
          ]
        })
      };
    };

    const mockKm = new KeyManager();
    mockKm.getAgentConfig = (name) => ({
      agentName: name,
      primaryKey: 'mock-primary-key',
      backupKey: 'mock-backup-key',
      primaryModel: 'meta-llama/llama-3.3-70b-instruct:free',
      fallbackModel: 'google/gemini-2.0-flash-lite-preview:free',
      isEnabled: true,
      hasPrimaryKey: true,
      hasBackupKey: true
    });

    agent.client = new OpenRouterClient({ fetchFn: mockFetch });
    agent.keyManager = mockKm;
  }

  // ==========================================
  // TEST EACH OF THE 7 AGENTS WITH MOCK TOOLS
  // ==========================================
  test('1. OrderAgent: calls getOrder and synthesizes order status', async () => {
    setupMockAgent(
      orderAgent,
      'getOrder',
      { orderNumber: testOrderNumber },
      `Order ${testOrderNumber} was successfully retrieved. Total is ₹35,000.00.`
    );

    const res = await orderAgent.run({
      message: `Lookup details for ${testOrderNumber}`,
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes(testOrderNumber));
  });

  test('2. PaymentAgent: calls getPaymentStatus and explains mock payment state', async () => {
    setupMockAgent(
      paymentAgent,
      'getPaymentStatus',
      { orderId: testOrderId },
      `Payment record verified: Order #${testOrderId} was paid via Demo Simulated Card.`
    );

    const res = await paymentAgent.run({
      message: `Check payment status for order ${testOrderId}`,
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes('Demo Simulated Card'));
  });

  test('3. WarehouseAgent: calls checkStock and reports inventory levels', async () => {
    setupMockAgent(
      warehouseAgent,
      'checkStock',
      { productId: testProductId },
      `Stock check: Product #${testProductId} has 15 physical units available.`
    );

    const res = await warehouseAgent.run({
      message: `What is current stock for product ${testProductId}?`,
      userContext: { user: { id: 1, role: 'admin' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes('15 physical units'));
  });

  test('4. TrackingAgent: calls getTracking and reports courier delivery status', async () => {
    setupMockAgent(
      trackingAgent,
      'getTracking',
      { trackingNumber: 'SPH-TRK-P5-001' },
      'Shipment SPH-TRK-P5-001 has been delivered by SphereExpress.'
    );

    const res = await trackingAgent.run({
      message: 'Track package SPH-TRK-P5-001',
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes('SphereExpress'));
  });

  test('5. CustomerSupportAgent: calls createTicket to open a customer ticket', async () => {
    setupMockAgent(
      customerSupportAgent,
      'createTicket',
      { subject: 'Assistance with warranty', category: 'general', initialMessage: 'Need warranty card' },
      'Your support ticket has been created. A specialist will assist you.'
    );

    const res = await customerSupportAgent.run({
      message: 'Open a ticket for warranty help',
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes('support ticket has been created'));
  });

  test('6. ReturnAgent: calls checkReturnEligibility and confirms 30-day window', async () => {
    setupMockAgent(
      returnAgent,
      'checkReturnEligibility',
      { orderId: testOrderId, productId: testProductId },
      'The item is eligible for return within our 30-day policy.'
    );

    const res = await returnAgent.run({
      message: `Can I return product ${testProductId} from order ${testOrderId}?`,
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes('eligible for return'));
  });

  test('7. RefundAgent: calls calculateRefund and reports integer paise refund breakdown', async () => {
    setupMockAgent(
      refundAgent,
      'calculateRefund',
      { orderId: testOrderId },
      'Refund calculation complete: Total refundable amount is ₹35,000.00 (3,500,000 paise).'
    );

    const res = await refundAgent.run({
      message: `Calculate refund for order ${testOrderId}`,
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.toolCallsCount, 1);
    assert.ok(res.response.includes('35,000.00'));
  });

  // ==========================================
  // OPENROUTER RATE LIMIT & KEY FAILOVER
  // ==========================================
  test('OpenRouter Failover Ladder: Primary 429 fails over to Backup key', async () => {
    const attempts = [];
    const mockFetchLadder = async (url, options) => {
      const authHeader = options.headers['Authorization'] || '';
      attempts.push(authHeader);

      if (authHeader.includes('key-primary')) {
        // Primary key encounters 429 rate limit
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Primary key rate limit exceeded', code: 429 } })
        };
      }

      // Backup key succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Response generated via backup key failover.'
              }
            }
          ]
        })
      };
    };

    const km = new KeyManager();
    km.getAgentConfig = () => ({
      agentName: 'support',
      primaryKey: 'key-primary-1111',
      backupKey: 'key-backup-2222',
      primaryModel: 'meta-llama/llama-3.3-70b-instruct:free',
      fallbackModel: 'google/gemini-2.0-flash-lite-preview:free',
      isEnabled: true,
      hasPrimaryKey: true,
      hasBackupKey: true
    });

    const client = new OpenRouterClient({ fetchFn: mockFetchLadder, timeoutMs: 500 });
    const completion = await km.executeWithFailover('support', client, async ({ apiKey, model, slot }) => {
      return client.chatCompletion({
        apiKey,
        model,
        messages: [{ role: 'user', content: 'test failover' }],
        maxRetries: 0
      });
    });

    assert.equal(completion.content, 'Response generated via backup key failover.');
    assert.equal(completion.keySlotUsed, 'backup');
    assert.equal(attempts.length, 2);
    assert.ok(attempts[0].includes('key-primary-1111'));
    assert.ok(attempts[1].includes('key-backup-2222'));
  });

  // ==========================================
  // FALLBACK JSON TOOL CALL PARSER
  // ==========================================
  test('Fallback Tool Calling: parses JSON markdown tool call when model lacks native tool calling', () => {
    const agent = new BaseAgent({
      name: 'OrderAgent',
      description: 'Test agent',
      systemPrompt: 'System',
      allowedTools: ['getOrder']
    });

    // Case 1: Markdown codeblock JSON
    const markdownOutput = '```json\n{\n  "tool": "getOrder",\n  "arguments": { "orderNumber": "SPH-123" }\n}\n```';
    const parsed1 = agent.parseJsonToolCallFallback(markdownOutput);
    assert.ok(parsed1);
    assert.equal(parsed1.name, 'getOrder');
    assert.equal(parsed1.arguments.orderNumber, 'SPH-123');

    // Case 2: Raw JSON object
    const rawOutput = '{"tool": "getOrder", "parameters": {"orderId": 42}}';
    const parsed2 = agent.parseJsonToolCallFallback(rawOutput);
    assert.ok(parsed2);
    assert.equal(parsed2.name, 'getOrder');
    assert.equal(parsed2.arguments.orderId, 42);

    // Case 3: Standard natural language (no tool call)
    const naturalText = 'Your order is currently processing and will arrive in 2 days.';
    const parsed3 = agent.parseJsonToolCallFallback(naturalText);
    assert.equal(parsed3, null);
  });

  // ==========================================
  // APPROVAL GATING IN AGENT LOOP
  // ==========================================
  test('Approval Gating: agent loop pauses on high-value refund and creates approval request', async () => {
    // Model requests createMockRefund with amount 500000 paise (₹5,000 > ₹2,000 threshold)
    let callCount = 0;
    const mockApprovalFetch = async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                tool_calls: [
                  {
                    id: 'call_refund_high',
                    type: 'function',
                    function: {
                      name: 'createMockRefund',
                      arguments: JSON.stringify({
                        orderId: testOrderId,
                        amountPaise: 500000,
                        reason: 'High-value test refund'
                      })
                    }
                  }
                ]
              }
            }
          ]
        })
      };
    };

    const km = new KeyManager();
    km.getAgentConfig = () => ({
      agentName: 'refund',
      primaryKey: 'mock-key',
      backupKey: null,
      primaryModel: 'test-model',
      fallbackModel: 'fallback-model',
      isEnabled: true,
      hasPrimaryKey: true,
      hasBackupKey: false
    });

    const agent = new BaseAgent({
      name: 'RefundAgent',
      description: 'Refund Agent',
      systemPrompt: 'You are the Refund Agent.',
      allowedTools: ['createMockRefund']
    });
    agent.client = new OpenRouterClient({ fetchFn: mockApprovalFetch });
    agent.keyManager = km;

    const res = await agent.run({
      message: 'Issue high value refund of ₹5,000',
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(res.success, true);
    assert.equal(res.approvalPending, true);
    assert.ok(res.response.includes('approval'));

    // Check approval record was created in database
    const pendingApproval = db.prepare(`
      SELECT * FROM agent_approval_requests
      WHERE agent_name = 'RefundAgent' AND tool_name = 'createMockRefund' AND status = 'pending'
      ORDER BY id DESC LIMIT 1
    `).get();
    assert.ok(pendingApproval, 'Pending approval request recorded in agent_approval_requests');
  });
});
