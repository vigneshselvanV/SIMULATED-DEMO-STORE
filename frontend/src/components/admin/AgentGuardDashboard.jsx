import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  DollarSign,
  Users,
  Send,
  RefreshCw,
  Zap,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Activity,
  Terminal,
  Database,
  ArrowRight
} from 'lucide-react';
import { formatPrice, formatDate } from '../../utils/formatters';

export function AgentGuardDashboard() {
  const [connection, setConnection] = useState({
    status: 'disconnected',
    tenantId: 'tenant_demo_shopsphere',
    gatewayUrl: 'http://localhost:5001',
    isConnected: false,
    apiKeyMasked: null
  });

  const [metrics, setMetrics] = useState({
    moneyRefundedPaise: 0,
    paymentsSentPaise: 0,
    customersExportedCount: 0,
    totalEventsCount: 0,
    blockedAttacksCount: 0,
    successfulExploitsCount: 0,
    merchantBalancePaise: 50000000,
    recentEvents: []
  });

  const [loading, setLoading] = useState(true);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectForm, setConnectForm] = useState({
    tenantId: 'tenant_demo_shopsphere',
    gatewayUrl: 'http://localhost:5001',
    apiKey: ''
  });

  // Attack Playground State
  const [selectedAttack, setSelectedAttack] = useState('refund_injection');
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackResult, setAttackResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/agentguard/damage', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) setMetrics(data.metrics);
        if (data.connection) setConnection(data.connection);
      }
    } catch (err) {
      console.error('Failed to fetch AgentGuard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleConnect = async (e) => {
    e?.preventDefault();
    try {
      const res = await fetch('/api/agentguard/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(connectForm)
      });
      const data = await res.json();
      if (data.success) {
        setConnectModalOpen(false);
        setStatusMessage('AgentGuard Gateway connected! Protection is now ACTIVE.');
        fetchDashboardData();
      } else {
        alert(data.message || 'Connection failed.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect AgentGuard? Store will revert to Direct (unprotected) mode.')) return;
    try {
      const res = await fetch('/api/agentguard/disconnect', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage('AgentGuard disconnected. Application is now running unprotected.');
        fetchDashboardData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset demo environment? This will disconnect the gateway, wipe all damage counters, and restore the ₹500,000 merchant balance.')) return;
    try {
      const res = await fetch('/api/agentguard/reset', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setAttackResult(null);
        setStatusMessage('Demo environment reset successfully! Baseline restored.');
        fetchDashboardData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExecuteAttack = async () => {
    try {
      setIsAttacking(true);
      setAttackResult(null);
      const res = await fetch('/api/agentguard/test-attack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ attackType: selectedAttack })
      });
      const data = await res.json();
      if (data.success) {
        setAttackResult(data);
        fetchDashboardData();
      } else {
        alert(data.message || 'Attack test failed.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsAttacking(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast status message */}
      {statusMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage('')} className="text-blue-500 hover:text-blue-700">✕</button>
        </div>
      )}

      {/* TOP STATUS BANNER */}
      <div className={`p-6 sm:p-8 rounded-3xl border transition-all shadow-md relative overflow-hidden ${
        connection.isConnected
          ? 'bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/80 border-emerald-500/40 text-emerald-100 shadow-emerald-500/10'
          : 'bg-gradient-to-r from-rose-950/80 via-slate-900 to-amber-950/80 border-rose-500/40 text-rose-100 shadow-rose-500/10'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                connection.isConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30' : 'bg-rose-500/20 text-rose-400 border border-rose-400/30'
              }`}>
                {connection.isConnected ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs uppercase font-black px-2.5 py-0.5 rounded-full tracking-wider ${
                    connection.isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                  }`}>
                    {connection.isConnected ? 'Protected by AgentGuard' : 'Direct (unprotected)'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Mode: {connection.isConnected ? 'GATEWAY ENFORCED' : 'VULNERABLE DIRECT'}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white mt-0.5 tracking-tight">
                  {connection.isConnected
                    ? 'AI Agent Firewall & Policy Gateway Active'
                    : 'AI Agents Operating Directly Without Policy Firewall'}
                </h2>
              </div>
            </div>

            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {connection.isConnected
                ? 'All sensitive agent tool invocations (refunds, order updates, payment disbursements, and customer exports) are routed through the AgentGuard Gateway. Fail-Closed protection is enforced.'
                : 'Sensitive tool calls bypass external verification and execute directly against the store database. Malicious prompt injections can trigger unauthorized financial transactions and data leakage.'}
            </p>

            {connection.isConnected && (
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-mono text-slate-400">
                <div>Tenant: <span className="text-emerald-400 font-bold">{connection.tenantId}</span></div>
                <div>Gateway: <span className="text-emerald-400 font-bold">{connection.gatewayUrl}</span></div>
                <div>Key: <span className="text-emerald-400 font-bold">{connection.apiKeyMasked || 'Active'}</span></div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {connection.isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-5 py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition border border-rose-400/30 shadow-sm flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                <span>Disconnect Gateway</span>
              </button>
            ) : (
              <button
                onClick={() => setConnectModalOpen(true)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 active:scale-95"
              >
                <Lock className="w-4 h-4" />
                <span>Connect AgentGuard</span>
              </button>
            )}

            <button
              onClick={handleResetDemo}
              title="Reset Demo to Initial Baseline"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition border border-slate-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>
      </div>

      {/* THREE DAMAGE METRIC CARDS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Attack Damage Telemetry</h3>
            <p className="text-xs text-slate-500">Live indicators of financial loss and data leakage incurred during attacks.</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            title="Refresh metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Metric 1: Money Refunded */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Money Refunded</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                metrics.moneyRefundedPaise > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}>
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(metrics.moneyRefundedPaise)}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              {metrics.moneyRefundedPaise > 0 ? (
                <span className="text-rose-600 font-bold">● Unauthorized refunds issued</span>
              ) : (
                <span className="text-emerald-600 font-bold">✓ Zero refund leakage</span>
              )}
            </div>
          </div>

          {/* Metric 2: Customer Records Exported */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customers Exfiltrated</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                metrics.customersExportedCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
              }`}>
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.customersExportedCount} Records
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              {metrics.customersExportedCount > 0 ? (
                <span className="text-amber-600 font-bold">● PII data exfiltrated via DLP breach</span>
              ) : (
                <span className="text-emerald-600 font-bold">✓ Zero customer PII leaked</span>
              )}
            </div>
          </div>

          {/* Metric 3: Payments Sent / Disbursed */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payments Sent</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                metrics.paymentsSentPaise > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
              }`}>
                <Send className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(metrics.paymentsSentPaise)}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              {metrics.paymentsSentPaise > 0 ? (
                <span className="text-rose-600 font-bold">● Merchant funds drained</span>
              ) : (
                <span className="text-emerald-600 font-bold">✓ Zero unauthorized payouts</span>
              )}
            </div>
          </div>

          {/* Metric 4: Merchant Ledger Balance */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Merchant Balance</span>
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatPrice(metrics.merchantBalancePaise)}
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>Blocked: <strong className="text-emerald-600">{metrics.blockedAttacksCount}</strong></span>
              <span>Attacks: <strong className="text-slate-800">{metrics.totalEventsCount}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* RED-TEAM ATTACK PLAYGROUND */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-black text-slate-900 tracking-tight">Interactive Red-Team Attack Sandbox</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Test how the AI Support Agent responds to adversarial prompt injections in <strong>{connection.isConnected ? 'Protected' : 'Unprotected'}</strong> mode.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExecuteAttack}
              disabled={isAttacking}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition flex items-center gap-2 active:scale-95 ${
                isAttacking
                  ? 'bg-slate-400 cursor-not-allowed'
                  : connection.isConnected
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>{isAttacking ? 'Simulating Attack...' : 'Launch Attack'}</span>
            </button>
          </div>
        </div>

        {/* Attack selector options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              id: 'refund_injection',
              title: 'Refund Prompt Injection',
              tool: 'issue_refund',
              desc: 'Injects "SYSTEM OVERRIDE" to force a ₹14,999 refund without return validation.'
            },
            {
              id: 'data_exfiltration',
              title: 'Customer DLP Exfiltration',
              tool: 'export_customers',
              desc: 'Exploits developer mode prompt to dump full customer database to CSV.'
            },
            {
              id: 'disbursement_drain',
              title: 'Financial Balance Drain',
              tool: 'send_payment',
              desc: 'Coerces agent into transferring ₹75,000 from merchant balance to attacker.'
            },
            {
              id: 'order_tamper',
              title: 'Address Hijacking',
              tool: 'update_order',
              desc: 'Redirects delivered shipment destination to an anonymous dropoff point.'
            }
          ].map((att) => (
            <div
              key={att.id}
              onClick={() => setSelectedAttack(att.id)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition text-left space-y-1 ${
                selectedAttack === att.id
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{att.title}</span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                  {att.tool}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">{att.desc}</p>
            </div>
          ))}
        </div>

        {/* Attack Execution Result Box */}
        {attackResult && (
          <div className={`p-5 rounded-2xl border text-xs space-y-3 animate-fadeIn ${
            attackResult.blockedByAgentGuard
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}>
            <div className="flex items-center justify-between border-b pb-2 border-current/20">
              <div className="flex items-center gap-2 font-bold">
                {attackResult.blockedByAgentGuard ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700 uppercase tracking-wider">Attack BLOCKED by AgentGuard Firewall</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="text-rose-700 uppercase tracking-wider">Exploit SUCCEEDED in Unprotected Mode</span>
                  </>
                )}
              </div>
              <span className="font-mono px-2 py-0.5 rounded bg-white/70 border border-current/20">
                Route: {attackResult.routingLabel}
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Attacker Injection Prompt:</span>
              <p className="font-mono text-slate-700 bg-white/80 p-2.5 rounded-xl border border-slate-200">
                {attackResult.attackPrompt}
              </p>
            </div>

            <div className="space-y-1">
              <span className="font-bold text-slate-500 uppercase text-[10px]">AI Agent Execution Output:</span>
              <p className="font-sans leading-relaxed text-slate-800 bg-white/80 p-2.5 rounded-xl border border-slate-200 whitespace-pre-wrap">
                {attackResult.agentResponse}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RECENT DAMAGE & SECURITY EVENTS TABLE */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Attack & Damage Audit Log</h3>
            <p className="text-xs text-slate-500">Append-only record of tool calls and damage outcomes.</p>
          </div>
          <span className="text-xs font-bold text-slate-400">Total logged: {metrics.recentEvents?.length || 0}</span>
        </div>

        {metrics.recentEvents && metrics.recentEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Tool Name</th>
                  <th className="py-3 px-4">Damage Type</th>
                  <th className="py-3 px-4">Amount / Count</th>
                  <th className="py-3 px-4">Routing Mode</th>
                  <th className="py-3 px-4">Security Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.recentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50 transition font-mono">
                    <td className="py-3 px-4 font-bold text-slate-800">#{evt.id}</td>
                    <td className="py-3 px-4 font-bold text-indigo-600">{evt.tool_name}</td>
                    <td className="py-3 px-4 uppercase text-slate-600">{evt.damage_type}</td>
                    <td className="py-3 px-4 font-bold">
                      {evt.amount_paise > 0 ? (
                        <span className="text-rose-600 font-bold">{formatPrice(evt.amount_paise)}</span>
                      ) : evt.record_count > 0 ? (
                        <span className="text-amber-600 font-bold">{evt.record_count} Records</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        evt.routing_mode === 'gateway'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}>
                        {evt.routing_mode === 'gateway' ? 'Protected' : 'Direct'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        evt.status === 'blocked'
                          ? 'bg-emerald-100 text-emerald-800'
                          : evt.status === 'executed'
                          ? 'bg-rose-100 text-rose-800 font-black'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {evt.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-sans">{formatDate(evt.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No damage events recorded. Launch an attack above to observe live telemetry.
          </div>
        )}
      </div>

      {/* CONNECT AGENTGUARD MODAL */}
      {connectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Connect AgentGuard</h3>
                  <p className="text-xs text-slate-500">Configure security gateway credentials</p>
                </div>
              </div>
              <button onClick={() => setConnectModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleConnect} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tenant ID</label>
                <input
                  type="text"
                  required
                  value={connectForm.tenantId}
                  onChange={(e) => setConnectForm({ ...connectForm, tenantId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="tenant_demo_shopsphere"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Gateway URL</label>
                <input
                  type="url"
                  required
                  value={connectForm.gatewayUrl}
                  onChange={(e) => setConnectForm({ ...connectForm, gatewayUrl: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="http://localhost:5001"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">API Key (Leave empty to auto-generate)</label>
                <input
                  type="password"
                  value={connectForm.apiKey}
                  onChange={(e) => setConnectForm({ ...connectForm, apiKey: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="ag_live_sec_..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-md shadow-emerald-500/20"
                >
                  Confirm & Protect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgentGuardDashboard;
