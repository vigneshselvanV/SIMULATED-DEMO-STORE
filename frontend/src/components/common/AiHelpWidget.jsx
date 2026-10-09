import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  X,
  Send,
  Minimize2,
  Maximize2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Layers
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const AGENT_OPTIONS = [
  { id: 'CustomerSupportAgent', label: 'Support Concierge', icon: '💬', desc: 'Front door help & routing' },
  { id: 'OrderAgent', label: 'Order Agent', icon: '📦', desc: 'Order lookup & cancellation' },
  { id: 'TrackingAgent', label: 'Tracking Agent', icon: '🚚', desc: 'Shipment timelines & ETA' },
  { id: 'ReturnAgent', label: 'Return Agent', icon: '🔄', desc: 'Return eligibility & intake' },
  { id: 'RefundAgent', label: 'Refund Agent', icon: '💰', desc: 'Paise calculations & mock refunds' },
  { id: 'PaymentAgent', label: 'Payment Agent', icon: '💳', desc: 'Simulated payment retries' }
];

const QUICK_PROMPTS = [
  'Where is my latest order?',
  'How do I return a delivered item?',
  'Can I cancel my pending order?',
  'How do simulated payments work?'
];

export function AiHelpWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('CustomerSupportAgent');
  const [messages, setMessages] = useState([
    {
      id: 'welcome_1',
      role: 'assistant',
      agentName: 'CustomerSupportAgent',
      content: 'Hi! I am the ShopSphere AI Assistant. I can track orders, help you request returns, check refunds, or answer marketplace questions. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAgentMenu, setShowAgentMenu] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    setError(null);
    setInputMessage('');

    const userMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build conversation history payload
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.agentChat({
        message: text,
        agentName: selectedAgent,
        history: historyPayload
      });

      const assistantMsg = {
        id: `agent_${Date.now()}`,
        role: 'assistant',
        agentName: res.agentName || selectedAgent,
        content: res.response || res.message || 'I have completed your request.',
        toolCallsCount: res.toolCallsCount || 0,
        approvalPending: Boolean(res.approvalPending),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Agent chat error:', err);
      const errMsg = {
        id: `err_${Date.now()}`,
        role: 'system',
        content: err.message || 'Unable to connect to AI assistant. Please check backend connection.',
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        agentName: selectedAgent,
        content: `Conversation reset. You are now chatting with the ${selectedAgent}. How can I assist you?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const currentAgentInfo = AGENT_OPTIONS.find((a) => a.id === selectedAgent) || AGENT_OPTIONS[0];

  return (
    <aside aria-label="AI Customer Support Assistant" className="fixed bottom-6 right-6 z-50 select-none">
      {/* Floating Trigger Button (When Closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          id="ai-help-widget-trigger"
          aria-label="Open AI Assistant"
          className="group relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-full shadow-2xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-700 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-700 rounded-full" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black tracking-wide leading-tight">Ask ShopSphere AI</span>
            <span className="text-[10px] text-blue-100 font-medium leading-tight">7 Smart Agents</span>
          </div>
        </button>
      )}

      {/* Chat Window (When Open) */}
      {isOpen && (
        <div
          className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-200 ${
            isMinimized
              ? 'w-80 h-14'
              : 'w-[360px] sm:w-[400px] h-[550px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-inner">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-black text-white leading-tight">ShopSphere AI</h2>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowAgentMenu(!showAgentMenu)}
                    className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white transition"
                    title="Change Specialist Agent"
                  >
                    <span>{currentAgentInfo.icon} {currentAgentInfo.label}</span>
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>

                  {/* Agent Dropdown Selector */}
                  {showAgentMenu && (
                    <div className="absolute left-0 top-6 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1 z-30">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Select Specialist
                      </div>
                      {AGENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSelectedAgent(opt.id);
                            setShowAgentMenu(false);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-800 transition ${
                            selectedAgent === opt.id ? 'bg-indigo-900/60 text-blue-300' : 'text-slate-200'
                          }`}
                        >
                          <span className="text-sm">{opt.icon}</span>
                          <div>
                            <p className="text-xs font-bold leading-tight">{opt.label}</p>
                            <p className="text-[10px] text-slate-400 leading-tight">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                title="Reset conversation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body (Hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/70 text-xs">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1 ml-1 font-semibold">
                        <span>{m.agentName || 'Agent'}</span>
                        {m.toolCallsCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700 font-mono text-[9px]">
                            {m.toolCallsCount} tool{m.toolCallsCount === 1 ? '' : 's'}
                          </span>
                        )}
                        {m.approvalPending && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-bold text-[9px]">
                            Approval Required
                          </span>
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : m.isError
                          ? 'bg-rose-50 border border-rose-200 text-rose-800 rounded-bl-xs'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                      }`}
                    >
                      {m.content}
                    </div>

                    <span className="text-[9px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-2xl w-fit text-slate-500 shadow-xs">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">Agent thinking & executing tools...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompt Suggestions */}
              {messages.length <= 3 && !isLoading && (
                <div className="px-3 py-2 bg-slate-100/70 border-t border-slate-200 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-[11px] px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-full text-slate-600 transition shadow-2xs text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition border border-slate-200">
                  <input
                    type="text"
                    id="ai-chat-input"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    placeholder={`Ask ${currentAgentInfo.label}...`}
                    className="flex-1 bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputMessage.trim() || isLoading}
                    aria-label="Send message"
                    className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition active:scale-95 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-400 px-1">
                  <span>OpenRouter AI • Free LLM Tier</span>
                  <span>{user ? `Logged in as ${user.name}` : 'Guest session'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

export default AiHelpWidget;
