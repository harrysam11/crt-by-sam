/**
 * Institutional Quant & AI Assistant Modal.
 * Integrates Local Ollama (DeepSeek-R1 / Llama 3 / Mistral) and Cloud API (OpenAI / Gemini / Anthropic compatible).
 * Features:
 *  - Chart Price Action & Technical Structure Audit
 *  - Macro News & Fundamentals Impact Debrief
 *  - PineScript Strategy & Quant Code Builder
 *  - Software & Terminal Interactive Guide
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { audioHaptics } from '../../utils/notify';
import { queryLocalOllama } from '../../services/aiBehavioralInsights';
import { fmtPrice } from '../../utils/formatters';

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: number;
}

interface QuantAIAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
}

type AIProvider = 'OLLAMA' | 'CLOUD_API';

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

  const [provider, setProvider] = useState<AIProvider>(() => {
    try {
      return (localStorage.getItem('crt_ai_provider') as AIProvider) || 'OLLAMA';
    } catch {
      return 'OLLAMA';
    }
  });

  const [ollamaEndpoint, setOllamaEndpoint] = useState(() => {
    try {
      return localStorage.getItem('crt_ollama_endpoint') || 'http://localhost:11434/api/generate';
    } catch {
      return 'http://localhost:11434/api/generate';
    }
  });

  const [ollamaModel, setOllamaModel] = useState(() => {
    try {
      return localStorage.getItem('crt_ollama_model') || 'deepseek-r1:latest';
    } catch {
      return 'deepseek-r1:latest';
    }
  });

  const [cloudEndpoint, setCloudEndpoint] = useState(() => {
    try {
      return localStorage.getItem('crt_cloud_endpoint') || 'https://api.openai.com/v1/chat/completions';
    } catch {
      return 'https://api.openai.com/v1/chat/completions';
    }
  });

  const [cloudApiKey, setCloudApiKey] = useState(() => {
    try {
      return localStorage.getItem('crt_cloud_apikey') || '';
    } catch {
      return '';
    }
  });

  const [cloudModel, setCloudModel] = useState(() => {
    try {
      return localStorage.getItem('crt_cloud_model') || 'deepseek-chat';
    } catch {
      return 'deepseek-chat';
    }
  });

  const [showConfig, setShowConfig] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'AI',
      text: `Quant & AI Assistant initialized. Connected to active symbol ${symbol} (${timeframe}). Ask any technical analysis, macro fundamentals, PineScript logic, or terminal usage questions.`,
      timestamp: Date.now(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle initial prompt passed to modal
  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSend(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  // Test local Ollama connection on open
  useEffect(() => {
    if (provider !== 'OLLAMA' || !isOpen) return;
    const testOllama = async () => {
      try {
        const rootUrl = ollamaEndpoint.replace(/\/api\/.*$/, '');
        const res = await fetch(`${rootUrl}/api/tags`, { method: 'GET' });
        setOllamaConnected(res.ok);
      } catch {
        setOllamaConnected(false);
      }
    };
    testOllama();
  }, [provider, ollamaEndpoint, isOpen]);

  // Save config settings
  const handleSaveConfig = () => {
    try {
      localStorage.setItem('crt_ai_provider', provider);
      localStorage.setItem('crt_ollama_endpoint', ollamaEndpoint);
      localStorage.setItem('crt_ollama_model', ollamaModel);
      localStorage.setItem('crt_cloud_endpoint', cloudEndpoint);
      localStorage.setItem('crt_cloud_apikey', cloudApiKey);
      localStorage.setItem('crt_cloud_model', cloudModel);
    } catch {}
    setShowConfig(false);
    audioHaptics.tick();
  };

  // Build Context Snapshot for on-chart analysis
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

    const context = buildChartContext();
    const fullPrompt = `${context}\n\nUSER REQUEST:\n${textToSend}\n\nINSTRUCTION: Provide an institutional, ultra-concise, technical answer. Format mathematical levels, orderflow bias, and code cleanly. No emojis.`;

    let reply = '';

    if (provider === 'OLLAMA') {
      const res = await queryLocalOllama(fullPrompt, ollamaModel, ollamaEndpoint);
      reply = res.response;
    } else {
      // Cloud API provider (OpenAI compatible)
      try {
        const res = await fetch(cloudEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cloudApiKey}`,
          },
          body: JSON.stringify({
            model: cloudModel,
            messages: [
              {
                role: 'system',
                content:
                  'You are an institutional quantitative trading AI and algorithmic software specialist. You give concise, data-driven answers without fluff or emojis.',
              },
              { role: 'user', content: fullPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (!res.ok) {
          throw new Error(`Cloud API returned HTTP ${res.status}`);
        }
        const data = await res.json();
        reply = data.choices?.[0]?.message?.content || 'No response generated.';
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown network failure';
        reply = `Cloud API Request Failed: ${msg}. Please check your Endpoint, API Key, and Model name in settings.`;
      }
    }

    const aiMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'AI',
      text: reply,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5 font-mono select-none">
      <div className="flex flex-col h-[90vh] max-h-[820px] w-full max-w-3xl clay-popover shadow-2xl border border-white/15 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grid/60 bg-[#0c0c14]">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
            <span className="font-bold text-white text-xs uppercase tracking-wider">
              Quant & AI Assistant ({provider === 'OLLAMA' ? 'Local Ollama' : 'Cloud API'})
            </span>
            <span className="text-[10px] text-slate-400 border border-white/10 px-1.5 py-0.5 rounded">
              {symbol} · {timeframe}
            </span>
            {provider === 'OLLAMA' && ollamaConnected !== null && (
              <span
                className={`text-[9.5px] px-1.5 py-0.5 rounded font-bold ${
                  ollamaConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {ollamaConnected ? 'Ollama Online' : 'Ollama Offline'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                audioHaptics.tick();
                setShowConfig((v) => !v);
              }}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="Configure AI Provider & Model"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Configuration Panel Dropdown */}
        {showConfig && (
          <div className="bg-[#10101c] p-4 border-b border-grid/80 space-y-3 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="font-bold text-white text-[11px] uppercase">AI Engine Settings</span>
              <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-white/10">
                <button
                  onClick={() => setProvider('OLLAMA')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    provider === 'OLLAMA' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Local Ollama
                </button>
                <button
                  onClick={() => setProvider('CLOUD_API')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    provider === 'CLOUD_API' ? 'bg-accent text-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cloud API
                </button>
              </div>
            </div>

            {provider === 'OLLAMA' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-muted block mb-1">Ollama API Endpoint</label>
                  <input
                    type="text"
                    value={ollamaEndpoint}
                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                    placeholder="http://localhost:11434/api/generate"
                    className="w-full bg-slate-900 border border-grid rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted block mb-1">Model Name</label>
                  <select
                    value={ollamaModel}
                    onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full bg-slate-900 border border-grid rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="deepseek-r1:latest">DeepSeek-R1 (Institutional Reasoning)</option>
                    <option value="llama3:latest">Llama 3 (Meta)</option>
                    <option value="mistral:latest">Mistral 7B</option>
                    <option value="qwen2.5:latest">Qwen 2.5 Coder</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase text-muted block mb-1">API Base URL</label>
                    <input
                      type="text"
                      value={cloudEndpoint}
                      onChange={(e) => setCloudEndpoint(e.target.value)}
                      placeholder="https://api.openai.com/v1/chat/completions"
                      className="w-full bg-slate-900 border border-grid rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-muted block mb-1">Model ID</label>
                    <input
                      type="text"
                      value={cloudModel}
                      onChange={(e) => setCloudModel(e.target.value)}
                      placeholder="e.g. deepseek-chat, gpt-4o-mini, claude-3-5-sonnet"
                      className="w-full bg-slate-900 border border-grid rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted block mb-1">API Key</label>
                  <input
                    type="password"
                    value={cloudApiKey}
                    onChange={(e) => setCloudApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-slate-900 border border-grid rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveConfig}
                className="px-3 py-1 bg-accent text-black font-bold rounded text-xs hover:brightness-110"
              >
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Quick Prompt Pills Bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-black/40 border-b border-grid/40 overflow-x-auto text-[10.5px]">
          <span className="text-muted text-[10px] uppercase shrink-0">Prompts:</span>
          <button
            onClick={() => handleSend(`Perform an institutional Price Action & Liquidity Audit for ${symbol} on the ${timeframe} chart. Identify market structure, key order blocks, liquidity sweep levels, and high-probability invalidation zones.`)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
          >
            Chart TA & Liquidity Audit
          </button>
          <button
            onClick={() => handleSend(`Provide a macroeconomic and fundamentals debrief. How are recent CPI, rates, and yields impacting ${symbol}? Give directional orderflow bias.`)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
          >
            Macro & News Impact
          </button>
          <button
            onClick={() => handleSend(`Write a PineScript v5 indicator or strategy for Candle Range Theory (CRT) and Turtle Soup liquidity sweeps with clean visual plots and alerts.`)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
          >
            PineScript Strategy Builder
          </button>
          <button
            onClick={() => handleSend(`Explain how to use the Footprint DOM ladder, order flow delta, and the multi-account switcher in this trading terminal.`)}
            className="shrink-0 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition"
          >
            Software & Terminal Help
          </button>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-[#09090f]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'USER' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 text-[10px] text-slate-400">
                <span className="font-bold text-white uppercase">
                  {m.sender === 'USER' ? 'You' : 'Quant AI'}
                </span>
                <span>{new Date(m.timestamp).toLocaleTimeString()}</span>
              </div>
              <div
                className={`max-w-[88%] rounded-xl p-3 leading-relaxed select-text whitespace-pre-wrap ${
                  m.sender === 'USER'
                    ? 'bg-accent/15 text-white border border-accent/30'
                    : 'bg-white/[0.03] text-slate-200 border border-white/10'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start animate-pulse">
              <div className="flex items-center gap-1.5 text-[10px] text-accent mb-1 font-bold">
                <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                <span>Quant AI Thinking & Analyzing Order Flow...</span>
              </div>
              <div className="max-w-[88%] rounded-xl p-3 bg-white/[0.03] border border-white/10 text-slate-400">
                Evaluating price levels, technical market structure, and macro confluence...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-3 bg-[#0c0c14] border-t border-grid/60">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={`Ask Quant AI about ${symbol}, technicals, macro, or terminal features...`}
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-grid rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !inputVal.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-black font-bold text-xs hover:brightness-110 disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <span>Send</span>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
