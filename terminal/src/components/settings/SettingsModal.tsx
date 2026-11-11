import React, { useState, useEffect } from 'react';
import {
  loadTelegramConfig,
  saveTelegramConfig,
  testTelegramConnection,
  type TelegramConfig,
} from '../../services/telegramService';
import { audioHaptics } from '../../utils/notify';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'PROFILE' | 'BILLING' | 'THEME' | 'LANGUAGE' | 'TELEGRAM';
}

export default function SettingsModal({
  isOpen,
  onClose,
  initialTab = 'PROFILE',
}: SettingsModalProps) {
  const [tab, setTab] = useState<'PROFILE' | 'BILLING' | 'THEME' | 'LANGUAGE' | 'TELEGRAM'>(initialTab);

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

  const navTabCls = (t: typeof tab) =>
    `px-3 py-2 text-xs font-semibold rounded-lg transition text-left flex items-center justify-between ${
      tab === t
        ? 'bg-accent/20 border border-accent text-accent'
        : 'text-muted hover:text-white hover:bg-slate-900'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-3xl h-[80vh] rounded-[10px] border border-white/[0.08] bg-panel p-6 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-accent" />
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
          {/* Left Navigation (3 cols) */}
          <div className="md:col-span-4 border-r border-grid pr-4 space-y-1 overflow-y-auto">
            <button onClick={() => setTab('PROFILE')} className={navTabCls('PROFILE')}>
              <span>Profile & Account</span>
              <span className="text-[10px] text-muted">[PRO+]</span>
            </button>
            <button onClick={() => setTab('BILLING')} className={navTabCls('BILLING')}>
              <span>Subscription & Billing</span>
              <span className="text-[10px] text-emerald-400">Active</span>
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
                  <div className="h-14 w-14 rounded-[8px] bg-accent/20 border border-accent flex items-center justify-center font-bold text-accent text-lg">
                    PA
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{handle}</span>
                      <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-black">
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
                      className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs focus:border-accent focus:outline-none"
                    />
                  </label>

                  <label className="block text-muted text-xs">
                    Registered Corporate Email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs focus:border-accent focus:outline-none"
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
                <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
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
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
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
                          ? 'border-accent bg-accent/20 text-white'
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
                          ? 'border-accent bg-accent/20 text-white'
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
                      className="accent-accent"
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
                          ? 'border-accent bg-accent/20 text-accent font-bold'
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
                      <div className="w-9 h-5 bg-grid peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
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
                        className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-accent focus:outline-none"
                      />
                    </label>

                    <label className="block text-muted text-xs">
                      Telegram Chat ID
                      <input
                        type="text"
                        placeholder="e.g. 987654321"
                        value={telegram.chatId}
                        onChange={(e) => setTelegram({ ...telegram, chatId: e.target.value })}
                        className="mt-1 w-full rounded border border-grid bg-bg p-2 text-white text-xs font-mono focus:border-accent focus:outline-none"
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
                          className="accent-accent"
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
                      className="rounded bg-accent px-4 py-1.5 text-xs font-bold text-black hover:brightness-110"
                    >
                      Save Configuration
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
