/**
 * Institutional Mobile & WiFi Connect Modal.
 * Generates dynamic QR code and local network URL (192.168.0.105:5173)
 * allowing instant scanning and live chart viewing on mobile devices over local WiFi.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { audioHaptics } from '../../utils/notify';

interface MobileConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  localIp?: string;
  port?: number;
}

export default function MobileConnectModal({
  isOpen,
  onClose,
  localIp = '192.168.0.105',
  port = 5173,
}: MobileConnectModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // If running in browser and hostname is an IP, use that; otherwise use detected localIp
  const effectiveIp =
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? window.location.hostname
      : localIp;

  const effectivePort =
    typeof window !== 'undefined' && window.location.port ? window.location.port : String(port);

  const fullUrl = `http://${effectiveIp}:${effectivePort}`;

  useEffect(() => {
    if (!isOpen) return;

    // Generate QR code data URL
    QRCode.toDataURL(fullUrl, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('[QR] Failed to generate:', err));
  }, [isOpen, fullUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    audioHaptics.tick();
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none font-mono">
      <div className="w-full max-w-md flex flex-col rounded-xl border border-grid shadow-2xl overflow-hidden bg-panel text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-4 py-3 bg-panel">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-sm text-white">Mobile WiFi Connect</span>
            <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              LAN Live
            </span>
          </div>
          <button
            onClick={() => {
              audioHaptics.tick();
              onClose();
            }}
            className="p-1 rounded text-muted hover:text-white hover:bg-white/10 transition"
            title="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          <p className="text-xs text-muted max-w-xs">
            Scan this QR code with your phone camera or visit the link below to open the terminal on your mobile device over local WiFi.
          </p>

          {/* QR Code Container */}
          <div className="p-3 bg-white rounded-xl shadow-lg border border-grid/40 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Mobile Terminal Access QR Code"
                className="w-48 h-48 rounded"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-xs text-black font-semibold animate-pulse">
                Generating QR...
              </div>
            )}
          </div>

          {/* URL Pill & Copy Button */}
          <div className="w-full flex items-center justify-between p-2 rounded-lg bg-surface border border-grid gap-2">
            <span className="text-xs font-bold text-cyan-400 font-mono truncate px-1">
              {fullUrl}
            </span>
            <button
              onClick={handleCopy}
              className={`px-3 py-1 text-xs font-bold rounded transition shrink-0 ${
                copied
                  ? 'bg-emerald-500 text-black'
                  : 'bg-accent hover:bg-accent/80 text-black'
              }`}
            >
              {copied ? 'Copied' : 'Copy URL'}
            </button>
          </div>

          {/* Instructions & Troubleshooting Box */}
          <div className="w-full text-left p-3 rounded-lg bg-surface/50 border border-grid text-[11px] text-muted space-y-1.5">
            <div className="font-semibold text-white text-xs mb-1">Quick Instructions & Troubleshooting:</div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-cyan-400">1.</span>
              <span>Ensure your phone is on the exact same WiFi network (not mobile 4G/5G data).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-cyan-400">2.</span>
              <span>Important: Use <strong>http://</strong> (not https://) in mobile browser address bar.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-cyan-400">3.</span>
              <span>If your WiFi router has "AP Isolation" or "Guest Network", connect both to primary WiFi SSID.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-bold text-cyan-400">4.</span>
              <span>VPN / Remote Access: If on Tailscale, connect directly to <code className="text-cyan-300 font-mono">http://100.123.109.16:{effectivePort}</code>.</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-grid px-4 py-2.5 bg-panel flex items-center justify-between text-[10.5px] text-muted">
          <span>Server listening on 0.0.0.0:{effectivePort}</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-surface hover:bg-surface/80 text-white font-semibold border border-grid transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
