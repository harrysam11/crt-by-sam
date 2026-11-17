# CRT Institutional Trading Terminal & TradeXGuardian

> Prevention-first institutional trading terminal with order flow analytics, multi-chart layout freedom, automated capital guardrails, and client-side zero-knowledge security.

---

## Overview

**CRT Terminal** is a high-performance web and mobile trading terminal engineered for prop firm challengers, professional discretionary traders, and algorithmic execution. 

Unlike traditional platforms that focus purely on chart drawing tools, CRT Terminal places **capital protection and trader psychology** at the core through the **TradeXGuardian** engine — intercepting fat-finger typos, hard-locking overtrading, enforcing daily drawdown caps, and preventing emotional revenge trading before an order ever reaches your broker.

The terminal is wrapped for standalone installation across **Web, iOS, Android, and Desktop** with offline caching and native WebGL acceleration.

---

## Key Architectural Highlights

### 1. TradeXGuardian Capital Protection
- **Pre-Trade Intercept Layer**: Orders are validated client-side against your risk rules before broker dispatch.
- **Hard Trade Blocker**: Enforces maximum trades per day and maximum daily loss. Orders are hard-blocked upon breach until the next session reset.
- **Session & Time Blocker**: Restricts execution strictly to proven killzone windows (London, New York AM/PM, Asian sessions).
- **Prop Firm Shield**: Automatically tracks maximum daily loss, maximum trailing drawdown, consistency rules, and profit targets for challenges.
- **Fat-Finger & Risk Error Prevention**: Flags and holds orders with missing stop losses, inverted risk-reward ratios, or abnormally wide invalidations.
- **Emergency Lockout & Discipline Scoring**: Tracks behavioral discipline scores (0-100%) and provides one-click 30-minute to 24-hour emotional cooldown locks.

### 2. Multi-Chart Canvas & Layout Freedom
- **TradingView-Grade Grid Engine**: Seamless switching between 1x1 Single, 1x2 Vertical Dual, 2x1 Horizontal Stacked, and 2x2 Quad Multi-Chart grids.
- **Independent Per-Pane Customization**: Full freedom to assign any trading pair and any timeframe (`1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `1d`, `1w`, `1M`) to each individual chart pane.
- **Crosshair & Range Synchronization**: Toggle symbol synchronization, timeframe alignment, time cursor crosshair synchronization, and visible zoom range locking across panes.
- **Interactive Drag-to-Set TP/SL**: Click and drag position lines directly on the chart canvas to position Take-Profit and Stop-Loss orders with auto-inverting short/long orientation logic.
- **Free-Movable Bar Replay**: High-speed bar-by-bar backtesting with detached viewport freedom and one-click playhead recentering.

### 3. Institutional Order Flow & Derivatives Suite
- **Footprint & Depth of Market (DOM)**: Interactive order book ladder with live bid/ask imbalances, iceberg volume tracking, and market execution.
- **Option Chain Matrix**: Live implied volatility surface, call/put strike chains, and open interest buildup across NSE and Crypto contracts.
- **Options Greeks Scanner**: Real-time Delta, Gamma, Theta, and Vega exposure telemetry.
- **Perpetual Funding Rate Heatmap**: Global exchange arbitrage tracking across Binance, Bybit, and OKX.
- **Liquidation Cascade Waterfall**: Visualizes aggregated liquidation pools, clusters, and stop hunt magnet zones.

### 4. Portfolio Dashboard, PnL Calendar & Trade Journal
- **PnL Calendar Heatmap**: Interactive monthly calendar showing daily realized profits, win rate, and trade frequency.
- **Cumulative Equity Curves**: High-resolution performance curve analytics with benchmark overlay.
- **Psychological Assessment & Takeaways**: Pre-trade emotion tagging, post-trade reviews, discipline score tracking, and automated edge analysis.
- **Weekly Review Suite**: Automated weekly stats aggregation, day-of-week win-rate breakdown, and four-quadrant reflection logs.
- **Local AI Behavioral Insights**: Integrates with local Ollama or secure API endpoints to generate objective behavioral coaching audits.

### 5. Macro News Wire & Forex Factory Calendar
- **Live Economic Release Feed**: Real-time high-impact macroeconomic releases powered by FairEconomy / Forex Factory.
- **Curated Financial & Leader Statements**: Live statements, geopolitical developments, central bank speeches (Fed, ECB, BoJ), and whale tracking.
- **Pair-Specific Filtering**: Instantly filters news, tweets, and calendar releases by active trading pair.
- **Manual & Automated Polling**: Auto-refreshes every 10 minutes with immediate manual refresh button.

### 6. Client-Side Zero-Knowledge Security Vault
- **AES-GCM 256-Bit Encryption**: Broker API keys and secrets are encrypted client-side using PBKDF2 (100,000 rounds) and AES-GCM before storage.
- **Zero Cloud Exposure**: Sensitive API credentials never leave your browser unencrypted.
- **Strict Content Security Policy (CSP)**: Hardened headers prohibiting external code injection and unauthorized cross-origin connections.

---

## Platform Installation: iOS, Android, and Web

CRT Terminal is packaged as both a **Progressive Web App (PWA)** and **Native iOS & Android Capacitor projects**.

### Option A: Direct Web App & PWA (Instant Mobile & Desktop)
No App Store download required:
1. **Apple iOS (iPhone / iPad)**:
   - Open the web terminal in **Safari**.
   - Tap the **Share** button (box with an upward arrow).
   - Tap **Add to Home Screen**, then tap **Add**.
   - The app launches in full-screen standalone mode at 120Hz without browser URL bars.
2. **Google Android**:
   - Open the web terminal in **Google Chrome**.
   - Tap **Install App** in the banner or tap the three dots menu &gt; **Install app**.
   - Runs as an isolated native application with home screen launch.
3. **Desktop (macOS / Windows / Linux)**:
   - Click the install icon in the browser address bar (Chrome, Edge, Brave) to install as a native desktop window.

### Option B: Native Mobile App Compilation (Capacitor)
Full native projects are pre-configured in `terminal/android` and `terminal/ios`.

#### Android (.apk / .aab)
```bash
cd terminal
npm install
npm run cap:build
npm run cap:android
```
In Android Studio:
1. Allow Gradle sync to complete.
2. Select **Build** &gt; **Build Bundle(s) / APK(s)** &gt; **Build APK(s)**.
3. The compiled `.apk` will be output to `terminal/android/app/build/outputs/apk/debug/`.

#### Apple iOS (.ipa / Xcode Workspace)
```bash
cd terminal
npm install
npm run cap:build
npm run cap:ios
```
In Xcode (macOS required):
1. Select your target device or simulator.
2. Choose your Apple Developer Signing Team.
3. Press **Product** &gt; **Run** (or **Archive** for TestFlight/App Store).

---

## Development & Local Run Guide

### Prerequisites
- Node.js 18.x or 20.x LTS
- npm 9.x or higher

### 1. Clone & Install
```bash
git clone https://github.com/harrysam11/crt-by-sam.git
cd crt-by-sam/terminal
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

- To launch directly into the **Live Terminal**: `http://localhost:5173`
- To view the **Product Showcase & Landing Page**: `http://localhost:5173/?view=landing`

### 3. Production Build & Verification
```bash
npm run build
npm run preview
```
Ensures 0 TypeScript errors and produces optimized production bundles in `terminal/dist/`.

---

## Global Hotkey Reference

| Hotkey | Description |
|---|---|
| `Ctrl+K` / `Cmd+K` | Global Command Palette & Quick Search (All tools, pairs, layouts) |
| `Alt+M` | Toggle Fullscreen Chart Canvas Maximize |
| `Alt+Z` | Toggle Zen Mode (Hides balance and PnL to prevent emotional anchoring) |
| `Alt+J` | Open Trade Psychology Journal & Weekly Review |
| `Alt+P` | Open Portfolio Tracker & PnL Calendar Heatmap |
| `Escape` | Close active popups, menus, and overlays |

---

## Typography & Design Standard
- **Headings**: Inter (`font-heading`)
- **Body & Controls**: DM Sans (`font-sans`)
- **Telemetry & Numbers**: JetBrains Mono (`font-mono`, `.num`)
- **Design Philosophy**: Claymorphism soft-card panels with subtle borders, adaptive contrast, zero clutter, and a strictly enforced **ZERO EMOJI POLICY**.

---

## License & Attribution
- CRT Engine, TradeXGuardian, and Terminal UI: Original work by Sam.
- SMT Divergences Module: Gregorius_XV (`GXV SMT_Divergences[LITE]`) under Mozilla Public License 2.0 (MPL-2.0).
- True Opens Module: Daye (Quarterly Theory, open-source).
