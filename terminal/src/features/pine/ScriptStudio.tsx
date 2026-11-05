/**
 * TradingView-Style Script Studio & Code Editor.
 * Dual-engine architecture:
 * 1. JavaScript / TypeScript sandboxed custom indicator runner with ta math library.
 * 2. Pine Script v5 transpiler and execution engine (PineTS).
 * Directly outputs typed series to TradingChart canvas.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { executeJsScript, PRESET_JS_SCRIPTS } from '../../services/jsScriptRunner';
import { executePineScript, PRESET_PINE_SCRIPTS, type PinePlotOutput } from '../../services/pineRunner';
import { audioHaptics } from '../../utils/notify';

interface ScriptStudioProps {
  onApplyPlots?: (plots: PinePlotOutput[]) => void;
  onClearPlots?: () => void;
}

type ScriptLanguage = 'JAVASCRIPT' | 'PINE_V5';

export default function ScriptStudio({ onApplyPlots, onClearPlots }: ScriptStudioProps) {
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const candles = useTerminalStore((s) => s.candles);

  const [language, setLanguage] = useState<ScriptLanguage>('JAVASCRIPT');
  const [jsCode, setJsCode] = useState<string>(PRESET_JS_SCRIPTS[0].code);
  const [selectedJsPreset, setSelectedJsPreset] = useState<string>(PRESET_JS_SCRIPTS[0].name);

  const [pineCode, setPineCode] = useState<string>(PRESET_PINE_SCRIPTS[0].code);
  const [selectedPinePreset, setSelectedPinePreset] = useState<string>(PRESET_PINE_SCRIPTS[0].name);

  const [status, setStatus] = useState<'IDLE' | 'COMPILING' | 'ACTIVE' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ runtimeMs: number; plotCount: number; pointsCount: number } | null>(null);

  const activeCode = language === 'JAVASCRIPT' ? jsCode : pineCode;
  const setActiveCode = (val: string) => {
    if (language === 'JAVASCRIPT') setJsCode(val);
    else setPineCode(val);
  };

  const handleSelectPreset = (name: string) => {
    if (language === 'JAVASCRIPT') {
      const found = PRESET_JS_SCRIPTS.find((p) => p.name === name);
      if (found) {
        setSelectedJsPreset(name);
        setJsCode(found.code);
        setStatus('IDLE');
        setErrorMessage(null);
      }
    } else {
      const found = PRESET_PINE_SCRIPTS.find((p) => p.name === name);
      if (found) {
        setSelectedPinePreset(name);
        setPineCode(found.code);
        setStatus('IDLE');
        setErrorMessage(null);
      }
    }
  };

  const handleRunScript = async () => {
    audioHaptics.tick();
    setStatus('COMPILING');
    setErrorMessage(null);

    if (language === 'JAVASCRIPT') {
      const result = await executeJsScript(jsCode, candles, symbol, timeframe);
      if (result.ok && result.plots.length > 0) {
        setStatus('ACTIVE');
        setErrorMessage(null);
        const totalPoints = result.plots.reduce((acc, p) => acc + p.data.length, 0);
        setMetrics({
          runtimeMs: result.runtimeMs || 0,
          plotCount: result.plots.length,
          pointsCount: totalPoints,
        });
        if (onApplyPlots) {
          onApplyPlots(result.plots);
        }
      } else {
        setStatus('ERROR');
        setErrorMessage(result.error || 'Execution failed: No valid plots returned.');
        audioHaptics.error();
      }
    } else {
      const result = await executePineScript(pineCode, candles, symbol, timeframe);
      if (result.ok && result.plots.length > 0) {
        setStatus('ACTIVE');
        setErrorMessage(null);
        const totalPoints = result.plots.reduce((acc, p) => acc + p.data.length, 0);
        setMetrics({
          runtimeMs: result.runtimeMs || 0,
          plotCount: result.plots.length,
          pointsCount: totalPoints,
        });
        if (onApplyPlots) {
          onApplyPlots(result.plots);
        }
      } else {
        setStatus('ERROR');
        setErrorMessage(result.error || 'Pine compilation error: No plots generated.');
        audioHaptics.error();
      }
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

  const lineCount = activeCode.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1);

  return (
    <div className="flex h-full flex-col bg-panel font-mono text-xs select-none">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-grid/50 px-3 py-2 bg-[#09090d]/60 gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Language Switcher Tabs */}
          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5">
            <button
              onClick={() => {
                audioHaptics.tick();
                setLanguage('JAVASCRIPT');
                setStatus('IDLE');
                setErrorMessage(null);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                language === 'JAVASCRIPT'
                  ? 'clay-pill-active text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              JS / TS Sandbox
            </button>
            <button
              onClick={() => {
                audioHaptics.tick();
                setLanguage('PINE_V5');
                setStatus('IDLE');
                setErrorMessage(null);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition ${
                language === 'PINE_V5'
                  ? 'clay-pill-active text-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Pine Script v5
            </button>
          </div>

          {/* Preset Selector */}
          <select
            value={language === 'JAVASCRIPT' ? selectedJsPreset : selectedPinePreset}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="rounded-lg border border-grid/60 bg-bg px-2.5 py-1 text-xs text-white focus:outline-none"
          >
            {(language === 'JAVASCRIPT' ? PRESET_JS_SCRIPTS : PRESET_PINE_SCRIPTS).map((p) => (
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
              className="clay-btn px-2.5 py-1 text-xs text-slate-400 hover:text-white transition"
              title="Remove script plots from chart"
            >
              Clear Plots
            </button>
          )}

          <button
            onClick={handleRunScript}
            disabled={status === 'COMPILING'}
            className="clay-pill-active px-3 py-1 text-xs font-bold transition flex items-center gap-1.5"
            title="Compile and deploy script plots onto chart"
          >
            {status === 'COMPILING' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Add to Chart</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor Main Canvas with Line Numbers */}
      <div className="relative flex flex-1 min-h-0 bg-[#060609]">
        {/* Line Numbers Column */}
        <div className="w-10 select-none border-r border-grid/40 bg-[#040406] py-3 text-right font-mono text-[11px] text-zinc-600 pr-2 leading-relaxed">
          {lineNumbers.map((num) => (
            <div key={num}>{num}</div>
          ))}
        </div>

        {/* Code Input Textarea */}
        <textarea
          value={activeCode}
          onChange={(e) => setActiveCode(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent p-3 font-mono text-xs text-zinc-200 focus:outline-none leading-relaxed selection:bg-white/20 whitespace-pre overflow-auto"
          placeholder={language === 'JAVASCRIPT' ? '// Write your custom JavaScript indicator algorithm here...' : '//@version=5\n// Write your Pine Script here...'}
        />
      </div>

      {/* Error or Metrics Console Bar */}
      {errorMessage && (
        <div className="border-t border-rose-500/40 bg-rose-950/40 px-3 py-2 text-rose-300 font-mono text-xs shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-rose-400">[Script Error]:</span>
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Bottom Status Footer */}
      <div className="flex items-center justify-between border-t border-grid/50 bg-[#07070a] px-3 py-1.5 text-[11px] text-slate-400 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'ACTIVE'
                  ? 'bg-white'
                  : status === 'ERROR'
                  ? 'bg-rose-500'
                  : status === 'COMPILING'
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-zinc-600'
              }`}
            />
            <span className="font-semibold text-slate-300">
              {status === 'ACTIVE' ? 'Deployed to Chart' : status === 'COMPILING' ? 'Executing' : status === 'ERROR' ? 'Compilation Failed' : 'Ready'}
            </span>
          </span>

          <span className="text-zinc-600">|</span>
          <span>Engine: {language === 'JAVASCRIPT' ? 'V8 Sandboxed Function' : 'PineTS Compiler v5'}</span>
          <span className="text-zinc-600">|</span>
          <span>Scope: {symbol} · {timeframe} ({candles.length} bars)</span>
        </div>

        {metrics && (
          <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-400">
            <span>Runtime: <strong className="text-white">{metrics.runtimeMs}ms</strong></span>
            <span>Plots: <strong className="text-white">{metrics.plotCount}</strong></span>
            <span>Points: <strong className="text-white">{metrics.pointsCount.toLocaleString()}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
