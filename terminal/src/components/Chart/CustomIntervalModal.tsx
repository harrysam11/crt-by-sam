/**
 * Custom Time Interval Configuration Modal.
 * Allows adding arbitrary timeframes (e.g. 2m, 10m, 45m, 2h, 3h, 8h, 2d, 3d, 1w).
 * Built with standard institutional card hierarchy, neutral surfaces, 1px borders,
 * soft shadows, and single accent color.
 *
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useEffect } from 'react';
import { audioHaptics } from '../../utils/notify';
import {
  IntervalUnit,
  UNIT_LABELS,
  UNIT_SECONDS,
  formatCountdownTimer,
  loadStoredCustomTimeframes,
  parseTimeframeToSeconds,
  removeStoredCustomTimeframe,
  saveStoredCustomTimeframe,
  validateCustomInterval,
} from '../../utils/timeframe';
import { StandardCard, StandardCardGrid } from '../common/StandardCard';
import type { Timeframe } from '../../types/terminal';

interface CustomIntervalModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
}

export default function CustomIntervalModal({
  isOpen,
  onClose,
  activeTimeframe,
  onSelectTimeframe,
}: CustomIntervalModalProps) {
  const [val, setVal] = useState<number>(10);
  const [unit, setUnit] = useState<IntervalUnit>('m');
  const [error, setError] = useState<string | null>(null);
  const [customList, setCustomList] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCustomList(loadStoredCustomTimeframes());
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentTfString = `${val}${unit}`;
  const totalSec = val * UNIT_SECONDS[unit];

  const handleAdd = () => {
    const res = validateCustomInterval(val, unit);
    if (!res.ok) {
      setError(res.error || 'Invalid interval');
      return;
    }
    setError(null);
    audioHaptics.tick();
    const updated = saveStoredCustomTimeframe(currentTfString);
    setCustomList(updated);
    onSelectTimeframe(currentTfString as Timeframe);
    onClose();
  };

  const handleRemove = (tf: string) => {
    audioHaptics.tick();
    const updated = removeStoredCustomTimeframe(tf);
    setCustomList(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="custom-interval-overlay fixed inset-0 z-50 flex items-center justify-center max-sm:items-end bg-black/75 p-4 max-sm:p-0 backdrop-blur-[2px]"
      onKeyDown={handleKeyDown}
    >
      <div className="custom-interval-dialog relative w-full max-w-xl rounded-2xl bg-[#0e0e14] border border-[#272736] p-6 shadow-2xl shadow-black font-mono">
        {/* Header with Primary Icon */}
        <div className="custom-interval-header flex items-start justify-between border-b border-[#20202e] pb-4 mb-5">
          <div className="custom-interval-fields flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171722] border border-[#2c2c3e] text-[#38bdf8]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Custom Time Interval
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Define non-standard minute, hour, or daily chart bars
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1a26] transition-colors"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Input Formulation Card */}
        <div className="rounded-xl bg-[#12121a] p-4 border border-[#242432] mb-5">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Interval Duration
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="1440"
              value={val}
              onChange={(e) => {
                const num = parseInt(e.target.value, 10);
                setVal(isNaN(num) ? 1 : Math.max(1, num));
                setError(null);
              }}
              className="w-28 rounded-lg bg-[#181824] px-3 py-2 text-sm text-white font-mono border border-[#2d2d3e] focus:border-[#38bdf8] focus:outline-none"
              autoFocus
            />

            <select
              value={unit}
              onChange={(e) => {
                setUnit(e.target.value as IntervalUnit);
                setError(null);
              }}
              className="flex-1 rounded-lg bg-[#181824] px-3 py-2 text-sm text-white font-mono border border-[#2d2d3e] focus:border-[#38bdf8] focus:outline-none"
            >
              <option value="m">Minutes</option>
              <option value="h">Hours</option>
              <option value="d">Days</option>
              <option value="w">Weeks</option>
            </select>

            <div className="flex items-center px-3 py-2 rounded-lg bg-[#1b2230] border border-[#23354d] text-xs font-semibold text-[#38bdf8]">
              {currentTfString}
            </div>
          </div>

          {error && (
            <p className="mt-2 text-xs text-rose-400 font-mono">
              {error}
            </p>
          )}

          <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Aggregated candle duration: {totalSec.toLocaleString()} seconds</span>
            <span>Formatted: {val} {UNIT_LABELS[unit].toLowerCase()}</span>
          </div>
        </div>

        {/* Saved Custom Intervals Grid */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Saved Custom Intervals ({customList.length})
          </div>

          <div className="max-h-52 overflow-y-auto pr-1">
            <StandardCardGrid className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {customList.map((tf) => {
                const sec = parseTimeframeToSeconds(tf);
                const isActive = tf === activeTimeframe;
                return (
                  <StandardCard
                    key={tf}
                    title={tf}
                    meta={`${sec >= 3600 ? `${(sec / 3600).toFixed(1)}h` : `${Math.floor(sec / 60)}m`} per candle`}
                    badge={isActive ? 'Active' : undefined}
                    badgeColor={isActive ? 'accent' : 'default'}
                    icon={
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 15 15" />
                      </svg>
                    }
                    primaryAction={{
                      label: isActive ? 'Current' : 'Select',
                      active: isActive,
                      onClick: () => {
                        audioHaptics.tick();
                        onSelectTimeframe(tf as Timeframe);
                        onClose();
                      },
                    }}
                    secondaryAction={{
                      label: 'Remove',
                      onClick: () => handleRemove(tf),
                      icon: (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                    }}
                  />
                );
              })}
            </StandardCardGrid>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="custom-interval-actions flex items-center justify-end gap-3 pt-4 border-t border-[#20202e]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="px-5 py-2 rounded-lg bg-[#38bdf8] text-black font-mono text-xs font-bold hover:bg-[#7dd3fc] transition-colors shadow-sm"
          >
            Add Interval
          </button>
        </div>
      </div>
    </div>
  );
}
