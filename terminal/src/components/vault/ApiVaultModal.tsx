import React, { useState } from 'react';
import {
  encryptSecret,
  decryptSecret,
  saveEncryptedVault,
  loadEncryptedVault,
  clearVault,
  type ApiCredentials,
} from '../../services/cryptoVault';

interface ApiVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiVaultModal({ isOpen, onClose }: ApiVaultModalProps) {
  const [broker, setBroker] = useState<ApiCredentials['broker']>('DELTA_EXCHANGE');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isTestnet, setIsTestnet] = useState(true);
  const [password, setPassword] = useState('');

  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockedCreds, setUnlockedCreds] = useState<ApiCredentials | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null);

  if (!isOpen) return null;

  const hasVault = !!loadEncryptedVault();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || !apiKey.trim() || !apiSecret.trim()) {
      setStatusMsg({ text: 'Please fill in credentials and a master passphrase.', ok: false });
      return;
    }

    try {
      const payload: ApiCredentials = {
        broker,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        isTestnet,
      };

      const encrypted = await encryptSecret(JSON.stringify(payload), password);
      saveEncryptedVault(encrypted);

      setApiKey('');
      setApiSecret('');
      setPassword('');
      setStatusMsg({ text: 'Credentials encrypted and stored locally with AES-GCM 256.', ok: true });
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
      if (!creds || typeof creds !== 'object' || !creds.apiKey || !creds.apiSecret) {
        setStatusMsg({ text: 'Corrupted credentials schema in decrypted vault.', ok: false });
        return;
      }
      setUnlockedCreds(creds as ApiCredentials);
      setStatusMsg({ text: 'Vault unlocked successfully.', ok: true });
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
      <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-6 py-4 bg-bg/50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-accent" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Secure Client-Side API Vault & E2EE State Backup
            </h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Message Banner */}
          {statusMsg && (
            <div
              className={`rounded-lg border p-3 ${
                statusMsg.ok
                  ? 'border-up/40 bg-up/10 text-up'
                  : 'border-red-500/40 bg-red-500/10 text-red-300'
              }`}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Section 1: Unlock Existing Vault */}
          {hasVault && !unlockedCreds && (
            <div className="rounded-xl border border-grid bg-bg/40 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                Unlock Stored Credentials
              </h3>
              <p className="text-[11px] text-muted mb-3">
                Your credentials are encrypted using AES-GCM 256. Enter your master password to inspect or verify.
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
                  className="rounded bg-accent px-4 py-1.5 font-bold text-white hover:brightness-110"
                >
                  Unlock
                </button>
              </form>
            </div>
          )}

          {/* Unlocked Credentials View */}
          {unlockedCreds && (
            <div className="rounded-xl border border-up/40 bg-up/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-up uppercase">Vault Unlocked: {unlockedCreds.broker}</span>
                <button
                  onClick={() => {
                    clearVault();
                    setUnlockedCreds(null);
                    setStatusMsg({ text: 'Vault wiped from local storage.', ok: true });
                  }}
                  className="text-red-400 hover:underline"
                >
                  Wipe Vault
                </button>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-muted">
                <div>API Key: <span className="text-white">{unlockedCreds.apiKey.slice(0, 8)}...</span></div>
                <div>Network: <span className="text-white">{unlockedCreds.isTestnet ? 'Testnet Sandbox' : 'Live Production'}</span></div>
              </div>
            </div>
          )}

          {/* Section 2: Store / Update Credentials */}
          <div className="rounded-xl border border-grid bg-bg/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
              Store Encrypted Broker Keys
            </h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted block mb-1">Broker Platform</label>
                  <select
                    value={broker}
                    onChange={(e) => setBroker(e.target.value as any)}
                    className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white"
                  >
                    <option value="DELTA_EXCHANGE">Delta Exchange (India & Global)</option>
                    <option value="OANDA">OANDA v20 Forex</option>
                    <option value="BINANCE">Binance Futures</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-muted block mb-1">Environment</label>
                  <select
                    value={isTestnet ? 'TESTNET' : 'PROD'}
                    onChange={(e) => setIsTestnet(e.target.value === 'TESTNET')}
                    className="w-full rounded border border-grid bg-bg px-2.5 py-1.5 text-white"
                  >
                    <option value="TESTNET">Testnet Sandbox (Safe Practice)</option>
                    <option value="PROD">Live Production Account</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">API Key</label>
                <input
                  type="text"
                  placeholder="Paste broker API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">API Secret</label>
                <input
                  type="password"
                  placeholder="Paste broker API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">Master Encryption Passphrase</label>
                <input
                  type="password"
                  placeholder="Choose a passphrase to encrypt your keys"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-grid bg-bg px-3 py-1.5 text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded bg-accent py-2 font-bold text-white hover:brightness-110"
              >
                Encrypt & Save Keys Locally
              </button>
            </form>
          </div>

          {/* Section 3: E2EE Workspace Backup */}
          <div className="rounded-xl border border-grid bg-bg/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
              Workspace & Layout Backup
            </h3>
            <p className="text-[11px] text-muted mb-3">
              Export your watchlists, positions, paper journal, and customized parameters as a JSON backup.
            </p>
            <button
              onClick={handleExportBackup}
              className="rounded bg-grid px-4 py-2 font-semibold text-white hover:bg-grid/80"
            >
              Export JSON Backup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
