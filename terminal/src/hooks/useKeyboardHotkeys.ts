import { useEffect } from 'react';
import { useTerminalStore } from '../store/useTerminalStore';
import { usePsychologyStore } from '../store/usePsychologyStore';
import { audioHaptics } from '../utils/notify';
import type { Timeframe } from '../types/terminal';
import { drawingEvents } from '../components/drawing/framework/DrawingEvents';

interface UseKeyboardHotkeysProps {
  onOpenCheatsheet?: () => void;
}

const TF_KEYS: Record<string, Timeframe> = {
  '1': '1m',
  '2': '5m',
  '3': '15m',
  '4': '1h',
  '5': '1d',
  'h': '1h',
  'H': '1h',
};

export function useKeyboardHotkeys({ onOpenCheatsheet }: UseKeyboardHotkeysProps = {}) {
  const symbol = useTerminalStore((s) => s.symbol);
  const positions = useTerminalStore((s) => s.positions);
  const orders = useTerminalStore((s) => s.orders);
  const setTimeframe = useTerminalStore((s) => s.setTimeframe);
  const placeOrder = useTerminalStore((s) => s.placeOrder);
  const closePosition = useTerminalStore((s) => s.closePosition);
  const closeAllPositions = useTerminalStore((s) => s.closeAllPositions);
  const cancelOrder = useTerminalStore((s) => s.cancelOrder);

  const killSwitch = usePsychologyStore((s) => s.killSwitch);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing in input fields
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Hotkey: ? -> Open Cheatsheet
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        audioHaptics.tick();
        onOpenCheatsheet?.();
        return;
      }

      // Hotkey: Ctrl+K or Cmd+K or "/" -> Quick Symbol Search modal
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
        e.preventDefault();
        audioHaptics.tick();
        const openSearch = (window as any).__openSymbolSearch;
        if (typeof openSearch === 'function') {
          openSearch();
        }
        return;
      }

      // Hotkey: Alt+R -> Auto-Scale / Reset Chart View
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        audioHaptics.tick();
        const resetScale = (window as any).__resetChartScale;
        if (typeof resetScale === 'function') {
          resetScale();
        }
        return;
      }

      // Drawing Tool Hotkeys: Alt+T (Trendline), Alt+H (Horizontal line), Alt+V (Vertical line), Alt+F (Fib)
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        audioHaptics.tick();
        drawingEvents.selectTool('TRENDLINE');
        return;
      }
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        audioHaptics.tick();
        drawingEvents.selectTool('HORIZONTAL_LINE');
        return;
      }
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        audioHaptics.tick();
        drawingEvents.selectTool('VERTICAL_LINE');
        return;
      }
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        audioHaptics.tick();
        drawingEvents.selectTool('FIBONACCI');
        return;
      }

      // Hotkey: Space / Shift+Space -> Cycle through Watchlist symbols
      if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        audioHaptics.tick();
        const cycle = (window as any).__cycleWatchlistSymbol;
        if (typeof cycle === 'function') {
          cycle(e.shiftKey ? -1 : 1);
        }
        return;
      }

      // Hotkey: Escape -> Emergency Panic Flatten
      if (e.key === 'Escape') {
        e.preventDefault();
        if (Object.keys(positions).length > 0) {
          audioHaptics.error();
          closeAllPositions();
        }
        return;
      }

      // Hotkeys: 1-5 or H -> Timeframes
      if (TF_KEYS[e.key]) {
        e.preventDefault();
        audioHaptics.tick();
        setTimeframe(TF_KEYS[e.key]);
        return;
      }

      // Hotkey: C -> Cancel All Pending Orders for Active Symbol
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        audioHaptics.tick();
        orders
          .filter((o) => o.status === 'PENDING' && o.symbol === symbol)
          .forEach((o) => cancelOrder(o.id));
        return;
      }

      // Trading hotkeys blocked when Kill-Switch is locked
      if (killSwitch.isLocked) return;

      // Hotkey: B -> Market Buy (0.01 lot)
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        audioHaptics.tick();
        placeOrder({
          symbol,
          side: 'BUY',
          type: 'MARKET',
          qty: 0.01,
          leverage: 10,
        });
        return;
      }

      // Hotkey: S -> Market Sell (0.01 lot)
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        audioHaptics.tick();
        placeOrder({
          symbol,
          side: 'SELL',
          type: 'MARKET',
          qty: 0.01,
          leverage: 10,
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    symbol,
    positions,
    orders,
    killSwitch.isLocked,
    setTimeframe,
    placeOrder,
    closePosition,
    closeAllPositions,
    cancelOrder,
    onOpenCheatsheet,
  ]);
}
