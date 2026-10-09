import db from '../config/db.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordhash',
  'secret',
  'token',
  'session_secret',
  'sessionsecret',
  'api_key',
  'apikey',
  'authorization',
  'cvv',
  'card_number',
  'cardnumber'
]);

function sanitizeData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeData);
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeData(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function stringifySafe(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(sanitizeData(val));
  } catch (e) {
    return String(val);
  }
}

export const auditLogger = {
  /**
   * Append a new audit record to the immutable audit_logs ledger.
   */
  log({
    actorType = 'system',
    actorId = null,
    action,
    entityType,
    entityId = null,
    beforeState = null,
    afterState = null,
    agentName = null,
    requestId = null,
    metadata = null
  }) {
    if (!action || !entityType) {
      throw new Error('Audit log requires action and entityType.');
    }

    const validActorTypes = ['customer', 'admin', 'system', 'agent'];
    const actor = validActorTypes.includes(actorType) ? actorType : 'system';

    const insertStmt = db.prepare(`
      INSERT INTO audit_logs (
        actor_type, actor_id, action, entity_type, entity_id,
        before_state, after_state, agent_name, request_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insertStmt.run(
      actor,
      actorId ? String(actorId) : null,
      String(action),
      String(entityType),
      entityId ? String(entityId) : null,
      stringifySafe(beforeState),
      stringifySafe(afterState),
      agentName ? String(agentName) : null,
      requestId ? String(requestId) : null,
      stringifySafe(metadata)
    );

    return {
      id: info.lastInsertRowid,
      action,
      entityType,
      createdAt: new Date().toISOString()
    };
  },

  /**
   * Query audit logs for administrative inspection.
   */
  query({
    limit = 50,
    offset = 0,
    actorType,
    action,
    entityType,
    agentName,
    requestId
  } = {}) {
    const conditions = [];
    const params = [];

    if (actorType) {
      conditions.push('actor_type = ?');
      params.push(actorType);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }
    if (agentName) {
      conditions.push('agent_name = ?');
      params.push(agentName);
    }
    if (requestId) {
      conditions.push('request_id = ?');
      params.push(requestId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    const sql = `
      SELECT * FROM audit_logs
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `;

    return db.prepare(sql).all(...params, safeLimit, safeOffset);
  },

  /**
   * Count matching audit logs for pagination.
   */
  count({
    actorType,
    action,
    entityType,
    agentName,
    requestId
  } = {}) {
    const conditions = [];
    const params = [];

    if (actorType) {
      conditions.push('actor_type = ?');
      params.push(actorType);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }
    if (agentName) {
      conditions.push('agent_name = ?');
      params.push(agentName);
    }
    if (requestId) {
      conditions.push('request_id = ?');
      params.push(requestId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT count(*) as total FROM audit_logs ${whereClause}`;
    return db.prepare(sql).get(...params).total;
  },

  /**
   * Retrieve a specific audit log by ID.
   */
  getById(id) {
    return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
  }
};

export default auditLogger;
