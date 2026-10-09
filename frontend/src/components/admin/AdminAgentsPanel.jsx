import React, { useState, useEffect } from 'react';
import {
  Bot,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCw,
  Clock,
  Cpu,
  Layers,
  ChevronRight,
  Send,
  Eye,
  Key,
  Database
} from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function AdminAgentsPanel() {
  const [agents, setAgents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvalFilter, setApprovalFilter] = useState('pending'); // 'pending' | 'all'

  // Admin Sandbox Chat State
  const [sandboxAgent, setSandboxAgent] = useState('OrderAgent');
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxMessages, setSandboxMessages] = useState([]);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // Tool Call Modal
  const [selectedRun, setSelectedRun] = useState(null);
  const [runToolCalls, setRunToolCalls] = useState([]);
  const [toolCallsLoading, setToolCallsLoading] = useState(false);

  // Action states
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentsRes, metricsRes, approvalsRes, runsRes] = await Promise.all([
        api.getAgents(),
        api.getAgentMetrics(),
        api.getAgentApprovals(approvalFilter),
        api.getAgentRuns({ limit: 20 })
      ]);

      if (agentsRes.success) setAgents(agentsRes.agents || []);
      if (metricsRes.success) setMetrics(metricsRes.metrics || {});
      if (approvalsRes.success) setApprovals(approvalsRes.approvals || []);
      if (runsRes.success) setRuns(runsRes.runs || []);
    } catch (err) {
      console.error('Error loading AI agent management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [approvalFilter]);

  const handleApprove = async (approvalId) => {
    setActionSuccess('');
    setActionError('');
    try {
      const res = await api.approveAgentRequest(approvalId, {
        reason: 'Authorized by administrator via management dashboard'
      });
      if (res.success) {
        setActionSuccess(`Request ${approvalId} approved and executed successfully!`);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to approve request.');
    }
  };

  const handleReject = async (approvalId) => {
    setActionSuccess('');
    setActionError('');
    try {
      const res = await api.rejectAgentRequest(approvalId, {
        reason: 'Declined by administrator'
      });
      if (res.success) {
        setActionSuccess(`Request ${approvalId} was rejected.`);
        loadData();
      }
    } catch (err) {
      setActionError(err.message || 'Failed to reject request.');
    }
  };

  const handleInspectRun = async (run) => {
    setSelectedRun(run);
    setToolCallsLoading(true);
    try {
      const res = await api.getRunToolCalls(run.run_id);
      if (res.success) {
        setRunToolCalls(res.toolCalls || []);
      }
    } catch (err) {
      console.error('Failed to load tool calls:', err);
    } finally {
      setToolCallsLoading(false);
    }
  };

  const handleSandboxSend = async () => {
    if (!sandboxInput.trim() || sandboxLoading) return;
    const prompt = sandboxInput.trim();
    setSandboxInput('');

    const newMsgs = [...sandboxMessages, { role: 'user', content: prompt }];
    setSandboxMessages(newMsgs);
    setSandboxLoading(true);

    try {
      const res = await api.agentDirectChat(sandboxAgent, {
        message: prompt,
        history: newMsgs.slice(-4)
      });

      setSandboxMessages([
        ...newMsgs,
        {
          role: 'assistant',
          content: res.response || res.message,
          toolCallsCount: res.toolCallsCount,
          modelUsed: res.modelUsed
        }
      ]);
    } catch (err) {
      setSandboxMessages([
        ...newMsgs,
        { role: 'system', content: `Error: ${err.message}`, isError: true }
      ]);
    } finally {
      setSandboxLoading(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}

      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Total Runs</span>
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics?.overview?.totalRuns || 0}</p>
          <span className="text-[10px] text-slate-400">Lifetime agent requests</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700">{metrics?.overview?.completedRuns || 0}</p>
          <span className="text-[10px] text-slate-400">100% success execution</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Pending Approvals</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700">{approvals.filter(a => a.status === 'pending').length}</p>
          <span className="text-[10px] text-slate-400">High-risk actions awaiting review</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">Avg Latency</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-slate-900">{metrics?.overview?.avgDurationMs || 0} ms</p>
          <span className="text-[10px] text-slate-400">Per execution loop</span>
        </div>
      </div>

      {/* 1. Human Approvals Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              Human-in-the-Loop Approval Queue
            </h3>
            <p className="text-xs text-slate-500">
              High-risk actions (e.g. refunds exceeding threshold, manual stock alterations) require admin confirmation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setApprovalFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                approvalFilter === 'pending'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending Only
            </button>
            <button
              onClick={() => setApprovalFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                approvalFilter === 'all'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Records
            </button>
            <button
              onClick={loadData}
              title="Refresh"
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {approvals.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No approval requests found matching the current filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {approvals.map((req) => (
              <div key={req.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                      {req.request_id}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{req.agent_name}</span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-xs font-mono font-semibold text-blue-600">{req.tool_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : req.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 text-red-700 uppercase">
                      Risk: {req.risk_level}
                    </span>
                  </div>

                  <p className="text-xs font-mono text-slate-600 bg-slate-50 p-2 rounded-lg break-all">
                    Args: {req.arguments}
                  </p>

                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>Requested by: {req.requested_by_user_email || 'User #' + req.requested_by_user_id}</span>
                    <span>Date: {formatDate(req.created_at)}</span>
                  </div>
                </div>

                {req.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(req.request_id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve & Execute</span>
                    </button>
                    <button
                      onClick={() => handleReject(req.request_id)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. The 7 AI Agents Fleet Overview */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-600" />
            Configured Agent Fleet ({agents.length})
          </h3>
          <p className="text-xs text-slate-500">
            OpenRouter free tier multi-model routing, automatic failover ladders, and key isolation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((ag) => (
            <div key={ag.name} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{ag.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Slot: {ag.activeSlot}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ag.isEnabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {ag.isEnabled ? 'ACTIVE' : 'READY (MOCK)'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mb-3">{ag.description}</p>

                <div className="space-y-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Primary:</span>
                    <span className="text-slate-700 truncate max-w-[180px]" title={ag.primaryModel}>{ag.primaryModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fallback:</span>
                    <span className="text-slate-700 truncate max-w-[180px]" title={ag.fallbackModel}>{ag.fallbackModel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key:</span>
                    <span className="text-slate-700">{ag.primaryKeyMasked || 'None (Dev)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Failovers:</span>
                    <span className="text-slate-700">{ag.failoverCount || 0}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(ag.allowedTools || []).slice(0, 4).map((tool) => (
                    <span key={tool} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono">
                      {tool}
                    </span>
                  ))}
                  {(ag.allowedTools || []).length > 4 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[10px]">
                      +{ag.allowedTools.length - 4} more
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSandboxAgent(ag.name);
                    const el = document.getElementById('admin-sandbox-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-xl text-xs font-bold text-slate-700 transition flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3 h-3" />
                  <span>Test in Sandbox</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Live Execution Sandbox & Tool Inspector */}
      <div id="admin-sandbox-section" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sandbox Chat */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col h-[500px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                Live Agent Testing Sandbox
              </h3>
              <p className="text-[11px] text-slate-400">Run queries against any of the 7 agents with admin privilege.</p>
            </div>

            <select
              value={sandboxAgent}
              onChange={(e) => setSandboxAgent(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              {agents.map((ag) => (
                <option key={ag.name} value={ag.name}>{ag.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 p-2 text-xs">
            {sandboxMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                Select an agent and send a test prompt (e.g. "Check inventory for product 1" or "List low stock").
              </div>
            ) : (
              sandboxMessages.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 shadow-2xs whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : m.isError
                        ? 'bg-rose-50 border border-rose-200 text-rose-800'
                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    {m.content}
                  </div>
                  {m.toolCallsCount > 0 && (
                    <span className="text-[10px] text-blue-600 font-mono mt-1 font-bold">
                      Executed {m.toolCallsCount} internal tool call(s)
                    </span>
                  )}
                </div>
              ))
            )}
            {sandboxLoading && (
              <div className="p-3 bg-slate-50 text-slate-500 rounded-xl w-fit text-xs animate-pulse">
                Executing agent loop and internal tools...
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <input
              type="text"
              value={sandboxInput}
              onChange={(e) => setSandboxInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSandboxSend()}
              placeholder={`Send test query to ${sandboxAgent}...`}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSandboxSend}
              disabled={!sandboxInput.trim() || sandboxLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>

        {/* Recent Execution Runs Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col h-[500px]">
          <div className="border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                Recent Execution Runs Log
              </h3>
              <p className="text-[11px] text-slate-400">Click a run to inspect individual tool calls.</p>
            </div>
            <button onClick={loadData} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
            {runs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No runs recorded yet.
              </div>
            ) : (
              runs.map((r) => (
                <div
                  key={r.id}
                  onClick={() => handleInspectRun(r)}
                  className="py-2.5 px-2 hover:bg-slate-50 rounded-xl cursor-pointer transition flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{r.agent_name}</span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                        r.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{r.input_message}</p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono">{r.duration_ms ? `${r.duration_ms}ms` : '—'}</span>
                    <p className="text-[9px] text-slate-400">{formatDate(r.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tool Calls Inspection Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  Execution Run Tool Calls: {selectedRun.run_id}
                </h4>
                <p className="text-xs text-slate-500">
                  Agent: {selectedRun.agent_name} • Duration: {selectedRun.duration_ms || 0}ms
                </p>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {toolCallsLoading ? (
                <div className="py-8 flex justify-center"><LoadingSpinner /></div>
              ) : runToolCalls.length === 0 ? (
                <p className="py-8 text-center text-slate-400 text-xs">No individual tool calls recorded for this run.</p>
              ) : (
                runToolCalls.map((tc) => (
                  <div key={tc.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-700">{tc.tool_name}</span>
                      <span className="text-[10px] text-slate-400">{tc.latency_ms}ms</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Arguments:</span>
                      <pre className="text-[11px] bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto text-slate-800">
                        {tc.arguments}
                      </pre>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase">Result:</span>
                      <pre className="text-[11px] bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto text-slate-800 max-h-36">
                        {tc.result}
                      </pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAgentsPanel;
