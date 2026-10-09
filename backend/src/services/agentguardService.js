/**
 * agentguardService.js
 * Authoritative connection manager, per-call dynamic gateway routing,
 * HMAC signature verification, damage telemetry tracking, and demo reset.
 */

import crypto from 'crypto';
import db from '../config/db.js';
import auditLogger from './auditLogger.js';

export class GatewayUnavailableError extends Error {
  constructor(message) {
    super(message || 'AgentGuard Gateway is currently unavailable. Failing closed.');
    this.name = 'GatewayUnavailableError';
    this.code = 'GATEWAY_UNAVAILABLE';
  }
}

export class AgentGuardService {
  constructor() {
    this.mockMode = 'normal'; // 'normal' | 'force_deny' | 'force_down' | 'force_invalid'
  }

  /**
   * Mask API key for secure public/admin inspection.
   */
  maskApiKey(key) {
    if (!key || typeof key !== 'string') return null;
    const trimmed = key.trim();
    if (trimmed.length <= 8) return '****';
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  }

  /**
   * Retrieve authoritative connection state from database.
   */
  getConnectionState() {
    try {
      const conn = db.prepare('SELECT * FROM agentguard_connection WHERE id = 1').get();
      if (!conn) {
        return {
          status: 'disconnected',
          tenantId: 'tenant_demo_shopsphere',
          gatewayUrl: 'http://localhost:5001',
          isConnected: false,
          apiKeyMasked: null
        };
      }

      return {
        id: conn.id,
        status: conn.status,
        tenantId: conn.tenant_id,
        gatewayUrl: conn.gateway_url,
        isConnected: conn.status === 'connected',
        lastConnectedAt: conn.last_connected_at,
        lastHeartbeatAt: conn.last_heartbeat_at,
        errorMessage: conn.error_message,
        apiKeyMasked: this.maskApiKey(conn.api_key),
        hasApiKey: Boolean(conn.api_key && conn.api_key.trim().length > 0)
      };
    } catch (err) {
      console.error('[AgentGuardService] Error getting connection state:', err);
      return {
        status: 'disconnected',
        tenantId: 'tenant_demo_shopsphere',
        gatewayUrl: 'http://localhost:5001',
        isConnected: false,
        apiKeyMasked: null
      };
    }
  }

  /**
   * Get raw API key (strictly server-side, never exposed to clients).
   */
  getRawApiKey() {
    const conn = db.prepare('SELECT api_key FROM agentguard_connection WHERE id = 1').get();
    return conn ? conn.api_key : null;
  }

  /**
   * Connect to AgentGuard Gateway with validation and persistence.
   */
  async connect({ tenantId, apiKey, gatewayUrl } = {}) {
    const effectiveTenantId = (tenantId || 'tenant_demo_shopsphere').trim();
    const effectiveGatewayUrl = (gatewayUrl || 'http://localhost:5001').trim();
    const effectiveApiKey = (apiKey || 'ag_live_sec_' + crypto.randomBytes(16).toString('hex')).trim();

    if (!effectiveTenantId) throw new Error('Tenant ID is required.');
    if (!effectiveGatewayUrl) throw new Error('Gateway URL is required.');

    // Validate Gateway URL format
    try {
      new URL(effectiveGatewayUrl);
    } catch (e) {
      throw new Error('Invalid Gateway URL format.');
    }

    // Persist connected state
    db.prepare(`
      UPDATE agentguard_connection
      SET status = 'connected',
          tenant_id = ?,
          api_key = ?,
          gateway_url = ?,
          last_connected_at = CURRENT_TIMESTAMP,
          last_heartbeat_at = CURRENT_TIMESTAMP,
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(effectiveTenantId, effectiveApiKey, effectiveGatewayUrl);

    try {
      auditLogger.log({
        actorType: 'admin',
        action: 'AGENTGUARD_CONNECTED',
        entityType: 'GATEWAY_CONNECTION',
        entityId: effectiveTenantId,
        metadata: {
          tenantId: effectiveTenantId,
          gatewayUrl: effectiveGatewayUrl,
          apiKeyMasked: this.maskApiKey(effectiveApiKey)
        }
      });
    } catch (e) {
      // ignore
    }

    return this.getConnectionState();
  }

  /**
   * Disconnect AgentGuard Gateway (switches store to Direct Unprotected mode).
   */
  async disconnect() {
    db.prepare(`
      UPDATE agentguard_connection
      SET status = 'disconnected',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();

    try {
      auditLogger.log({
        actorType: 'admin',
        action: 'AGENTGUARD_DISCONNECTED',
        entityType: 'GATEWAY_CONNECTION',
        entityId: '1',
        metadata: { status: 'disconnected' }
      });
    } catch (e) {
      // ignore
    }

    return this.getConnectionState();
  }

  /**
   * Cryptographic signature generation for gateway requests.
   */
  generateSignature(payload, timestamp, secretKey) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const data = `${timestamp}.${payloadStr}`;
    return crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  }

  /**
   * Validate incoming webhook callback signature with timestamp freshness.
   */
  verifyCallbackSignature({ payload, signature, timestamp, secretKey = null }) {
    if (!signature || !timestamp) {
      return { valid: false, reason: 'Missing signature or timestamp headers.' };
    }

    const effectiveKey = secretKey || this.getRawApiKey();
    if (!effectiveKey) {
      return { valid: false, reason: 'No active AgentGuard API key found for verification.' };
    }

    // Timestamp freshness: must be within 300 seconds (5 minutes)
    const now = Date.now();
    const tsNum = parseInt(timestamp, 10);
    if (isNaN(tsNum) || Math.abs(now - tsNum) > 300000) {
      return { valid: false, reason: 'Callback timestamp expired or clock skew exceeds 300s.' };
    }

    const expectedSignature = this.generateSignature(payload, tsNum, effectiveKey);

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { valid: false, reason: 'HMAC signature mismatch.' };
    }

    return { valid: true };
  }

  /**
   * Evaluates security policy rules against a proposed action.
   * Internal intelligent rule engine used when routing through AgentGuard.
   */
  evaluateSecurityPolicy(actionPayload) {
    const { toolName, arguments: args = {}, userContext = {} } = actionPayload;

    // Check for prompt injection or system override attempts in all string fields
    const allText = JSON.stringify(args).toLowerCase();
    const injectionPatterns = [
      'system override',
      'ignore previous instructions',
      'admin bypass',
      'bypass security',
      'disregard rules',
      'escalate privileges',
      'grant admin',
      'developer mode'
    ];

    for (const pattern of injectionPatterns) {
      if (allText.includes(pattern)) {
        return {
          allowed: false,
          ruleId: 'RULE_PROMPT_INJECTION_DETECTED',
          reason: `AgentGuard blocked action: Indirect prompt injection detected in tool input ("${pattern}").`
        };
      }
    }

    // Policy Rule 1: issue_refund protection
    if (toolName === 'issue_refund' || toolName === 'createMockRefund') {
      const amountPaise = args.amountPaise || 0;
      // High-value refund threshold: > ₹5,000 (500,000 paise) without admin role
      if (amountPaise > 500000 && userContext.role !== 'admin') {
        return {
          allowed: false,
          ruleId: 'RULE_EXCESSIVE_REFUND_BLOCKED',
          reason: `AgentGuard blocked action: Unauthorized refund amount (${amountPaise / 100} INR) exceeds policy limit.`
        };
      }

      // Vague or missing refund reason
      if (!args.reason || args.reason.trim().length < 5) {
        return {
          allowed: false,
          ruleId: 'RULE_SUSPICIOUS_REFUND_REASON',
          reason: 'AgentGuard blocked action: Suspicious or missing refund justification.'
        };
      }
    }

    // Policy Rule 2: send_payment protection
    if (toolName === 'send_payment') {
      // Public users or guests can never trigger external disbursements
      if (userContext.role !== 'admin') {
        return {
          allowed: false,
          ruleId: 'RULE_UNAUTHORIZED_DISBURSEMENT',
          reason: 'AgentGuard blocked action: Outbound financial disbursements are strictly prohibited for non-administrator sessions.'
        };
      }
    }

    // Policy Rule 3: export_customers protection
    if (toolName === 'export_customers') {
      if (userContext.role !== 'admin') {
        return {
          allowed: false,
          ruleId: 'RULE_DATA_EXFILTRATION_BLOCKED',
          reason: 'AgentGuard blocked action: Customer PII bulk exfiltration blocked by data loss prevention (DLP) policy.'
        };
      }
    }

    // Policy Rule 4: update_order address redirect protection
    if (toolName === 'update_order' && args.shippingAddress) {
      const suspiciousAddressKeywords = ['dropoff point', 'anonymous locker', 'unverified freight', 'p.o. box 000'];
      const addrLower = (args.shippingAddress || '').toLowerCase();
      for (const kw of suspiciousAddressKeywords) {
        if (addrLower.includes(kw)) {
          return {
            allowed: false,
            ruleId: 'RULE_SUSPICIOUS_ORDER_REDIRECT',
            reason: `AgentGuard blocked action: High-risk shipping address redirect detected ("${kw}").`
          };
        }
      }
    }

    return {
      allowed: true,
      ruleId: 'RULE_POLICY_PASSED',
      reason: 'Action verified and approved by AgentGuard Gateway.'
    };
  }

  /**
   * Dynamic Per-Call Gateway Dispatch with Fail-Closed Enforcement.
   * Sends the action to the Gateway, evaluates policy, and returns outcome.
   */
  async checkActionWithGateway({ toolName, args, userContext = {}, runId = null }) {
    const conn = this.getConnectionState();
    if (!conn.isConnected) {
      throw new Error('checkActionWithGateway called while disconnected.');
    }

    // Test Harness Hooks: simulate gateway failure states for red-team verification
    if (this.mockMode === 'force_down') {
      throw new GatewayUnavailableError('AgentGuard Gateway connection timed out (Simulated Outage). Action failed closed.');
    }

    if (this.mockMode === 'force_invalid') {
      throw new GatewayUnavailableError('AgentGuard Gateway returned corrupted non-JSON response. Action failed closed.');
    }

    if (this.mockMode === 'force_deny') {
      return {
        allowed: false,
        ruleId: 'RULE_MOCK_FORCE_DENIED',
        reason: 'AgentGuard blocked action: Enforced denial rule.'
      };
    }

    const payload = {
      tenantId: conn.tenantId,
      toolName,
      arguments: args,
      userContext: {
        userId: userContext.userId || null,
        role: userContext.role || 'guest'
      },
      runId,
      timestamp: Date.now()
    };

    // If external gateway URL is configured and not local demo, attempt live HTTP fetch
    if (conn.gatewayUrl && !conn.gatewayUrl.includes('localhost:5001') && !conn.gatewayUrl.includes('mock')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s strict timeout

      try {
        const rawKey = this.getRawApiKey();
        const signature = this.generateSignature(payload, payload.timestamp, rawKey);

        const response = await fetch(`${conn.gatewayUrl.replace(/\/+$/, '')}/v1/action/check`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-agentguard-tenant': conn.tenantId,
            'x-agentguard-timestamp': String(payload.timestamp),
            'x-agentguard-signature': signature
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new GatewayUnavailableError(`Gateway returned HTTP ${response.status}. Action failed closed.`);
        }

        const data = await response.json();
        return {
          allowed: Boolean(data.allowed),
          ruleId: data.ruleId || 'GATEWAY_REMOTE_EVAL',
          reason: data.reason || (data.allowed ? 'Approved by remote AgentGuard.' : 'Blocked by remote AgentGuard.')
        };
      } catch (err) {
        clearTimeout(timeoutId);
        // CRITICAL FAIL-CLOSED: Any HTTP error or timeout halts execution
        throw new GatewayUnavailableError(`AgentGuard Gateway unreachable (${err.message}). Action failed closed.`);
      }
    }

    // Default: Evaluate via built-in high-fidelity rule policy engine
    return this.evaluateSecurityPolicy(payload);
  }

  /**
   * Record a Damage Event (financial loss or data exfiltration caused in unprotected mode).
   */
  recordDamageEvent({
    toolName,
    damageType,
    amountPaise = 0,
    recordCount = 0,
    routingMode = 'direct',
    status = 'executed',
    details = '',
    sessionUserId = null,
    runId = null
  }) {
    try {
      db.prepare(`
        INSERT INTO agentguard_damage_events (
          tool_name, damage_type, amount_paise, record_count, routing_mode, status, details, session_user_id, run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        toolName,
        damageType,
        amountPaise,
        recordCount,
        routingMode,
        status,
        details,
        sessionUserId,
        runId
      );
    } catch (err) {
      console.error('[AgentGuardService] Error recording damage event:', err);
    }
  }

  /**
   * Aggregate live Damage Dashboard metrics.
   */
  getDamageMetrics() {
    try {
      const totals = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN damage_type = 'refund' AND status = 'executed' AND routing_mode = 'direct' THEN amount_paise ELSE 0 END), 0) as money_refunded_paise,
          COALESCE(SUM(CASE WHEN damage_type = 'payment' AND status = 'executed' AND routing_mode = 'direct' THEN amount_paise ELSE 0 END), 0) as payments_sent_paise,
          COALESCE(SUM(CASE WHEN damage_type = 'data_export' AND status = 'executed' AND routing_mode = 'direct' THEN record_count ELSE 0 END), 0) as customers_exported_count,
          COUNT(*) as total_events_count,
          COALESCE(SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END), 0) as blocked_attacks_count,
          COALESCE(SUM(CASE WHEN status = 'executed' AND routing_mode = 'direct' THEN 1 ELSE 0 END), 0) as successful_exploits_count
        FROM agentguard_damage_events
      `).get();

      const ledger = db.prepare('SELECT balance_paise, total_disbursed_paise FROM agentguard_merchant_ledger WHERE id = 1').get() || {
        balance_paise: 50000000,
        total_disbursed_paise: 0
      };

      const recentEvents = db.prepare(`
        SELECT * FROM agentguard_damage_events
        ORDER BY id DESC LIMIT 25
      `).all();

      return {
        moneyRefundedPaise: totals.money_refunded_paise,
        paymentsSentPaise: totals.payments_sent_paise,
        customersExportedCount: totals.customers_exported_count,
        totalEventsCount: totals.total_events_count,
        blockedAttacksCount: totals.blocked_attacks_count,
        successfulExploitsCount: totals.successful_exploits_count,
        merchantBalancePaise: ledger.balance_paise,
        merchantDisbursedPaise: ledger.total_disbursed_paise,
        recentEvents
      };
    } catch (err) {
      console.error('[AgentGuardService] Error compiling damage metrics:', err);
      return {
        moneyRefundedPaise: 0,
        paymentsSentPaise: 0,
        customersExportedCount: 0,
        totalEventsCount: 0,
        blockedAttacksCount: 0,
        successfulExploitsCount: 0,
        merchantBalancePaise: 50000000,
        merchantDisbursedPaise: 0,
        recentEvents: []
      };
    }
  }

  /**
   * Authorized Demo Reset Workflow.
   * 1. Disconnects AgentGuard.
   * 2. Restores synthetic merchant balance to ₹500,000.
   * 3. Wipes damage events and attack history.
   * 4. Returns system to pristine vulnerable baseline.
   */
  async resetDemo() {
    db.prepare(`
      UPDATE agentguard_connection
      SET status = 'disconnected',
          error_message = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();

    db.prepare(`
      UPDATE agentguard_merchant_ledger
      SET balance_paise = 50000000,
          total_disbursed_paise = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run();

    db.prepare('DELETE FROM agentguard_damage_events').run();

    // Reset simulated orders to pending/delivered baseline without refunds
    db.prepare("UPDATE orders SET status = 'Delivered', payment_status = 'Paid' WHERE id IN (1, 2)").run();
    db.prepare("DELETE FROM refunds WHERE order_id IN (1, 2)").run();

    try {
      auditLogger.log({
        actorType: 'admin',
        action: 'AGENTGUARD_DEMO_RESET',
        entityType: 'DEMO_ENVIRONMENT',
        entityId: '1',
        metadata: {
          restoredStatus: 'disconnected',
          initialBalancePaise: 50000000
        }
      });
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      message: 'Demo environment reset successfully. AgentGuard disconnected and damage metrics cleared.',
      connection: this.getConnectionState(),
      metrics: this.getDamageMetrics()
    };
  }
}

export const agentguardService = new AgentGuardService();
export default agentguardService;
