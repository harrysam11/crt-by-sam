/**
 * Deep Institutional Studies Canvas Overlay.
 * Renders Big Trades Bubbles, GEX Levels (Call Wall, Put Wall, Gamma Flip),
 * Deep Zones (Supply/Demand Order Blocks), and Effort vs Result Absorptions.
 * Hardware-accelerated Canvas 2D with 60 FPS performance and zero DOM clutter.
 * ZERO EMOJI POLICY strictly enforced.
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp } from 'lightweight-charts';
import type { Candle } from '../../types/terminal';
import { DeepStudiesEngine, type BigTradeBubble, type GexLevels, type DeepZone } from '../../services/orderflow/deepStudies';
import { fmtPrice, fmtUsd } from '../../utils/formatters';
import { useIndicatorsStore } from '../../store/useIndicatorsStore';

interface DeepStudiesOverlayProps {
  chartApi: IChartApi | null;
  seriesApi: ISeriesApi<SeriesType> | null;
  candles: Candle[];
  symbol: string;
  currentPrice: number;
  containerWidth: number;
  containerHeight: number;
}

export interface DeepStudiesSettings {
  showBigTrades: boolean;
  minBigTradeUsd: number;
  showGexLevels: boolean;
  showDeepZones: boolean;
  showEffortResult: boolean;
  bigTradeBuyColor: string;
  bigTradeSellColor: string;
  absorptionRingColor: string;
  callWallColor: string;
  putWallColor: string;
  gammaFlipColor: string;
  demandZoneColor: string;
  supplyZoneColor: string;
}

export const DEFAULT_DEEP_STUDIES_SETTINGS: DeepStudiesSettings = {
  showBigTrades: false,
  minBigTradeUsd: 5000000,
  showGexLevels: false,
  showDeepZones: false,
  showEffortResult: false,
  bigTradeBuyColor: '#22c55e',
  bigTradeSellColor: '#ef4444',
  absorptionRingColor: '#f59e0b',
  callWallColor: '#38bdf8',
  putWallColor: '#f43f5e',
  gammaFlipColor: '#fbbf24',
  demandZoneColor: 'rgba(34, 197, 94, 0.15)',
  supplyZoneColor: 'rgba(239, 68, 68, 0.15)',
};

export default function DeepStudiesOverlay({
  chartApi,
  seriesApi,
  candles,
  symbol,
  currentPrice,
  containerWidth,
  containerHeight,
}: DeepStudiesOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeInstances = useIndicatorsStore((s) => s.activeInstances);
  const isBigTradesActive = activeInstances.some((i) => i.indicatorId === 'big_trades' && i.visible);
  const isGexActive = activeInstances.some((i) => i.indicatorId === 'gex' && i.visible);
  const isZonesActive = activeInstances.some((i) => i.indicatorId === 'deep_effort' && i.visible);

  // Settings from localStorage with reset support
  const [settings, setSettings] = useState<DeepStudiesSettings>(() => {
    try {
      const stored = localStorage.getItem('crt_deep_studies_settings');
      return stored ? { ...DEFAULT_DEEP_STUDIES_SETTINGS, ...JSON.parse(stored) } : DEFAULT_DEEP_STUDIES_SETTINGS;
    } catch {
      return DEFAULT_DEEP_STUDIES_SETTINGS;
    }
  });

  const showBigTrades = isBigTradesActive || settings.showBigTrades;
  const showGex = isGexActive || settings.showGexLevels;
  const showZones = isZonesActive || settings.showDeepZones;

  const [hoveredTrade, setHoveredTrade] = useState<BigTradeBubble | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Compute studies
  const bigTrades = useMemo(() => {
    if (!showBigTrades) return [];
    return DeepStudiesEngine.calculateBigTrades(candles, settings.minBigTradeUsd);
  }, [candles, showBigTrades, settings.minBigTradeUsd]);

  const gexLevels = useMemo(() => {
    if (!showGex) return null;
    return DeepStudiesEngine.calculateGexLevels(currentPrice, symbol);
  }, [currentPrice, symbol, showGex]);

  const deepZones = useMemo(() => {
    if (!showZones) return [];
    return DeepStudiesEngine.calculateDeepZones(candles);
  }, [candles, showZones]);

  // Main 60 FPS Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !chartApi || !seriesApi || containerWidth <= 0 || containerHeight <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    const timeScale = chartApi.timeScale();

    // 1. Render Deep Zones (Supply & Demand Order Blocks)
    if (showZones) {
      for (const zone of deepZones) {
        const startX = timeScale.timeToCoordinate(zone.startTime as UTCTimestamp);
        if (startX === null || startX > containerWidth) continue;

        const endX = zone.mitigated && zone.mitigationTime
          ? timeScale.timeToCoordinate(zone.mitigationTime as UTCTimestamp) ?? containerWidth
          : containerWidth;

        const topY = seriesApi.priceToCoordinate(zone.topPrice);
        const bottomY = seriesApi.priceToCoordinate(zone.bottomPrice);
        if (topY === null || bottomY === null) continue;

        const x = Math.max(0, startX);
        const w = Math.max(8, endX - x);
        const y = Math.min(topY, bottomY);
        const h = Math.max(4, Math.abs(bottomY - topY));

        ctx.fillStyle = zone.type === 'DEMAND' ? settings.demandZoneColor : settings.supplyZoneColor;
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = zone.type === 'DEMAND' ? '#22c55e' : '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash(zone.mitigated ? [4, 4] : []);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // Label
        ctx.font = '10px monospace';
        ctx.fillStyle = zone.type === 'DEMAND' ? '#4ade80' : '#f87171';
        ctx.fillText(
          `${zone.type} ${zone.strength} [${zone.topPrice.toFixed(1)}]`,
          x + 6,
          y + 12
        );
      }
    }

    // 2. Render GEX Levels (Call Wall, Put Wall, Gamma Flip)
    if (showGex && gexLevels && gexLevels.callWallPrice > 0) {
      const levelsToDraw = [
        { label: `CALL WALL $${gexLevels.callWallPrice}`, price: gexLevels.callWallPrice, color: settings.callWallColor },
        { label: `PUT WALL $${gexLevels.putWallPrice}`, price: gexLevels.putWallPrice, color: settings.putWallColor },
        { label: `GAMMA FLIP $${gexLevels.gammaFlipPrice}`, price: gexLevels.gammaFlipPrice, color: settings.gammaFlipColor },
      ];

      for (const lvl of levelsToDraw) {
        const y = seriesApi.priceToCoordinate(lvl.price);
        if (y === null || y < 0 || y > containerHeight) continue;

        ctx.beginPath();
        ctx.strokeStyle = lvl.color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.moveTo(0, y);
        ctx.lineTo(containerWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge on right edge
        ctx.fillStyle = lvl.color;
        ctx.fillRect(containerWidth - 160, y - 9, 155, 18);
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#0a0a0f';
        ctx.fillText(lvl.label, containerWidth - 152, y + 3);
      }
    }

    // 3. Render Big Trades Bubbles
    if (showBigTrades) {
      for (const trade of bigTrades) {
        const x = timeScale.timeToCoordinate(trade.time as UTCTimestamp);
        const y = seriesApi.priceToCoordinate(trade.price);
        if (x === null || y === null || x < -20 || x > containerWidth + 20) continue;

        ctx.beginPath();
        ctx.arc(x, y, trade.radius, 0, Math.PI * 2);
        ctx.fillStyle = trade.side === 'BUY' ? settings.bigTradeBuyColor : settings.bigTradeSellColor;
        ctx.globalAlpha = 0.65;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Absorption outline ring
        if (trade.isAbsorption) {
          ctx.beginPath();
          ctx.arc(x, y, trade.radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = settings.absorptionRingColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }, [
    chartApi,
    seriesApi,
    containerWidth,
    containerHeight,
    bigTrades,
    gexLevels,
    deepZones,
    settings,
    showBigTrades,
    showGex,
    showZones,
  ]);

  if (!showBigTrades && !showGex && !showZones) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-15 overflow-hidden font-mono select-none">
      <canvas
        ref={canvasRef}
        style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}
        className="absolute inset-0 pointer-events-none"
      />
    </div>
  );
}
