/**
 * agentRoutes.js
 * Express router mapping agent chat, status, approval queue, and metrics endpoints.
 */

import { Router } from 'express';
import { agentController } from '../controllers/agentController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public / Authenticated agent status & chat
router.get('/', agentController.getAgentsList);
router.post('/chat', agentController.chatWithAgent);

// Admin-only management, approvals, telemetry & audit history
router.get('/approvals', requireAdmin, agentController.getApprovalRequests);
router.post('/approvals/:id/approve', requireAdmin, agentController.approveRequest);
router.post('/approvals/:id/reject', requireAdmin, agentController.rejectRequest);
router.get('/metrics', requireAdmin, agentController.getAgentMetrics);
router.get('/runs', requireAdmin, agentController.getAgentRuns);
router.get('/runs/:runId/tools', requireAdmin, agentController.getRunToolCalls);

// Specific agent direct chat endpoint (after static routes to prevent collision)
router.post('/:agentName/chat', agentController.chatWithAgent);

export default router;
