import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CanvasOrderLine, ContractSpec, DOMLevel, FootprintCandle, GhostCandleConfig } from '../types/derivatives';

interface DerivativesState {
  // Selected derivative contract
  selectedContract: ContractSpec;
  contracts: ContractSpec[];
  leverage: number;

  // DOM & Footprint
  domLevels: DOMLevel[];
  footprintCandles: FootprintCandle[];
  isDomVisible: boolean;
  isFootprintVisible: boolean;

  // Ghost Candles
  ghostConfig: GhostCandleConfig;
  isGhostVisible: boolean;

  // Canvas Order Lines
  canvasOrderLines: CanvasOrderLine[];
  activeDragId: string | null;

  // Analytics panel visibility
  isAnalyticsVisible: boolean;

  // Actions
  setSelectedContract: (contract: ContractSpec) => void;
  setLeverage: (lev: number) => void;
  setDomLevels: (levels: DOMLevel[]) => void;
  setFootprintCandles: (candles: FootprintCandle[]) => void;
  toggleDom: () => void;
  toggleFootprint: () => void;
  toggleGhost: () => void;
  updateGhostConfig: (config: Partial<GhostCandleConfig>) => void;
  toggleAnalytics: () => void;

  // Drag-and-drop order lines
  setCanvasOrderLines: (lines: CanvasOrderLine[]) => void;
  updateCanvasOrderLine: (id: string, price: number) => void;
  setActiveDragId: (id: string | null) => void;
  initCanvasOrderLines: (currentPrice: number, side?: 'BUY' | 'SELL', qty?: number) => void;
  clearCanvasOrderLines: () => void;
}

const DEFAULT_CONTRACTS: ContractSpec[] = [
  { symbol: 'BTC-PERP', underlying: 'BTC', type: 'FUTURE', lotSize: 0.001, tickSize: 0.5, maxLeverage: 100 },
  { symbol: 'ETH-PERP', underlying: 'ETH', type: 'FUTURE', lotSize: 0.01, tickSize: 0.05, maxLeverage: 75 },
  { symbol: 'SOL-PERP', underlying: 'SOL', type: 'FUTURE', lotSize: 0.1, tickSize: 0.01, maxLeverage: 50 },
  { symbol: 'BTC-95000-C', underlying: 'BTC', type: 'CALL_OPTION', strikePrice: 95000, expiryDate: '2026-11-28', lotSize: 0.1, tickSize: 1, maxLeverage: 10 },
  { symbol: 'BTC-90000-P', underlying: 'BTC', type: 'PUT_OPTION', strikePrice: 90000, expiryDate: '2026-11-28', lotSize: 0.1, tickSize: 1, maxLeverage: 10 },
];

export const useDerivativesStore = create<DerivativesState>()(
  persist(
    (set, get) => ({
      selectedContract: DEFAULT_CONTRACTS[0],
      contracts: DEFAULT_CONTRACTS,
      leverage: 20,

      domLevels: [],
      footprintCandles: [],
      isDomVisible: false,
      isFootprintVisible: false,

      ghostConfig: {
        higherTimeframe: '1h',
        transparency: 0.22,
        showHighLowBoxes: true,
      },
      isGhostVisible: false,

      canvasOrderLines: [],
      activeDragId: null,

      isAnalyticsVisible: false,

      setSelectedContract: (contract) => set({ selectedContract: contract }),
      setLeverage: (leverage) => set({ leverage }),
      setDomLevels: (domLevels) => set({ domLevels }),
      setFootprintCandles: (footprintCandles) => set({ footprintCandles }),
      toggleDom: () => set((s) => ({ isDomVisible: !s.isDomVisible })),
      toggleFootprint: () => set((s) => ({ isFootprintVisible: !s.isFootprintVisible })),
      toggleGhost: () => set((s) => ({ isGhostVisible: !s.isGhostVisible })),
      updateGhostConfig: (patch) => set((s) => ({ ghostConfig: { ...s.ghostConfig, ...patch } })),
      toggleAnalytics: () => set((s) => ({ isAnalyticsVisible: !s.isAnalyticsVisible })),

      setCanvasOrderLines: (canvasOrderLines) => set({ canvasOrderLines }),

      updateCanvasOrderLine: (id, price) => {
        set((s) => ({
          canvasOrderLines: s.canvasOrderLines.map((line) =>
            line.id === id ? { ...line, price: Math.round(price * 100) / 100 } : line
          ),
        }));
      },

      setActiveDragId: (activeDragId) => set({ activeDragId }),

      initCanvasOrderLines: (currentPrice, side = 'BUY', qty = 0.1) => {
        if (!currentPrice || currentPrice <= 0) return;
        const tick = currentPrice * 0.01;
        const entryPrice = currentPrice;
        const slPrice = side === 'BUY' ? entryPrice - tick * 1.5 : entryPrice + tick * 1.5;
        const tpPrice = side === 'BUY' ? entryPrice + tick * 3.0 : entryPrice - tick * 3.0;

        set({
          canvasOrderLines: [
            { id: 'entry-line', type: 'ENTRY', price: entryPrice, side, qty },
            { id: 'sl-line', type: 'STOP_LOSS', price: slPrice, side, qty },
            { id: 'tp-line', type: 'TAKE_PROFIT', price: tpPrice, side, qty },
          ],
        });
      },

      clearCanvasOrderLines: () => set({ canvasOrderLines: [], activeDragId: null }),
    }),
    {
      name: 'derivatives-store',
      version: 1,
    }
  )
);
