import { useState, useMemo } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';

export interface EconomicEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM UTC
  currency: 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';
  title: string;
  impact: 'HIGH' | 'MED' | 'LOW';
  actual?: string;
  forecast: string;
  previous: string;
  relatedSymbol?: string;
  note?: string;
}

const SAMPLE_EVENTS: EconomicEvent[] = [
  {
    id: 'ev-1',
    date: '2026-11-04',
    time: '14:30',
    currency: 'USD',
    title: 'US Non-Farm Payrolls (NFP)',
    impact: 'HIGH',
    actual: '215K',
    forecast: '185K',
    previous: '160K',
    relatedSymbol: 'SPY',
    note: 'Primary labor market barometer. High volatility expected on EURUSD, SPY, and BTC.',
  },
  {
    id: 'ev-2',
    date: '2026-11-04',
    time: '18:00',
    currency: 'USD',
    title: 'FOMC Interest Rate Decision',
    impact: 'HIGH',
    actual: '4.75%',
    forecast: '4.75%',
    previous: '5.00%',
    relatedSymbol: 'BTC-USD',
    note: 'Benchmark Fed Funds rate. Watch Jerome Powell press conference 30m post-announcement.',
  },
  {
    id: 'ev-3',
    date: '2026-11-05',
    time: '04:30',
    currency: 'INR',
    title: 'RBI MPC Policy Repo Rate',
    impact: 'HIGH',
    forecast: '6.50%',
    previous: '6.50%',
    relatedSymbol: 'NIFTY',
    note: 'Reserve Bank of India Monetary Policy Committee decision. Crucial for Bank Nifty and FinNifty.',
  },
  {
    id: 'ev-4',
    date: '2026-11-05',
    time: '13:00',
    currency: 'GBP',
    title: 'Bank of England Official Bank Rate',
    impact: 'HIGH',
    forecast: '4.75%',
    previous: '5.00%',
    relatedSymbol: 'GBPUSD',
    note: 'BoE vote split and monetary policy report summary.',
  },
  {
    id: 'ev-5',
    date: '2026-11-06',
    time: '14:30',
    currency: 'USD',
    title: 'US Core CPI (MoM)',
    impact: 'HIGH',
    forecast: '0.3%',
    previous: '0.3%',
    relatedSymbol: 'SPY',
    note: 'Excludes volatile food and energy. Critical measure for sticky inflation trajectories.',
  },
  {
    id: 'ev-6',
    date: '2026-11-07',
    time: '09:00',
    currency: 'EUR',
    title: 'Eurozone S&P Global Composite PMI',
    impact: 'MED',
    forecast: '49.8',
    previous: '49.6',
    relatedSymbol: 'EURUSD',
    note: 'Diffusion index for Eurozone manufacturing and services activity.',
  },
  {
    id: 'ev-7',
    date: '2026-11-10',
    time: '12:00',
    currency: 'INR',
    title: 'India CPI Inflation (YoY)',
    impact: 'HIGH',
    forecast: '5.2%',
    previous: '5.49%',
    relatedSymbol: 'NIFTY',
    note: 'Headline consumer price index for domestic market direction.',
  },
  {
    id: 'ev-8',
    date: '2026-11-11',
    time: '15:30',
    currency: 'USD',
    title: 'EIA Crude Oil Inventories',
    impact: 'MED',
    forecast: '-1.2M',
    previous: '+2.1M',
    relatedSymbol: 'SPY',
    note: 'Measures weekly change in barrels of commercial crude oil.',
  },
  {
    id: 'ev-9',
    date: '2026-11-12',
    time: '13:30',
    currency: 'USD',
    title: 'Initial Jobless Claims',
    impact: 'MED',
    forecast: '218K',
    previous: '216K',
    relatedSymbol: 'SPY',
    note: 'Weekly reading of unemployment benefit claimants in the United States.',
  },
  {
    id: 'ev-10',
    date: '2026-11-14',
    time: '00:50',
    currency: 'JPY',
    title: 'Japan Preliminary GDP (QoQ)',
    impact: 'HIGH',
    forecast: '0.4%',
    previous: '0.7%',
    relatedSymbol: 'USDJPY',
    note: 'Total value of all goods and services produced in Japan. Directly impacts BoJ rate expectations.',
  },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function EconomicCalendarModal({ onClose }: { onClose: () => void }) {
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 10, 1)); // November 2026
  const [selectedDate, setSelectedDate] = useState('2026-11-04');
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MED' | 'LOW'>('ALL');
  const setSymbol = useTerminalStore((s) => s.setSymbol);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ dayNumber: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
    }

    // Next month padding to fill 35 or 42 cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const filteredEvents = useMemo(() => {
    return SAMPLE_EVENTS.filter((ev) => impactFilter === 'ALL' || ev.impact === impactFilter);
  }, [impactFilter]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>();
    for (const ev of filteredEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [filteredEvents]);

  const selectedDateEvents = useMemo(() => {
    return SAMPLE_EVENTS.filter((ev) => ev.date === selectedDate);
  }, [selectedDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getImpactColor = (impact: EconomicEvent['impact']) => {
    switch (impact) {
      case 'HIGH':
        return 'bg-red-500 border-red-400 text-red-200';
      case 'MED':
        return 'bg-amber-500 border-amber-400 text-amber-200';
      case 'LOW':
        return 'bg-slate-500 border-slate-400 text-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] rounded-lg border border-grid bg-panel shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">
              Global Economic Calendar & Macro Matrix
            </h2>
            <span className="text-xs text-muted">Tier-1 Volatility Radar</span>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-grid px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-white transition"
          >
            [ESC / Close]
          </button>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-grid px-5 py-2.5 bg-slate-950/40">
          {/* Month Stepper */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrevMonth}
              className="rounded border border-grid px-2 py-1 text-xs text-muted hover:border-accent hover:text-white"
            >
              &lt; Prev
            </button>
            <span className="text-xs font-semibold text-white tracking-wide min-w-[130px] text-center">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="rounded border border-grid px-2 py-1 text-xs text-muted hover:border-accent hover:text-white"
            >
              Next &gt;
            </button>
          </div>

          {/* Impact Filter Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted mr-1.5">Impact:</span>
            {(['ALL', 'HIGH', 'MED', 'LOW'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setImpactFilter(lvl)}
                className={`rounded px-2.5 py-1 text-xs transition ${
                  impactFilter === lvl
                    ? 'bg-accent/20 border border-accent text-accent font-semibold'
                    : 'border border-grid text-muted hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              <span>High (Tier 1)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-500 inline-block" />
              <span>Low</span>
            </div>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* Left Column: 7-Column Monthly Calendar Grid (7 cols out of 12) */}
          <div className="md:col-span-7 border-r border-grid flex flex-col p-4 overflow-y-auto">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-medium text-muted">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* 7-column Calendar Cells */}
            <div className="grid grid-cols-7 gap-1 flex-1">
              {calendarDays.map((cell, idx) => {
                const dayEvents = eventsByDate.get(cell.dateStr) ?? [];
                const isSelected = selectedDate === cell.dateStr;
                const hasHigh = dayEvents.some((e) => e.impact === 'HIGH');
                const hasMed = dayEvents.some((e) => e.impact === 'MED');

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    className={`min-h-[58px] p-1.5 rounded flex flex-col justify-between text-left transition border ${
                      isSelected
                        ? 'border-accent bg-accent/15 ring-1 ring-accent'
                        : cell.isCurrentMonth
                        ? 'border-grid/60 bg-panel hover:border-slate-600 hover:bg-slate-800/40'
                        : 'border-transparent bg-slate-950/20 text-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs ${
                          isSelected
                            ? 'font-bold text-accent'
                            : cell.isCurrentMonth
                            ? 'text-slate-300'
                            : 'text-slate-600'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] px-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Impact Dots / Rings */}
                    <div className="flex items-center gap-1 mt-1">
                      {hasHigh && (
                        <span className="h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-950" title="High Impact" />
                      )}
                      {hasMed && (
                        <span className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-950" title="Medium Impact" />
                      )}
                      {dayEvents.some((e) => e.impact === 'LOW') && !hasHigh && !hasMed && (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" title="Low Impact" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Selected Date Event Preview & Macro Feed (5 cols out of 12) */}
          <div className="md:col-span-5 flex flex-col p-4 bg-slate-950/30 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-grid pb-2 mb-3">
              <div>
                <span className="text-xs text-muted block uppercase">Selected Session</span>
                <span className="text-sm font-bold text-white">{selectedDate}</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded border border-grid text-muted">
                {selectedDateEvents.length} Event{selectedDateEvents.length === 1 ? '' : 's'}
              </span>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted border border-dashed border-grid rounded">
                <span className="text-xs mb-1">No scheduled macro releases for this date.</span>
                <span className="text-[11px] text-slate-500">Select highlighted dates on the calendar matrix to view high-impact triggers.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded border border-grid bg-panel hover:border-slate-600 transition"
                  >
                    {/* Event Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-cyan-300">
                          [{ev.currency}]
                        </span>
                        <span className="text-xs text-muted">{ev.time} UTC</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getImpactColor(
                          ev.impact
                        )}`}
                      >
                        {ev.impact}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-semibold text-white mb-2 leading-tight">
                      {ev.title}
                    </h3>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded bg-slate-900/80 border border-grid/60 mb-2 text-xs">
                      <div>
                        <span className="text-[10px] text-muted block">Actual</span>
                        <span
                          className={`font-semibold ${
                            ev.actual ? 'text-up' : 'text-slate-500'
                          }`}
                        >
                          {ev.actual ?? '--'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Forecast</span>
                        <span className="font-semibold text-slate-300">{ev.forecast}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Previous</span>
                        <span className="font-semibold text-muted">{ev.previous}</span>
                      </div>
                    </div>

                    {/* Context / Notes */}
                    {ev.note && (
                      <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                        {ev.note}
                      </p>
                    )}

                    {/* Action buttons */}
                    {ev.relatedSymbol && (
                      <button
                        onClick={() => {
                          setSymbol(ev.relatedSymbol!);
                          onClose();
                        }}
                        className="w-full text-center text-xs py-1 rounded border border-accent/40 bg-accent/10 text-accent hover:bg-accent hover:text-black font-semibold transition"
                      >
                        Jump to {ev.relatedSymbol} Chart
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-grid px-5 py-2.5 bg-slate-900/60 text-xs text-muted">
          <span>Data Feed: MQL5 / Economic Synthetic Feed Active</span>
          <span>Timezone: UTC | Low Latency Matrix</span>
        </div>
      </div>
    </div>
  );
}
