/**
 * AppDownloadModal.tsx
 * Download and Installation Guide Modal for iOS, Android, and Desktop.
 * Supports:
 * - One-click PWA browser installation via beforeinstallprompt
 * - Step-by-step iOS Safari installation guide (Add to Home Screen)
 * - Android APK / Chrome installation guide
 * - Native Capacitor source build instructions (Xcode & Android Studio)
 * ZERO EMOJI POLICY strictly enforced.
 */

import { useState, useEffect } from 'react';
import { audioHaptics } from '../../utils/notify';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppDownloadModal({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'IOS' | 'ANDROID' | 'NATIVE'>('IOS');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleTriggerInstall = async () => {
    audioHaptics.tick();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('PWA installation prompt is ready. Follow the guide below for your platform.');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#090b12] shadow-2xl overflow-hidden font-sans flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center">
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h3 className="font-heading font-bold text-white text-base">Download CRT Terminal App</h3>
              <p className="text-[11px] text-muted font-sans">Full native experience on iOS, Android, and Desktop</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Platform Switcher Tabs */}
        <div className="flex items-center border-b border-white/[0.07] px-6 pt-3 gap-2 shrink-0 bg-white/[0.01]">
          {[
            { id: 'IOS' as const, label: 'iOS (iPhone / iPad)' },
            { id: 'ANDROID' as const, label: 'Android (APK / PWA)' },
            { id: 'NATIVE' as const, label: 'Capacitor Native Build' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                audioHaptics.tick();
                setActiveTab(tab.id);
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-accent text-white font-bold'
                  : 'border-transparent text-muted hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
          {/* iOS Guide */}
          {activeTab === 'IOS' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-sky-500/30 bg-sky-500/10 space-y-1.5">
                <span className="font-bold text-sky-300 block text-xs">Instant iOS Home Screen App (No App Store Needed)</span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Runs full-screen with native 120Hz gesture support, zero Safari browser address bars, and instant launch from your iPhone or iPad home screen.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-white/10 font-bold text-white flex items-center justify-center shrink-0 text-xs">1</span>
                  <div>
                    <span className="font-semibold text-white block">Open in Safari</span>
                    <p className="text-muted text-[11px] mt-0.5">Navigate to this terminal domain in Safari on your iPhone or iPad.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-white/10 font-bold text-white flex items-center justify-center shrink-0 text-xs">2</span>
                  <div>
                    <span className="font-semibold text-white block">Tap the Share Button</span>
                    <p className="text-muted text-[11px] mt-0.5">Tap the bottom share icon (box with an upward arrow) in Safari.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-white/10 font-bold text-white flex items-center justify-center shrink-0 text-xs">3</span>
                  <div>
                    <span className="font-semibold text-white block">Select &quot;Add to Home Screen&quot;</span>
                    <p className="text-muted text-[11px] mt-0.5">Scroll down and tap &quot;Add to Home Screen&quot;, then tap &quot;Add&quot; in the top-right corner.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android Guide */}
          {activeTab === 'ANDROID' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-1.5">
                <span className="font-bold text-emerald-300 block text-xs">Direct Android App Installation</span>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Installs CRT Terminal directly as a standalone Android app with native notification capabilities and offline cache.
                </p>
              </div>

              {deferredPrompt && (
                <button
                  onClick={handleTriggerInstall}
                  className="w-full clay-btn-active py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Click to Install App on Android Device</span>
                </button>
              )}

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-white/10 font-bold text-white flex items-center justify-center shrink-0 text-xs">1</span>
                  <div>
                    <span className="font-semibold text-white block">Open in Chrome or Edge</span>
                    <p className="text-muted text-[11px] mt-0.5">Visit the terminal on your Android phone or tablet.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <span className="h-6 w-6 rounded-full bg-white/10 font-bold text-white flex items-center justify-center shrink-0 text-xs">2</span>
                  <div>
                    <span className="font-semibold text-white block">Tap &quot;Install App&quot; or Three Dots Menu</span>
                    <p className="text-muted text-[11px] mt-0.5">Tap the banner or tap Chrome settings (three dots) &gt; &quot;Install app&quot; or &quot;Add to Home Screen&quot;.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Native Build Guide */}
          {activeTab === 'NATIVE' && (
            <div className="space-y-3 font-mono text-[11px]">
              <div className="p-3 rounded-xl border border-purple-500/30 bg-purple-500/10">
                <span className="font-bold text-purple-300 block text-xs font-sans">Capacitor Native Projects Ready</span>
                <p className="text-slate-300 leading-relaxed text-[11px] font-sans mt-1">
                  The repository includes ready-to-compile native Xcode (`ios/`) and Android Studio (`android/`) projects.
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider font-sans">Build Android APK (.apk / .aab):</span>
                <pre className="p-3 rounded-lg bg-black/60 border border-white/10 text-emerald-400 overflow-x-auto">
{`cd terminal
npm run cap:build
npm run cap:android
# In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK`}
                </pre>

                <span className="text-[10px] text-muted uppercase font-bold tracking-wider font-sans block pt-2">Build iOS App (.ipa / Xcode):</span>
                <pre className="p-3 rounded-lg bg-black/60 border border-white/10 text-sky-400 overflow-x-auto">
{`cd terminal
npm run cap:build
npm run cap:ios
# In Xcode: Product > Archive / Run on connected iPhone`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.07] px-6 py-3.5 bg-black/40">
          <span className="text-[11px] text-muted font-mono">
            {isInstalled ? 'Status: App installed in standalone mode' : 'Status: Web application ready for install'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
