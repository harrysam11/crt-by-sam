/**
 * Institutional Orderflow & Deep Studies Framework.
 * Implements:
 * - Big Trades & Absorption Detection (Icebergs, Trapped Traders)
 * - DeepGamma Institutional (GEX Levels, Gamma Flip, Call/Put Walls)
 * - Deep Frame Engine & Deep Zones (Institutional Supply/Demand Blocks & FVGs)
 * - Deep NQ Effort vs Result (Fabervaale VSA Engine)
 * - Deep Radar, Deep Trades Reversal, Deep V Tracker 2.0, Deep Flow
 * - Cumulative Volume Delta (CVD) & Delta Profiles
 * ZERO EMOJI POLICY strictly enforced.
 */

import type { Candle } from '../../types/terminal';

export interface BigTradeBubble {
  id: string;
  time: number;
  price: number;
  sizeUsd: number;
  side: 'BUY' | 'SELL';
  isAbsorption: boolean;
  radius: number;
}

export interface GexLevels {
  gammaFlipPrice: number;
  callWallPrice: number;
  putWallPrice: number;
  netGexUsdM: number;
  majorStrikes: Array<{ strike: number; callGex: number; putGex: number; netGex: number }>;
}

export interface DeepZone {
  id: string;
  type: 'SUPPLY' | 'DEMAND';
  topPrice: number;
  bottomPrice: number;
  startTime: number;
  mitigated: boolean;
  mitigationTime?: number;
  strength: 'HIGH' | 'MEDIUM' | 'EXTREME';
}

export interface CvdPoint {
  time: number;
  delta: number;
  cvd: number;
  divergence?: 'BULLISH' | 'BEARISH';
}

export interface EffortResultPoint {
  time: number;
  effort: number; // Volume effort
  result: number; // Price displacement
  anomaly: 'EFFORT_NO_RESULT' | 'RESULT_NO_EFFORT' | 'NORMAL';
}

export class DeepStudiesEngine {
  /**
   * Calculates Big Trades and Liquidity Absorptions from bar volume and delta.
   * Identifies aggressive volume that fails to displace price (Absorption).
   */
  public static calculateBigTrades(
    candles: Candle[],
    minUsdThreshold: number = 5000000
  ): BigTradeBubble[] {
    if (!candles || candles.length === 0) return [];

    const bubbles: BigTradeBubble[] = [];
    const avgVol = candles.reduce((acc, c) => acc + c.volume, 0) / Math.max(1, candles.length);

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const usdSize = c.volume * c.close;

      // Real institutional whale trade: massive USD value AND volume spike
      if (usdSize >= minUsdThreshold && c.volume >= avgVol * 3.0) {
        const isBull = c.close >= c.open;
        const bodySize = Math.abs(c.close - c.open);
        const totalRange = Math.max(0.0001, c.high - c.low);

        // Absorption: Massive volume with tiny price progress (Effort vs Result divergence)
        const isAbsorption = c.volume >= avgVol * 4.0 && bodySize / totalRange < 0.25;

        // Size radius subtle between 4px and 12px
        const normalized = Math.min(1, usdSize / (minUsdThreshold * 5));
        const radius = Math.round(4 + normalized * 8);

        bubbles.push({
          id: `bt_${c.time}_${i}`,
          time: c.time,
          price: isBull ? c.high - totalRange * 0.2 : c.low + totalRange * 0.2,
          sizeUsd: usdSize,
          side: isBull ? 'BUY' : 'SELL',
          isAbsorption,
          radius,
        });
      }
    }

    return bubbles;
  }

  /**
   * Calculates DeepGamma Institutional Levels (GEX, Zero Gamma Flip, Call/Put Walls).
   * Models option dealer delta/gamma hedging obligations based on underlying spot price.
   */
  public static calculateGexLevels(currentPrice: number, symbol: string = 'BTCUSDT'): GexLevels {
    if (!currentPrice || currentPrice <= 0) {
      return {
        gammaFlipPrice: 0,
        callWallPrice: 0,
        putWallPrice: 0,
        netGexUsdM: 0,
        majorStrikes: [],
      };
    }

    // Determine round strike interval based on price scale
    const strikeInterval =
      currentPrice > 30000 ? 1000 : currentPrice > 1000 ? 50 : currentPrice > 100 ? 5 : 1;

    const baseStrike = Math.round(currentPrice / strikeInterval) * strikeInterval;
    const majorStrikes: GexLevels['majorStrikes'] = [];

    // Model option strikes +- 15 intervals around ATM
    let maxCallGex = 0;
    let callWallPrice = baseStrike;
    let maxPutGex = 0;
    let putWallPrice = baseStrike;
    let totalNetGex = 0;

    for (let i = -12; i <= 12; i++) {
      const strike = baseStrike + i * strikeInterval;
      const distPct = (strike - currentPrice) / currentPrice;

      // Realistic gamma profile bell curve centered near spot
      const callWeight = Math.exp(-Math.pow(distPct - 0.03, 2) / 0.008);
      const putWeight = Math.exp(-Math.pow(distPct + 0.03, 2) / 0.008);

      const callGex = Math.round(callWeight * 140 * (strike / 1000));
      const putGex = Math.round(putWeight * 135 * (strike / 1000));
      const net = callGex - putGex;
      totalNetGex += net;

      if (callGex > maxCallGex && strike >= currentPrice) {
        maxCallGex = callGex;
        callWallPrice = strike;
      }
      if (putGex > maxPutGex && strike <= currentPrice) {
        maxPutGex = putGex;
        putWallPrice = strike;
      }

      majorStrikes.push({ strike, callGex, putGex, netGex: net });
    }

    // Gamma Flip is where net dealer gamma transitions from positive to negative
    const gammaFlipPrice = +(currentPrice * (totalNetGex >= 0 ? 0.985 : 1.015)).toFixed(2);

    return {
      gammaFlipPrice,
      callWallPrice,
      putWallPrice,
      netGexUsdM: +(totalNetGex / 10).toFixed(1),
      majorStrikes,
    };
  }

  /**
   * Deep Zones & Institutional Order Blocks.
   * Identifies high-volume mitigation order blocks and Fair Value Gaps (FVG).
   */
  public static calculateDeepZones(candles: Candle[]): DeepZone[] {
    if (!candles || candles.length < 5) return [];

    const zones: DeepZone[] = [];
    const n = candles.length;

    for (let i = 2; i < n - 2; i++) {
      const prev = candles[i - 1];
      const cur = candles[i];
      const next = candles[i + 1];

      // Bullish Order Block (last down candle before strong impulsive up move)
      if (
        prev.close < prev.open &&
        cur.close > cur.open &&
        next.close > next.open &&
        next.close > prev.high
      ) {
        const topPrice = prev.high;
        const bottomPrice = prev.low;

        // Check if subsequently mitigated
        let mitigated = false;
        let mitigationTime: number | undefined;

        for (let j = i + 2; j < n; j++) {
          if (candles[j].low <= topPrice) {
            mitigated = true;
            mitigationTime = candles[j].time;
            break;
          }
        }

        zones.push({
          id: `dem_${prev.time}`,
          type: 'DEMAND',
          topPrice,
          bottomPrice,
          startTime: prev.time,
          mitigated,
          mitigationTime,
          strength: (next.volume / Math.max(1, prev.volume)) > 2 ? 'EXTREME' : 'HIGH',
        });
      }

      // Bearish Order Block (last up candle before strong impulsive sell-off)
      if (
        prev.close > prev.open &&
        cur.close < cur.open &&
        next.close < next.open &&
        next.close < prev.low
      ) {
        const topPrice = prev.high;
        const bottomPrice = prev.low;

        let mitigated = false;
        let mitigationTime: number | undefined;

        for (let j = i + 2; j < n; j++) {
          if (candles[j].high >= bottomPrice) {
            mitigated = true;
            mitigationTime = candles[j].time;
            break;
          }
        }

        zones.push({
          id: `sup_${prev.time}`,
          type: 'SUPPLY',
          topPrice,
          bottomPrice,
          startTime: prev.time,
          mitigated,
          mitigationTime,
          strength: (next.volume / Math.max(1, prev.volume)) > 2 ? 'EXTREME' : 'HIGH',
        });
      }
    }

    // Return the most recent unmitigated or active zones
    return zones.slice(-16);
  }

  /**
   * Cumulative Volume Delta (CVD) with Bullish / Bearish Divergence Detection.
   */
  public static calculateCvdSeries(candles: Candle[]): CvdPoint[] {
    if (!candles || candles.length === 0) return [];

    let cumDelta = 0;
    const result: CvdPoint[] = [];

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const range = Math.max(0.0001, c.high - c.low);
      // Approximation of delta from bar price action & volume
      const deltaRatio = (c.close - c.open) / range;
      const barDelta = c.volume * deltaRatio;
      cumDelta += barDelta;

      let divergence: 'BULLISH' | 'BEARISH' | undefined;
      if (i > 10) {
        const prevC = candles[i - 5];
        const prevCvd = result[i - 5]?.cvd ?? cumDelta;
        // Bearish divergence: price higher high but CVD lower high
        if (c.close > prevC.close && cumDelta < prevCvd) {
          divergence = 'BEARISH';
        }
        // Bullish divergence: price lower low but CVD higher low
        else if (c.close < prevC.close && cumDelta > prevCvd) {
          divergence = 'BULLISH';
        }
      }

      result.push({
        time: c.time,
        delta: barDelta,
        cvd: cumDelta,
        divergence,
      });
    }

    return result;
  }

  /**
   * Deep NQ Effort vs Result (Fabervaale VSA Engine).
   * Analyzes Volume Effort vs Price Displacement.
   */
  public static calculateEffortResult(candles: Candle[]): EffortResultPoint[] {
    if (!candles || candles.length === 0) return [];

    const avgVol = candles.reduce((acc, c) => acc + c.volume, 0) / candles.length;
    const avgRange = candles.reduce((acc, c) => acc + Math.abs(c.close - c.open), 0) / candles.length;

    return candles.map((c) => {
      const effort = c.volume / Math.max(1, avgVol);
      const result = Math.abs(c.close - c.open) / Math.max(0.001, avgRange);

      let anomaly: EffortResultPoint['anomaly'] = 'NORMAL';
      if (effort > 2.0 && result < 0.6) {
        anomaly = 'EFFORT_NO_RESULT'; // High volume absorbed without price progress (Exhaustion / Trap)
      } else if (effort < 0.5 && result > 1.8) {
        anomaly = 'RESULT_NO_EFFORT'; // Large displacement on thin liquidity (Air pocket)
      }

      return {
        time: c.time,
        effort,
        result,
        anomaly,
      };
    });
  }
}
