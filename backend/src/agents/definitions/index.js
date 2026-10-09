/**
 * index.js
 * Central registry and orchestrator for all 7 ShopSphere AI Agents.
 * Configures multi-agent handoffs, provides lookup helpers, and exports singleton agents.
 */

import { orderAgent, OrderAgent } from './orderAgent.js';
import { paymentAgent, PaymentAgent } from './paymentAgent.js';
import { warehouseAgent, WarehouseAgent } from './warehouseAgent.js';
import { trackingAgent, TrackingAgent } from './trackingAgent.js';
import { customerSupportAgent, CustomerSupportAgent } from './supportAgent.js';
import { returnAgent, ReturnAgent } from './returnAgent.js';
import { refundAgent, RefundAgent } from './refundAgent.js';
import { setAgentResolver } from '../tools/handoffTools.js';
import '../tools/index.js';
import keyManager from '../llm/keyManager.js';

export const agents = {
  OrderAgent: orderAgent,
  PaymentAgent: paymentAgent,
  WarehouseAgent: warehouseAgent,
  TrackingAgent: trackingAgent,
  CustomerSupportAgent: customerSupportAgent,
  ReturnAgent: returnAgent,
  RefundAgent: refundAgent
};

const AGENT_ALIAS_MAP = {
  order: 'OrderAgent',
  orderagent: 'OrderAgent',
  payment: 'PaymentAgent',
  paymentagent: 'PaymentAgent',
  warehouse: 'WarehouseAgent',
  warehouseagent: 'WarehouseAgent',
  tracking: 'TrackingAgent',
  trackingagent: 'TrackingAgent',
  support: 'CustomerSupportAgent',
  supportagent: 'CustomerSupportAgent',
  customersupport: 'CustomerSupportAgent',
  customersupportagent: 'CustomerSupportAgent',
  return: 'ReturnAgent',
  returnagent: 'ReturnAgent',
  refund: 'RefundAgent',
  refundagent: 'RefundAgent'
};

/**
 * Normalized lookup helper supporting multiple casing and naming conventions
 * (e.g., 'order', 'orderagent', 'support', 'CustomerSupportAgent').
 */
export function getAgent(name) {
  if (!name || typeof name !== 'string') return null;

  const clean = name.trim().toLowerCase();
  const canonicalName = AGENT_ALIAS_MAP[clean];
  if (canonicalName && agents[canonicalName]) {
    return agents[canonicalName];
  }

  for (const [key, agent] of Object.entries(agents)) {
    const keyLower = key.toLowerCase();
    if (keyLower === clean || keyLower === `${clean}agent` || keyLower.replace(/agent$/, '') === clean) {
      return agent;
    }
  }

  return null;
}

/**
 * Register resolver in handoffTools to enable multi-agent routing.
 */
setAgentResolver(getAgent);

/**
 * List metadata and configuration status for all 7 agents.
 */
export function listAgents() {
  return Object.values(agents).map((agent) => {
    let config = null;
    try {
      config = keyManager.getAgentConfig(agent.name);
    } catch (e) {
      config = { isEnabled: false };
    }

    return {
      name: agent.name,
      description: agent.description,
      allowedTools: agent.allowedTools,
      isEnabled: config ? config.isEnabled : false,
      primaryModel: config?.primaryModel || null,
      fallbackModel: config?.fallbackModel || null,
      hasPrimaryKey: config?.hasPrimaryKey || false,
      hasBackupKey: config?.hasBackupKey || false
    };
  });
}

export {
  orderAgent,
  OrderAgent,
  paymentAgent,
  PaymentAgent,
  warehouseAgent,
  WarehouseAgent,
  trackingAgent,
  TrackingAgent,
  customerSupportAgent,
  CustomerSupportAgent,
  returnAgent,
  ReturnAgent,
  refundAgent,
  RefundAgent
};

export default agents;
