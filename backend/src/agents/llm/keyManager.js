/**
 * keyManager.js
 * Per-Agent Key Routing, Failover, Model Management, and Health Tracking.
 * Masks all keys, prevents hammer on failed keys via cooldowns, and never crashes on missing keys.
 */

import auditLogger from '../../services/auditLogger.js';

export const AGENT_NAMES = [
  'order',
  'payment',
  'warehouse',
  'tracking',
  'support',
  'return',
  'refund'
];

const DEFAULT_PRIMARY_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const DEFAULT_FALLBACK_MODEL = 'google/gemini-2.0-flash-lite-preview:free';
const COOLDOWN_DURATION_MS = 60 * 1000; // 60s cooldown for failing/rate-limited keys

export function maskApiKey(key) {
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export class KeyManager {
  constructor() {
    this.keyCooldowns = new Map(); // keyIdentifier -> timestamp
    this.failoverCounts = new Map(); // agentName -> number
    this.activeSlots = new Map(); // agentName -> 'primary' | 'backup'
  }

  /**
   * Check if agents are globally enabled.
   */
  isGloballyEnabled() {
    const flag = process.env.AGENTS_ENABLED;
    return flag === undefined || flag === null || flag.toLowerCase() !== 'false';
  }

  /**
   * Helper to clean env var value of trailing comments and whitespace
   */
  _cleanEnvVal(val) {
    if (!val || typeof val !== 'string') return null;
    const stripped = val.split(/\s+#/)[0].trim();
    return stripped.length > 0 ? stripped : null;
  }

  /**
   * Retrieve environment configuration for a specific agent.
   */
  getAgentConfig(agentName) {
    let normalized = (agentName || '').toLowerCase().trim();
    if (normalized.endsWith('agent')) {
      normalized = normalized.slice(0, -5);
    }
    if (normalized === 'customersupport') {
      normalized = 'support';
    }
    if (!AGENT_NAMES.includes(normalized)) {
      throw new Error(`Unknown agent: "${agentName}". Supported agents: ${AGENT_NAMES.join(', ')}`);
    }

    const prefix = normalized.toUpperCase();
    const primaryKey = this._cleanEnvVal(
      process.env[`${prefix}_AGENT_API_KEY`] ||
      (prefix === 'RETURN' ? process.env.RETURN_AGENT_AGENT_API_KEY : null) ||
      process.env.OPENROUTER_API_KEY
    );
    const backupKey = this._cleanEnvVal(process.env[`${prefix}_AGENT_BACKUP_API_KEY`]);
    const primaryModel = this._cleanEnvVal(process.env[`${prefix}_AGENT_MODEL`] || process.env.AGENT_DEFAULT_MODEL) || DEFAULT_PRIMARY_MODEL;
    const fallbackModel = this._cleanEnvVal(process.env[`${prefix}_AGENT_FALLBACK_MODEL`] || process.env.AGENT_DEFAULT_FALLBACK_MODEL) || DEFAULT_FALLBACK_MODEL;

    const hasAnyKey = Boolean(primaryKey || backupKey);
    const isEnabled = this.isGloballyEnabled() && hasAnyKey;

    return {
      agentName: normalized,
      primaryKey,
      backupKey,
      primaryModel,
      fallbackModel,
      isEnabled,
      hasPrimaryKey: Boolean(primaryKey),
      hasBackupKey: Boolean(backupKey)
    };
  }

  /**
   * Mark a key as temporarily cooled down (e.g. on 429 rate limit or 401 auth error).
   */
  markKeyFailed(keyIdentifier) {
    if (!keyIdentifier) return;
    this.keyCooldowns.set(keyIdentifier, Date.now() + COOLDOWN_DURATION_MS);
  }

  /**
   * Check whether a key is currently in cooldown.
   */
  isKeyCooledDown(keyIdentifier) {
    if (!keyIdentifier) return false;
    const until = this.keyCooldowns.get(keyIdentifier);
    if (!until) return false;
    if (Date.now() > until) {
      this.keyCooldowns.delete(keyIdentifier);
      return false;
    }
    return true;
  }

  /**
   * Determine failover execution plans for an agent request.
   * Yields plan steps:
   * 1. primary key + primary model (if key available and not in cooldown)
   * 2. backup key + primary model (if backup key available and not in cooldown)
   * 3. backup key + fallback model (if backup key available)
   * 4. fallback attempt with primary key if it was only a model failure
   */
  getExecutionPlan(agentName) {
    const config = this.getAgentConfig(agentName);
    if (!config.isEnabled) {
      return [];
    }

    const plans = [];

    // Step 1: Primary key + Primary model
    if (config.primaryKey && !this.isKeyCooledDown(`primary_${agentName}`)) {
      plans.push({
        slot: 'primary',
        apiKey: config.primaryKey,
        model: config.primaryModel,
        keyIdentifier: `primary_${agentName}`
      });
    }

    // Step 2: Backup key + Primary model
    if (config.backupKey && !this.isKeyCooledDown(`backup_${agentName}`)) {
      plans.push({
        slot: 'backup',
        apiKey: config.backupKey,
        model: config.primaryModel,
        keyIdentifier: `backup_${agentName}`
      });
    }

    // Step 3: Backup key + Fallback model
    if (config.backupKey) {
      plans.push({
        slot: 'backup_fallback',
        apiKey: config.backupKey,
        model: config.fallbackModel,
        keyIdentifier: `backup_${agentName}`
      });
    }

    // Step 4: Fallback model on primary key if backup wasn't configured
    if (!config.backupKey && config.primaryKey) {
      plans.push({
        slot: 'primary_fallback',
        apiKey: config.primaryKey,
        model: config.fallbackModel,
        keyIdentifier: `primary_${agentName}`
      });
    }

    return plans;
  }

  /**
   * Record that a failover was triggered.
   */
  recordFailover(agentName, fromSlot, toSlot, reason = '') {
    const count = (this.failoverCounts.get(agentName) || 0) + 1;
    this.failoverCounts.set(agentName, count);
    this.activeSlots.set(agentName, toSlot);

    try {
      auditLogger.log({
        actorType: 'system',
        action: 'AGENT_KEY_FAILOVER',
        entityType: 'AGENT',
        entityId: agentName,
        agentName,
        metadata: {
          fromSlot,
          toSlot,
          failoverCount: count,
          reason
        }
      });
    } catch (e) {
      // ignore
    }
  }

  /**
   * Execute an LLM call using the failover ladder.
   */
  async executeWithFailover(agentName, openrouterClient, executeFn) {
    const config = this.getAgentConfig(agentName);
    if (!config.isEnabled) {
      throw new Error(`Agent "${agentName}" is currently disabled or has no configured API key.`);
    }

    const plans = this.getExecutionPlan(agentName);
    if (plans.length === 0) {
      throw new Error(`Agent "${agentName}" currently has all key slots in cooldown or unavailable.`);
    }

    let lastError = null;

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];

      try {
        const result = await executeFn({
          apiKey: plan.apiKey,
          model: plan.model,
          slot: plan.slot
        });

        // Track active slot
        this.activeSlots.set(agentName, plan.slot);
        return {
          ...result,
          keySlotUsed: plan.slot,
          modelUsed: plan.model
        };
      } catch (err) {
        lastError = err;
        this.markKeyFailed(plan.keyIdentifier);

        const nextPlan = plans[i + 1];
        if (nextPlan) {
          this.recordFailover(agentName, plan.slot, nextPlan.slot, err.message);
        }
      }
    }

    // Log total exhaustion
    try {
      auditLogger.log({
        actorType: 'system',
        action: 'AGENT_FAILOVER_EXHAUSTED',
        entityType: 'AGENT',
        entityId: agentName,
        agentName,
        metadata: {
          error: lastError?.message || 'All execution plans failed'
        }
      });
    } catch (e) {
      // ignore
    }

    throw new Error(
      `Agent "${agentName}" is temporarily unavailable. All key slots and fallback models have been exhausted.`
    );
  }

  /**
   * Status reporter for Admin panel (masks keys, shows health).
   */
  getStatus() {
    const status = {
      globallyEnabled: this.isGloballyEnabled(),
      timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS, 10) || 30000,
      maxToolIterations: parseInt(process.env.AGENT_MAX_TOOL_ITERATIONS, 10) || 6,
      agents: {}
    };

    for (const name of AGENT_NAMES) {
      const cfg = this.getAgentConfig(name);
      status.agents[name] = {
        enabled: cfg.isEnabled,
        hasPrimaryKey: cfg.hasPrimaryKey,
        hasBackupKey: cfg.hasBackupKey,
        primaryKeyMasked: maskApiKey(cfg.primaryKey),
        backupKeyMasked: maskApiKey(cfg.backupKey),
        primaryModel: cfg.primaryModel,
        fallbackModel: cfg.fallbackModel,
        activeSlot: this.activeSlots.get(name) || 'primary',
        failoverCount: this.failoverCounts.get(name) || 0,
        primaryCooledDown: this.isKeyCooledDown(`primary_${name}`),
        backupCooledDown: this.isKeyCooledDown(`backup_${name}`)
      };
    }

    return status;
  }

  /**
   * Validate configuration at startup: logs friendly warnings without throwing.
   */
  validateStartupEnv() {
    console.log('[Agents KeyManager] Checking per-agent LLM configurations...');
    for (const name of AGENT_NAMES) {
      const cfg = this.getAgentConfig(name);
      if (!cfg.hasPrimaryKey) {
        console.warn(`[Agents KeyManager] Warning: Agent "${name}" has no primary key (${name.toUpperCase()}_AGENT_API_KEY). Agent will report disabled.`);
      }
    }
  }
}

export const keyManager = new KeyManager();
export default keyManager;
