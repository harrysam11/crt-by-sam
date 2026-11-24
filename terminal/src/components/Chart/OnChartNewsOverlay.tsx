/**
 * TradingView-Style On-Chart News & Macro Events Overlay.
 * Renders interactive macroeconomic flags & breaking news markers along the bottom time axis.
 * Hover shows quick summary pill; Click opens full institutional article modal with Quant AI analysis.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp } from 'lightweight-charts';
import { audioHaptics } from '../../utils/notify';
import { MACRO_ECONOMIC_CALENDAR, LIVE_BREAKING_NEWS, type MacroEconomicEvent, type LiveBreakingNewsItem } from '../../services/liveMacroNews';
import { fetchEconomicCalendar, fetchMarketNews, type RealEconomicEvent, type MarketNewsStory } from '../../services/calendarNewsService';

export interface UnifiedChartNewsItem {
  id: string;
  type: 'MACRO_EVENT' | 'NEWS_ARTICLE';
  title: string;
  source: string;
  timestamp: number; // unix seconds
  impact: 'HIGH' | 'MED' | 'LOW';
  category?: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  currency?: string;
  link?: string;
  summary?: string;
}

interface OnChartNewsOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
  symbol: string;
  visible?: boolean;
  onOpenQuantAI?: (initialPrompt: string) => void;
}

export default function OnChartNewsOverlay({
  chartApi,
  seriesApi,
  symbol,
  visible = true,
  onOpenQuantAI,
}: OnChartNewsOverlayProps) {
  const [newsItems, setNewsItems] = useState<UnifiedChartNewsItem[]>([]);
  const [activeItem, setActiveItem] = useState<UnifiedChartNewsItem | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{ item: UnifiedChartNewsItem; x: number; y: number } | null>(null);
  const [chartWidth, setChartWidth] = useState(800);
  const [chartHeight, setChartHeight] = useState(500);
  const [timeRange, setTimeRange] = useState<{ from: number; to: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load and consolidate real + institutional news events
  useEffect(() => {
    let isMounted = true;
    const loadNews = async () => {
      const consolidated: UnifiedChartNewsItem[] = [];

      // 1. Static high-impact macro calendar events
      const nowSec = Math.floor(Date.now() / 1000);
      MACRO_ECONOMIC_CALENDAR.forEach((ev, idx) => {
        // synthesize timestamps spread over recent days and future
        const dayOffset = (idx - 3) * 86400;
        const [hh, mm] = ev.timeUtc.split(':').map(Number);
        const eventSec = nowSec + dayOffset + (hh * 3600 + mm * 60);

        consolidated.push({
          id: `macro-${ev.id}`,
          type: 'MACRO_EVENT',
          title: ev.event,
          source: 'ForexFactory / Economic Calendar',
          timestamp: eventSec,
          impact: ev.impact,
          category: 'CENTRAL_BANK',
          currency: ev.currency,
          actual: ev.actual,
          forecast: ev.forecast,
          previous: ev.previous,
          summary: `Key macroeconomic release for ${ev.currency}. Actual: ${ev.actual ?? 'Pending'} | Forecast: ${ev.forecast ?? 'N/A'} | Previous: ${ev.previous ?? 'N/A'}. Significant institutional volatility expected.`,
        });
      });

      // 2. Breaking live news items
      LIVE_BREAKING_NEWS.forEach((item) => {
        consolidated.push({
          id: `news-${item.id}`,
          type: 'NEWS_ARTICLE',
          title: item.headline,
          source: item.source,
          timestamp: Math.floor(item.timestamp / 1000),
          impact: item.impact,
          category: item.category,
          link: item.link,
          summary: item.headline,
        });
      });

      // 3. Dynamic fetch of real economic calendar
      try {
        const realEvents = await fetchEconomicCalendar();
        realEvents.slice(0, 15).forEach((ev) => {
          consolidated.push({
            id: `real-${ev.id}`,
            type: 'MACRO_EVENT',
            title: ev.title,
            source: 'FairEconomy Wire',
            timestamp: Math.floor(ev.timestamp / 1000),
            impact: ev.impact === 'HOLIDAY' ? 'LOW' : ev.impact,
            currency: ev.country,
            forecast: ev.forecast,
            previous: ev.previous,
            summary: `Economic release for ${ev.country}: ${ev.title}. Forecast: ${ev.forecast} | Prior: ${ev.previous}.`,
          });
        });
      } catch {}

      // 4. Dynamic fetch of financial news
      try {
        const query = symbol.includes('BTC') ? 'bitcoin' : symbol.includes('ETH') ? 'ethereum' : 'stock market';
        const realNews = await fetchMarketNews(query);
        realNews.slice(0, 10).forEach((n) => {
          consolidated.push({
            id: `market-${n.uuid}`,
            type: 'NEWS_ARTICLE',
            title: n.title,
            source: n.publisher,
            timestamp: n.publishTime,
            impact: 'MED',
            category: 'MARKET_NEWS',
            link: n.link,
            summary: `${n.title} (Published by ${n.publisher}). Relevant for assets associated with ${n.relatedTickers?.join(', ') || symbol}.`,
          });
        });
      } catch {}

      if (isMounted) {
        setNewsItems(consolidated);
      }
    };

    loadNews();
    const interval = setInterval(loadNews, 120000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  // Subscribe to chart resize and visible range changes
  useEffect(() => {
    if (!chartApi) return;
    const timeScale = chartApi.timeScale();

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setChartWidth(rect.width);
        setChartHeight(rect.height);
      }
      try {
        const range = timeScale.getVisibleRange();
        if (range && typeof range.from === 'number' && typeof range.to === 'number') {
          setTimeRange({ from: range.from, to: range.to });
        }
      } catch {}
    };

    updateDimensions();
    timeScale.subscribeVisibleTimeRangeChange(updateDimensions);
    const resizeInterval = setInterval(updateDimensions, 1000);

    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(updateDimensions);
      clearInterval(resizeInterval);
    };
  }, [chartApi]);

  // Project events into visible X coordinates
  const visibleMarkers = useMemo(() => {
    if (!chartApi || !visible || newsItems.length === 0) return [];
    const timeScale = chartApi.timeScale();

    const markers: Array<{ item: UnifiedChartNewsItem; x: number }> = [];

    newsItems.forEach((item) => {
      try {
        const coord = timeScale.timeToCoordinate(item.timestamp as UTCTimestamp);
        if (coord !== null && typeof coord === 'number' && !isNaN(coord)) {
          if (coord >= 0 && coord <= chartWidth - 30) {
            markers.push({ item, x: coord });
          }
        }
      } catch {}
    });

    return markers;
  }, [chartApi, visible, newsItems, chartWidth, timeRange]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden font-mono select-none"
    >
      {/* Markers rendered along bottom time-scale axis */}
      {visibleMarkers.map(({ item, x }) => {
        const isMacro = item.type === 'MACRO_EVENT';
        const isHigh = item.impact === 'HIGH';
        const isMed = item.impact === 'MED';

        const badgeColor = isHigh
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500 hover:text-white'
          : isMed
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500 hover:text-white'
          : 'bg-sky-500/20 text-sky-300 border-sky-500/50 hover:bg-sky-500 hover:text-white';

        const labelText = isMacro
          ? item.currency || 'MACRO'
          : 'NEWS';

        const bottomPos = 34; // Pinned directly above the time axis

        return (
          <div
            key={item.id}
            style={{ left: `${x}px`, bottom: `${bottomPos}px` }}
            className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center group cursor-pointer transition-transform hover:scale-110"
            onClick={() => {
              audioHaptics.tick();
              setActiveItem(item);
            }}
            onMouseEnter={() => setHoveredItem({ item, x, y: chartHeight - bottomPos })}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {/* Vertical dotted guide line extending upwards into the chart */}
            <div className="w-[1px] h-12 bg-white/10 group-hover:bg-accent/60 transition-colors pointer-events-none" />

            {/* Event Flag Badge */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold border backdrop-blur-md shadow-md transition ${badgeColor}`}
            >
              {isHigh && <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />}
              {isMed && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
              {!isHigh && !isMed && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
              <span>{labelText}</span>
            </div>
          </div>
        );
      })}

      {/* Hover Tooltip Card */}
      {hoveredItem && !activeItem && (
        <div
          style={{
            left: `${Math.min(Math.max(hoveredItem.x, 150), chartWidth - 170)}px`,
            bottom: '76px',
          }}
          className="pointer-events-none absolute -translate-x-1/2 w-72 clay-popover p-2.5 z-40 text-xs shadow-2xl backdrop-blur-md border border-white/15 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 mb-1 border-b border-white/10">
            <span className="font-bold text-white uppercase">{hoveredItem.item.source}</span>
            <span
              className={`px-1 rounded text-[9px] font-bold ${
                hoveredItem.item.impact === 'HIGH'
                  ? 'bg-rose-500/20 text-rose-300'
                  : hoveredItem.item.impact === 'MED'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-sky-500/20 text-sky-300'
              }`}
            >
              {hoveredItem.item.impact} IMPACT
            </span>
          </div>
          <p className="text-[11px] font-semibold text-white leading-snug line-clamp-2">
            {hoveredItem.item.title}
          </p>
          {hoveredItem.item.actual && (
            <div className="mt-1.5 flex items-center justify-between text-[10px] bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
              <span>Act: <strong className="text-white">{hoveredItem.item.actual}</strong></span>
              <span>Fcst: <strong className="text-slate-300">{hoveredItem.item.forecast ?? '-'}</strong></span>
              <span>Prior: <strong className="text-slate-400">{hoveredItem.item.previous ?? '-'}</strong></span>
            </div>
          )}
          <div className="mt-1.5 text-[9px] text-slate-400 text-right">
            Click marker to read full article
          </div>
        </div>
      )}

      {/* Full Institutional Article & Event Modal */}
      {activeItem && (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg clay-popover p-5 shadow-2xl border border-white/15 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-grid/60">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    activeItem.impact === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : activeItem.impact === 'MED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}
                >
                  {activeItem.impact} IMPACT
                </span>
                <span className="text-xs text-slate-400 font-semibold">{activeItem.source}</span>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5 transition"
                title="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Article Content */}
            <div className="py-4 space-y-3">
              <h2 className="text-sm font-bold text-white leading-relaxed">
                {activeItem.title}
              </h2>

              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>Timestamp: {new Date(activeItem.timestamp * 1000).toLocaleString()}</span>
                {activeItem.currency && <span>Currency: <strong className="text-white">{activeItem.currency}</strong></span>}
                {activeItem.category && <span>Category: <strong className="text-white">{activeItem.category}</strong></span>}
              </div>

              {activeItem.type === 'MACRO_EVENT' && (
                <div className="grid grid-cols-3 gap-2 bg-black/40 p-3 rounded-lg border border-white/5 text-center">
                  <div>
                    <span className="text-[10px] uppercase text-muted block">Actual</span>
                    <span className="text-xs font-bold text-emerald-400 mt-0.5 block">{activeItem.actual ?? 'Pending'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted block">Forecast</span>
                    <span className="text-xs font-bold text-slate-300 mt-0.5 block">{activeItem.forecast ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted block">Previous</span>
                    <span className="text-xs font-bold text-slate-400 mt-0.5 block">{activeItem.previous ?? '-'}</span>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-grid/40">
                {activeItem.summary || activeItem.title}
              </p>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-grid/60">
              {activeItem.link ? (
                <a
                  href={activeItem.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1.5"
                >
                  <span>Open Full Wire</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const prompt = `Analyze the institutional market impact of the following economic release/news event on ${symbol}:\n\nTitle: ${activeItem.title}\nSource: ${activeItem.source}\nImpact: ${activeItem.impact}\nActual: ${activeItem.actual ?? 'N/A'}, Forecast: ${activeItem.forecast ?? 'N/A'}, Prior: ${activeItem.previous ?? 'N/A'}\nSummary: ${activeItem.summary}\n\nProvide: 1) Immediate orderflow bias, 2) Key liquidation / liquidity zones, 3) Confluence trade execution advice.`;
                    setActiveItem(null);
                    if (onOpenQuantAI) {
                      onOpenQuantAI(prompt);
                    } else if (window.__openQuantAI) {
                      window.__openQuantAI(prompt);
                    }
                  }}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-accent hover:brightness-110 text-black transition flex items-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Analyze with Quant AI</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
