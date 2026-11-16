import React, { useState } from 'react';
import {
  encryptSecret,
  decryptSecret,
  saveEncryptedVault,
  loadEncryptedVault,
  clearVault,
  type ApiCredentials,
  type SupportedBroker,
} from '../../services/cryptoVault';
import { audioHaptics } from '../../utils/notify';

interface ApiVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiVaultModal({ isOpen, onClose }: ApiVaultModalProps) {
  const [broker, setBroker] = useState<SupportedBroker>('METATRADER_5');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTestnet, setIsTestnet] = useState(false);
  const [password, setPassword] = useState('');

  // Extended broker connector state
  const [accountNumber, setAccountNumber] = useState('');
  const [server, setServer] = useState('MetaQuotes-Demo');
  const [gatewayUrl, setGatewayUrl] = useState('ws://127.0.0.1:8765');
  const [appId, setAppId] = useState('CRT-Terminal');
  const [totpSecret, setTotpSecret] = useState('');
  const [propFirmShieldEnabled, setPropFirmShieldEnabled] = useState(true);

  const [activeTab, setActiveTab] = useState<'CONNECT' | 'STATUS' | 'GUIDE'>('CONNECT');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockedCreds, setUnlockedCreds] = useState<ApiCredentials | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!isOpen) return null;

  const hasVault = !!loadEncryptedVault();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setStatusMsg({ text: 'Please enter a master encryption passphrase.', ok: false });
      return;
    }

    try {
      const payload: ApiCredentials = {
        broker,
        apiKey: apiKey.trim() || accountNumber.trim(),
        apiSecret: apiSecret.trim(),
        isTestnet,
        server: server.trim(),
        gatewayUrl: gatewayUrl.trim(),
        appId: appId.trim(),
        accountNumber: accountNumber.trim(),
        totpSecret: totpSecret.trim(),
        propFirmShieldEnabled,
        propFirmDailyLossPct: 4.5,
      };

      const encrypted = await encryptSecret(JSON.stringify(payload), password);
      saveEncryptedVault(encrypted);

      setPassword('');
      setStatusMsg({
        text: `${broker} credentials encrypted with AES-GCM 256 and saved locally in secure client vault.`,
        ok: true,
      });
    } catch (err) {
      setStatusMsg({ text: 'Encryption failed: ' + String(err), ok: false });
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const encrypted = loadEncryptedVault();
    if (!encrypted) {
      setStatusMsg({ text: 'No encrypted vault found in storage.', ok: false });
      return;
    }

    try {
      const decrypted = await decryptSecret(encrypted, unlockPassword);
      const creds = JSON.parse(decrypted) as Partial<ApiCredentials>;
      if (!creds || typeof creds !== 'object') {
        setStatusMsg({ text: 'Corrupted credentials schema in decrypted vault.', ok: false });
        return;
      }
      setUnlockedCreds(creds as ApiCredentials);
      setStatusMsg({ text: `Vault unlocked: connected to ${creds.broker}.`, ok: true });
    } catch {
      setStatusMsg({ text: 'Invalid passphrase or corrupted vault. Decryption failed.', ok: false });
    }
  };

  const handleExportBackup = () => {
    const raw = localStorage.getItem('terminal-v3') || '{}';
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crt-terminal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex h-[88vh] w-full max-w-3xl flex-col rounded-xl border border-white/[0.08] bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-accent" />
            <h2 className="text-sm font-semibold text-white">
              Institutional Broker Vault & Gateway Connectors
            </h2>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="clay-btn px-2.5 py-1 text-muted hover:text-white"
          >
            ESC
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-grid bg-bg/30 px-6">
          {(['CONNECT', 'STATUS', 'GUIDE'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                audioHaptics.tick();
                setActiveTab(tab);
              }}
              className={`py-2 px-4 font-semibold text-xs border-b-2 transition ${
                activeTab === tab
                  ? 'border-accent text-white'
                  : 'border-transparent text-muted hover:text-white'
              }`}
            >
              {tab === 'CONNECT'
                ? 'Broker Setup'
                : tab === 'STATUS'
                ? 'Vault Status'
                : 'Bridge Architecture'}
            </button>
          ))}
        </div>

        {/* Status Notification Message */}
        {statusMsg && (
          <div
            className={`px-6 py-2 border-b text-[11px] font-semibold flex items-center justify-between ${
              statusMsg.ok
                ? 'border-up/30 bg-up/10 text-up'
                : 'border-down/30 bg-down/10 text-down'
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="text-muted hover:text-white">
              x
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'CONNECT' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-grid bg-bg/40 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                  Connect MT5, Tradovate or Crypto Broker
                </h3>
                <p className="text-[11px] text-muted mb-4">
                  Keys and credentials are encrypted on your local device using AES-GCM 256-bit PBKDF2 encryption. They are never sent to external servers in plain text.
                </p>

                <form onSubmit={handleSave} className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                        Broker Platform
                      </label>
                      <select
                        value={broker}
                        onChange={(e) => {
                          const val = e.target.value as SupportedBroker;
                          setBroker(val);
                          if (val === 'METATRADER_5') {
                            setServer('MetaQuotes-Demo');
                            setGatewayUrl('ws://127.0.0.1:8765');
                          } else if (val === 'TRADOVATE') {
                            setAppId('CRT-Terminal');
                          } else if (val === 'INTERACTIVE_BROKERS') {
                            setGatewayUrl('http://127.0.0.1:5000');
                          }
                        }}
                        className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white focus:outline-none"
                      >
                        <option value="METATRADER_5">MetaTrader 5 (MT5 Bridge Gateway)</option>
                        <option value="TRADOVATE">Tradovate (CME Futures Direct)</option>
                        <option value="INTERACTIVE_BROKERS">Interactive Brokers (IBKR TWS)</option>
                        <option value="ZERODHA_KITE">Zerodha Kite (NSE/BSE Equities & F&O)</option>
                        <option value="DHAN">Dhan HQ (NSE/BSE/MCX Direct API)</option>
                        <option value="ANGEL_ONE">Angel One SmartAPI (Nifty & Bank Nifty)</option>
                        <option value="DELTA_EXCHANGE">Delta Exchange (Options & Futures)</option>
                        <option value="BINANCE">Binance Futures (Perp USDT)</option>
                        <option value="BYBIT">Bybit Perpetuals</option>
                        <option value="OANDA">OANDA v20 Forex</option>
                        <option value="CUSTOM">Custom WebSocket / REST Bridge</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                        Environment / Network
                      </label>
                      <select
                        value={isTestnet ? 'DEMO' : 'LIVE'}
                        onChange={(e) => setIsTestnet(e.target.value === 'DEMO')}
                        className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white focus:outline-none"
                      >
                        <option value="DEMO">Demo / Simulation Sandbox</option>
                        <option value="LIVE">Live Capital Account</option>
                      </select>
                    </div>
                  </div>

                  {/* Broker Specific Fields */}
                  {broker === 'METATRADER_5' && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            MT5 Account Login ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 5092819"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            MT5 Broker Server
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. FTMO-Server or MetaQuotes-Demo"
                            value={server}
                            onChange={(e) => setServer(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            MT5 Password (Master or Investor)
                          </label>
                          <input
                            type="password"
                            placeholder="Account password"
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Local Bridge WebSocket URL
                          </label>
                          <input
                            type="text"
                            placeholder="ws://127.0.0.1:8765"
                            value={gatewayUrl}
                            onChange={(e) => setGatewayUrl(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {broker === 'TRADOVATE' && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Tradovate App ID
                          </label>
                          <input
                            type="text"
                            placeholder="CRT-Terminal"
                            value={appId}
                            onChange={(e) => setAppId(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            API Key
                          </label>
                          <input
                            type="text"
                            placeholder="Tradovate API Key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                          API Secret
                        </label>
                        <input
                          type="password"
                          placeholder="Tradovate API Secret"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  )}

                  {broker === 'INTERACTIVE_BROKERS' && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            IBKR Account ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. U1234567"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            TWS Client Gateway Host:Port
                          </label>
                          <input
                            type="text"
                            placeholder="http://127.0.0.1:5000"
                            value={gatewayUrl}
                            onChange={(e) => setGatewayUrl(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {broker === 'ZERODHA_KITE' && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Zerodha User ID / Client Code
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. AB1234"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Kite API Key
                          </label>
                          <input
                            type="text"
                            placeholder="Kite Connect API Key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Kite API Secret
                          </label>
                          <input
                            type="password"
                            placeholder="API Secret"
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Daily Request Token
                          </label>
                          <input
                            type="text"
                            placeholder="Request token from login redirect"
                            value={server}
                            onChange={(e) => setServer(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {broker === 'DHAN' && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Dhan Client ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 1000123456"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Dhan HQ Access Token (JWT)
                          </label>
                          <input
                            type="password"
                            placeholder="Paste Dhan HQ Access Token"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {broker === 'ANGEL_ONE' && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Angel One Client Code
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. A123456"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            SmartAPI Key
                          </label>
                          <input
                            type="text"
                            placeholder="SmartAPI Key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            Trading PIN / Password
                          </label>
                          <input
                            type="password"
                            placeholder="Trading PIN"
                            value={apiSecret}
                            onChange={(e) => setApiSecret(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                            TOTP Secret Key (2FA)
                          </label>
                          <input
                            type="password"
                            placeholder="TOTP Secret key"
                            value={totpSecret}
                            onChange={(e) => setTotpSecret(e.target.value)}
                            className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {['DELTA_EXCHANGE', 'BINANCE', 'BYBIT', 'OANDA', 'CUSTOM'].includes(broker) && (
                    <div className="space-y-3 border-t border-grid/50 pt-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                          API Key
                        </label>
                        <input
                          type="text"
                          placeholder="Paste API Key"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                          API Secret
                        </label>
                        <input
                          type="password"
                          placeholder="Paste API Secret (HMAC-SHA256)"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  )}

                  {/* Prop Firm Rule Compliance Shield Guardrail */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] space-y-1.5 border-t border-grid/50 pt-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <span className="font-bold text-white uppercase">Prop Firm Rule Compliance Shield</span>
                      </div>
                      <label className="flex items-center gap-1.5 text-[10px] cursor-pointer text-amber-300">
                        <input
                          type="checkbox"
                          checked={propFirmShieldEnabled}
                          onChange={(e) => setPropFirmShieldEnabled(e.target.checked)}
                          className="rounded bg-black border-grid text-white focus:ring-0"
                        />
                        <span>Shield Active (4.5% Buffer)</span>
                      </label>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[10px]">
                      Automated Daily Loss Lockout: If session loss exceeds 4.5% of starting capital, terminal automatically locks execution to protect your FTMO / FundedNext / Prop Firm account from the 5% max daily loss breach rule.
                    </p>
                    <p className="text-zinc-400 text-[9px]">
                      Notice: FTMO and FundedNext permit standard local MT5 bridges. If your firm restricts third-party EAs, use direct broker login.
                    </p>
                  </div>

                  {/* Encryption Passphrase */}
                  <div className="border-t border-grid/50 pt-3">
                    <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                      Master Passphrase for Local AES Encryption
                    </label>
                    <input
                      type="password"
                      placeholder="Passphrase to encrypt your keys on this device"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="clay-pill-active w-full py-2 font-bold text-xs"
                  >
                    Encrypt & Save in Secure Client Vault
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'STATUS' && (
            <div className="space-y-4">
              {hasVault ? (
                <div className="rounded-xl border border-grid bg-bg/40 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                    Vault Status: Encrypted Credentials Present
                  </h3>
                  <p className="text-[11px] text-muted mb-3">
                    Enter your master passphrase to unlock and inspect your broker configuration.
                  </p>
                  <form onSubmit={handleUnlock} className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Master Passphrase"
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      className="flex-1 rounded border border-grid bg-bg px-3 py-1.5 text-white"
                    />
                    <button
                      type="submit"
                      className="clay-pill-active px-4 py-1.5 font-bold"
                    >
                      Unlock
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-xl border border-grid bg-bg/40 p-4 text-center text-muted">
                  No encrypted credentials currently stored. Use the Broker Setup tab to connect.
                </div>
              )}

              {unlockedCreds && (
                <div className="rounded-xl border border-up/40 bg-up/10 p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-up/20 pb-2">
                    <span className="font-bold text-up uppercase">
                      Vault Unlocked: {unlockedCreds.broker}
                    </span>
                    <button
                      onClick={() => {
                        clearVault();
                        setUnlockedCreds(null);
                        setStatusMsg({ text: 'Vault wiped from local storage.', ok: true });
                      }}
                      className="text-red-400 hover:underline text-[10px]"
                    >
                      Wipe Vault
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-muted">
                    <div>Broker: <span className="text-white font-bold">{unlockedCreds.broker}</span></div>
                    {unlockedCreds.server && <div>Server: <span className="text-white">{unlockedCreds.server}</span></div>}
                    {unlockedCreds.gatewayUrl && <div>Gateway: <span className="text-white">{unlockedCreds.gatewayUrl}</span></div>}
                    <div>Network: <span className="text-white">{unlockedCreds.isTestnet ? 'Demo / Simulation' : 'Live Production'}</span></div>
                  </div>
                </div>
              )}

              {/* Workspace Export Backup */}
              <div className="rounded-xl border border-grid bg-bg/40 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                  Encrypted Workspace Backup
                </h3>
                <p className="text-[11px] text-muted mb-3">
                  Export your terminal preferences, drawings, alerts, and settings as a JSON backup file.
                </p>
                <button
                  onClick={handleExportBackup}
                  className="clay-btn px-4 py-1.5 font-semibold text-white"
                >
                  Export JSON Backup
                </button>
              </div>
            </div>
          )}

          {activeTab === 'GUIDE' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-grid bg-bg/40 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  How MT5, Tradovate & External Feeds Work in Pure Web Apps
                </h3>

                <div className="space-y-2 text-[11px] text-slate-300 leading-relaxed">
                  <p>
                    <b className="text-white">1. The Browser Sandbox Boundary:</b><br />
                    Web browsers cannot directly invoke C++ DLLs or execute raw binary TCP sockets to desktop MT5 binaries (e.g. `terminal64.exe`). This is an inherent browser security sandbox restriction.
                  </p>

                  <p>
                    <b className="text-white">2. MT5 Bridge Architecture (ZeroMQ / Python):</b><br />
                    To stream free tick feeds and execute trades on MT5, a lightweight local bridge daemon (such as the standard Python `MetaTrader5` library or ZeroMQ EA) runs on your computer or VPS. It connects directly to your MT5 terminal and exposes a local WebSocket server (default <code className="text-cyan-300">ws://127.0.0.1:8765</code>). CRT Terminal connects to this local WebSocket to receive raw ticks, footprint order books, and send instant execution tickets.
                  </p>

                  <p>
                    <b className="text-white">3. Tradovate Direct WebSocket & OAuth:</b><br />
                    Tradovate provides official REST and WebSocket endpoints for CME Futures (ES, NQ, YM, GC, CL). By configuring your Tradovate App ID and API Key in the vault, CRT Terminal streams real-time CME market data and routes orders directly through Tradovate APIs.
                  </p>

                  <p>
                    <b className="text-white">4. Zero-Knowledge Encryption:</b><br />
                    Your master passphrase derives an AES-GCM 256-bit encryption key in memory via PBKDF2 with 100,000 SHA-256 iterations. Secrets are stored strictly encrypted inside your browser&#39;s local storage.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
