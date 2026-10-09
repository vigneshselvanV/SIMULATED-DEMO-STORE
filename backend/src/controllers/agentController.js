/**
 * agentController.js
 * Controller handling public and authenticated agent chat endpoints,
 * agent status inspection, administrator approval queues, and telemetry metrics.
 */

import db from '../config/db.js';
import { getAgent, listAgents } from '../agents/definitions/index.js';
import keyManager from '../agents/llm/keyManager.js';
import toolRegistry from '../agents/toolRegistry.js';
import auditLogger from '../services/auditLogger.js';

export const agentController = {
  /**
   * List all 7 agents with configuration, masked keys, and availability.
   * GET /api/agents
   */
  async getAgentsList(req, res) {
    try {
      const agentsMeta = listAgents();
      const statusOverview = keyManager.getStatus();

      const combined = agentsMeta.map((agent) => {
        let canonicalKey = agent.name.toLowerCase().replace(/agent$/, '');
        if (canonicalKey === 'customersupport') canonicalKey = 'support';
        const agentStatus = statusOverview.agents[canonicalKey] || {};
        return {
          ...agent,
          activeSlot: agentStatus.activeSlot || 'primary',
          failoverCount: agentStatus.failoverCount || 0,
          primaryKeyMasked: agentStatus.primaryKeyMasked || null,
          backupKeyMasked: agentStatus.backupKeyMasked || null
        };
      });

      res.json({
        success: true,
        globallyEnabled: statusOverview.globallyEnabled,
        agents: combined
      });
    } catch (err) {
      console.error('Error fetching agents list:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve agent configurations.' });
    }
  },

  /**
   * Chat with default or specified AI Agent.
   * POST /api/agents/chat
   * POST /api/agents/:agentName/chat
   */
  async chatWithAgent(req, res) {
    const targetAgentName = req.params.agentName || req.body.agentName || 'CustomerSupportAgent';
    const { message, history = [], requestId = null } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message field is required and cannot be empty.'
      });
    }

    const agent = getAgent(targetAgentName);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: `Agent "${targetAgentName}" not found. Valid agents: OrderAgent, PaymentAgent, WarehouseAgent, TrackingAgent, CustomerSupportAgent, ReturnAgent, RefundAgent.`
      });
    }

    // Context is injected strictly from authenticated session
    const userContext = {
      user: req.user ? { id: req.user.id, role: req.user.role, email: req.user.email, name: req.user.name } : null
    };

    try {
      const result = await agent.run({
        message: message.trim(),
        history: Array.isArray(history) ? history : [],
        userContext,
        requestId
      });

      res.json({
        success: result.success !== false,
        agentName: agent.name,
        runId: result.runId,
        message: result.message,
        response: result.response || result.message,
        approvalPending: Boolean(result.approvalPending),
        toolCallsCount: result.toolCallsCount || 0,
        iterations: result.iterations || 1,
        modelUsed: result.modelUsed || null,
        durationMs: result.durationMs || null
      });
    } catch (err) {
      console.error(`Agent execution error for [${agent.name}]:`, err);
      res.status(500).json({
        success: false,
        agentName: agent.name,
        message: 'The AI assistant encountered an unexpected error processing your request. Please try again.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  },

  /**
   * List human approval requests for high-risk operations (Admin only).
   * GET /api/agents/approvals
   */
  async getApprovalRequests(req, res) {
    try {
      const { status = 'all' } = req.query;
      let query = `
        SELECT a.*, u.name as requested_by_user_name, u.email as requested_by_user_email,
               admin.name as reviewed_by_admin_name
        FROM agent_approval_requests a
        LEFT JOIN users u ON a.requested_by_user_id = u.id
        LEFT JOIN users admin ON a.reviewed_by_admin_id = admin.id
      `;
      const params = [];

      if (status && status !== 'all') {
        query += ' WHERE a.status = ?';
        params.push(status);
      }

      query += ' ORDER BY a.created_at DESC LIMIT 100';

      const approvals = db.prepare(query).all(...params);
      res.json({ success: true, count: approvals.length, approvals });
    } catch (err) {
      console.error('Error fetching approval requests:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch approval requests.' });
    }
  },

  /**
   * Approve a pending high-risk tool call and execute it (Admin only).
   * POST /api/agents/approvals/:id/approve
   */
  async approveRequest(req, res) {
    const { id } = req.params;
    const { reason = 'Approved by administrator' } = req.body;

    try {
      const approval = db.prepare(`
        SELECT * FROM agent_approval_requests WHERE id = ? OR request_id = ?
      `).get(id, id);

      if (!approval) {
        return res.status(404).json({ success: false, message: 'Approval request not found.' });
      }

      if (approval.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request is already marked as "${approval.status}".`
        });
      }

      const tool = toolRegistry.getTool(approval.tool_name);
      if (!tool) {
        return res.status(400).json({
          success: false,
          message: `Registered tool "${approval.tool_name}" not found.`
        });
      }

      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(approval.arguments);
      } catch (e) {
        parsedArgs = {};
      }

      const adminContext = {
        user: req.user,
        userId: req.user.id,
        role: 'admin',
        agentName: approval.agent_name,
        isPreApproved: true
      };

      // Execute tool with pre-approval bypass
      const toolResult = await tool.handler(parsedArgs, adminContext);

      // Update approval request status
      db.prepare(`
        UPDATE agent_approval_requests
        SET status = 'approved', reviewed_by_admin_id = ?, review_reason = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user.id, reason, approval.id);

      try {
        auditLogger.log({
          actorType: 'admin',
          actorId: String(req.user.id),
          action: 'AGENT_APPROVAL_GRANTED',
          entityType: 'APPROVAL_REQUEST',
          entityId: approval.request_id,
          agentName: approval.agent_name,
          metadata: { toolName: approval.tool_name, toolResult, reason }
        });
      } catch (e) {
        // ignore
      }

      res.json({
        success: true,
        message: `Approval request ${approval.request_id} approved. Action executed successfully.`,
        toolResult
      });
    } catch (err) {
      console.error('Error approving request:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to approve request.' });
    }
  },

  /**
   * Reject a pending high-risk tool call (Admin only).
   * POST /api/agents/approvals/:id/reject
   */
  async rejectRequest(req, res) {
    const { id } = req.params;
    const { reason = 'Rejected by administrator' } = req.body;

    try {
      const approval = db.prepare(`
        SELECT * FROM agent_approval_requests WHERE id = ? OR request_id = ?
      `).get(id, id);

      if (!approval) {
        return res.status(404).json({ success: false, message: 'Approval request not found.' });
      }

      if (approval.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request is already marked as "${approval.status}".`
        });
      }

      db.prepare(`
        UPDATE agent_approval_requests
        SET status = 'rejected', reviewed_by_admin_id = ?, review_reason = ?, reviewed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user.id, reason, approval.id);

      try {
        auditLogger.log({
          actorType: 'admin',
          actorId: String(req.user.id),
          action: 'AGENT_APPROVAL_REJECTED',
          entityType: 'APPROVAL_REQUEST',
          entityId: approval.request_id,
          agentName: approval.agent_name,
          metadata: { toolName: approval.tool_name, reason }
        });
      } catch (e) {
        // ignore
      }

      res.json({
        success: true,
        message: `Approval request ${approval.request_id} has been rejected.`
      });
    } catch (err) {
      console.error('Error rejecting request:', err);
      res.status(500).json({ success: false, message: 'Failed to reject request.' });
    }
  },

  /**
   * Telemetry metrics for Agent performance and health (Admin only).
   * GET /api/agents/metrics
   */
  async getAgentMetrics(req, res) {
    try {
      const statusOverview = keyManager.getStatus();

      const runStats = db.prepare(`
        SELECT
          COUNT(*) as totalRuns,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedRuns,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedRuns,
          SUM(CASE WHEN status = 'approval_pending' THEN 1 ELSE 0 END) as pendingApprovalRuns,
          ROUND(AVG(duration_ms), 1) as avgDurationMs
        FROM agent_runs
      `).get();

      const agentBreakdown = db.prepare(`
        SELECT agent_name, COUNT(*) as runCount, ROUND(AVG(duration_ms), 1) as avgDurationMs
        FROM agent_runs
        GROUP BY agent_name
        ORDER BY runCount DESC
      `).all();

      const approvalStats = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM agent_approval_requests
        GROUP BY status
      `).all();

      res.json({
        success: true,
        metrics: {
          overview: runStats,
          agentBreakdown,
          approvalStats,
          health: statusOverview
        }
      });
    } catch (err) {
      console.error('Error fetching agent metrics:', err);
      res.status(500).json({ success: false, message: 'Failed to compile metrics.' });
    }
  },

  /**
   * Execution history list (Admin only).
   * GET /api/agents/runs
   */
  async getAgentRuns(req, res) {
    try {
      const { agentName = null, limit = 50 } = req.query;
      let query = `
        SELECT r.*, u.name as user_name, u.email as user_email
        FROM agent_runs r
        LEFT JOIN users u ON r.user_id = u.id
      `;
      const params = [];

      if (agentName) {
        query += ' WHERE r.agent_name = ?';
        params.push(agentName);
      }

      query += ' ORDER BY r.created_at DESC LIMIT ?';
      params.push(Math.max(1, Math.min(200, parseInt(limit, 10) || 50)));

      const runs = db.prepare(query).all(...params);
      res.json({ success: true, count: runs.length, runs });
    } catch (err) {
      console.error('Error fetching agent runs:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve execution runs.' });
    }
  },

  /**
   * Tool calls for a specific run (Admin only).
   * GET /api/agents/runs/:runId/tools
   */
  async getRunToolCalls(req, res) {
    const { runId } = req.params;
    try {
      const toolCalls = db.prepare(`
        SELECT * FROM agent_tool_calls WHERE run_id = ? ORDER BY id ASC
      `).all(runId);

      res.json({ success: true, count: toolCalls.length, toolCalls });
    } catch (err) {
      console.error('Error fetching tool calls:', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve tool calls.' });
    }
  }
};

export default agentController;
