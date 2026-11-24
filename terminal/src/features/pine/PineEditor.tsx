/**
 * TradingView-Style Pine Script Studio & Code Editor.
 * Real-time Pine Script v4/v5 editing, compilation, and chart deployment.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { executePineScript, PRESET_PINE_SCRIPTS, type PinePlotOutput } from '../../services/pineRunner';
import { audioHaptics } from '../../utils/notify';

interface PineEditorProps {
  onApplyPlots?: (plots: PinePlotOutput[]) => void;
  onClearPlots?: () => void;
}

export default function PineEditor({ onApplyPlots, onClearPlots }: PineEditorProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const candles = useTerminalStore((s) => s.candles);

  const [code, setCode] = useState<string>(PRESET_PINE_SCRIPTS[0].code);
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_PINE_SCRIPTS[0].name);
  const [status, setStatus] = useState<'IDLE' | 'COMPILING' | 'ACTIVE' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ runtimeMs: number; plotCount: number; pointsCount: number } | null>(null);

  const handleSelectPreset = (name: string) => {
    const found = PRESET_PINE_SCRIPTS.find((p) => p.name === name);
    if (found) {
      setSelectedPreset(name);
      setCode(found.code);
      setStatus('IDLE');
      setErrorMessage(null);
    }
  };

  const handleRunScript = async () => {
    audioHaptics.tick();
    setStatus('COMPILING');
    setErrorMessage(null);

    const result = await executePineScript(code, candles, symbol, timeframe);

    const hasOutputs =
      result.ok &&
      (result.plots.length > 0 ||
        (result.drawings &&
          (result.drawings.boxes.length > 0 ||
            result.drawings.lines.length > 0 ||
            result.drawings.labels.length > 0 ||
            result.drawings.tables.length > 0)));

    if (hasOutputs) {
      setStatus('ACTIVE');
      setErrorMessage(null);
      const totalPoints = result.plots.reduce((acc, p) => acc + p.data.length, 0);
      const drawingsCount =
        (result.drawings?.boxes.length || 0) +
        (result.drawings?.lines.length || 0) +
        (result.drawings?.labels.length || 0) +
        (result.drawings?.tables.length || 0);
      setMetrics({
        runtimeMs: result.runtimeMs || 0,
        plotCount: result.plots.length + drawingsCount,
        pointsCount: totalPoints,
      });

      // Extract title from code if present: indicator("Title", ...), strategy("Title", ...), study("Title", ...)
      const matchTitle = code.match(/(?:indicator|strategy|study)\s*\(\s*["']([^"']+)["']/i);
      const scriptTitle = matchTitle?.[1]?.trim() || selectedPreset || 'Custom Pine Script';

      useTerminalStore.getState().addPineScript({
        name: scriptTitle,
        code,
      });

      if (onApplyPlots) {
        onApplyPlots(result.plots);
      }
    } else {
      setStatus('ERROR');
      setErrorMessage(result.error || 'Compilation error: No plots or drawings generated');
      audioHaptics.error();
    }
  };

  const handleClear = () => {
    audioHaptics.tick();
    setStatus('IDLE');
    setErrorMessage(null);
    setMetrics(null);
    if (onClearPlots) {
      onClearPlots();
    }
  };

  return (
    <div className="flex h-full flex-col bg-panel font-mono text-xs select-none">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-between border-b border-grid/50 px-3 py-1.5 bg-[#09090d]/60">
        <div className="flex items-center gap-2">
          <span className="clay-badge text-[10px] font-bold text-white tracking-wider">PINE v5</span>
          
          {/* Preset Selector */}
          <select
            value={selectedPreset}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="rounded-lg border border-grid/60 bg-bg px-2.5 py-1 text-xs text-white focus:outline-none"
          >
            {PRESET_PINE_SCRIPTS.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {status === 'ACTIVE' && (
            <button
              onClick={handleClear}
              className="clay-btn px-2.5 py-1 text-xs text-muted hover:text-white transition"
              title="Remove Pine indicator plots from chart"
            >
              Clear from Chart
            </button>
          )}

          <button
            onClick={handleRunScript}
            disabled={status === 'COMPILING'}
            className="clay-pill-active px-4 py-1 text-xs font-bold transition disabled:opacity-50"
            title="Compile and Add to Chart (Ctrl+Enter)"
          >
            {status === 'COMPILING' ? 'Compiling...' : status === 'ACTIVE' ? 'Update on Chart' : 'Add to Chart'}
          </button>
        </div>
      </div>

      {/* Editor & Console Split */}
      <div className="flex flex-1 min-h-0 flex-col">
        {/* Code Input Area */}
        <div className="relative flex-1 min-h-0 bg-[#060609]">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleRunScript();
              }
            }}
            placeholder="//@version=5\nindicator('My Script', overlay=true)\nplot(ta.sma(close, 14))"
            spellCheck={false}
            className="w-full h-full resize-none bg-transparent p-3 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Status / Console Footer */}
        <div className="border-t border-grid/50 bg-[#09090d]/80 px-3 py-1.5 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === 'ACTIVE'
                    ? 'bg-white'
                    : status === 'ERROR'
                    ? 'bg-zinc-500'
                    : status === 'COMPILING'
                    ? 'bg-zinc-400'
                    : 'bg-zinc-700'
                }`}
              />
              <span className="font-semibold text-white">
                {status === 'ACTIVE'
                  ? 'Compiled & Active on Chart'
                  : status === 'ERROR'
                  ? 'Compilation Error'
                  : status === 'COMPILING'
                  ? 'Transpiling Pine Script...'
                  : 'Ready'}
              </span>
            </div>

            {errorMessage && (
              <span className="text-zinc-400 truncate max-w-lg" title={errorMessage}>
                {errorMessage}
              </span>
            )}
          </div>

          {metrics && status === 'ACTIVE' && (
            <div className="flex items-center gap-3 text-muted">
              <span>{metrics.plotCount} plot series</span>
              <span>{metrics.pointsCount} points</span>
              <span>Runtime: {metrics.runtimeMs}ms</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
