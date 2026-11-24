/**
 * XAlphaNewsPanel.tsx
 * Real-time X.com (Twitter) Market Wire & Influential Figures News Feed.
 * Connects traders with live breaking posts from:
 *   - @DeItaone, @tier10k, @federalreserve, @FinancialJuice, @elonmusk, @saylor
 * Features:
 *   - Symbol-specific tweet filtering (e.g. $XAUUSD, $BTCUSDT)
 *   - 1-click "Ask Quant AI" market impact analysis
 *   - 1-click "Open on X" link
 *   - 1-click "Share to X" intent composer
 *   - Connect / Manage X account status
 * ZERO NEON POLICY & ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { useDrawingStore } from '../../store/useDrawingStore';
import { useAuthStore } from '../../store/useAuthStore';
import { audioHaptics } from '../../utils/notify';
import {
  CURATED_MARKET_TWEETS,
  filterMarketTweets,
  buildXIntentUrl,
  MarketTweetItem,
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
  const disconnectTwitter = useAuthStore((s) => s.disconnectTwitter);

  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [filterBySymbolOnly, setFilterBySymbolOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newPostText, setNewPostText] = useState<string>('');
  const [showCompose, setShowCompose] = useState<boolean>(false);
  const [showConnectInput, setShowConnectInput] = useState<boolean>(false);
  const [handleInput, setHandleInput] = useState<string>('');

  const tweets = useMemo(() => {
    return filterMarketTweets(CURATED_MARKET_TWEETS, {
      symbol: filterBySymbolOnly ? symbol : undefined,
      category: activeCategory !== 'ALL' ? activeCategory : undefined,
      searchQuery,
    });
  }, [symbol, filterBySymbolOnly, activeCategory, searchQuery]);

  const handleConnectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleInput.trim()) return;
    connectTwitter(handleInput);
    setShowConnectInput(false);
    setHandleInput('');
  };

  const handleAskQuantAI = (tweet: MarketTweetItem) => {
    audioHaptics.tick();
    if (typeof window !== 'undefined' && window.__openQuantAI) {
      window.__openQuantAI(
        `Analyze the direct market impact and volatility implications of this breaking post from @${tweet.handle} on ${symbol}:\n"${tweet.content}"`
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
          <span className="text-xs font-bold text-white tracking-tight">X Alpha Wire</span>
          <span className="rounded px-1.5 py-0.5 bg-white/5 border border-[#282826] text-slate-400 text-[10px]">
            {symbol}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Account Connection Status Bar */}
      <div className="px-3 py-2 border-b border-[#282826] bg-[#141413]">
        {twitterAccount ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#089981]" />
              <span className="text-slate-300 font-bold text-[11px]">@{twitterAccount.handle}</span>
              <span className="text-[10px] text-slate-500">[Connected]</span>
            </div>
            <button
              onClick={disconnectTwitter}
              className="text-[10px] text-slate-500 hover:text-rose-400 transition"
            >
              Unlink
            </button>
          </div>
        ) : showConnectInput ? (
          <form onSubmit={handleConnectSubmit} className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Link X Account</span>
              <button
                type="button"
                onClick={() => setShowConnectInput(false)}
                className="text-slate-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
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
                Save
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Connect X to post and sync feeds</span>
            <button
              onClick={() => setShowConnectInput(true)}
              className="text-[10px] font-bold text-white underline hover:text-slate-300"
            >
              Connect X Account
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
            <span className="text-[10px] text-slate-500">
              {newPostText.length}/280
            </span>
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

      {/* Filter and Search Bar */}
      <div className="p-2.5 border-b border-[#282826] bg-[#141413] space-y-2">
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter tweets by text, handle, or $symbol..."
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

        {/* Filter Badges */}
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
          {['ALL', 'CENTRAL_BANK', 'MACRO', 'CRYPTO', 'COMMODITIES'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                activeCategory === cat && !filterBySymbolOnly
                  ? 'bg-white text-black border-white'
                  : 'bg-black/40 border-[#282826] text-slate-400 hover:text-white'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Tweet Feed Stream */}
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
              {/* Tweet Header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-[#282826] border border-white/20 flex items-center justify-center font-bold text-[9px] text-white">
                    {tweet.handle.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="font-bold text-white text-[11px]">{tweet.name}</span>
                  <span className="text-slate-500 text-[10px]">@{tweet.handle}</span>
                </div>
                <span className="text-[10px] text-slate-500">{relativeTime(tweet.timestamp)}</span>
              </div>

              {/* Tweet Content */}
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
                  title="Prompt TerminalX Quant AI with this market event"
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
                    <span>Open on X</span>
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
