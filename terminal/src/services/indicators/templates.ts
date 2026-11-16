/**
 * Pro Indicator Templates & Institutional Setups Engine.
 * Provides pre-configured 1-click indicator stacks for trend following,
 * volatility breakout, institutional orderflow, and momentum scalping,
 * plus user-saved custom template management.
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { ActiveIndicatorInstance, InputValueType, IndicatorPlotStyle } from './types';
import { INDICATOR_REGISTRY } from './registry';

export interface TemplateIndicatorItem {
  indicatorId: string;
  name?: string;
  inputs?: Record<string, InputValueType>;
  styles?: Record<string, Partial<IndicatorPlotStyle>>;
}

export interface IndicatorTemplate {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  category: 'TREND' | 'VOLATILITY' | 'ORDERFLOW' | 'MOMENTUM' | 'CUSTOM';
  indicators: TemplateIndicatorItem[];
}

export const BUILT_IN_INDICATOR_TEMPLATES: IndicatorTemplate[] = [
  {
    id: 'tmpl-trend-ribbon',
    name: 'Triple EMA Ribbon + RSI',
    description: 'Classic institutional trend alignment (20/50/200 EMA) with momentum exhaustion filter.',
    isBuiltIn: true,
    category: 'TREND',
    indicators: [
      {
        indicatorId: 'ema',
        name: 'EMA 20',
        inputs: { period: 20 },
        styles: { plot: { color: '#38bdf8', lineWidth: 2 } },
      },
      {
        indicatorId: 'ema',
        name: 'EMA 50',
        inputs: { period: 50 },
        styles: { plot: { color: '#f59e0b', lineWidth: 2 } },
      },
      {
        indicatorId: 'ema',
        name: 'EMA 200',
        inputs: { period: 200 },
        styles: { plot: { color: '#ef4444', lineWidth: 2.5 } },
      },
      {
        indicatorId: 'rsi',
        name: 'RSI 14',
        inputs: { period: 14, overbought: 70, oversold: 30 },
      },
    ],
  },
  {
    id: 'tmpl-institutional-orderflow',
    name: 'Institutional Order Flow & Delta',
    description: 'Volume profile, cumulative volume delta (CVD), open interest and session VWAP.',
    isBuiltIn: true,
    category: 'ORDERFLOW',
    indicators: [
      {
        indicatorId: 'vwap',
        name: 'Session VWAP',
        styles: { plot: { color: '#a855f7', lineWidth: 2 } },
      },
      {
        indicatorId: 'vpvr',
        name: 'VPVR Profile',
      },
      {
        indicatorId: 'cvd',
        name: 'Cumulative Delta',
      },
      {
        indicatorId: 'oi',
        name: 'Open Interest',
      },
    ],
  },
  {
    id: 'tmpl-volatility-squeeze',
    name: 'Bollinger & Keltner Squeeze',
    description: 'John Carter style volatility expansion setup combining Bollinger Bands with Keltner Channels & MACD.',
    isBuiltIn: true,
    category: 'VOLATILITY',
    indicators: [
      {
        indicatorId: 'bbands',
        name: 'Bollinger Bands (20, 2)',
        inputs: { period: 20, stdDev: 2 },
        styles: {
          upper: { color: '#06b6d4', lineWidth: 1.5 },
          middle: { color: '#089981', lineWidth: 1, lineStyle: 'dashed' },
          lower: { color: '#06b6d4', lineWidth: 1.5 },
        },
      },
      {
        indicatorId: 'keltner',
        name: 'Keltner Channels (20, 1.5)',
        inputs: { period: 20, multiplier: 1.5 },
      },
      {
        indicatorId: 'macd',
        name: 'MACD (12, 26, 9)',
        inputs: { fast: 12, slow: 26, signal: 9 },
      },
    ],
  },
  {
    id: 'tmpl-supertrend-scalper',
    name: 'SuperTrend Momentum Scalper',
    description: 'Fast intraday breakout system featuring SuperTrend ATR filter, fast EMA, and Stochastic RSI.',
    isBuiltIn: true,
    category: 'MOMENTUM',
    indicators: [
      {
        indicatorId: 'supertrend',
        name: 'SuperTrend (10, 3)',
        inputs: { period: 10, multiplier: 3 },
      },
      {
        indicatorId: 'ema',
        name: 'Fast EMA 9',
        inputs: { period: 9 },
        styles: { plot: { color: '#10b981', lineWidth: 1.5 } },
      },
      {
        indicatorId: 'stochrsi',
        name: 'Stoch RSI (14, 14, 3, 3)',
      },
      {
        indicatorId: 'volume',
        name: 'Volume + MA 20',
      },
    ],
  },
  {
    id: 'tmpl-gamma-structure',
    name: 'Gamma Levels & Classical Pivots',
    description: 'Options dealer gamma wall exposure matrix combined with daily classical pivot support & resistance.',
    isBuiltIn: true,
    category: 'ORDERFLOW',
    indicators: [
      {
        indicatorId: 'pivots',
        name: 'Daily Pivot Points',
        inputs: { type: 'Standard' },
      },
      {
        indicatorId: 'gex',
        name: 'Gamma Exposure (GEX)',
      },
      {
        indicatorId: 'atr',
        name: 'ATR Volatility Range',
        inputs: { period: 14 },
      },
    ],
  },
];

/**
 * Builds an array of ActiveIndicatorInstance from a template item array,
 * automatically calculating pane indices for sub-panes.
 */
export function buildInstancesFromTemplate(
  items: TemplateIndicatorItem[],
  startingPaneIndex = 1
): ActiveIndicatorInstance[] {
  let curSubPane = startingPaneIndex;
  const result: ActiveIndicatorInstance[] = [];

  items.forEach((item, idx) => {
    const def = INDICATOR_REGISTRY.find((i) => i.id === item.indicatorId);
    if (!def) return;

    // Default inputs merged with template inputs
    const inputs: Record<string, InputValueType> = {};
    def.inputs.forEach((inp) => {
      inputs[inp.id] = inp.default;
    });
    if (item.inputs) {
      Object.assign(inputs, item.inputs);
    }

    // Default styles merged with template style overrides
    const styles: Record<string, IndicatorPlotStyle> = JSON.parse(JSON.stringify(def.defaultStyles));
    if (item.styles) {
      Object.keys(item.styles).forEach((key) => {
        if (styles[key]) {
          Object.assign(styles[key], item.styles![key]);
        }
      });
    }

    const isOverlay = def.overlay;
    const paneIndex = isOverlay ? 0 : curSubPane++;

    result.push({
      instanceId: `tmpl_inst_${item.indicatorId}_${Date.now()}_${idx}`,
      indicatorId: def.id,
      name: item.name || def.shortName,
      overlay: isOverlay,
      inputs,
      styles,
      visible: true,
      paneIndex,
    });
  });

  return result;
}
