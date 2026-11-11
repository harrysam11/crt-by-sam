/**
 * Economic Calendar & Financial News Matrix Modal.
 * Dual-tab interface:
 * 1. Live Global Economic Calendar (FairEconomy/ForexFactory feed) with impact filters & currency breakdown.
 * 2. Live Financial News Wire (Yahoo Finance news feed) with real-time headlines and ticker links.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import {
  fetchEconomicCalendar,
  fetchMarketNews,
  type RealEconomicEvent,
  type MarketNewsStory,
} from '../../services/calendarNewsService';
import { audioHaptics } from '../../utils/notify';

interface EconomicCalendarModalProps {
  onClose: () => void;
}

type ModalTab = 'CALENDAR' | 'NEWS';
type ImpactFilter = 'ALL' | 'HIGH' | 'MED' | 'LOW';

export default function EconomicCalendarModal({ onClose }: EconomicCalendarModalProps) {
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const [activeTab, setActiveTab] = useState<ModalTab>('CALENDAR');

  // Calendar State
  const [events, setEvents] = useState<RealEconomicEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string>('ALL');

  // News State
  const [news, setNews] = useState<MarketNewsStory[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsTopic, setNewsTopic] = useState<'market' | 'crypto' | 'stocks' | 'economy'>('market');

  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const loadCalendar = async (signal?: AbortSignal) => {
    setEventsLoading(true);
    try {
      const data = await fetchEconomicCalendar(signal);
      if (!signal?.aborted) {
        setEvents(data);
        setLastUpdated(Date.now());
      }
    } finally {
      if (!signal?.aborted) setEventsLoading(false);
    }
  };

  const loadNews = async (topic: string, signal?: AbortSignal) => {
    setNewsLoading(true);
    try {
      const data = await fetchMarketNews(topic, signal);
      if (!signal?.aborted) {
        setNews(data);
        setLastUpdated(Date.now());
      }
    } finally {
      if (!signal?.aborted) setNewsLoading(false);
    }
  };

  useEffect(() => {
    const ctl = new AbortController();
    if (activeTab === 'CALENDAR' && events.length === 0) {
      loadCalendar(ctl.signal);
    } else if (activeTab === 'NEWS' && news.length === 0) {
      loadNews(newsTopic, ctl.signal);
    }
    return () => ctl.abort();
  }, [activeTab, newsTopic]);

  // Distinct days in calendar
  const distinctDays = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      set.add(ev.dateStr);
    }
    return Array.from(set).sort();
  }, [events]);

  // Filtered Calendar Events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (impactFilter !== 'ALL' && ev.impact !== impactFilter) return false;
      if (countryFilter !== 'ALL' && ev.country !== countryFilter) return false;
      if (selectedDay !== 'ALL' && ev.dateStr !== selectedDay) return false;
      return true;
    });
  }, [events, impactFilter, countryFilter, selectedDay]);

  const getImpactBadge = (impact: RealEconomicEvent['impact']) => {
    switch (impact) {
      case 'HIGH':
        return 'border-white text-white font-bold bg-white/15';
      case 'MED':
        return 'border-zinc-500 text-zinc-300 bg-zinc-800/40';
      case 'HOLIDAY':
        return 'border-zinc-800 text-zinc-500 bg-zinc-900/60';
      default:
        return 'border-zinc-700 text-zinc-400 bg-black/40';
    }
  };

  const formatTimeAgo = (unixSec: number) => {
    const diff = Math.floor(Date.now() / 1000) - unixSec;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md select-none font-mono text-xs">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] rounded-[10px] border border-white/[0.08] bg-[#0f0f13] p-5 shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-white/80" />
            <div>
              <h2 className="text-sm font-semibold text-white">
                Global Macro Matrix & News Wire
              </h2>
              <div className="text-[10px] text-zinc-400">
                Weekly Economic Indicators & Financial Market News
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 mr-2">
              <button
                onClick={() => {
                  audioHaptics.tick();
                  setActiveTab('CALENDAR');
                }}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  activeTab === 'CALENDAR'
                    ? 'clay-pill-active text-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Economic Calendar
              </button>
              <button
                onClick={() => {
                  audioHaptics.tick();
                  setActiveTab('NEWS');
                }}
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${
                  activeTab === 'NEWS'
                    ? 'clay-pill-active text-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Market News Wire
              </button>
            </div>

            <button
              onClick={() => {
                audioHaptics.tick();
                if (activeTab === 'CALENDAR') loadCalendar();
                else loadNews(newsTopic);
              }}
              disabled={eventsLoading || newsLoading}
              className="clay-pill px-3 py-1 text-xs text-white hover:text-white flex items-center gap-1.5 transition"
              title="Refresh data"
            >
              <svg
                className={`h-3.5 w-3.5 text-white ${eventsLoading || newsLoading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>

            <button
              onClick={onClose}
              className="clay-btn px-2.5 py-1 text-slate-400 hover:text-white transition"
              title="Close modal (ESC)"
            >
              Close
            </button>
          </div>
        </div>

        {/* Calendar View */}
        {activeTab === 'CALENDAR' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid/60 py-2.5 shrink-0 text-[11px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-500 font-semibold">Impact:</span>
                {(
                  [
                    { id: 'ALL', label: 'All' },
                    { id: 'HIGH', label: 'High Impact' },
                    { id: 'MED', label: 'Medium' },
                    { id: 'LOW', label: 'Low' },
                  ] as const
                ).map((imp) => (
                  <button
                    key={imp.id}
                    onClick={() => {
                      audioHaptics.tick();
                      setImpactFilter(imp.id);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      impactFilter === imp.id
                        ? 'bg-white text-black font-bold'
                        : 'border border-grid/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    {imp.label}
                  </button>
                ))}

                <span className="text-zinc-600 ml-1">|</span>
                <span className="text-zinc-500 font-semibold">Currency:</span>
                {(['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'] as const).map((curr) => (
                  <button
                    key={curr}
                    onClick={() => {
                      audioHaptics.tick();
                      setCountryFilter(curr);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                      countryFilter === curr
                        ? 'bg-white text-black font-bold'
                        : 'border border-grid/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>

              {/* Day filter pills */}
              {distinctDays.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-zinc-500">Day:</span>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="rounded border border-grid/60 bg-bg px-2 py-0.5 text-xs text-white focus:outline-none"
                  >
                    <option value="ALL">Entire Week</option>
                    {distinctDays.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Events List */}
            <div className="flex-1 overflow-y-auto min-h-0 pt-2">
              {eventsLoading && events.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
                  <span className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Loading weekly macro calendar data...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-slate-500">
                  <span>No economic releases match the selected filters.</span>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-panel border-b border-grid text-slate-400 font-semibold text-[11px]">
                    <tr>
                      <th className="px-3 py-2">Date & Time</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Economic Release</th>
                      <th className="px-3 py-2 text-center">Impact</th>
                      <th className="px-3 py-2 text-right">Forecast</th>
                      <th className="px-3 py-2 text-right">Previous</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grid/40">
                    {filteredEvents.map((ev) => (
                      <tr key={ev.id} className="hover:bg-white/5 transition">
                        <td className="px-3 py-2 font-mono text-zinc-300">
                          <div>{ev.dateStr}</div>
                          <div className="text-[10px] text-zinc-500">{ev.timeStr}</div>
                        </td>
                        <td className="px-3 py-2 font-bold text-white tracking-wider">
                          <span className="rounded px-1.5 py-0.5 text-[10px] border border-grid text-slate-200">
                            {ev.country}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-white font-medium">
                          {ev.title}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${getImpactBadge(ev.impact)}`}>
                            {ev.impact}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300">
                          {ev.forecast}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-400">
                          {ev.previous}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* News View */}
        {activeTab === 'NEWS' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* News Filter Toolbar */}
            <div className="flex items-center gap-1.5 border-b border-grid/60 py-2.5 shrink-0">
              <span className="text-zinc-500 font-semibold text-[11px] mr-1">Topic:</span>
              {(
                [
                  { id: 'market', label: 'All Markets' },
                  { id: 'crypto', label: 'Crypto' },
                  { id: 'stocks', label: 'Equities' },
                  { id: 'economy', label: 'Macro & Fed' },
                ] as const
              ).map((top) => (
                <button
                  key={top.id}
                  onClick={() => {
                    audioHaptics.tick();
                    setNewsTopic(top.id);
                    loadNews(top.id);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition ${
                    newsTopic === top.id ? 'clay-pill-active' : 'clay-pill text-slate-400 hover:text-white'
                  }`}
                >
                  {top.label}
                </button>
              ))}
            </div>

            {/* News Feed Grid */}
            <div className="flex-1 overflow-y-auto min-h-0 pt-3">
              {newsLoading && news.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
                  <span className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span>Fetching live financial wire stories...</span>
                </div>
              ) : news.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-slate-500">
                  <span>No stories available for this topic right now.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {news.map((story) => (
                    <div
                      key={story.uuid}
                      className="rounded-xl border border-grid/60 bg-bg p-3 flex flex-col justify-between hover:border-white/30 transition shadow-clay-card"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5">
                          <span className="font-bold text-slate-400">{story.publisher}</span>
                          <span>{formatTimeAgo(story.publishTime)}</span>
                        </div>
                        <a
                          href={story.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-white hover:underline line-clamp-2 text-xs leading-snug"
                        >
                          {story.title}
                        </a>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-grid/40 text-[10px]">
                        <div className="flex items-center gap-1 overflow-hidden">
                          {story.relatedTickers.slice(0, 3).map((t) => (
                            <button
                              key={t}
                              onClick={() => {
                                audioHaptics.tick();
                                setSymbol(t);
                                onClose();
                              }}
                              className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white hover:text-black font-bold text-slate-300 transition"
                              title={`Load ${t} on chart`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <a
                          href={story.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-white font-bold"
                        >
                          Open Story
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-grid/60 pt-2.5 mt-2 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>
            {activeTab === 'CALENDAR'
              ? `Displaying ${filteredEvents.length} macro events for the week`
              : `Displaying ${news.length} market wire stories`}
          </span>
          <div className="flex items-center gap-2">
            {lastUpdated && <span>Updated: {new Date(lastUpdated).toLocaleTimeString()}</span>}
            <span className="text-zinc-600">|</span>
            <span>Source: {activeTab === 'CALENDAR' ? 'FairEconomy Weekly Macro' : 'Yahoo Finance Wire'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
