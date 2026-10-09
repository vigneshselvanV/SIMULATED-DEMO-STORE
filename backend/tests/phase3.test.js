import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/config/db.js';
import {
  agents,
  getAgent,
  listAgents,
  OrderAgent,
  PaymentAgent,
  WarehouseAgent,
  TrackingAgent,
  CustomerSupportAgent,
  ReturnAgent,
  RefundAgent
} from '../src/agents/definitions/index.js';
import { OpenRouterClient } from '../src/agents/llm/openrouterClient.js';
import { KeyManager } from '../src/agents/llm/keyManager.js';

describe('Phase 3: The 7 AI Agents & Multi-Agent Handoff Suite', () => {
  let testUserId;
  let testOrderId;
  let testOrderNumber;

  before(() => {
    // Seed test user and order
    const userRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Phase3 User', 'phase3_user@example.com', 'hashed_pw', 'customer')
    `).run();
    testUserId = userRes.lastInsertRowid;

    testOrderNumber = `SPH-P3-${Date.now()}`;
    const orderRes = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address, city, state, postal_code, subtotal_paise, shipping_paise, total_paise,
        status, payment_method, payment_status
      ) VALUES (?, ?, 'Phase3 User', 'phase3_user@example.com', '9876543210',
        '100 Tech Park', 'Bengaluru', 'Karnataka', '560001', 199900, 0, 199900,
        'Pending', 'Demo UPI', 'Paid - Demo')
    `).run(testOrderNumber, testUserId);
    testOrderId = orderRes.lastInsertRowid;
  });

  after(() => {
    try {
      db.prepare('DELETE FROM orders WHERE id = ?').run(testOrderId);
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    } catch (e) {
      // ignore
    }
  });

  test('Registry: exposes all 7 specialized agents with distinct roles', () => {
    const list = listAgents();
    assert.equal(list.length, 7);

    const names = list.map((a) => a.name);
    assert.ok(names.includes('OrderAgent'));
    assert.ok(names.includes('PaymentAgent'));
    assert.ok(names.includes('WarehouseAgent'));
    assert.ok(names.includes('TrackingAgent'));
    assert.ok(names.includes('CustomerSupportAgent'));
    assert.ok(names.includes('ReturnAgent'));
    assert.ok(names.includes('RefundAgent'));

    // Check flexible name lookup
    assert.equal(getAgent('OrderAgent').name, 'OrderAgent');
    assert.equal(getAgent('order').name, 'OrderAgent');
    assert.equal(getAgent('orderagent').name, 'OrderAgent');
    assert.equal(getAgent('customersupportagent').name, 'CustomerSupportAgent');
    assert.equal(getAgent('support').name, 'CustomerSupportAgent');
    assert.equal(getAgent('tracking').name, 'TrackingAgent');
    assert.equal(getAgent('payment').name, 'PaymentAgent');
    assert.equal(getAgent('warehouse').name, 'WarehouseAgent');
    assert.equal(getAgent('return').name, 'ReturnAgent');
    assert.equal(getAgent('refund').name, 'RefundAgent');
    assert.equal(getAgent('nonexistent'), null);
  });

  test('Agent Prompts: contain prompt-injection boundary and integer paise rules', () => {
    for (const agent of Object.values(agents)) {
      const prompt = agent.buildSystemPrompt();
      assert.ok(prompt.includes('<user_data>'), `${agent.name} prompt includes <user_data> tags boundary`);
      assert.ok(prompt.includes('UNTRUSTED DATA'), `${agent.name} prompt defines untrusted data rule`);
      assert.ok(prompt.includes('integer paise'), `${agent.name} prompt enforces integer paise rule`);
      assert.ok(agent.allowedTools.length > 0, `${agent.name} has allowed tools configured`);
    }
  });

  test('OrderAgent: executes tool loop to lookup order with mock LLM', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        // Model requests tool call getOrder
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
                      id: 'call_ord_1',
                      type: 'function',
                      function: {
                        name: 'getOrder',
                        arguments: JSON.stringify({ orderNumber: testOrderNumber })
                      }
                    }
                  ]
                }
              }
            ]
          })
        };
      }
      // Model produces final answer based on tool output
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: `Your order ${testOrderNumber} is currently Pending and totals ₹1,999.00.`
              }
            }
          ]
        })
      };
    };

    const mockKm = new KeyManager();
    mockKm.getAgentConfig = () => ({
      agentName: 'order',
      primaryKey: 'mock-key',
      backupKey: null,
      primaryModel: 'test-model',
      fallbackModel: 'fallback-model',
      isEnabled: true,
      hasPrimaryKey: true,
      hasBackupKey: false
    });

    const agent = new OrderAgent();
    agent.client = new OpenRouterClient({ fetchFn: mockFetch });
    agent.keyManager = mockKm;

    const result = await agent.run({
      message: `What is the status of ${testOrderNumber}?`,
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(result.success, true);
    assert.ok(result.response.includes('Pending'));
    assert.ok(result.response.includes(testOrderNumber));
    assert.equal(result.toolCallsCount, 1);
  });

  test('CustomerSupportAgent: delegates request to specialized agent via routeToAgent tool', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) {
        // Support agent initiates handoff to OrderAgent
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
                      id: 'call_support_handoff_1',
                      type: 'function',
                      function: {
                        name: 'routeToAgent',
                        arguments: JSON.stringify({
                          targetAgent: 'OrderAgent',
                          query: `Lookup order ${testOrderNumber}`,
                          reason: 'Order management request'
                        })
                      }
                    }
                  ]
                }
              }
            ]
          })
        };
      }
      // Final message after handoff returns
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: `I've connected with our Order Agent to handle your inquiry for order ${testOrderNumber}.`
              }
            }
          ]
        })
      };
    };

    const mockKm = new KeyManager();
    mockKm.getAgentConfig = () => ({
      agentName: 'support',
      primaryKey: 'mock-key',
      backupKey: null,
      primaryModel: 'test-model',
      fallbackModel: 'fallback-model',
      isEnabled: true,
      hasPrimaryKey: true,
      hasBackupKey: false
    });

    const supportAgent = new CustomerSupportAgent();
    supportAgent.client = new OpenRouterClient({ fetchFn: mockFetch });
    supportAgent.keyManager = mockKm;

    const result = await supportAgent.run({
      message: `Help me with my order ${testOrderNumber}`,
      userContext: { user: { id: testUserId, role: 'customer' } }
    });

    assert.equal(result.success, true);
    assert.ok(result.response.includes('Order Agent'));
    assert.equal(result.toolCallsCount, 1);
  });
});
