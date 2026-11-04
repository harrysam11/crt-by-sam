# Terminal v2.1

React 18 + TypeScript (strict) + Tailwind + Zustand + Lightweight Charts 4.2.

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # type-check + production build

## Markets
| Category | Source | Live updates |
|---|---|---|
| Crypto | Binance WebSocket | every trade, batched per frame; real 10-level depth |
| Forex, commodities, US stocks, India (NSE/BSE) stocks, indices | Yahoo Finance via `/api/yahoo` | polled ~2s (active symbol), ~20s (rest) |

- Use **Add symbol** to search any stock, ETF, index, FX pair or future; it joins the watchlist and is saved.
- Yahoo is unofficial, can rate-limit, and some exchanges are delayed. Fine for paper trading, not for real execution decisions.
- The proxy is in `vite.config.ts` (dev + `vite preview`). If you deploy the build, add the same rule in nginx / Caddy / a Cloudflare Worker: `/api/yahoo/* -> https://query1.finance.yahoo.com/*` with a browser-like User-Agent.
- Timeframes: Yahoo has no 1s data; 4h is built from 1h bars.

## Paper account
- USD wallet. PnL from INR / JPY / CAD etc. converts to USD using live FX (seeded rates until the first fetch).
- Leverage per order (1x to 100x). Margin = notional / leverage; orders are rejected above free margin.
- Market, Limit, Stop-loss, Take-profit. SL/TP are reduce-only and cancel each other (OCO).
- Pending orders keep filling for non-active symbols using the watchlist prices.
- Market orders when a session is closed fill at the last price with a warning.

## Extras
Entry / order / SL / TP / alert lines on the chart, price alerts (sound + notification), trade journal with win rate, profit factor and drawdown (CSV export), risk-based position sizing, chart axis in your local timezone.

Volume is an overlay histogram (Lightweight Charts 4.x has no native sub-panes).
