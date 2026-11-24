/**
 * XAlphaNewsPanel.tsx
 * Real-time X.com (Twitter) Market Wire & Live Dynamic Current Affairs Engine.
 * Features:
 *   - Auto-updating live geopolitical & macroeconomic wire (/api/news/wire)
 *   - Tracks Donald Trump, Vladimir Putin, Iran Republic, Jensen Huang (NVIDIA),
 *     Fed/Powell, OPEC+, Walter Bloomberg (@DeItaone), Tree News (@tier10k)
 *   - Cryptographic proof-of-ownership verification challenge (prevents handle spoofing)
 *   - Custom figure / handle tracking engine
 *   - 1-click "Ask Quant AI" market impact analysis
 *   - 1-click "Share to X" intent composer
 * ZERO NEON POLICY & ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { useAuthStore } from '../../store/useAuthStore';
import { audioHaptics } from '../../utils/notify';
import {
  CURATED_MARKET_TWEETS,
  fetchLiveNewsWire,
  filterMarketTweets,
  buildXIntentUrl,
  getCustomTrackedFigures,
  saveCustomTrackedFigure,
  removeCustomTrackedFigure,
  MarketTweetItem,
  CustomFigureTracker,
} from '../../services/xAlphaWireService';

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function XAlphaNewsPanel() {
  const symbol = useTerminalStore((s) => s.symbol);
  const setActiveRightDrawer = useDrawingStore((s) => s.setActiveRightDrawer);
  const twitterAccount = useAuthStore((s) => s.twitterAccount);
  const connectTwitter = useAuthStore((s) => s.connectTwitter);
  const confirmTwitterVerification = useAuthStore((s) => s.confirmTwitterVerification);
  const disconnectTwitter = useAuthStore((s) => s.disconnectTwitter);

  const [rawTweets, setRawTweets] = useState<MarketTweetItem[]>(CURATED_MARKET_TWEETS);
  const [isLoadingWire, setIsLoadingWire] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [filterBySymbolOnly, setFilterBySymbolOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newPostText, setNewPostText] = useState<string>('');
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [showConnectInput, setShowConnectInput] = useState<boolean>(false);
  const [handleInput, setHandleInput] = useState<string>('');

  // Custom Figure Tracking state
  const [showAddFigure, setShowAddFigure] = useState<boolean>(false);
  const [customHandleInput, setCustomHandleInput] = useState<string>('');
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [customFigures, setCustomFigures] = useState<CustomFigureTracker[]>(getCustomTrackedFigures);

  const loadLiveWire = useCallback(async () => {
    setIsLoadingWire(true);
    try {
      const liveItems = await fetchLiveNewsWire();
      if (liveItems && liveItems.length > 0) {
        // Merge live items with curated figures without duplicates
        const map = new Map<string, MarketTweetItem>();
        for (const item of liveItems) map.set(item.id, item);
        for (const item of CURATED_MARKET_TWEETS) {
          if (!map.has(item.id)) map.set(item.id, item);
        }
        setRawTweets(Array.from(map.values()));
        setLastRefreshedAt(Date.now());
      }
    } catch {
      // Fallback already preserved
    } finally {
      setIsLoadingWire(false);
    }
  }, []);

  useEffect(() => {
    loadLiveWire();
    const timer = setInterval(() => {
      loadLiveWire();
    }, 45000);
    return () => clearInterval(timer);
  }, [loadLiveWire]);

  const tweets = useMemo(() => {
    return filterMarketTweets(rawTweets, {
      symbol: filterBySymbolOnly ? symbol : undefined,
      category: activeCategory !== 'ALL' ? activeCategory : undefined,
      searchQuery,
    });
  }, [rawTweets, symbol, filterBySymbolOnly, activeCategory, searchQuery]);

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleInput.trim()) return;
    connectTwitter(handleInput);
    setShowConnectInput(false);
    setHandleInput('');
  };

  const handleConfirmProof = () => {
    audioHaptics.fill();
    if (twitterAccount?.verificationNonce) {
      confirmTwitterVerification(twitterAccount.verificationNonce);
    }
  };

  const handleAddCustomFigureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHandleInput.trim() || !customNameInput.trim()) return;
    const clean = customHandleInput.replace(/^@/, '').trim();
    const newFig: CustomFigureTracker = {
      id: `cf-${Date.now()}`,
      handle: clean,
      name: customNameInput.trim(),
      category: 'GEOPOLITICAL',
      symbols: [symbol],
    };
    saveCustomTrackedFigure(newFig);
    setCustomFigures(getCustomTrackedFigures());
    setCustomHandleInput('');
    setCustomNameInput('');
    setShowAddFigure(false);
  };

  const handleRemoveFigure = (id: string) => {
    audioHaptics.tick();
    removeCustomTrackedFigure(id);
    setCustomFigures(getCustomTrackedFigures());
  };

  const handleAskQuantAI = (tweet: MarketTweetItem) => {
    audioHaptics.tick();
    if (typeof window !== 'undefined' && window.__openQuantAI) {
      window.__openQuantAI(
        `Analyze the direct macroeconomic, geopolitical, and price impact of this breaking tape on ${symbol}:\nSource: @${tweet.handle} (${tweet.name})\nContent: "${tweet.content}"`
      );
    }
  };

  const handleShareTweet = (text: string) => {
    audioHaptics.tick();
    const url = buildXIntentUrl({
      text: `${text}\n\n#TerminalX #${symbol}`,
      hashtags: ['Orderflow', 'TerminalX'],
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#141413] font-mono text-xs select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#282826] px-3 py-2.5 shrink-0 bg-[#181817]">
        <div className="flex items-center gap-2">
          {/* Official X Logo */}
          <div className="h-4 w-4 flex items-center justify-center text-white">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </div>
          <span className="text-xs font-bold text-white tracking-tight">X Alpha & Geopolitical Wire</span>
          <span className="rounded px-1.5 py-0.5 bg-white/5 border border-[#282826] text-slate-400 text-[10px]">
            {symbol}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              audioHaptics.tick();
              loadLiveWire();
            }}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title={`Refresh live wire (updated ${relativeTime(lastRefreshedAt)})`}
          >
            <svg
              className={`h-3.5 w-3.5 ${isLoadingWire ? 'animate-spin text-white' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={() => setShowCompose((v) => !v)}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-black hover:bg-slate-200 transition"
            title="Compose Post to X"
          >
            Post
          </button>
          <button
            onClick={() => setActiveRightDrawer(null)}
            className="p-1 rounded text-slate-400 hover:text-white transition"
            title="Close panel"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Real-time Dynamic Wire Telemetry Status Bar */}
      <div className="px-3 py-1.5 border-b border-[#282826] bg-[#10100f] flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#089981] animate-pulse" />
          <span className="text-slate-300 font-bold">LIVE CURRENT AFFAIRS ENGINE</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span>{tweets.length} events</span>
          <span>·</span>
          <span>Auto-sync 45s</span>
        </div>
      </div>

      {/* Account Connection & Cryptographic Proof Verification Bar */}
      <div className="px-3 py-2 border-b border-[#282826] bg-[#141413]">
        {twitterAccount ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    twitterAccount.verified ? 'bg-[#089981]' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="text-white font-bold text-[11px]">@{twitterAccount.handle}</span>
                {twitterAccount.verified ? (
                  <span className="text-[9px] font-bold rounded bg-emerald-500/10 border border-emerald-500/30 px-1 text-emerald-400">
                    VERIFIED OWNER
                  </span>
                ) : (
                  <span className="text-[9px] font-bold rounded bg-amber-500/10 border border-amber-500/30 px-1 text-amber-400">
                    PROOF REQUIRED
                  </span>
                )}
              </div>
              <button
                onClick={disconnectTwitter}
                className="text-[10px] text-slate-500 hover:text-rose-400 transition"
              >
                Unlink
              </button>
            </div>

            {/* Cryptographic Ownership Verification Challenge */}
            {!twitterAccount.verified && (
              <div className="p-2 rounded bg-[#181817] border border-amber-500/20 text-[10px] space-y-1.5">
                <div className="text-amber-300 font-bold">Ownership Challenge Nonce:</div>
                <code className="block bg-black p-1 rounded border border-[#282826] text-white font-mono select-all">
                  {twitterAccount.verificationNonce}
                </code>
                <div className="flex items-center gap-2 pt-0.5">
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                      `Verifying my @TerminalX trader handle: ${twitterAccount.verificationNonce}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded bg-white text-black font-bold text-[10px] hover:bg-slate-200 transition"
                  >
                    1-Click Tweet Nonce
                  </a>
                  <button
                    onClick={handleConfirmProof}
                    className="px-2 py-0.5 rounded border border-white/20 text-white font-bold text-[10px] hover:bg-white/10 transition"
                  >
                    Confirm Proof
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : showConnectInput ? (
          <form onSubmit={handleConnectSubmit} className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span className="font-bold text-white">Cryptographic Handle Linker</span>
              <button
                type="button"
                onClick={() => setShowConnectInput(false)}
                className="text-slate-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              A challenge nonce will be issued to prevent unauthorized username squatting.
            </p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="your_handle"
                className="flex-1 rounded border border-[#282826] bg-black/60 px-2 py-1 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-white text-black font-bold text-xs hover:bg-slate-200"
              >
                Issue Challenge
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Connect your X account to trade & post</span>
            <button
              onClick={() => setShowConnectInput(true)}
              className="text-[10px] font-bold text-white underline hover:text-slate-300"
            >
              Verify X Account
            </button>
          </div>
        )}
      </div>

      {/* Quick Compose Drawer */}
      {showCompose && (
        <div className="p-3 border-b border-[#282826] bg-[#181817] space-y-2 animate-fadeIn">
          <textarea
            value={newPostText}
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder={`Share market observation on ${symbol}...`}
            rows={2}
            className="w-full rounded border border-[#282826] bg-black/60 p-2 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none resize-none font-sans"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">{newPostText.length}/280</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowCompose(false)}
                className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newPostText.trim()) return;
                  handleShareTweet(newPostText);
                  setNewPostText('');
                  setShowCompose(false);
                }}
                disabled={!newPostText.trim()}
                className="px-3 py-1 rounded bg-white text-black font-bold text-[10px] hover:bg-slate-200 disabled:opacity-40"
              >
                Publish to X
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Figure / Public Figure Tracker Drawer */}
      {showAddFigure && (
        <form onSubmit={handleAddCustomFigureSubmit} className="p-3 border-b border-[#282826] bg-[#181817] space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white">Track Custom Public Figure</span>
            <button
              type="button"
              onClick={() => setShowAddFigure(false)}
              className="text-slate-500 hover:text-white text-[10px]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={customNameInput}
              onChange={(e) => setCustomNameInput(e.target.value)}
              placeholder="Name (e.g. Macron / Powell)"
              className="rounded border border-[#282826] bg-black/60 p-1.5 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none"
            />
            <input
              type="text"
              value={customHandleInput}
              onChange={(e) => setCustomHandleInput(e.target.value)}
              placeholder="@handle or keyword"
              className="rounded border border-[#282826] bg-black/60 p-1.5 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-3 py-1 rounded bg-white text-black font-bold text-[10px] hover:bg-slate-200"
            >
              Add to Live Wire
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="p-2.5 border-b border-[#282826] bg-[#141413] space-y-2">
        {/* Search Input & Add Figure Button */}
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Trump, Putin, Iran, Nvidia, Fed, Oil..."
              className="w-full rounded border border-[#282826] bg-black/50 px-2.5 py-1 text-xs text-white placeholder-slate-600 focus:border-white focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-[10px] text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAddFigure((v) => !v)}
            className="px-2 py-1 rounded border border-[#282826] bg-[#181817] text-slate-300 hover:text-white text-[10px] font-bold"
            title="Add custom politician or CEO figure tracker"
          >
            + Figure
          </button>
        </div>

        {/* Dynamic Category Chips */}
        <div className="flex flex-wrap gap-1 items-center">
          <button
            onClick={() => setFilterBySymbolOnly((v) => !v)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
              filterBySymbolOnly
                ? 'bg-white text-black border-white'
                : 'bg-black/40 border-[#282826] text-slate-400 hover:text-white'
            }`}
          >
            {symbol} Only
          </button>
          {[
            { id: 'ALL', label: 'All Wire' },
            { id: 'TRUMP_POLICY', label: 'Trump Policy' },
            { id: 'GEOPOLITICAL', label: 'Putin & Iran' },
            { id: 'SEMICONDUCTOR_AI', label: 'Nvidia / AI' },
            { id: 'CENTRAL_BANK', label: 'Fed & Rates' },
            { id: 'ENERGY_OPEC', label: 'OPEC / Oil' },
            { id: 'CRYPTO', label: 'Crypto Wire' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setFilterBySymbolOnly(false);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                activeCategory === cat.id && !filterBySymbolOnly
                  ? 'bg-white text-black border-white'
                  : 'bg-black/40 border-[#282826] text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* User's Custom Figure Tags if any */}
        {customFigures.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-[#282826]/40 items-center">
            <span className="text-[9px] text-slate-500 font-bold">Custom Figures:</span>
            {customFigures.map((cf) => (
              <span
                key={cf.id}
                onClick={() => setSearchQuery(cf.name)}
                className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-slate-300 text-[9px] cursor-pointer hover:border-white flex items-center gap-1"
              >
                <span>{cf.name}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFigure(cf.id);
                  }}
                  className="text-slate-500 hover:text-rose-400"
                >
                  x
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Feed Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#282826]">
        {tweets.length === 0 ? (
          <div className="p-6 text-center text-slate-500 space-y-2">
            <p>No posts matching the current criteria.</p>
            <button
              onClick={() => {
                setFilterBySymbolOnly(false);
                setActiveCategory('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-white underline hover:text-slate-300"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          tweets.map((tweet) => (
            <div key={tweet.id} className="p-3 hover:bg-[#181817] transition space-y-2">
              {/* Event Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-[#282826] border border-white/20 flex items-center justify-center font-bold text-[9px] text-white">
                    {tweet.handle.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-white text-[11px]">{tweet.name}</span>
                  <span className="text-slate-500 text-[10px]">@{tweet.handle}</span>
                  {tweet.sourceType === 'LIVE_WIRE' && (
                    <span className="rounded bg-white/10 px-1 py-0.2 text-[8px] font-bold text-slate-300">
                      LIVE
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">{relativeTime(tweet.timestamp)}</span>
              </div>

              {/* Event Content */}
              <p className="text-xs text-slate-200 font-sans leading-relaxed">
                {tweet.content}
              </p>

              {/* Metadata Badges & Symbols */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                    tweet.impact === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {tweet.impact} IMPACT
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                    tweet.sentiment === 'BULLISH'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : tweet.sentiment === 'BEARISH'
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                  }`}
                >
                  {tweet.sentiment}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/5 border border-[#282826] text-slate-400">
                  {tweet.category.replace('_', ' ')}
                </span>
                {tweet.symbols.map((sym) => (
                  <span
                    key={sym}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-[#282826] text-slate-300"
                  >
                    ${sym}
                  </span>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t border-[#282826]/60 text-[10px]">
                <button
                  onClick={() => handleAskQuantAI(tweet)}
                  className="flex items-center gap-1 text-slate-300 hover:text-white transition"
                  title="Prompt TerminalX Quant AI to analyze the fundamental impact of this event"
                >
                  <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Ask Quant AI</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleShareTweet(`"${tweet.content}" - @${tweet.handle}`)}
                    className="text-slate-400 hover:text-white transition"
                  >
                    Quote
                  </button>
                  <a
                    href={tweet.tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-white transition flex items-center gap-0.5"
                  >
                    <span>Source</span>
                    <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
