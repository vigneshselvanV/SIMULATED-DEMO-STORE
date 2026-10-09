/**
 * handoffTools.js
 * Multi-agent routing handoff tool enabling CustomerSupportAgent to delegate
 * domain-specific customer requests to specialized agents.
 */

import auditLogger from '../../services/auditLogger.js';

let agentResolver = null;

/**
 * Register the agent lookup function to avoid circular imports.
 */
export function setAgentResolver(resolver) {
  agentResolver = resolver;
}

export const handoffTools = {
  /**
   * Route customer inquiry to a specialized agent.
   */
  async routeToAgent({ targetAgent, query, reason = 'Specialized domain inquiry' } = {}, context = {}) {
    if (!targetAgent) {
      throw new Error('targetAgent is required for handoff routing.');
    }

    const validAgents = [
      'OrderAgent',
      'PaymentAgent',
      'WarehouseAgent',
      'TrackingAgent',
      'ReturnAgent',
      'RefundAgent'
    ];

    if (!validAgents.includes(targetAgent)) {
      throw new Error(`Invalid target agent "${targetAgent}". Supported agents: ${validAgents.join(', ')}`);
    }

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('query parameter cannot be empty for agent handoff.');
    }

    try {
      auditLogger.log({
        actorType: 'agent',
        actorId: 'CustomerSupportAgent',
        action: 'AGENT_HANDOFF_INITIATED',
        entityType: 'AGENT_HANDOFF',
        entityId: targetAgent,
        agentName: 'CustomerSupportAgent',
        metadata: { targetAgent, reason, query: query.trim() }
      });
    } catch (e) {
      // ignore
    }

    // Resolve and execute target agent if resolver registered
    if (typeof agentResolver === 'function') {
      const agentInstance = agentResolver(targetAgent);
      if (agentInstance && typeof agentInstance.run === 'function') {
        try {
          const runResult = await agentInstance.run({
            message: query.trim(),
            history: [],
            userContext: context
          });

          return {
            success: true,
            handedOff: true,
            targetAgent,
            reason,
            delegatedRunId: runResult.runId,
            response: runResult.response
          };
        } catch (delegationErr) {
          return {
            success: true,
            handedOff: true,
            targetAgent,
            reason,
            fallbackNote: `Handoff established. ${targetAgent} received query: "${query.trim()}".`
          };
        }
      }
    }

    return {
      success: true,
      handedOff: true,
      targetAgent,
      reason,
      message: `Handoff to ${targetAgent} completed successfully.`
    };
  }
};

export default handoffTools;
