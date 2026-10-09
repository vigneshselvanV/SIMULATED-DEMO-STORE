-- 007_agentguard_connection.sql
-- AgentGuard integration: connection state, damage telemetry, and synthetic merchant ledger

-- 1. AgentGuard connection configuration and state
CREATE TABLE IF NOT EXISTS agentguard_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'connected', 'error'
  tenant_id TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  gateway_url TEXT NOT NULL DEFAULT '',
  last_connected_at DATETIME,
  last_heartbeat_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ensure singleton row exists
INSERT OR IGNORE INTO agentguard_connection (id, status, tenant_id, api_key, gateway_url)
VALUES (1, 'disconnected', 'tenant_demo_shopsphere', '', 'http://localhost:5001');

-- 2. Damage events ledger (tracks financial damage and data leakage caused by unprotected agent abuse)
CREATE TABLE IF NOT EXISTS agentguard_damage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT NOT NULL,
  damage_type TEXT NOT NULL, -- 'refund', 'payment', 'data_export', 'order_tamper'
  amount_paise INTEGER DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  routing_mode TEXT NOT NULL DEFAULT 'direct', -- 'direct', 'gateway'
  status TEXT NOT NULL DEFAULT 'executed', -- 'executed', 'blocked', 'failed'
  details TEXT,
  session_user_id INTEGER,
  run_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_damage_events_created ON agentguard_damage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_damage_events_type ON agentguard_damage_events(damage_type);

-- 3. Synthetic merchant account ledger (simulates business funds vulnerable to unauthorized disbursements)
CREATE TABLE IF NOT EXISTS agentguard_merchant_ledger (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  account_name TEXT NOT NULL DEFAULT 'ShopSphere Merchant Operations',
  balance_paise INTEGER NOT NULL DEFAULT 50000000, -- Initial: ₹500,000.00
  total_disbursed_paise INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ensure singleton row exists
INSERT OR IGNORE INTO agentguard_merchant_ledger (id, account_name, balance_paise, total_disbursed_paise)
VALUES (1, 'ShopSphere Merchant Operations', 50000000, 0);
