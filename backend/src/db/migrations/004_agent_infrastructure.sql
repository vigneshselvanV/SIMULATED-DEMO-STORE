-- 004_agent_infrastructure.sql
-- Agent execution tracking, tool call logging, and human-in-the-loop approval queues

-- Agent execution runs
CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT UNIQUE NOT NULL,
    agent_name TEXT NOT NULL,
    user_id INTEGER,
    role TEXT,
    input_message TEXT,
    output_message TEXT,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'approval_pending')),
    iterations INTEGER DEFAULT 0,
    key_slot_used TEXT,
    model_used TEXT,
    duration_ms INTEGER,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at);

-- Agent individual tool call records
CREATE TABLE IF NOT EXISTS agent_tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments TEXT,
    result TEXT,
    is_error INTEGER DEFAULT 0,
    latency_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_run ON agent_tool_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_tool ON agent_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_created ON agent_tool_calls(created_at);

-- Human-in-the-loop approval requests for high-risk agent operations
CREATE TABLE IF NOT EXISTS agent_approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT UNIQUE NOT NULL,
    run_id TEXT,
    agent_name TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    arguments TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    requested_by_user_id INTEGER,
    reviewed_by_admin_id INTEGER,
    review_reason TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_approval_status ON agent_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_approval_agent ON agent_approval_requests(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_approval_created ON agent_approval_requests(created_at);
