# CRT Terminal - Feature Specifications & Architecture Reference

A high-performance, self-hosted financial charting and paper-trading terminal built with React 18, TypeScript, Tailwind CSS, Zustand, and TradingView Lightweight Charts v5. Designed with a custom Claymorphic Black and White design system.

---

## 1. Multi-Asset Market Datafeed & Adapters

- **Crypto Real-Time WebSocket Feed**:
  - Direct connection to Binance WebSocket stream (`wss://stream.binance.com:9443/ws`).
  - Sub-second tick aggregation and live candle updates without full chart recomputation.
  - Automatic reconnection, ping/pong heartbeats, and subscription state tracking.
- **Forex & Commodities Free-Tier Adapter**:
  - Live and historical bar fetching for `XAUUSD` (Gold), `EURUSD`, `GBPUSD`, `USDJPY`, `USOIL`.
  - Resolution normalization from 1-minute to 1-month bars.
- **Indian Equities & Indices (NSE / BSE)**:
  - Real-time and historical data for National Stock Exchange symbols (`RELIANCE.NS`, `TCS.NS`, `HDFCBANK.NS`, `INFY.NS`) and major indices (`NIFTY 50`, `BANKNIFTY`).
- **US Equities**:
  - Historical and live quote handling for `AAPL`, `TSLA`, `NVDA`, `MSFT`.
- **Pluggable Custom Datafeed Provider**:
  - Standardized interface: `searchSymbols`, `resolveSymbol`, `getBars`, `subscribeBars`, `unsubscribeBars`.
  - User-configurable endpoint URL and API key fields stored locally in the browser (`terminal/src/services/datafeed/index.ts`).
- **Institutional Symbol Search Modal**:
  - Category filters: `All`, `Crypto`, `Forex`, `NSE/BSE`, `US Stocks`, `Commodities`.
  - Real-time search query filtering with instrument provider tags and keyboard navigation.

---

## 2. Core Charting Engine

- **High-Performance Canvas Core**:
  - Powered by TradingView Lightweight Charts v5 series primitives and pane architecture.
  - Sub-millisecond tick updates and smooth panning/zooming.
- **Multi-Timeframe Architecture**:
  - Standard intervals: `1s`, `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `1d`, `1w`, `1M`.
  - Quick-access favorite timeframe pills on top toolbar.
- **7 Chart Render Types**:
  - Candlestick (custom bull/bear colors, wicks, borders)
  - Bar Chart
  - Hollow Candlestick
  - Real-time computed Heikin Ashi
  - Line Chart
  - Mountain / Area Chart
  - Baseline Chart
- **Price Scale Modes**:
  - Normal / Linear (`lin`)
  - Logarithmic (`log`)
  - Percentage Change (`%`)
  - 1-Click Auto Scale (`auto`) or double-click scale axis reset.
- **Global Timezone Converter**:
  - Instant chart conversion between `UTC`, `IST` (Asia/Kolkata), `EDT` (America/New_York), `GMT` (Europe/London), and `JST` (Asia/Tokyo).
- **Time Range Selector Presets**:
  - Bottom bar presets: `1D`, `5D`, `1M`, `3M`, `6M`, `YTD`, `1Y`, `ALL`.
- **Canvas Context Menu**:
  - Right-click canvas menu for quick actions: Add Alert, Create Limit/Market Order, Add Horizontal Line/Ray, Start Replay at Bar, Measure Ruler, Open Indicators, Chart Settings.

---

## 3. Drawing Tools Suite (12+ Professional Vector Tools)

- **Docked Left Toolbar & Floating Favorites Bar**:
  - Expandable flyouts for lines, geometric shapes, Fibonacci, annotations, and risk calculators.
  - Quick-star favorite tools bar persistent across sessions.
- **12+ Native Vector Drawing Tools**:
  1. Trendline
  2. Extended Ray
  3. Horizontal Line & Horizontal Ray
  4. Vertical Line
  5. Parallel Channel (dual rail with midline)
  6. Fibonacci Retracement (multi-level percentages with custom colors)
  7. Fibonacci Trend Extension
  8. Rectangle (support/resistance zones)
  9. Long Position Risk/Reward Tool (entry, stop loss, take profit, R:R ratio, dollar risk)
  10. Short Position Risk/Reward Tool
  11. Measurement Ruler (price delta, percentage delta, bar count, elapsed time)
  12. Freehand Brush & Arrow Callouts
- **Interactive Editing & Magnet Controls**:
  - Anchor point hit-testing, drag-to-resize, and translate.
  - Magnet Snapping (Weak mode: nearby OHLC; Strong mode: absolute candle extremities).
  - Floating Tool Style Bar: color picker, line thickness, opacity, dashed/dotted styles.
  - Global Drawing Operations: Lock All, Hide All, Clear All.
  - Undo / Redo engine (`Ctrl+Z`, `Ctrl+Y`).
  - Storage: Drawings persisted per symbol in local storage.

---

## 4. Technical Indicator Engine (25+ Indicators & Multi-Pane)

- **25+ Institutional Indicators**:
  - Moving Averages: SMA, EMA, WMA, HMA, RMA, VWMA, VWAP.
  - Oscillators: RSI, MACD, Stochastic, Stochastic RSI, CCI, Williams %R, Rate of Change (ROC).
  - Volatility: Bollinger Bands, ATR, Keltner Channels, Donchian Channels.
  - Trend: Supertrend, Parabolic SAR, Ichimoku Cloud, ADX / DMI, ZigZag, Pivot Points Standard.
  - Volume: On-Balance Volume (OBV), Money Flow Index (MFI), Chaikin Money Flow (CMF), Volume Profile (VPVR).
- **SubPane Oscillator Charts**:
  - Non-overlay indicators (RSI, MACD, Stoch) render in dedicated sub-panes beneath the main price chart with synchronized time scale and crosshairs.
- **In-Chart Legend HUD**:
  - Real-time indicator values displayed directly in the chart legend.
  - Eye icon for visibility toggling, gear icon for settings dialog, and remove icon.
- **Indicator Settings Dialog**:
  - Inputs Tab (lengths, multipliers, smoothing sources).
  - Style Tab (line colors, line widths, plot visibility).
  - Visibility Tab (timeframe visibility filters).
- **Pine Script Runtime**:
  - Sandboxed PineTS transpiler runtime to parse and plot custom user Pine Script formulas.

---

## 5. Multi-Chart Grid & Workspace Engine

- **Grid Layouts**:
  - `1x1` Single chart view
  - `1x2` Dual vertical split
  - `2x1` Dual horizontal split
  - `2x2` Quad-chart matrix
- **Cross-Chart Event Bus Synchronization**:
  - Crosshair timestamp and logical visible range broadcasting.
  - Global Crosshair Sync toggle.
  - Visible Range / Zoom Sync toggle.
  - Master Symbol Sync toggle.
  - Master Timeframe Sync toggle.
- **Custom Workspace Templates**:
  - Save named grid layouts and templates to local storage.
  - Active chart border indicator with keyboard shortcut focus management.

---

## 6. Paper-Trading Simulation Engine & In-Chart Order Dragging

- **Trading Simulation Core**:
  - Real-time position tracking with entry price, size, margin, and liquidation calculation.
  - Mark-to-market live unrealized P&L in USD and percentage.
  - Account equity, cash balance, and margin allocation meters.
  - Historical closed trade log with gross/net P&L and commission deductions.
- **Order Types & Execution**:
  - Market Orders (instant execution at current bid/ask).
  - Limit Orders (executed when price touches or crosses limit price).
  - Stop Orders (triggered when price penetrates stop level).
  - Configurable Leverage (1x to 100x).
- **Bracket Order Management (SL / TP)**:
  - Stop Loss and Take Profit attached directly to parent orders or active positions.
- **In-Chart Trading Overlay**:
  - **Draggable Order Lines**: Move pending Limit and Stop orders vertically on the chart canvas to modify price.
  - **Draggable SL / TP Handles**: Drag Stop Loss and Take Profit tags to dynamically update exit targets.
  - **Active Position Badge**: Position line on canvas showing live P&L, with 1-click **Close (X)**, **Flip Position (REV)**, and **Snap Break-Even (BE)**.
  - **1-Click Quick Trade Pill**: Floating widget on chart canvas with Instant Buy, Instant Sell, and custom lot size input.

---

## 7. Bar Replay Historical Time Machine

- **Time Machine Scrubber Controls**:
  - Play, Pause, Speed adjustment (`0.1s`, `0.25s`, `0.5s`, `1s`, `2s`), and manual Step-Forward.
  - Hotkey support: `Space` for Play/Pause, `Shift+Right` for single-bar advance.
- **Interactive Cut-Point Selection**:
  - Jump to any historical candle by clicking directly on the chart canvas or selecting a timestamp via context menu.
- **Synchronized Paper Trading Execution**:
  - Historical bars broadcast price ticks directly to the paper-trading engine during replay.
  - Pending orders, SL/TP brackets, and positions trigger and execute against replayed historical bars.

---

## 8. Institutional Alert & Notification System

- **Condition Operators**:
  - `Crossing`, `Crossing Up`, `Crossing Down`, `Greater Than`, `Less Than`.
- **Condition Triggers**:
  - Price levels.
  - Indicator crossovers (RSI overbought/oversold, MA crosses).
  - Drawing tool trendline crosses.
- **Multi-Channel Notifications**:
  - Synthesized Web Audio three-tone chime (`audioHaptics.alert()`).
  - Desktop HTML5 push notifications.
- **Draggable Alert Handles**:
  - Visual alert markers on the chart price axis that can be dragged up or down to adjust trigger levels.
- **Alerts Manager Dashboard**:
  - Active and Triggered alert tables with pause/resume, delete, notes, and trigger timestamps.

---

## 9. Institutional Overlays & Analytical Tools

- **Volume Profile (VPVR)**:
  - Visible range dynamic volume histogram calculating Point of Control (POC), Value Area High (VAH), and Value Area Low (VAL).
- **Ghost HTF Overlay**:
  - Higher-timeframe candlestick silhouettes projected semi-transparently behind lower-timeframe bars.
- **Footprint / Order Flow Chart**:
  - Real-time buy vs sell volume clustering per price tick.
- **Session OHL Laser Lines**:
  - Daily Open, High, and Low projected lines.
- **Candle Countdown Timer**:
  - Floating timer displaying exact minutes and seconds remaining in current bar.
- **Sticky Notes Overlay**:
  - Pin markdown trade notes directly to specific bars on the chart.
- **Risk Sizing HUD**:
  - 1-click position sizing widget computing lot size based on % account risk and stop-loss distance.

---

## 10. Watchlist & Flagging System

- **Multiple Custom Watchlists**:
  - Create, rename, delete, and switch between custom asset lists.
- **5-Color Flagging System**:
  - Tag symbols with Red, Blue, Green, Orange, or Purple color dots.
  - Filter active watchlist by color flag.
- **Keyboard Navigation**:
  - Cycle through watchlist symbols with `Up` and `Down` arrow keys.
- **24-Hour Market Metrics**:
  - Real-time price change, percentage change, and volume indicators.

---

## 11. Design System & Customization

- **Claymorphic Black & White Aesthetic**:
  - Tactile, modern dark/light UI with custom CSS claymorphism (`clay-btn`, `clay-card`, `clay-pill`, `clay-popover`).
- **Zen Mode**:
  - Distraction-free trading mode hiding secondary panels and rendering soft pastel candles.
- **Wallpaper & Skins Engine**:
  - Solid color, gradient, anime art, or video background skins for the chart canvas.
- **Watermark & Snapshot Export**:
  - Configurable chart watermark text.
  - 1-click high-resolution PNG snapshot generator with direct clipboard copy and file download.
- **Zero Emoji Compliance**:
  - 100% clean typography and financial SVG iconography across the entire application.

---

## File Architecture Mapping

```
terminal/src/
├── components/
│   ├── Chart/
│   │   ├── TradingChart.tsx              # Primary chart component with Canvas 2D overlays
│   │   ├── ChartTradingOverlay.tsx       # Draggable orders, SL/TP tags, position P&L badge
│   │   ├── MultiChartGrid.tsx            # 1x1, 1x2, 2x1, 2x2 grid engine with synced crosshairs
│   │   ├── BarReplayController.tsx       # Replay scrubber bar and playback controls
│   │   ├── ChartContextMenu.tsx          # Right-click canvas menu
│   │   ├── ChartLegendHUD.tsx            # In-chart legend with live OHLC and indicator values
│   │   ├── ChartSettingsModal.tsx        # Candle colors, scales, watermark settings
│   │   ├── IndicatorSettingsDialog.tsx   # Inputs, Style, Visibility settings
│   │   ├── IndicatorsModal.tsx           # Indicator search and selection dialog
│   │   ├── SubPaneChart.tsx              # Multi-pane oscillator charts (RSI, MACD)
│   │   ├── VolumeProfileOverlay.tsx      # Visible range VPVR overlay
│   │   ├── FootprintChartOverlay.tsx     # Order flow volume clusters
│   │   ├── CandleCountdown.tsx           # Bar close countdown timer
│   │   ├── ChartRulerOverlay.tsx         # In-chart measurement ruler
│   │   └── StickyNotesOverlay.tsx        # Candle-pinned trade notes
│   ├── drawing/
│   │   ├── DrawingToolbar.tsx            # Docked left rail with tool categories
│   │   ├── DrawingOverlay.tsx            # SVG canvas rendering 12+ vector tools
│   │   ├── FavoritesBar.tsx              # Floating quick-access favorites bar
│   │   └── framework/                    # Base DrawingTool class, hit-testing, events, undo/redo
│   ├── Trading/
│   │   ├── CreateAlertModal.tsx          # Price/indicator/drawing alert dialog
│   │   ├── AlertsTab.tsx                 # Alerts dashboard
│   │   └── OrderTicket.tsx               # Market/Limit/Stop order placement
│   ├── Watchlist/
│   │   └── Watchlist.tsx                 # Multi-list watchlist with 5 color flags
│   ├── Search/
│   │   └── SymbolSearchModal.tsx         # Multi-market asset search
│   └── RiskHUD.tsx                       # Position sizing calculator
├── services/
│   ├── datafeed/                         # Adapters for Binance, Forex, NSE/BSE, US Stocks
│   ├── indicators/                       # 25+ indicator calculation algorithms & registry
│   └── crosshairSyncBus.ts               # Event bus for multi-chart crosshair & range sync
├── store/
│   ├── useTerminalStore.ts               # Paper-trading engine, orders, positions, alerts
│   ├── useLayoutStore.ts                 # Multi-chart grid state, themes, sync toggles
│   ├── useIndicatorsStore.ts             # Active indicator instances, inputs, styles
│   └── useWatchlistStore.ts              # Watchlists and color flags
└── types/
    └── terminal.ts                       # Strict TypeScript interfaces
```
