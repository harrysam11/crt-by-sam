/**
 * QuantAIAgentModal.tsx
 * Institutional Quant & AI Assistant Modal powered by Model Context Protocol (MCP).
 * Connects directly to:
 *  - Remote MCP Streamable HTTP / SSE Servers (dmcharts standard)
 *  - Anthropic Claude 3.5 (Sonnet / Haiku) with Native Tool Calling
 *  - OpenAI / OpenRouter / Groq / DeepSeek with Tool Calling
 *  - Google Gemini 1.5 (Flash / Pro) with Function Declarations
 *  - Local Ollama (Desktop / Self-Hosted)
 * Client-Side Tool Calling: executes real-time market data, orderflow, and risk checks
 * with ZERO inference load on the Railway server.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { audioHaptics } from '../../utils/notify';
import { fmtPrice } from '../../utils/formatters';
import { queryMcpAgent, McpProviderType, McpConfig } from '../../services/mcp/mcpClient';
import { TERMINALX_MCP_TOOLS } from '../../services/mcp/mcpTools';

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: number;
  toolCalls?: { tool: string; args: any; output: string }[];
}

interface QuantAIAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

declare global {
  interface Window {
    __openQuantAI?: (initialPrompt?: string) => void;
  }
}

export default function QuantAIAgentModal({
  isOpen,
  onClose,
  initialPrompt,
}: QuantAIAgentModalProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const currentPrice = useTerminalStore((s) => s.currentPrice);
  const candles = useTerminalStore((s) => s.candles);
  const activeAccount = useTerminalStore((s) => {
    const accs = s.accounts || [];
    return accs.find((a) => a.id === s.activeAccountId) || accs[0];
  });

  const [provider, setProvider] = useState<McpProviderType>(() => {
    try {
      return (localStorage.getItem('terminalx_ai_provider') as McpProviderType) || 'OPENAI_OPENROUTER';
    } catch {
      return 'OPENAI_OPENROUTER';
    }
  });

  const [endpoint, setEndpoint] = useState(() => {
    try {
      return (
        localStorage.getItem('terminalx_ai_endpoint') ||
        'https://api.openai.com/v1/chat/completions'
      );
    } catch {
      return 'https://api.openai.com/v1/chat/completions';
    }
  });

  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('terminalx_ai_apikey') || '';
    } catch {
      return '';
    }
  });

  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem('terminalx_ai_model') || 'gpt-4o-mini';
    } catch {
      return 'gpt-4o-mini';
    }
  });

  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'AI',
      text: `TerminalX MCP Quant Engine active. Connected to ${symbol} (${timeframe}).\nEquipped with 6 real-time tools: Market Quotes, Orderflow Imbalance, TradeXGuardian Risk, Lot Sizing, Macro Calendar, and PineScript Audit.\n\nAll tools execute in your browser with zero server latency or load.`,
      timestamp: Date.now(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedToolIndex, setExpandedToolIndex] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSend(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  // Quick preset loader when switching provider
  const handleSelectProvider = (p: McpProviderType) => {
    setProvider(p);
    if (p === 'ANTHROPIC') {
      setEndpoint('https://api.anthropic.com/v1/messages');
      setModel('claude-3-5-sonnet-20241022');
    } else if (p === 'GOOGLE_GEMINI') {
      setEndpoint('https://generativelanguage.googleapis.com/v1beta/models');
      setModel('gemini-1.5-flash');
    } else if (p === 'MCP_SERVER') {
      setEndpoint('http://localhost:3000/mcp');
      setModel('mcp-agent');
    } else if (p === 'LOCAL_OLLAMA') {
      setEndpoint('http://localhost:11434/api/generate');
      setModel('deepseek-r1:latest');
    } else {
      setEndpoint('https://api.openai.com/v1/chat/completions');
      setModel('gpt-4o-mini');
    }
  };

  const handleSaveConfig = () => {
    try {
      localStorage.setItem('terminalx_ai_provider', provider);
      localStorage.setItem('terminalx_ai_endpoint', endpoint);
      localStorage.setItem('terminalx_ai_apikey', apiKey);
      localStorage.setItem('terminalx_ai_model', model);
    } catch {}
    setShowConfig(false);
    audioHaptics.tick();
  };

  const buildChartContext = () => {
    const recent = (candles || []).slice(-15);
    const candleSummary = recent
      .map(
        (c) =>
          `[${new Date(c.time * 1000).toLocaleTimeString()}] O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume}`
      )
      .join('\n');

    return `CURRENT TERMINAL CONTEXT:
Symbol: ${symbol}
Timeframe: ${timeframe}
Current Price: ${fmtPrice(currentPrice, symbol)}
Active Account: ${activeAccount?.name || 'Simulation'} (${activeAccount?.type || 'PAPER'})
Recent 15 Bars OHLCV:
${candleSummary || 'Data loading...'}`;
  };

  const handleSend = async (userPromptText?: string) => {
    const textToSend = userPromptText || inputVal;
    if (!textToSend.trim() || isLoading) return;

    audioHaptics.tick();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'USER',
      text: textToSend.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!userPromptText) setInputVal('');
    setIsLoading(true);

    const contextSnapshot = buildChartContext();
    const config: McpConfig = {
      provider,
      endpoint,
      apiKey,
      model,
    };

    try {
      const res = await queryMcpAgent(textToSend.trim(), config, contextSnapshot);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: res.reply,
        timestamp: Date.now(),
        toolCalls: res.toolCallsExecuted,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        text: `Execution Error: ${err.message || 'Failed to reach AI provider'}.\nPlease verify your API Key and Endpoint in MCP settings (gear icon).`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-5 font-mono select-none">
      <div className="flex flex-col h-[90vh] max-h-[840px] w-full max-w-3xl rounded-xl bg-panel text-slate-200 shadow-2xl border border-grid overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid bg-panel/90">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded bg-cyan-400 text-black font-black text-[11px] flex items-center justify-center font-mono shadow-xs">
              MCP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs font-heading">QUANT &amp; AI AGENT</span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                  {provider.replace('_', ' ')}
                </span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/10">
                  {TERMINALX_MCP_TOOLS.length} Tools Active
                </span>
              </div>
              <span className="text-[10px] text-muted block -mt-0.5">
                Model Context Protocol • Client-Side Zero Server Load
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                audioHaptics.tick();
                setShowConfig((v) => !v);
              }}
              className={`p-1.5 rounded transition ${
                showConfig ? 'bg-cyan-500/20 text-cyan-300' : 'text-muted hover:text-white hover:bg-white/5'
              }`}
              title="MCP Engine & Provider Settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-muted hover:text-white rounded hover:bg-white/5 transition"
              title="Close Assistant"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* MCP Engine Configuration Drawer */}
        {showConfig && (
          <div className="border-b border-grid bg-black/40 p-3.5 text-xs space-y-3 animate-in slide-in-from-top duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                MCP AI Provider (Bring Your Own Key)
              </span>
              <span className="text-[10px] text-muted">Runs 100% Client-Side</span>
            </div>

            {/* Provider Switcher Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 rounded-lg bg-surface border border-grid text-[10px]">
              {(
                [
                  { id: 'OPENAI_OPENROUTER', label: 'OpenAI / Groq' },
                  { id: 'ANTHROPIC', label: 'Claude 3.5' },
                  { id: 'GOOGLE_GEMINI', label: 'Gemini 1.5' },
                  { id: 'MCP_SERVER', label: 'Remote MCP' },
                  { id: 'LOCAL_OLLAMA', label: 'Local Ollama' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className={`py-1.5 px-2 rounded font-bold transition text-center ${
                    provider === p.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase text-muted block mb-1 font-semibold">
                  API Endpoint / SSE URL
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-surface border border-grid rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase text-muted block mb-1 font-semibold">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                  className="w-full bg-surface border border-grid rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {provider !== 'LOCAL_OLLAMA' && (
              <div>
                <label className="text-[10px] uppercase text-muted block mb-1 font-semibold">
                  API Key (Stored only in your browser localStorage)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'ANTHROPIC'
                      ? 'sk-ant-...'
                      : provider === 'GOOGLE_GEMINI'
                      ? 'AIzaSy...'
                      : 'sk-...'
                  }
                  className="w-full bg-surface border border-grid rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-muted">
                Available Tools: Quote, Orderflow, Risk Guardian, Position Sizing, Calendar, PineScript
              </span>
              <button
                onClick={handleSaveConfig}
                className="px-3.5 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-black font-bold rounded text-xs transition font-heading"
              >
                Save MCP Settings
              </button>
            </div>
          </div>
        )}

        {/* Quick Prompts Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-panel/50 border-b border-grid overflow-x-auto text-[10.5px]">
          <span className="text-muted text-[10px] uppercase shrink-0 font-bold">Actions:</span>
          <button
            onClick={() =>
              handleSend(
                `Use the get_market_quote and get_orderflow_imbalance tools to analyze the current structure and volume bias for ${symbol} on the ${timeframe} timeframe.`
              )
            }
            className="shrink-0 px-2.5 py-1 rounded-full bg-surface hover:bg-white/10 text-slate-300 hover:text-white border border-grid transition"
          >
            Audit Quote &amp; Orderflow
          </button>
          <button
            onClick={() =>
              handleSend(
                `Use the calculate_position_size tool to determine my exact lot size on ${symbol} with $500 risk and a 25-pip stop loss.`
              )
            }
            className="shrink-0 px-2.5 py-1 rounded-full bg-surface hover:bg-white/10 text-slate-300 hover:text-white border border-grid transition"
          >
            Calculate Lot Size ($500 Risk)
          </button>
          <button
            onClick={() =>
              handleSend(
                `Use the check_guardian_risk tool to audit my current TradeXGuardian daily drawdown buffer, discipline score, and active trade rules.`
              )
            }
            className="shrink-0 px-2.5 py-1 rounded-full bg-surface hover:bg-white/10 text-slate-300 hover:text-white border border-grid transition"
          >
            Check TradeXGuardian Rules
          </button>
          <button
            onClick={() =>
              handleSend(
                `Use the fetch_macro_calendar tool to retrieve upcoming high-impact economic news events that could induce volatility today.`
              )
            }
            className="shrink-0 px-2.5 py-1 rounded-full bg-surface hover:bg-white/10 text-slate-300 hover:text-white border border-grid transition"
          >
            Fetch Volatility Catalysts
          </button>
        </div>

        {/* Chat Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-bg/50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 text-[10px] text-muted">
                <span className="font-bold text-white uppercase">
                  {m.sender === 'USER' ? 'You' : 'Quant AI (MCP)'}
                </span>
                <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
              </div>

              {/* Tool Execution Badges */}
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mb-2 space-y-1 w-full max-w-[88%]">
                  {m.toolCalls.map((tc, idx) => {
                    const key = `${m.id}-tool-${idx}`;
                    const isExpanded = expandedToolIndex === key;
                    return (
                      <div
                        key={key}
                        className="rounded border border-cyan-500/30 bg-cyan-500/10 p-2 text-[11px]"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedToolIndex(isExpanded ? null : key)}
                        >
                          <span className="font-bold text-cyan-300">
                            [MCP Tool Executed: {tc.tool}]
                          </span>
                          <span className="text-[9.5px] text-muted hover:text-white">
                            {isExpanded ? 'Hide Payload' : 'View Payload'}
                          </span>
                        </div>
                        {isExpanded && (
                          <div className="mt-1.5 pt-1.5 border-t border-cyan-500/20 text-[10px] text-slate-300 font-mono space-y-1">
                            <div>
                              <strong className="text-muted">Arguments:</strong>{' '}
                              {JSON.stringify(tc.args)}
                            </div>
                            <div>
                              <strong className="text-muted">Result:</strong> {tc.output}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-xl p-3 leading-relaxed select-text whitespace-pre-wrap ${
                  m.sender === 'USER'
                    ? 'bg-cyan-500/15 text-white border border-cyan-500/30'
                    : 'bg-surface text-slate-200 border border-grid'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start animate-pulse">
              <div className="flex items-center gap-2 mb-1 text-[10px] text-muted">
                <span className="font-bold text-cyan-300 uppercase">Quant AI</span>
                <span>Querying MCP &amp; Executing Tools...</span>
              </div>
              <div className="rounded-xl p-3 bg-surface border border-grid text-muted text-xs flex items-center gap-2">
                <span className="h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span>Running client-side model inference &amp; tool validation...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-panel/90 border-t border-grid flex items-center gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Ask MCP Agent about ${symbol}, orderflow, risk rules, or PineScript...`}
            className="flex-1 bg-surface border border-grid rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputVal.trim() || isLoading}
            className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-black font-bold text-xs rounded-lg transition font-heading cursor-pointer flex items-center gap-1.5"
          >
            <span>Execute</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
