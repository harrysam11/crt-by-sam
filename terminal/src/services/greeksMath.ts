/**
 * Black-Scholes Analytical Option Greeks Engine
 * Computes Delta, Gamma, Theta, Vega, and Rho for European/Crypto Options
 */

// Cumulative standard normal distribution
export function cnd(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;

  const k = 1.0 / (1.0 + p * Math.abs(x));
  const w = 1.0 - (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp((-x * x) / 2) *
    (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));

  return x < 0 ? 1.0 - w : w;
}

// Probability density function of standard normal
export function npdf(x: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp((-x * x) / 2);
}

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number; // per day decay
  vega: number;  // per 1% change in IV
  rho: number;
}

/**
 * Compute Black-Scholes Option Greeks
 * @param s Spot Price
 * @param k Strike Price
 * @param t Time to expiration in years (e.g. 7 days = 7/365)
 * @param v Implied Volatility (decimal, e.g. 0.45 for 45%)
 * @param r Risk-free interest rate (e.g. 0.05 for 5%)
 * @param type 'CALL' | 'PUT'
 */
export function calculateGreeks(
  s: number,
  k: number,
  t: number,
  v: number,
  r: number = 0.05,
  type: 'CALL' | 'PUT' = 'CALL'
): OptionGreeks {
  if (t <= 0 || v <= 0 || s <= 0 || k <= 0) {
    const isCall = type === 'CALL';
    const itm = isCall ? s > k : k > s;
    return {
      delta: itm ? (isCall ? 1 : -1) : 0,
      gamma: 0,
      theta: 0,
      vega: 0,
      rho: 0,
    };
  }

  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(s / k) + (r + (v * v) / 2) * t) / (v * sqrtT);
  const d2 = d1 - v * sqrtT;

  const nd1 = cnd(d1);
  const npd1 = npdf(d1);
  const expRt = Math.exp(-r * t);

  // Gamma is identical for Call and Put
  const gamma = npd1 / (s * v * sqrtT);

  // Vega is identical for Call and Put (per 1% IV move)
  const vega = (s * sqrtT * npd1) / 100;

  let delta = 0;
  let theta = 0;
  let rho = 0;

  if (type === 'CALL') {
    delta = nd1;
    theta = (-(s * npd1 * v) / (2 * sqrtT) - r * k * expRt * cnd(d2)) / 365;
    rho = (k * t * expRt * cnd(d2)) / 100;
  } else {
    delta = nd1 - 1;
    theta = (-(s * npd1 * v) / (2 * sqrtT) + r * k * expRt * cnd(-d2)) / 365;
    rho = (-k * t * expRt * cnd(-d2)) / 100;
  }

  return {
    delta: Math.round(delta * 1000) / 1000,
    gamma: Math.round(gamma * 10000) / 10000,
    theta: Math.round(theta * 100) / 100,
    vega: Math.round(vega * 100) / 100,
    rho: Math.round(rho * 1000) / 1000,
  };
}
