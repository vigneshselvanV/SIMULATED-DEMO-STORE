/**
 * dispatcher.js
 * Validates tool calls, enforces session-injected user context, verifies permissions,
 * performs per-call dynamic AgentGuard gateway routing (Protected vs Direct Unprotected),
 * gates high-risk operations, records damage telemetry, and audit-logs all calls.
 */

import db from '../config/db.js';
import toolRegistry from './toolRegistry.js';
import auditLogger from '../services/auditLogger.js';
import agentguardService, { GatewayUnavailableError } from '../services/agentguardService.js';

export const SENSITIVE_TOOLS = [
  'issue_refund',
  'createMockRefund',
  'update_order',
  'send_payment',
  'export_customers',
  'adjustStock'
];

function getDamageType(toolName) {
  if (toolName === 'issue_refund' || toolName === 'createMockRefund') return 'refund';
  if (toolName === 'send_payment') return 'payment';
  if (toolName === 'export_customers') return 'data_export';
  if (toolName === 'update_order') return 'order_tamper';
  return 'other';
}

function validateParameters(schema, args) {
  if (!schema || typeof schema !== 'object') return true;
  if (schema.type === 'object' && schema.required && Array.isArray(schema.required)) {
    for (const reqField of schema.required) {
      if (args[reqField] === undefined || args[reqField] === null || args[reqField] === '') {
        throw new Error(`Missing required parameter: "${reqField}"`);
      }
    }
  }
  return true;
}

export class ToolDispatcher {
  constructor(options = {}) {
    this.registry = options.registry || toolRegistry;
  }

  /**
   * Dispatch a tool call initiated by an agent.
   */
  async dispatch({
    agentName,
    allowedTools = [],
    toolName,
    arguments: args = {},
    userContext = {},
    runId = null,
    requestId = null
  }) {
    const startTime = Date.now();
    let isError = false;
    let result = null;

    // 1. Tool authorization check: Is tool registered and allowed for this agent?
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      const err = new Error(`Tool "${toolName}" is not registered in system.`);
      this.recordToolCall({ runId, agentName, toolName, args, result: { error: err.message }, isError: true, latencyMs: Date.now() - startTime });
      return { success: false, error: err.message };
    }

    if (!allowedTools.includes(toolName)) {
      const err = new Error(`Security Violation: Agent "${agentName}" is not permitted to execute tool "${toolName}".`);
      this.recordToolCall({ runId, agentName, toolName, args, result: { error: err.message }, isError: true, latencyMs: Date.now() - startTime });
      return { success: false, error: err.message };
    }

    // 2. User Role & Permission checks
    const userRole = userContext?.user?.role || 'guest';
    const userId = userContext?.user?.id || null;

    if (tool.permissionScope === 'admin' && userRole !== 'admin') {
      const err = new Error(`Forbidden: Tool "${toolName}" requires administrator privileges.`);
      this.recordToolCall({ runId, agentName, toolName, args, result: { error: err.message }, isError: true, latencyMs: Date.now() - startTime });
      return { success: false, error: err.message };
    }

    // 3. Schema validation
    try {
      validateParameters(tool.parameters, args);
    } catch (valErr) {
      this.recordToolCall({ runId, agentName, toolName, args, result: { error: valErr.message }, isError: true, latencyMs: Date.now() - startTime });
      return { success: false, error: valErr.message };
    }

    // 4. Injected Context (Never accept userId from model arguments!)
    const sanitizedContext = {
      user: userContext.user || null,
      userId,
      role: userRole,
      agentName,
      runId,
      requestId
    };

    // 5. Per-Call Dynamic AgentGuard Routing
    const connState = agentguardService.getConnectionState();
    const isSensitive = SENSITIVE_TOOLS.includes(toolName);

    // ==========================================
    // CASE A: CONNECTED -> Protected by AgentGuard
    // ==========================================
    if (connState.isConnected) {
      let checkResult = null;
      try {
        checkResult = await agentguardService.checkActionWithGateway({
          toolName,
          args,
          userContext: sanitizedContext,
          runId
        });
      } catch (gatewayErr) {
        // STRICT FAIL-CLOSED: Gateway down, timeout, or invalid response must NOT fallback to direct execution!
        const failClosedMessage = {
          success: false,
          blockedByAgentGuard: true,
          failClosed: true,
          routingMode: 'gateway',
          routingLabel: 'Protected by AgentGuard',
          error: gatewayErr.message,
          message: `Security Gateway Unavailable (${gatewayErr.message}). Action aborted per strict fail-closed policy.`
        };

        agentguardService.recordDamageEvent({
          toolName,
          damageType: getDamageType(toolName),
          amountPaise: 0,
          recordCount: 0,
          routingMode: 'gateway',
          status: 'failed',
          details: `Fail closed: ${gatewayErr.message}`,
          sessionUserId: userId,
          runId
        });

        this.recordToolCall({
          runId,
          agentName,
          toolName,
          args,
          result: failClosedMessage,
          isError: true,
          latencyMs: Date.now() - startTime
        });

        return failClosedMessage;
      }

      // Gateway Policy Decision Check
      if (!checkResult.allowed) {
        const blockedMessage = {
          success: false,
          blockedByAgentGuard: true,
          routingMode: 'gateway',
          routingLabel: 'Protected by AgentGuard',
          ruleId: checkResult.ruleId,
          message: checkResult.reason || `Action "${toolName}" was blocked by AgentGuard security policy.`
        };

        agentguardService.recordDamageEvent({
          toolName,
          damageType: getDamageType(toolName),
          amountPaise: 0,
          recordCount: 0,
          routingMode: 'gateway',
          status: 'blocked',
          details: checkResult.reason,
          sessionUserId: userId,
          runId
        });

        this.recordToolCall({
          runId,
          agentName,
          toolName,
          args,
          result: blockedMessage,
          isError: false,
          latencyMs: Date.now() - startTime
        });

        return blockedMessage;
      }

      // If approved by Gateway: execute backend action under protected mode
      try {
        result = await tool.handler(args, sanitizedContext);
        if (result && typeof result === 'object') {
          result.routingMode = 'gateway';
          result.routingLabel = 'Protected by AgentGuard';
        }
      } catch (execErr) {
        isError = true;
        result = { error: execErr.message || 'Tool execution encountered an internal error.' };
      }

      const latencyMs = Date.now() - startTime;
      this.recordToolCall({ runId, agentName, toolName, args, result, isError, latencyMs });
      return result;
    }

    // ==========================================
    // CASE B: DISCONNECTED -> Direct (unprotected)
    // ==========================================
    // Check if non-demo high-risk human approval gating is needed
    const isTargetDemoTool = ['issue_refund', 'send_payment', 'export_customers', 'update_order'].includes(toolName);
    if (!isTargetDemoTool) {
      const autoApproveRefundMaxPaise = parseInt(process.env.REFUND_AUTO_APPROVE_MAX_PAISE, 10) || 200000;
      const isExcessiveRefund = toolName === 'createMockRefund' && (args.amountPaise || 0) > autoApproveRefundMaxPaise;
      const isHighRiskAction = tool.riskLevel === 'critical' || (tool.riskLevel === 'high' && userRole !== 'admin') || isExcessiveRefund;

      if (isHighRiskAction && !userContext.isPreApproved) {
        const approvalRequestId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        db.prepare(`
          INSERT INTO agent_approval_requests (
            request_id, run_id, agent_name, tool_name, arguments, risk_level, status, requested_by_user_id
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
        `).run(approvalRequestId, runId, agentName, toolName, JSON.stringify(args), tool.riskLevel, userId);

        const approvalMessage = {
          approvalRequired: true,
          approvalRequestId,
          status: 'pending',
          routingMode: 'direct',
          routingLabel: 'Direct (unprotected)',
          message: `High-risk action "${toolName}" requires administrator approval before execution. Request ID: ${approvalRequestId}.`
        };

        this.recordToolCall({ runId, agentName, toolName, args, result: approvalMessage, isError: false, latencyMs: Date.now() - startTime });
        return approvalMessage;
      }
    }

    // Execute directly via local backend
    try {
      result = await tool.handler(args, sanitizedContext);
      if (result && typeof result === 'object') {
        result.routingMode = 'direct';
        result.routingLabel = 'Direct (unprotected)';
      }

      // Record damage event on successful unprotected execution of sensitive actions
      if (isSensitive) {
        let amtPaise = args.amountPaise || 0;
        let recCount = result?.recordCount || 0;
        if (toolName === 'createMockRefund' && result?.refundAmountPaise) amtPaise = result.refundAmountPaise;

        agentguardService.recordDamageEvent({
          toolName,
          damageType: getDamageType(toolName),
          amountPaise: amtPaise,
          recordCount: recCount,
          routingMode: 'direct',
          status: 'executed',
          details: `Direct execution: ${JSON.stringify(args)}`,
          sessionUserId: userId,
          runId
        });
      }
    } catch (execErr) {
      isError = true;
      result = { error: execErr.message || 'Tool execution encountered an internal error.' };
    }

    const latencyMs = Date.now() - startTime;
    this.recordToolCall({ runId, agentName, toolName, args, result, isError, latencyMs });

    try {
      auditLogger.log({
        actorType: 'agent',
        actorId: String(userId || agentName),
        action: `AGENT_TOOL_${toolName.toUpperCase()}`,
        entityType: 'TOOL_EXECUTION',
        entityId: toolName,
        agentName,
        requestId,
        metadata: {
          latencyMs,
          isError,
          runId,
          routingMode: 'direct',
          routingLabel: 'Direct (unprotected)'
        }
      });
    } catch (auditErr) {
      // ignore
    }

    return result;
  }

  recordToolCall({ runId, agentName, toolName, args, result, isError, latencyMs }) {
    if (!runId) return;
    try {
      db.prepare(`
        INSERT INTO agent_tool_calls (
          run_id, agent_name, tool_name, arguments, result, is_error, latency_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        runId,
        agentName,
        toolName,
        JSON.stringify(args || {}),
        JSON.stringify(result || {}),
        isError ? 1 : 0,
        latencyMs
      );
    } catch (e) {
      console.error('Failed to record agent tool call:', e);
    }
  }
}

export const dispatcher = new ToolDispatcher();
export default dispatcher;
