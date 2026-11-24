import React, { useState, useEffect } from 'react';
import {
  loadTelegramConfig,
  saveTelegramConfig,
  testTelegramConnection,
  type TelegramConfig,
} from '../../services/telegramService';
import { audioHaptics } from '../../utils/notify';
import { useAuthStore } from '../../store/useAuthStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { McpProviderType } from '../../services/mcp/mcpClient';

type SettingsTab =
  | 'PROFILE'
  | 'BILLING'
  | 'THEME'
  | 'LANGUAGE'
  | 'TELEGRAM'
  | 'MCP_AI'
  | 'X_TWITTER';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
}

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'PROFILE',
}: SettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  // Auth & Social Store
  const twitterAccount = useAuthStore((s) => s.twitterAccount);
  const connectTwitter = useAuthStore((s) => s.connectTwitter);
  const disconnectTwitter = useAuthStore((s) => s.disconnectTwitter);
  const setActiveRightDrawer = useDrawingStore((s) => s.setActiveRightDrawer);

  // X.com Local Input State
  const [xHandleInput, setXHandleInput] = useState('');
  const [xShareTags, setXShareTags] = useState(() => {
    return localStorage.getItem('terminalx_default_x_tags') || '#TerminalX #Orderflow $BTC $XAUUSD';
  });

  // MCP AI Engine State
  const [mcpProvider, setMcpProvider] = useState<McpProviderType>(() => {
    try {
      return (localStorage.getItem('terminalx_ai_provider') as McpProviderType) || 'OPENAI_OPENROUTER';
    } catch {
      return 'OPENAI_OPENROUTER';
    }
  });

  const [mcpEndpoint, setMcpEndpoint] = useState(() => {
    try {
      return (
        localStorage.getItem('terminalx_ai_endpoint') ||
        'https://api.openai.com/v1/chat/completions'
      );
    } catch {
      return 'https://api.openai.com/v1/chat/completions';
    }
  });

  const [mcpApiKey, setMcpApiKey] = useState(() => {
    try {
      return localStorage.getItem('terminalx_ai_apikey') || '';
    } catch {
      return '';
    }
  });

  const [mcpModel, setMcpModel] = useState(() => {
    try {
      return localStorage.getItem('terminalx_ai_model') || 'gpt-4o-mini';
    } catch {
      return 'gpt-4o-mini';
    }
  });

  const [showApiKey, setShowApiKey] = useState(false);
  const [mcpToast, setMcpToast] = useState<string | null>(null);

  // Profile State
  const [handle, setHandle] = useState('PRO_ALPHA_TRADER');
  const [email, setEmail] = useState('trader@institutional.capital');

  // Theme & Appearance State
  const [themeMode, setThemeMode] = useState<'DARK' | 'LIGHT'>(() => {
    return (localStorage.getItem('crt_theme_mode') as 'DARK' | 'LIGHT') || 'DARK';
  });
  const [highContrast, setHighContrast] = useState(false);

  // Language State
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('crt_language') || 'EN';
  });

  // Telegram Config State
  const [telegram, setTelegram] = useState<TelegramConfig>(loadTelegramConfig);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('crt_theme_mode', themeMode);
      localStorage.setItem('crt_language', language);
      window.dispatchEvent(new Event('crt-theme-change'));
    } catch {}
  }, [themeMode, language]);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  const handleSaveTelegram = () => {
    audioHaptics.tick();
    saveTelegramConfig(telegram);
    setTestResult({ ok: true, msg: 'Telegram notification settings saved.' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestTelegram = async () => {
    audioHaptics.tick();
    setIsTesting(true);
    setTestResult(null);
    const res = await testTelegramConnection(telegram.botToken, telegram.chatId);
    setIsTesting(false);
    if (res.ok) {
      audioHaptics.fill();
      setTestResult({ ok: true, msg: 'Test message delivered to Telegram chat.' });
    } else {
      audioHaptics.error();
      setTestResult({ ok: false, msg: res.error || 'Connection failed.' });
    }
  };

  const handleSaveMcp = () => {
    audioHaptics.tick();
    try {
      localStorage.setItem('terminalx_ai_provider', mcpProvider);
      localStorage.setItem('terminalx_ai_endpoint', mcpEndpoint);
      localStorage.setItem('terminalx_ai_apikey', mcpApiKey);
      localStorage.setItem('terminalx_ai_model', mcpModel);
      setMcpToast('MCP Engine & BYOK settings saved successfully.');
      setTimeout(() => setMcpToast(null), 3000);
    } catch {
      setMcpToast('Failed to save settings.');
    }
  };

  const navTabCls = (t: typeof tab) =>
    `px-3 py-2 text-xs font-semibold rounded-lg transition text-left flex items-center justify-between ${
      tab === t
        ? 'bg-white text-black font-bold'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-3xl h-[80vh] rounded-[10px] border border-white/[0.08] bg-panel p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-white" />
            <h2 className="text-sm font-semibold text-white">
              Platform Settings & Account Center
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-grid px-2 py-0.5 text-muted hover:text-white"
          >
            [ESC / Close]
          </button>
        </div>

        {/* Modal Body: Left Navigation & Right Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 pt-4 overflow-hidden">
          {/* Left Navigation (4 cols) */}
          <div className="md:col-span-4 border-r border-grid pr-4 space-y-1 overflow-y-auto">
            <button onClick={() => setTab('PROFILE')} className={navTabCls('PROFILE')}>
              <span>Profile & Account</span>
              <span className="text-[10px] text-muted">[PRO+]</span>
            </button>
            <button onClick={() => setTab('BILLING')} className={navTabCls('BILLING')}>
              <span>Subscription & Billing</span>
              <span className="text-[10px] text-emerald-400">Active</span>
            </button>
            <button onClick={() => setTab('MCP_AI')} className={navTabCls('MCP_AI')}>
              <span>Model Context (MCP)</span>
              <span className="text-[10px] text-white font-bold">[BYOK]</span>
            </button>
            <button onClick={() => setTab('X_TWITTER')} className={navTabCls('X_TWITTER')}>
              <span>X.com (Twitter) Connect</span>
              <span className="text-[10px] text-muted">{twitterAccount ? `@${twitterAccount.handle}` : '[CONNECT]'}</span>
            </button>
            <button onClick={() => setTab('THEME')} className={navTabCls('THEME')}>
              <span>Theme & Display</span>
              <span className="text-[10px] text-muted">{themeMode}</span>
            </button>
            <button onClick={() => setTab('LANGUAGE')} className={navTabCls('LANGUAGE')}>
              <span>Language & Locale</span>
              <span className="text-[10px] text-muted">{language}</span>
            </button>
            <button onClick={() => setTab('TELEGRAM')} className={navTabCls('TELEGRAM')}>
              <span>Telegram Alerts & Bot</span>
              <span className="text-[10px] text-muted">{telegram.enabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Right Content Area (8 cols) */}
          <div className="md:col-span-8 overflow-y-auto pr-2 space-y-4">
            {/* 1. Profile & Account */}
            {tab === 'PROFILE' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-xl border border-grid bg-slate-900/40 p-4">
                  <div className="h-14 w-14 rounded-[8px] bg-white/10 border border-white/20 flex items-center justify-center font-bold text-white text-lg">
                    PA
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{handle}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">
                        INSTITUTIONAL PRO+
                      </span>
                    </div>
                    <span className="text-xs text-muted block mt-0.5">{email}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold block mt-1">
                      Tier 1 Verification: Approved
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-muted text-xs">
                    Trader Tag / Display Handle
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs focus:border-white focus:outline-none"
                    />
                  </label>

                  <label className="block text-muted text-xs">
                    Registered Corporate Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs focus:border-white focus:outline-none"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-grid bg-slate-950/40 p-3 space-y-1.5 text-[11px] text-muted">
                  <div className="flex justify-between">
                    <span>Broker Connectivity:</span>
                    <span className="text-white font-semibold">Binance Futures / Delta Exchange India / NSE Paper</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hardware 2FA Authentication:</span>
                    <span className="text-emerald-400 font-semibold">YubiKey & WebAuthn Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Subscription & Billing */}
            {tab === 'BILLING' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white">Plan: CRT TERMINAL PRO+ (LIFETIME)</span>
                    <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      PAID ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Institutional Tier subscription unlocked. Real-time L2 orderbook feeds, tick-level WebSockets, and unlimited automated Telegram alerts.
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                    Unlocked Capabilities
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      'Real-Time WebSocket L2 Feeds',
                      'Tick Footprint & Depth of Market',
                      'Black-Scholes Options Greeks Matrix',
                      'Automated Chart Journaling',
                      'Cross-Exchange Funding Arbitrage',
                      'Multi-Timeframe Ghost Charts',
                      'Section 43(5) Tax & Audit Ledger',
                      'Encrypted Client-Side Key Vault',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-1.5 text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-grid p-3 text-xs space-y-2">
                  <div className="flex justify-between text-muted">
                    <span>Billing Cycle:</span>
                    <span className="text-white">Annual Institutional Invoice</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Payment Method:</span>
                    <span className="text-white font-mono">USDC / USDT (Direct Settlement)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Theme & Appearance */}
            {tab === 'THEME' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                    Interface Theme Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        setThemeMode('DARK');
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        themeMode === 'DARK'
                          ? 'border-white bg-white/10 text-white'
                          : 'border-grid bg-slate-900/40 text-muted hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs">Dark Terminal (Default)</div>
                      <div className="text-[10px] text-muted">Obsidian black canvas for zero eye fatigue</div>
                    </button>

                    <button
                      onClick={() => {
                        audioHaptics.tick();
                        setThemeMode('LIGHT');
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        themeMode === 'LIGHT'
                          ? 'border-white bg-white/10 text-white'
                          : 'border-grid bg-slate-900/40 text-muted hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs">Light TradingView Canvas</div>
                      <div className="text-[10px] text-muted">Clean high-contrast daylight palette</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-grid">
                  <label className="flex items-center justify-between p-2 rounded border border-grid bg-slate-900/40 cursor-pointer">
                    <span className="text-xs text-white">High-Contrast Candlesticks</span>
                    <input
                      type="checkbox"
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                      className="accent-white"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* 4. Language & Locale */}
            {tab === 'LANGUAGE' && (
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                  Select Terminal Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: 'EN', name: 'English (US / UK)' },
                    { code: 'HI', name: 'Hindi' },
                    { code: 'ES', name: 'Spanish' },
                    { code: 'JA', name: 'Japanese' },
                    { code: 'DE', name: 'German' },
                    { code: 'FR', name: 'French' },
                    { code: 'ZH', name: 'Mandarin Chinese' },
                  ].map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        audioHaptics.tick();
                        setLanguage(l.code);
                      }}
                      className={`p-2.5 rounded-lg border text-left transition text-xs ${
                        language === l.code
                          ? 'border-white bg-white/10 text-white font-bold'
                          : 'border-grid bg-slate-900/40 text-slate-300 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Telegram Alerts & Bot */}
            {tab === 'TELEGRAM' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-grid bg-slate-950/40 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white block">Telegram Notification Dispatcher</span>
                      <span className="text-[10px] text-muted">Receive live fills and liquidation warnings in your Telegram chat</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={telegram.enabled}
                        onChange={(e) => setTelegram({ ...telegram, enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-grid peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-white"></div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-muted text-xs">
                      Telegram Bot API Token
                      <input
                        type="password"
                        placeholder="123456789:ABCdefGHIjklMNOpqrs..."
                        value={telegram.botToken}
                        onChange={(e) => setTelegram({ ...telegram, botToken: e.target.value })}
                        className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-white focus:outline-none"
                      />
                    </label>

                    <label className="block text-muted text-xs">
                      Telegram Chat ID
                      <input
                        type="text"
                        placeholder="e.g. 987654321"
                        value={telegram.chatId}
                        onChange={(e) => setTelegram({ ...telegram, chatId: e.target.value })}
                        className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-white focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-grid">
                    <span className="text-[11px] font-bold text-muted block mb-1">Dispatch Triggers</span>
                    {[
                      { key: 'notifyOnFills', label: 'Order Execution Fills (Market, Limit, TP/SL)' },
                      { key: 'notifyOnAlerts', label: 'Price & Unrealized Loss Targets' },
                      { key: 'notifyOnKillSwitch', label: 'Kill-Switch Overtrading Lockouts' },
                      { key: 'notifyOnLiquidation', label: 'Margin Call & Liquidation Warnings' },
                    ].map((trig) => (
                      <label key={trig.key} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(telegram as any)[trig.key]}
                          onChange={(e) => setTelegram({ ...telegram, [trig.key]: e.target.checked })}
                          className="accent-white"
                        />
                        <span>{trig.label}</span>
                      </label>
                    ))}
                  </div>

                  {testResult && (
                    <div
                      className={`p-2 rounded text-xs font-semibold ${
                        testResult.ok ? 'bg-emerald-500/10 text-up border border-emerald-500/30' : 'bg-rose-500/10 text-down border border-rose-500/30'
                      }`}
                    >
                      {testResult.msg}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={handleTestTelegram}
                      disabled={isTesting || !telegram.botToken || !telegram.chatId}
                      className="rounded border border-grid px-3 py-1.5 text-xs text-muted hover:text-white hover:border-slate-500 disabled:opacity-40"
                    >
                      {isTesting ? 'Sending...' : 'Send Test Ping'}
                    </button>
                    <button
                      onClick={handleSaveTelegram}
                      className="rounded bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-slate-200 transition"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Model Context Protocol (MCP) & BYOK AI Engine */}
            {tab === 'MCP_AI' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-white block">
                        Model Context Protocol (MCP) & BYOK Engine
                      </span>
                      <span className="text-[10px] text-muted">
                        Configure local or cloud LLMs with native browser tool calling
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-black">
                      CLIENT-SIDE
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed bg-[#181817] p-3 rounded-lg border border-[#282826]">
                    TerminalX executes all 6 MCP quant tools (Live Quotes, Footprint Delta, Risk Blocker, Lot Calculator, Forex Calendar, and PineScript Audit) directly in your browser. No server inference load on Railway, zero rate limits, and full API key privacy.
                  </p>

                  <div className="space-y-3 pt-2">
                    {/* Provider Select */}
                    <div>
                      <label className="block text-[11px] font-bold text-muted mb-1">
                        AI Provider Engine
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { id: 'OPENAI_OPENROUTER', label: 'OpenAI / OpenRouter' },
                          { id: 'ANTHROPIC', label: 'Anthropic Claude' },
                          { id: 'GOOGLE_GEMINI', label: 'Google Gemini' },
                          { id: 'MCP_SERVER', label: 'Remote MCP Server' },
                          { id: 'LOCAL_OLLAMA', label: 'Local Ollama' },
                        ].map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              audioHaptics.tick();
                              setMcpProvider(p.id as McpProviderType);
                              if (p.id === 'OPENAI_OPENROUTER') {
                                setMcpEndpoint('https://api.openai.com/v1/chat/completions');
                                setMcpModel('gpt-4o-mini');
                              } else if (p.id === 'ANTHROPIC') {
                                setMcpEndpoint('https://api.anthropic.com/v1/messages');
                                setMcpModel('claude-3-5-sonnet-20241022');
                              } else if (p.id === 'GOOGLE_GEMINI') {
                                setMcpEndpoint('https://generativelanguage.googleapis.com/v1beta/models');
                                setMcpModel('gemini-1.5-flash');
                              } else if (p.id === 'LOCAL_OLLAMA') {
                                setMcpEndpoint('http://localhost:11434/api/chat');
                                setMcpModel('llama3.2');
                              }
                            }}
                            className={`p-2 rounded-lg border text-left text-[11px] font-bold transition ${
                              mcpProvider === p.id
                                ? 'border-white bg-white/10 text-white'
                                : 'border-[#282826] bg-black/40 text-slate-400 hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Endpoint URL */}
                    <div>
                      <label className="block text-muted text-[11px] mb-1">
                        API Endpoint URL
                      </label>
                      <input
                        type="text"
                        value={mcpEndpoint}
                        onChange={(e) => setMcpEndpoint(e.target.value)}
                        className="w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-white focus:outline-none"
                      />
                    </div>

                    {/* BYOK API Key */}
                    {mcpProvider !== 'LOCAL_OLLAMA' && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-muted text-[11px]">
                            Bring-Your-Own-Key (BYOK) API Key
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowApiKey((v) => !v)}
                            className="text-[10px] text-slate-400 hover:text-white"
                          >
                            {showApiKey ? 'Hide Key' : 'Reveal Key'}
                          </button>
                        </div>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={mcpApiKey}
                          onChange={(e) => setMcpApiKey(e.target.value)}
                          placeholder="sk-..."
                          className="w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-white focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Model Identifier */}
                    <div>
                      <label className="block text-muted text-[11px] mb-1">
                        Model Identifier
                      </label>
                      <input
                        type="text"
                        value={mcpModel}
                        onChange={(e) => setMcpModel(e.target.value)}
                        placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022, deepseek-chat"
                        className="w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {mcpToast && (
                    <div className="p-2 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {mcpToast}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-grid">
                    <button
                      onClick={handleSaveMcp}
                      className="rounded bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-slate-200 transition"
                    >
                      Save MCP Engine Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 7. X.com (Twitter) Connect & Feed Settings */}
            {tab === 'X_TWITTER' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-black border border-white/20 flex items-center justify-center text-white">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block">
                          X.com Account & Social Alpha Wire
                        </span>
                        <span className="text-[10px] text-muted">
                          Connect your trader handle and track market-moving posts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connected Account Card */}
                  {twitterAccount ? (
                    <div className="p-3.5 rounded-lg border border-[#282826] bg-[#181817] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#282826] border border-white/20 flex items-center justify-center text-white font-bold text-sm">
                          {twitterAccount.handle.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs">@{twitterAccount.handle}</div>
                          <div className="text-[10px] text-emerald-400">Connected to TerminalX Social Layer</div>
                        </div>
                      </div>
                      <button
                        onClick={disconnectTwitter}
                        className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-400 hover:bg-rose-500/20 transition"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-lg border border-[#282826] bg-[#181817] space-y-2">
                      <span className="text-xs text-white font-bold block">Link your X.com account</span>
                      <p className="text-[11px] text-slate-400">
                        Enables 1-click chart sharing, personal quote tweets, and real-time social market feeds.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-2 text-slate-500">@</span>
                          <input
                            type="text"
                            value={xHandleInput}
                            onChange={(e) => setXHandleInput(e.target.value)}
                            placeholder="username"
                            className="w-full rounded border border-[#282826] bg-black/60 pl-6 pr-3 py-1.5 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!xHandleInput.trim()) return;
                            connectTwitter(xHandleInput);
                            setXHandleInput('');
                          }}
                          className="px-4 py-1.5 rounded bg-white text-black font-bold text-xs hover:bg-slate-200 transition"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Curated Market Accounts Info */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                      Tracked High-Impact Market Accounts
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { handle: '@DeItaone', desc: 'Walter Bloomberg Fast Wire' },
                        { handle: '@tier10k', desc: 'Tree News Macro & Crypto Wire' },
                        { handle: '@federalreserve', desc: 'FOMC Policy & Rate Actions' },
                        { handle: '@FinancialJuice', desc: 'Global Macro Indicators' },
                        { handle: '@saylor', desc: 'MicroStrategy Treasury Updates' },
                        { handle: '@elonmusk', desc: 'Macro & Regulatory Announcements' },
                      ].map((acc) => (
                        <div key={acc.handle} className="p-2 rounded border border-[#282826] bg-black/40 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-white text-[11px]">{acc.handle}</div>
                            <div className="text-[10px] text-muted">{acc.desc}</div>
                          </div>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Default Share Tags */}
                  <div className="space-y-1.5 pt-2 border-t border-grid">
                    <label className="text-[11px] font-bold text-muted block">
                      Default Share Hashtags & Cashtags
                    </label>
                    <input
                      type="text"
                      value={xShareTags}
                      onChange={(e) => {
                        setXShareTags(e.target.value);
                        localStorage.setItem('terminalx_default_x_tags', e.target.value);
                      }}
                      className="w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-white focus:outline-none"
                    />
                  </div>

                  {/* Launch Wire Drawer Action */}
                  <div className="flex items-center justify-between pt-3 border-t border-grid">
                    <span className="text-[11px] text-slate-400">
                      View live tweets side-by-side with your chart:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        audioHaptics.tick();
                        setActiveRightDrawer('X_FEED');
                        onClose();
                      }}
                      className="rounded bg-white px-4 py-1.5 text-xs font-bold text-black hover:bg-slate-200 transition"
                    >
                      Open X Alpha Wire
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-4 border-t border-grid pt-3 flex items-center justify-between shrink-0 text-muted text-[11px]">
          <span>Security Protocol: AES-256 Web Crypto Client Encrypted</span>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="rounded bg-grid px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
