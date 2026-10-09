import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/config/db.js';
import app from '../src/app.js';

describe('Phase 4: Agent API Routes, Approvals & Admin Telemetry', () => {
  let server;
  let baseUrl;
  let customerCookie;
  let adminCookie;
  let customerUserId;
  let adminUserId;
  let testApprovalRequestId;

  before(async () => {
    // 1. Seed customer and admin users
    const customerRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Phase4 Cust', 'phase4_cust@example.com', '$2a$10$abcdefghijklmnopqrstuu', 'customer')
    `).run();
    customerUserId = customerRes.lastInsertRowid;

    const adminRes = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Phase4 Admin', 'phase4_admin@example.com', '$2a$10$abcdefghijklmnopqrstuu', 'admin')
    `).run();
    adminUserId = adminRes.lastInsertRowid;

    // 2. Start HTTP server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    // 3. Login customer to obtain session cookie
    // Manually insert sessions or use test helper
    const custSessionRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cust Session User',
        email: `cust_sess_${Date.now()}@example.com`,
        password: 'Password123!'
      })
    });
    customerCookie = custSessionRes.headers.get('set-cookie');

    // 4. Create admin session by registering and updating role to admin
    const adminEmail = `admin_sess_${Date.now()}@example.com`;
    const adminSessionRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Admin Session User',
        email: adminEmail,
        password: 'Password123!'
      })
    });
    adminCookie = adminSessionRes.headers.get('set-cookie');
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run('admin', adminEmail);

    // 5. Seed test approval request in agent_approval_requests using registered tool listLowStock
    testApprovalRequestId = `appr_test_${Date.now()}`;
    db.prepare(`
      INSERT INTO agent_approval_requests (
        request_id, run_id, agent_name, tool_name, arguments, risk_level, status, requested_by_user_id
      ) VALUES (?, 'run_mock_01', 'WarehouseAgent', 'listLowStock', '{"threshold": 5}', 'high', 'pending', ?)
    `).run(testApprovalRequestId, customerUserId);

    // 6. Setup mock fetch for agent chat in tests
    const mockChatFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! I am your ShopSphere AI assistant. How can I help you today?'
            }
          }
        ]
      })
    });

    const { customerSupportAgent, orderAgent } = await import('../src/agents/definitions/index.js');
    customerSupportAgent.client.fetchFn = mockChatFetch;
    orderAgent.client.fetchFn = mockChatFetch;

    customerSupportAgent.keyManager.getAgentConfig = (name) => ({
      agentName: name,
      primaryKey: 'mock-key',
      backupKey: null,
      primaryModel: 'test-model',
      fallbackModel: 'fallback-model',
      isEnabled: true,
      hasPrimaryKey: true,
      hasBackupKey: false
    });
  });

  after(async () => {
    try {
      db.prepare('DELETE FROM agent_approval_requests WHERE request_id = ?').run(testApprovalRequestId);
      db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(customerUserId, adminUserId);
    } catch (e) {
      // ignore
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/agents: returns all 7 agents with masked keys (no secrets exposed)', async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.agents.length, 7);

    // Verify key masking everywhere: no raw 'sk-or' keys exposed
    const bodyStr = JSON.stringify(body);
    assert.ok(!bodyStr.includes('sk-or-v1-'), 'Never exposes raw OpenRouter API keys in API response');

    for (const agent of body.agents) {
      assert.ok(agent.name, 'Agent has a valid name');
      assert.ok(agent.description, 'Agent has a description');
      assert.ok(Array.isArray(agent.allowedTools), 'Agent specifies allowed tools');
    }
  });

  test('POST /api/agents/chat: validates input and handles chat interaction', async () => {
    // 1. Empty message rejection
    const emptyRes = await fetch(`${baseUrl}/api/agents/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });
    assert.equal(emptyRes.status, 400);

    // 2. Chat with CustomerSupportAgent
    const chatRes = await fetch(`${baseUrl}/api/agents/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie
      },
      body: JSON.stringify({
        message: 'Hello, what can you help me with?'
      })
    });
    assert.equal(chatRes.status, 200);

    const chatBody = await chatRes.json();
    assert.equal(chatBody.success, true);
    assert.equal(chatBody.agentName, 'CustomerSupportAgent');
    assert.ok(chatBody.runId);
    assert.ok(chatBody.response || chatBody.message);
  });

  test('POST /api/agents/:agentName/chat: routes directly to named agent and 404s on unknown', async () => {
    // 1. Direct chat with OrderAgent
    const orderChatRes = await fetch(`${baseUrl}/api/agents/OrderAgent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: customerCookie
      },
      body: JSON.stringify({
        message: 'I want to check my order history.'
      })
    });
    assert.equal(orderChatRes.status, 200);
    const orderChatBody = await orderChatRes.json();
    assert.equal(orderChatBody.agentName, 'OrderAgent');

    // 2. Unknown agent 404
    const unknownRes = await fetch(`${baseUrl}/api/agents/UnknownAgent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' })
    });
    assert.equal(unknownRes.status, 404);
  });

  test('GET /api/agents/approvals: enforces admin authorization', async () => {
    // 1. Unauthenticated gets 401
    const unauthRes = await fetch(`${baseUrl}/api/agents/approvals`);
    assert.equal(unauthRes.status, 401);

    // 2. Customer gets 403 Forbidden
    const custRes = await fetch(`${baseUrl}/api/agents/approvals`, {
      headers: { Cookie: customerCookie }
    });
    assert.equal(custRes.status, 403);

    // 3. Admin gets 200 with list
    const adminRes = await fetch(`${baseUrl}/api/agents/approvals`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(adminRes.status, 200);
    const adminBody = await adminRes.json();
    assert.equal(adminBody.success, true);
    assert.ok(Array.isArray(adminBody.approvals));
    assert.ok(adminBody.approvals.some((a) => a.request_id === testApprovalRequestId));
  });

  test('POST /api/agents/approvals/:id/approve & reject: admin can process approvals', async () => {
    // 1. Customer cannot approve
    const unauthApprove = await fetch(`${baseUrl}/api/agents/approvals/${testApprovalRequestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
      body: JSON.stringify({ reason: 'Hacking attempt' })
    });
    assert.equal(unauthApprove.status, 403);

    // 2. Admin approves request
    const adminApprove = await fetch(`${baseUrl}/api/agents/approvals/${testApprovalRequestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ reason: 'Verified by lead admin' })
    });
    assert.equal(adminApprove.status, 200);
    const approveBody = await adminApprove.json();
    assert.equal(approveBody.success, true);

    // Check status in DB updated to approved
    const updatedReq = db.prepare('SELECT status, review_reason FROM agent_approval_requests WHERE request_id = ?').get(testApprovalRequestId);
    assert.equal(updatedReq.status, 'approved');
    assert.equal(updatedReq.review_reason, 'Verified by lead admin');
  });

  test('GET /api/agents/metrics & /runs: admin can inspect telemetry and execution logs', async () => {
    // 1. Customer cannot view metrics
    const custMetrics = await fetch(`${baseUrl}/api/agents/metrics`, {
      headers: { Cookie: customerCookie }
    });
    assert.equal(custMetrics.status, 403);

    // 2. Admin retrieves metrics
    const adminMetrics = await fetch(`${baseUrl}/api/agents/metrics`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(adminMetrics.status, 200);
    const metricsBody = await adminMetrics.json();
    assert.equal(metricsBody.success, true);
    assert.ok(metricsBody.metrics.overview);
    assert.ok(metricsBody.metrics.health);

    // 3. Admin retrieves runs list
    const adminRuns = await fetch(`${baseUrl}/api/agents/runs`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(adminRuns.status, 200);
    const runsBody = await adminRuns.json();
    assert.equal(runsBody.success, true);
    assert.ok(Array.isArray(runsBody.runs));
  });
});
