import type { IndicatorDefinition } from './types';
import * as Calc from './calculations';

export const INDICATOR_REGISTRY: IndicatorDefinition[] = [
  // 1. SMA
  {
    id: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    category: 'Moving Averages',
    overlay: true,
    description: 'Calculates the unweighted mean of closing prices over a specified period.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'SMA',
        color: '#f0b90b',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcSMA(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 2. EMA
  {
    id: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    category: 'Moving Averages',
    overlay: true,
    description: 'Places a greater weight and significance on the most recent price points.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'EMA',
        color: '#38bdf8',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcEMA(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 3. WMA
  {
    id: 'wma',
    name: 'Weighted Moving Average',
    shortName: 'WMA',
    category: 'Moving Averages',
    overlay: true,
    description: 'Linearly weighted moving average giving linearly increasing weight to recent data.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'WMA',
        color: '#c084fc',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcWMA(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 4. HMA
  {
    id: 'hma',
    name: 'Hull Moving Average',
    shortName: 'HMA',
    category: 'Moving Averages',
    overlay: true,
    description: 'Extremely responsive moving average that virtually eliminates lag while improving smoothing.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'HMA',
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcHMA(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 5. DEMA
  {
    id: 'dema',
    name: 'Double Exponential Moving Average',
    shortName: 'DEMA',
    category: 'Moving Averages',
    overlay: true,
    description: 'Reduces the amount of lag time found in traditional EMAs.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'DEMA',
        color: '#ec4899',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcDEMA(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 6. TEMA
  {
    id: 'tema',
    name: 'Triple Exponential Moving Average',
    shortName: 'TEMA',
    category: 'Moving Averages',
    overlay: true,
    description: 'Smooths price fluctuations and filters out volatility faster than a standard EMA.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'TEMA',
        color: '#14b8a6',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcTEMA(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 7. VWAP
  {
    id: 'vwap',
    name: 'Volume Weighted Average Price',
    shortName: 'VWAP',
    category: 'Moving Averages',
    overlay: true,
    description: 'Benchmark ratio representing dollar volume divided by total volume.',
    inputs: [],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'VWAP',
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles) => {
      const values = Calc.calcVWAP(candles);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 8. Bollinger Bands
  {
    id: 'bbands',
    name: 'Bollinger Bands',
    shortName: 'BB',
    category: 'Technicals',
    overlay: true,
    description: 'Standard deviation volatility bands above and below an SMA.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 500, default: 20 },
      { id: 'multiplier', label: 'StdDev', type: 'number', min: 0.5, max: 10, step: 0.1, default: 2 },
    ],
    defaultStyles: {
      upper: {
        id: 'upper',
        label: 'Upper Band',
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      middle: {
        id: 'middle',
        label: 'Basis (SMA)',
        color: '#f0b90b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      lower: {
        id: 'lower',
        label: 'Lower Band',
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 20);
      const mult = Number(inputs.multiplier || 2);
      const closes = candles.map((c) => c.close);
      const { upper, middle, lower } = Calc.calcBollingerBands(closes, period, mult);
      return {
        plots: {
          upper: candles.map((c, i) => ({ time: c.time, value: upper[i] })),
          middle: candles.map((c, i) => ({ time: c.time, value: middle[i] })),
          lower: candles.map((c, i) => ({ time: c.time, value: lower[i] })),
        },
      };
    },
  },

  // 9. Keltner Channels
  {
    id: 'keltner',
    name: 'Keltner Channels',
    shortName: 'KC',
    category: 'Technicals',
    overlay: true,
    description: 'Volatility-based envelopes set above and below an EMA using ATR bands.',
    inputs: [
      { id: 'emaPeriod', label: 'EMA Length', type: 'number', min: 1, max: 500, default: 20 },
      { id: 'atrPeriod', label: 'ATR Length', type: 'number', min: 1, max: 500, default: 10 },
      { id: 'multiplier', label: 'Multiplier', type: 'number', min: 0.5, max: 10, step: 0.1, default: 2 },
    ],
    defaultStyles: {
      upper: {
        id: 'upper',
        label: 'Upper KC',
        color: '#06b6d4',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      middle: {
        id: 'middle',
        label: 'Middle KC',
        color: '#0891b2',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      lower: {
        id: 'lower',
        label: 'Lower KC',
        color: '#06b6d4',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const { upper, middle, lower } = Calc.calcKeltnerChannels(
        candles,
        Number(inputs.emaPeriod || 20),
        Number(inputs.atrPeriod || 10),
        Number(inputs.multiplier || 2)
      );
      return {
        plots: {
          upper: candles.map((c, i) => ({ time: c.time, value: upper[i] })),
          middle: candles.map((c, i) => ({ time: c.time, value: middle[i] })),
          lower: candles.map((c, i) => ({ time: c.time, value: lower[i] })),
        },
      };
    },
  },

  // 10. Supertrend
  {
    id: 'supertrend',
    name: 'Supertrend',
    shortName: 'Supertrend',
    category: 'Technicals',
    overlay: true,
    description: 'Trend-following indicator using ATR to calculate dynamic support/resistance.',
    inputs: [
      { id: 'period', label: 'ATR Length', type: 'number', min: 1, max: 100, default: 10 },
      { id: 'multiplier', label: 'Factor', type: 'number', min: 1, max: 10, step: 0.5, default: 3 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'Supertrend',
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const { trend, line } = Calc.calcSupertrend(
        candles,
        Number(inputs.period || 10),
        Number(inputs.multiplier || 3)
      );
      return {
        plots: {
          plot: candles.map((c, i) => ({
            time: c.time,
            value: line[i],
            color: trend[i] === 1 ? '#22c55e' : '#ef4444',
          })),
        },
      };
    },
  },

  // 11. Parabolic SAR
  {
    id: 'psar',
    name: 'Parabolic SAR',
    shortName: 'SAR',
    category: 'Technicals',
    overlay: true,
    description: 'Determines the trend direction and potential reversal points.',
    inputs: [
      { id: 'startAf', label: 'Start AF', type: 'number', min: 0.01, max: 0.1, step: 0.01, default: 0.02 },
      { id: 'maxAf', label: 'Max AF', type: 'number', min: 0.1, max: 0.5, step: 0.05, default: 0.2 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'SAR Dots',
        color: '#a855f7',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'cross',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const values = Calc.calcParabolicSAR(
        candles,
        Number(inputs.startAf || 0.02),
        Number(inputs.maxAf || 0.2)
      );
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 12. Ichimoku Cloud
  {
    id: 'ichimoku',
    name: 'Ichimoku Cloud',
    shortName: 'Ichimoku',
    category: 'Technicals',
    overlay: true,
    description: 'Comprehensive indicator defining support, resistance, trend direction, and momentum.',
    inputs: [
      { id: 'tenkan', label: 'Conversion Line (Tenkan)', type: 'number', min: 1, max: 100, default: 9 },
      { id: 'kijun', label: 'Base Line (Kijun)', type: 'number', min: 1, max: 100, default: 26 },
      { id: 'senkouB', label: 'Leading Span B', type: 'number', min: 1, max: 200, default: 52 },
    ],
    defaultStyles: {
      tenkan: {
        id: 'tenkan',
        label: 'Tenkan-sen',
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      kijun: {
        id: 'kijun',
        label: 'Kijun-sen',
        color: '#f43f5e',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      senkouA: {
        id: 'senkouA',
        label: 'Senkou Span A',
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      senkouB: {
        id: 'senkouB',
        label: 'Senkou Span B',
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const { tenkan, kijun, senkouA, senkouB } = Calc.calcIchimoku(
        candles,
        Number(inputs.tenkan || 9),
        Number(inputs.kijun || 26),
        Number(inputs.senkouB || 52)
      );
      return {
        plots: {
          tenkan: candles.map((c, i) => ({ time: c.time, value: tenkan[i] })),
          kijun: candles.map((c, i) => ({ time: c.time, value: kijun[i] })),
          senkouA: candles.map((c, i) => ({ time: c.time, value: senkouA[i] })),
          senkouB: candles.map((c, i) => ({ time: c.time, value: senkouB[i] })),
        },
      };
    },
  },

  // 13. Pivot Points Standard
  {
    id: 'pivots',
    name: 'Pivot Points Standard',
    shortName: 'Pivots',
    category: 'Technicals',
    overlay: true,
    description: 'Calculates intraday support and resistance levels based on high, low, and close.',
    inputs: [],
    defaultStyles: {
      p: {
        id: 'p',
        label: 'Pivot (P)',
        color: '#eab308',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      r1: {
        id: 'r1',
        label: 'Resistance 1 (R1)',
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      s1: {
        id: 's1',
        label: 'Support 1 (S1)',
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      r2: {
        id: 'r2',
        label: 'Resistance 2 (R2)',
        color: '#b91c1c',
        lineWidth: 1,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      s2: {
        id: 's2',
        label: 'Support 2 (S2)',
        color: '#15803d',
        lineWidth: 1,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles) => {
      const { p, r1, s1, r2, s2 } = Calc.calcPivotPoints(candles);
      return {
        plots: {
          p: candles.map((c, i) => ({ time: c.time, value: p[i] })),
          r1: candles.map((c, i) => ({ time: c.time, value: r1[i] })),
          s1: candles.map((c, i) => ({ time: c.time, value: s1[i] })),
          r2: candles.map((c, i) => ({ time: c.time, value: r2[i] })),
          s2: candles.map((c, i) => ({ time: c.time, value: s2[i] })),
        },
      };
    },
  },

  // 14. Volume (with MA)
  {
    id: 'volume',
    name: 'Volume',
    shortName: 'Volume',
    category: 'Volume & Volatility',
    overlay: false,
    description: 'Displays the number of shares or contracts traded with a moving average overlay.',
    inputs: [
      { id: 'maLength', label: 'Volume MA Length', type: 'number', min: 1, max: 100, default: 20 },
    ],
    defaultStyles: {
      vol: {
        id: 'vol',
        label: 'Volume',
        color: '#38bdf8',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'histogram',
        visible: true,
      },
      ma: {
        id: 'ma',
        label: 'Volume MA',
        color: '#f59e0b',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const vols = candles.map((c) => c.volume);
      const maVals = Calc.calcSMA(vols, Number(inputs.maLength || 20));
      return {
        plots: {
          vol: candles.map((c) => ({
            time: c.time,
            value: c.volume,
            color: c.close >= c.open ? '#22c55e' : '#ef4444',
          })),
          ma: candles.map((c, i) => ({ time: c.time, value: maVals[i] })),
        },
      };
    },
  },

  // 15. RSI (Separate Pane)
  {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    category: 'Oscillators',
    overlay: false,
    description: 'Measures the speed and change of price movements between 0 and 100.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'RSI',
        color: '#a855f7',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      upper: {
        id: 'upper',
        label: 'Upper Band (70)',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      lower: {
        id: 'lower',
        label: 'Lower Band (30)',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const period = Number(inputs.period || 14);
      const closes = candles.map((c) => c.close);
      const values = Calc.calcRSI(closes, period);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
          upper: candles.map((c) => ({ time: c.time, value: 70 })),
          lower: candles.map((c) => ({ time: c.time, value: 30 })),
        },
      };
    },
  },

  // 16. MACD (Separate Pane)
  {
    id: 'macd',
    name: 'Moving Average Convergence Divergence',
    shortName: 'MACD',
    category: 'Oscillators',
    overlay: false,
    description: 'Shows the relationship between two exponential moving averages.',
    inputs: [
      { id: 'fast', label: 'Fast Length', type: 'number', min: 1, max: 100, default: 12 },
      { id: 'slow', label: 'Slow Length', type: 'number', min: 1, max: 100, default: 26 },
      { id: 'signal', label: 'Signal Smoothing', type: 'number', min: 1, max: 50, default: 9 },
    ],
    defaultStyles: {
      macd: {
        id: 'macd',
        label: 'MACD Line',
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      signal: {
        id: 'signal',
        label: 'Signal Line',
        color: '#f97316',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      histogram: {
        id: 'histogram',
        label: 'Histogram',
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'histogram',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const closes = candles.map((c) => c.close);
      const { macd, signal, histogram } = Calc.calcMACD(
        closes,
        Number(inputs.fast || 12),
        Number(inputs.slow || 26),
        Number(inputs.signal || 9)
      );
      return {
        plots: {
          macd: candles.map((c, i) => ({ time: c.time, value: macd[i] })),
          signal: candles.map((c, i) => ({ time: c.time, value: signal[i] })),
          histogram: candles.map((c, i) => ({
            time: c.time,
            value: histogram[i],
            color: (histogram[i] ?? 0) >= 0 ? '#22c55e' : '#ef4444',
          })),
        },
      };
    },
  },

  // 17. Stochastic Oscillator (Separate Pane)
  {
    id: 'stoch',
    name: 'Stochastic Oscillator',
    shortName: 'Stoch',
    category: 'Oscillators',
    overlay: false,
    description: 'Compares a specific closing price to a range of prices over time.',
    inputs: [
      { id: 'kPeriod', label: '%K Length', type: 'number', min: 1, max: 100, default: 14 },
      { id: 'dPeriod', label: '%D Smoothing', type: 'number', min: 1, max: 50, default: 3 },
    ],
    defaultStyles: {
      k: {
        id: 'k',
        label: '%K',
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      d: {
        id: 'd',
        label: '%D',
        color: '#f59e0b',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const { k, d } = Calc.calcStochastic(
        candles,
        Number(inputs.kPeriod || 14),
        Number(inputs.dPeriod || 3)
      );
      return {
        plots: {
          k: candles.map((c, i) => ({ time: c.time, value: k[i] })),
          d: candles.map((c, i) => ({ time: c.time, value: d[i] })),
        },
      };
    },
  },

  // 18. Stochastic RSI (Separate Pane)
  {
    id: 'stochrsi',
    name: 'Stochastic RSI',
    shortName: 'Stoch RSI',
    category: 'Oscillators',
    overlay: false,
    description: 'Applies the Stochastic formula to RSI values instead of raw price data.',
    inputs: [
      { id: 'rsiPeriod', label: 'RSI Length', type: 'number', min: 1, max: 100, default: 14 },
      { id: 'stochPeriod', label: 'Stoch Length', type: 'number', min: 1, max: 100, default: 14 },
      { id: 'dPeriod', label: '%D Smoothing', type: 'number', min: 1, max: 50, default: 3 },
    ],
    defaultStyles: {
      k: {
        id: 'k',
        label: '%K',
        color: '#38bdf8',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      d: {
        id: 'd',
        label: '%D',
        color: '#f43f5e',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const closes = candles.map((c) => c.close);
      const { k, d } = Calc.calcStochRSI(
        closes,
        Number(inputs.rsiPeriod || 14),
        Number(inputs.stochPeriod || 14),
        Number(inputs.dPeriod || 3)
      );
      return {
        plots: {
          k: candles.map((c, i) => ({ time: c.time, value: k[i] })),
          d: candles.map((c, i) => ({ time: c.time, value: d[i] })),
        },
      };
    },
  },

  // 19. ATR (Separate Pane)
  {
    id: 'atr',
    name: 'Average True Range',
    shortName: 'ATR',
    category: 'Volume & Volatility',
    overlay: false,
    description: 'Technical analysis volatility indicator depicting market volatility degree.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'ATR',
        color: '#e11d48',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const values = Calc.calcATR(candles, Number(inputs.period || 14));
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 20. ADX (Separate Pane)
  {
    id: 'adx',
    name: 'Average Directional Index',
    shortName: 'ADX',
    category: 'Oscillators',
    overlay: false,
    description: 'Quantifies trend strength regardless of trend direction.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
    ],
    defaultStyles: {
      adx: {
        id: 'adx',
        label: 'ADX',
        color: '#f59e0b',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      plusDI: {
        id: 'plusDI',
        label: '+DI',
        color: '#22c55e',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      minusDI: {
        id: 'minusDI',
        label: '-DI',
        color: '#ef4444',
        lineWidth: 1.5,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const { adx, plusDI, minusDI } = Calc.calcADX(candles, Number(inputs.period || 14));
      return {
        plots: {
          adx: candles.map((c, i) => ({ time: c.time, value: adx[i] })),
          plusDI: candles.map((c, i) => ({ time: c.time, value: plusDI[i] })),
          minusDI: candles.map((c, i) => ({ time: c.time, value: minusDI[i] })),
        },
      };
    },
  },

  // 21. CCI (Separate Pane)
  {
    id: 'cci',
    name: 'Commodity Channel Index',
    shortName: 'CCI',
    category: 'Oscillators',
    overlay: false,
    description: 'Momentum oscillator used to determine when an asset is overbought or oversold.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'CCI',
        color: '#0284c7',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      upper: {
        id: 'upper',
        label: 'Upper (100)',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      lower: {
        id: 'lower',
        label: 'Lower (-100)',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const values = Calc.calcCCI(candles, Number(inputs.period || 20));
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
          upper: candles.map((c) => ({ time: c.time, value: 100 })),
          lower: candles.map((c) => ({ time: c.time, value: -100 })),
        },
      };
    },
  },

  // 22. Williams %R (Separate Pane)
  {
    id: 'williamsr',
    name: 'Williams %R',
    shortName: '%R',
    category: 'Oscillators',
    overlay: false,
    description: 'Momentum indicator that moves between 0 and -100 to show overbought/oversold levels.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: '%R',
        color: '#8b5cf6',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      upper: {
        id: 'upper',
        label: 'Upper (-20)',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
      lower: {
        id: 'lower',
        label: 'Lower (-80)',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const values = Calc.calcWilliamsR(candles, Number(inputs.period || 14));
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
          upper: candles.map((c) => ({ time: c.time, value: -20 })),
          lower: candles.map((c) => ({ time: c.time, value: -80 })),
        },
      };
    },
  },

  // 23. MFI (Separate Pane)
  {
    id: 'mfi',
    name: 'Money Flow Index',
    shortName: 'MFI',
    category: 'Volume & Volatility',
    overlay: false,
    description: 'Volume-weighted RSI measuring buying and selling pressure.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 14 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'MFI',
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const values = Calc.calcMFI(candles, Number(inputs.period || 14));
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 24. OBV (Separate Pane)
  {
    id: 'obv',
    name: 'On-Balance Volume',
    shortName: 'OBV',
    category: 'Volume & Volatility',
    overlay: false,
    description: 'Cumulative volume indicator relating volume to price change.',
    inputs: [],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'OBV',
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles) => {
      const values = Calc.calcOBV(candles);
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 25. CMF (Separate Pane)
  {
    id: 'cmf',
    name: 'Chaikin Money Flow',
    shortName: 'CMF',
    category: 'Volume & Volatility',
    overlay: false,
    description: 'Measures the volume-weighted accumulation and distribution over a specified period.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 20 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'CMF',
        color: '#14b8a6',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
      zero: {
        id: 'zero',
        label: 'Zero Line',
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 'dashed',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const values = Calc.calcCMF(candles, Number(inputs.period || 20));
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
          zero: candles.map((c) => ({ time: c.time, value: 0 })),
        },
      };
    },
  },

  // 26. ROC (Separate Pane)
  {
    id: 'roc',
    name: 'Rate of Change',
    shortName: 'ROC',
    category: 'Oscillators',
    overlay: false,
    description: 'Measures the percentage change in price from one period to the next.',
    inputs: [
      { id: 'period', label: 'Length', type: 'number', min: 1, max: 100, default: 9 },
    ],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'ROC',
        color: '#d946ef',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'line',
        visible: true,
      },
    },
    calculate: (candles, inputs) => {
      const closes = candles.map((c) => c.close);
      const values = Calc.calcROC(closes, Number(inputs.period || 9));
      return {
        plots: {
          plot: candles.map((c, i) => ({ time: c.time, value: values[i] })),
        },
      };
    },
  },

  // 27. Awesome Oscillator (Separate Pane)
  {
    id: 'ao',
    name: 'Awesome Oscillator',
    shortName: 'AO',
    category: 'Oscillators',
    overlay: false,
    description: 'Market momentum indicator comparing recent momentum with longer-term momentum.',
    inputs: [],
    defaultStyles: {
      plot: {
        id: 'plot',
        label: 'AO Histogram',
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 'solid',
        plotType: 'histogram',
        visible: true,
      },
    },
    calculate: (candles) => {
      const values = Calc.calcAwesomeOscillator(candles);
      return {
        plots: {
          plot: candles.map((c, i) => {
            const prev = i > 0 ? values[i - 1] : 0;
            const cur = values[i] ?? 0;
            const isBullish = cur >= (prev ?? 0);
            return {
              time: c.time,
              value: values[i],
              color: isBullish ? '#22c55e' : '#ef4444',
            };
          }),
        },
      };
    },
  },
];
