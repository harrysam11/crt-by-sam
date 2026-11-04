import type { OptionChainData, OptionStrike, OpenInterestBar } from '../types/derivatives';
import type { Candle } from '../types/terminal';

/**
 * Calculate Max Pain strike from option strikes list
 */
export function calculateMaxPain(strikes: OptionStrike[]): number {
  if (!strikes.length) return 0;

  let minLoss = Infinity;
  let maxPainStrike = strikes[0].strikePrice;

  for (const target of strikes) {
    const s = target.strikePrice;
    let totalLoss = 0;

    for (const row of strikes) {
      // Call payout if underlying expires at s
      if (s > row.strikePrice) {
        totalLoss += (s - row.strikePrice) * row.callOI;
      }
      // Put payout if underlying expires at s
      if (s < row.strikePrice) {
        totalLoss += (row.strikePrice - s) * row.putOI;
      }
    }

    if (totalLoss < minLoss) {
      minLoss = totalLoss;
      maxPainStrike = s;
    }
  }

  return maxPainStrike;
}

/**
 * Generate synthetic or live Option Chain for Indian indices / crypto
 */
export function generateOptionChain(underlying: string, spotPrice: number): OptionChainData {
  const isNifty = underlying.includes('NIFTY') || underlying === '^NSEI';
  const isBankNifty = underlying.includes('BANK') || underlying === '^NSEBANK';

  const step = isBankNifty ? 100 : isNifty ? 50 : spotPrice > 1000 ? 50 : 10;
  const numStrikes = 15;
  const atmBase = Math.round(spotPrice / step) * step;

  const strikes: OptionStrike[] = [];
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (let i = -Math.floor(numStrikes / 2); i <= Math.floor(numStrikes / 2); i++) {
    const strikePrice = atmBase + i * step;
    const dist = (strikePrice - spotPrice) / step;

    // Call OI peaks above spot (resistance); Put OI peaks below spot (support)
    const callWeight = Math.max(0.2, 1 - Math.abs(dist - 2) * 0.15);
    const putWeight = Math.max(0.2, 1 - Math.abs(dist + 2) * 0.15);

    const callOI = Math.round(150000 * callWeight * (1 + (Math.sin(i * 1.5) * 0.2)));
    const putOI = Math.round(160000 * putWeight * (1 + (Math.cos(i * 1.5) * 0.2)));

    const callChangeOI = Math.round(callOI * 0.12 * (i > 0 ? 1 : -0.5));
    const putChangeOI = Math.round(putOI * 0.14 * (i < 0 ? 1 : -0.5));

    // Black-Scholes intrinsic approximation
    const callIntrinsic = Math.max(0, spotPrice - strikePrice);
    const putIntrinsic = Math.max(0, strikePrice - spotPrice);
    const timeValue = Math.max(5, (step * 1.8) / (1 + Math.abs(dist) * 0.5));

    const callLtp = Math.round((callIntrinsic + timeValue) * 10) / 10;
    const putLtp = Math.round((putIntrinsic + timeValue) * 10) / 10;

    const callIv = Math.round((14 + Math.abs(dist) * 0.4) * 10) / 10;
    const putIv = Math.round((14.5 + Math.abs(dist) * 0.45) * 10) / 10;

    totalCallOI += callOI;
    totalPutOI += putOI;

    strikes.push({
      strikePrice,
      callOI,
      callChangeOI,
      callLtp,
      callIv,
      putOI,
      putChangeOI,
      putLtp,
      putIv,
    });
  }

  const pcr = totalCallOI > 0 ? Math.round((totalPutOI / totalCallOI) * 100) / 100 : 1;
  const maxPain = calculateMaxPain(strikes);

  // Next weekly Thursday expiry
  const now = new Date();
  const day = now.getDay();
  const diff = (4 - day + 7) % 7 || 7;
  const nextThursday = new Date(now.getTime() + diff * 86400000);
  const expiryDate = nextThursday.toISOString().slice(0, 10);

  return {
    underlying,
    spotPrice,
    expiryDate,
    pcr,
    maxPain,
    totalCallOI,
    totalPutOI,
    strikes,
  };
}

/**
 * Generate Open Interest history bars aligned with candle timestamps
 */
export function generateOIHistory(candles: Candle[]): OpenInterestBar[] {
  let baseOI = 1200000;

  return candles.map((c, i) => {
    // If price went up with volume, OI increases (Long Build up)
    const priceChange = c.close - c.open;
    const oiDelta = Math.round((priceChange / c.close) * baseOI * 0.8 + (Math.random() - 0.48) * 15000);
    baseOI += oiDelta;

    const callRatio = priceChange >= 0 ? 0.46 : 0.54;
    const callOI = Math.round(baseOI * callRatio);
    const putOI = baseOI - callOI;

    return {
      time: c.time,
      totalOI: baseOI,
      callOI,
      putOI,
      changeOI: oiDelta,
    };
  });
}

/**
 * Determine F&O interpretation from Price and OI change
 */
export function getOIBuildupSignal(priceChange: number, oiChange: number): {
  type: 'LONG_BUILDUP' | 'SHORT_BUILDUP' | 'SHORT_COVERING' | 'LONG_UNWINDING';
  label: string;
  bias: 'BULLISH' | 'BEARISH';
} {
  if (priceChange >= 0 && oiChange >= 0) {
    return { type: 'LONG_BUILDUP', label: 'Long Build-up (Bullish)', bias: 'BULLISH' };
  } else if (priceChange < 0 && oiChange >= 0) {
    return { type: 'SHORT_BUILDUP', label: 'Short Build-up (Bearish)', bias: 'BEARISH' };
  } else if (priceChange >= 0 && oiChange < 0) {
    return { type: 'SHORT_COVERING', label: 'Short Covering (Pullback Rally)', bias: 'BULLISH' };
  } else {
    return { type: 'LONG_UNWINDING', label: 'Long Unwinding (Profit Booking)', bias: 'BEARISH' };
  }
}
