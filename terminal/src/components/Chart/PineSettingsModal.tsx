/**
 * TradingView-Style Pine Script Indicator Settings & Code Dialog.
 * Features:
 * - Inputs Tab: Auto-parses input.int, input.float, input.bool, input.string, input.color, etc.
 *   Provides interactive number steppers, toggles, dropdowns, and color pickers.
 * - Code Tab: In-place code editor to inspect and edit Pine Script source directly.
 * - Style / Info Tab: Overview of plots, compiler status, runtime ms, and remove button.
 * - Deep link: "Open in Pine Editor / Script Studio" to edit in bottom docking panel.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ActivePineScript } from '../../store/useTerminalStore';
import { useTerminalStore } from '../../store/useTerminalStore';
import { audioHaptics } from '../../utils/notify';
import { executePineScript } from '../../services/pineRunner';

export interface PineInputParam {
  varName: string;
  type: 'int' | 'float' | 'bool' | 'string' | 'color' | 'timeframe' | 'session';
  title: string;
  group?: string;
  value: any;
  options?: string[];
  minval?: number;
  maxval?: number;
  step?: number;
  fullMatch: string;
}

interface PineSettingsModalProps {
  script: ActivePineScript | null;
  isOpen: boolean;
  onClose: () => void;
}

export function getFirstArgumentEnd(args: string): number {
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (inQuote) {
      if (ch === quoteChar && args[i - 1] !== '\\') inQuote = false;
    } else {
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
      } else if (ch === ')' || ch === ']' || ch === '}') {
        depth--;
      } else if (ch === ',' && depth === 0) {
        return i;
      }
    }
  }
  return args.length;
}

export function updateInputInDeclaration(fullDecl: string, type: string, nextVal: any): string {
  const m = fullDecl.match(/^(\s*[a-zA-Z0-9_]+\s*=\s*input(?:\.[a-zA-Z]+)?\s*\()([\s\S]*?)(\)\s*)$/);
  if (!m) return fullDecl;
  const prefix = m[1];
  const args = m[2];
  const suffix = m[3];

  let nextLiteral = '';
  if (type === 'bool') {
    nextLiteral = nextVal ? 'true' : 'false';
  } else if (type === 'int' || type === 'float') {
    nextLiteral = String(nextVal);
  } else if (type === 'color') {
    if (typeof nextVal === 'string' && nextVal.startsWith('#')) {
      const r = parseInt(nextVal.slice(1, 3), 16) || 0;
      const g = parseInt(nextVal.slice(3, 5), 16) || 0;
      const b = parseInt(nextVal.slice(5, 7), 16) || 0;
      nextLiteral = `color.rgb(${r}, ${g}, ${b})`;
    } else {
      nextLiteral = String(nextVal);
    }
  } else {
    nextLiteral = JSON.stringify(String(nextVal));
  }

  if (/defval\s*=/.test(args)) {
    const updatedArgs = args.replace(/(defval\s*=\s*)([^,\)]+)/, `$1${nextLiteral}`);
    return prefix + updatedArgs + suffix;
  }

  const endFirstArg = getFirstArgumentEnd(args);
  const leadingWsMatch = args.match(/^\s*/);
  const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
  const rest = args.slice(endFirstArg);
  return prefix + leadingWs + nextLiteral + rest + suffix;
}

export function parsePineScriptInputs(code: string): PineInputParam[] {
  const results: PineInputParam[] = [];
  const regex = /([a-zA-Z0-9_]+)\s*=\s*input(?:\.([a-zA-Z]+))?\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(code)) !== null) {
    const varName = match[1];
    const explicitType = match[2] as PineInputParam['type'] | undefined;
    const startIndex = match.index;
    const argsStartIndex = regex.lastIndex;

    let depth = 1;
    let inQuote = false;
    let quoteChar = '';
    let endIndex = -1;

    for (let i = argsStartIndex; i < code.length; i++) {
      const ch = code[i];
      if (inQuote) {
        if (ch === quoteChar && code[i - 1] !== '\\') inQuote = false;
      } else {
        if (ch === '"' || ch === "'") {
          inQuote = true;
          quoteChar = ch;
        } else if (ch === '(' || ch === '[' || ch === '{') {
          depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          depth--;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
    }

    if (endIndex !== -1) {
      const fullMatch = code.slice(startIndex, endIndex + 1);
      const argsStr = code.slice(argsStartIndex, endIndex);

      // Extract Title
      let title = varName;
      const titleMatch = argsStr.match(/(?:title\s*=\s*|,\s*)["']([^"']+)["']/);
      if (titleMatch) {
        title = titleMatch[1];
      }

      // Extract Group
      let group = 'General Settings';
      const grpMatch = argsStr.match(/group\s*=\s*(?:["']([^"']+)["']|([a-zA-Z0-9_]+))/);
      if (grpMatch) {
        group = grpMatch[1] || grpMatch[2];
        group = group.replace(/[━─_-]+/g, '').trim() || 'General Settings';
      }

      // Extract Options
      let options: string[] | undefined = undefined;
      const optMatch = argsStr.match(/options\s*=\s*\[(.*?)\]/s);
      if (optMatch) {
        options = optMatch[1]
          .split(',')
          .map((o) => o.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean);
      }

      // Min/Max/Step
      const minM = argsStr.match(/minval\s*=\s*(-?\d+(?:\.\d+)?)/);
      const maxM = argsStr.match(/maxval\s*=\s*(-?\d+(?:\.\d+)?)/);
      const stepM = argsStr.match(/step\s*=\s*(-?\d+(?:\.\d+)?)/);
      const minval = minM ? parseFloat(minM[1]) : undefined;
      const maxval = maxM ? parseFloat(maxM[1]) : undefined;
      const step = stepM ? parseFloat(stepM[1]) : undefined;

      // Extract Type and Defval
      let detectedType: PineInputParam['type'] = explicitType || 'string';
      let val: any = '';

      const firstArgRaw = argsStr.slice(0, getFirstArgumentEnd(argsStr)).trim();

      if (detectedType === 'bool' || firstArgRaw === 'true' || firstArgRaw === 'false') {
        detectedType = 'bool';
        val = firstArgRaw.includes('true');
      } else if (detectedType === 'color' || firstArgRaw.startsWith('color.')) {
        detectedType = 'color';
        const rgbM = firstArgRaw.match(/color\.rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbM) {
          const r = Number(rgbM[1]).toString(16).padStart(2, '0');
          const g = Number(rgbM[2]).toString(16).padStart(2, '0');
          const b = Number(rgbM[3]).toString(16).padStart(2, '0');
          val = `#${r}${g}${b}`;
        } else {
          val = '#38bdf8';
        }
      } else if (detectedType === 'int' || /^-?\d+$/.test(firstArgRaw)) {
        detectedType = 'int';
        const numM = firstArgRaw.match(/-?\d+/);
        val = numM ? parseInt(numM[0], 10) : 0;
      } else if (detectedType === 'float' || /^-?\d+\.\d+$/.test(firstArgRaw)) {
        detectedType = 'float';
        const floatM = firstArgRaw.match(/-?\d+\.\d+/);
        val = floatM ? parseFloat(floatM[0]) : 0;
      } else if (detectedType === 'session') {
        detectedType = 'session';
        const sM = firstArgRaw.match(/["']([^"']+)["']/);
        val = sM ? sM[1] : '0900-1000';
      } else {
        detectedType = 'string';
        const sM = firstArgRaw.match(/["']([^"']+)["']/);
        val = sM ? sM[1] : firstArgRaw;
      }

      results.push({
        varName,
        type: detectedType,
        title,
        group,
        value: val,
        options,
        minval,
        maxval,
        step,
        fullMatch,
      });
    }
  }

  return results;
}

export default function PineSettingsModal({ script, isOpen, onClose }: PineSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'inputs' | 'code' | 'about'>('inputs');
  const [editedCode, setEditedCode] = useState<string>(script?.code || '');
  const [compileStatus, setCompileStatus] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  // Sync edited code when script changes
  React.useEffect(() => {
    if (script) {
      setEditedCode(script.code);
      setCompileStatus(null);
    }
  }, [script]);

  const updatePineScript = useTerminalStore((s) => s.updatePineScript);
  const removePineScript = useTerminalStore((s) => s.removePineScript);
  const candles = useTerminalStore((s) => s.candles);
  const symbol = useTerminalStore((s) => s.symbol);
  const timeframe = useTerminalStore((s) => s.timeframe);

  const parsedInputs = useMemo(() => {
    if (!editedCode) return [];
    return parsePineScriptInputs(editedCode);
  }, [editedCode]);

  const groupedInputs = useMemo(() => {
    const map: Record<string, PineInputParam[]> = {};
    for (const p of parsedInputs) {
      const g = p.group || 'General Inputs';
      if (!map[g]) map[g] = [];
      map[g].push(p);
    }
    return map;
  }, [parsedInputs]);

  if (!isOpen || !script) return null;

  const handleUpdateParam = (param: PineInputParam, nextVal: any) => {
    audioHaptics.tick();
    const updatedDecl = updateInputInDeclaration(param.fullMatch, param.type, nextVal);
    if (updatedDecl === param.fullMatch) return;

    const newCode = editedCode.replace(param.fullMatch, updatedDecl);
    setEditedCode(newCode);
    updatePineScript(script.id, { code: newCode });
    setCompileStatus('Input updated & recalculating...');
  };

  const handleApplyCode = async () => {
    audioHaptics.tick();
    setIsCompiling(true);
    setCompileStatus('Compiling Pine Script...');

    try {
      const res = await executePineScript(editedCode, candles, symbol, timeframe);
      if (res.ok) {
        updatePineScript(script.id, { code: editedCode });
        setCompileStatus(`Compilation successful (${res.runtimeMs || 0}ms)`);
      } else {
        setCompileStatus(`Error: ${res.error || 'Compilation failed'}`);
        audioHaptics.error();
      }
    } catch (err: any) {
      setCompileStatus(`Error: ${err.message || 'Execution error'}`);
      audioHaptics.error();
    } finally {
      setIsCompiling(false);
    }
  };

  const handleOpenInPineEditor = () => {
    audioHaptics.tick();
    onClose();
    window.dispatchEvent(new CustomEvent('crt_open_pine_tab'));
  };

  const handleRemove = () => {
    audioHaptics.tick();
    removePineScript(script.id);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none font-mono">
      <div className="w-full max-w-lg flex flex-col rounded-xl border border-grid shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] bg-panel text-primary">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-grid px-4 py-3 bg-panel">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold text-sm text-primary truncate max-w-xs">{script.name}</span>
            <span className="text-[10px] text-cyan-400 font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
              Pine Script v5
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

        {/* Tab Strip */}
        <div className="flex items-center border-b border-grid bg-panel px-3 gap-2">
          <button
            onClick={() => {
              audioHaptics.tick();
              setActiveTab('inputs');
            }}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'inputs'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            Inputs ({parsedInputs.length})
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              setActiveTab('code');
            }}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'code'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            Source Code
          </button>
          <button
            onClick={() => {
              audioHaptics.tick();
              setActiveTab('about');
            }}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition ${
              activeTab === 'about'
                ? 'border-cyan-400 text-cyan-400 font-bold'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            Overview & Style
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh] bg-surface/50">
          {activeTab === 'inputs' && (
            <div className="flex flex-col gap-4">
              {parsedInputs.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted">
                  <p>No user configurable inputs declared in this script.</p>
                  <p className="text-[10px] text-muted/80 mt-1">
                    You can inspect or add inputs in the Source Code tab.
                  </p>
                </div>
              ) : (
                Object.entries(groupedInputs).map(([groupTitle, params]) => (
                  <div key={groupTitle} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 border-b border-grid/60 pb-1 pt-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted font-mono">
                        {groupTitle}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {params.map((param, pIdx) => (
                        <div
                          key={`${param.varName}-${pIdx}`}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-panel border border-grid hover:border-accent/40 transition"
                        >
                          <div className="flex flex-col pr-2">
                            <span className="text-xs font-semibold text-primary">{param.title}</span>
                            <span className="text-[10px] text-muted font-mono">{param.varName} ({param.type})</span>
                          </div>

                          {/* Input Controls by Type */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {param.type === 'bool' && (
                              <button
                                onClick={() => handleUpdateParam(param, !param.value)}
                                className={`w-10 h-5 rounded-full p-0.5 transition ${
                                  param.value ? 'bg-cyan-500' : 'bg-zinc-600/40'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition transform ${
                                    param.value ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            )}

                            {param.type === 'color' ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="color"
                                  value={typeof param.value === 'string' && param.value.startsWith('#') ? param.value : '#38bdf8'}
                                  onChange={(e) => handleUpdateParam(param, e.target.value)}
                                  className="w-7 h-7 rounded border border-grid cursor-pointer p-0.5 bg-transparent"
                                />
                                <input
                                  type="text"
                                  value={param.value}
                                  onChange={(e) => handleUpdateParam(param, e.target.value)}
                                  className="w-20 bg-surface border border-grid text-xs text-white rounded px-2 py-1 font-mono focus:border-cyan-400 focus:outline-none"
                                />
                              </div>
                            ) : param.options && param.options.length > 0 ? (
                              <select
                                value={param.value}
                                onChange={(e) => handleUpdateParam(param, e.target.value)}
                                className="bg-surface border border-grid text-xs text-white rounded px-2 py-1 font-mono focus:border-cyan-400 focus:outline-none"
                              >
                                {param.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (param.type === 'int' || param.type === 'float') ? (
                              <input
                                type="number"
                                step={param.type === 'float' ? '0.1' : '1'}
                                min={param.minval}
                                max={param.maxval}
                                value={param.value}
                                onChange={(e) => {
                                  const val = param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                                  if (!isNaN(val)) handleUpdateParam(param, val);
                                }}
                                className="w-20 bg-surface border border-grid text-xs text-center text-primary rounded px-2 py-1 font-mono focus:border-cyan-400 focus:outline-none"
                              />
                            ) : param.type === 'session' ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={param.value}
                                  placeholder="HHMM-HHMM"
                                  onChange={(e) => handleUpdateParam(param, e.target.value)}
                                  className="w-24 bg-surface border border-grid text-xs text-primary rounded px-2 py-1 font-mono focus:border-cyan-400 focus:outline-none"
                                  title="Format: HHMM-HHMM (e.g. 0300-0400, 1000-1100, 2100-2200)"
                                />
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) handleUpdateParam(param, e.target.value);
                                  }}
                                  className="bg-surface border border-grid text-[10px] text-secondary rounded px-1 py-1 font-mono focus:border-cyan-400 focus:outline-none max-w-[110px]"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Presets...</option>
                                  <option value="0300-0400">London (03-04)</option>
                                  <option value="0900-1000">NY Early (09-10)</option>
                                  <option value="1000-1100">NY AM (10-11)</option>
                                  <option value="1400-1500">NY PM (14-15)</option>
                                  <option value="2100-2200">Asia (21-22)</option>
                                </select>
                              </div>
                            ) : param.type === 'timeframe' ? (
                              <select
                                value={param.value}
                                onChange={(e) => handleUpdateParam(param, e.target.value)}
                                className="bg-surface border border-grid text-xs text-primary rounded px-2 py-1 font-mono focus:border-cyan-400 focus:outline-none"
                              >
                                {['1m', '3m', '5m', '15m', '30m', '1H', '2H', '4H', '1D', '1W'].map((tf) => (
                                  <option key={tf} value={tf}>
                                    {tf}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={param.value}
                                onChange={(e) => handleUpdateParam(param, e.target.value)}
                                className="w-28 bg-surface border border-grid text-xs text-primary rounded px-2 py-1 font-mono focus:border-cyan-400 focus:outline-none"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span>Pine Script v5 Source Code</span>
                <span className="text-[10px] text-muted">{editedCode.split('\n').length} lines</span>
              </div>
              <textarea
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                rows={14}
                className="w-full bg-surface border border-grid rounded-lg p-2.5 font-mono text-[11px] text-emerald-400 dark:text-emerald-300 leading-relaxed focus:outline-none focus:border-cyan-400 resize-y"
                spellCheck={false}
              />
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleOpenInPineEditor}
                  className="px-2.5 py-1 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg transition flex items-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span>Open in Pine Editor</span>
                </button>
                <button
                  onClick={handleApplyCode}
                  disabled={isCompiling}
                  className="px-3.5 py-1.5 text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black rounded-lg transition disabled:opacity-50"
                >
                  {isCompiling ? 'Compiling...' : 'Apply & Save to Chart'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="flex flex-col gap-3 text-xs">
              <div className="p-3 bg-panel rounded-lg border border-grid flex flex-col gap-1.5">
                <div className="font-bold text-white text-sm">{script.name}</div>
                <div className="text-[11px] text-muted">
                  {script.code.includes('overlay=true') ? 'In-Chart Price Overlay' : 'Oscillator Sub-Pane'}
                </div>
                <div className="text-[10.5px] text-muted mt-1">
                  Evaluated with local high-speed PineTS engine across live WebSocket market data.
                </div>
              </div>

              <div className="border-t border-grid pt-3 flex items-center justify-between">
                <span className="text-muted text-xs">Remove from chart</span>
                <button
                  onClick={handleRemove}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 transition font-bold"
                >
                  Remove Indicator
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer status */}
        {compileStatus && (
          <div className={`px-4 py-2 border-t border-grid text-xs font-mono ${
            compileStatus.startsWith('Error') ? 'bg-rose-950/40 text-rose-400' : 'bg-cyan-950/40 text-cyan-300'
          }`}>
            {compileStatus}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
