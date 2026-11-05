import type { Candle } from '../../types/terminal';

export type IndicatorCategory =
  | 'Moving Averages'
  | 'Oscillators'
  | 'Technicals'
  | 'Volume & Volatility';

export interface IndicatorPlotStyle {
  id: string;
  label: string;
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  plotType: 'line' | 'histogram' | 'cross' | 'circles';
  visible: boolean;
}

export type InputValueType = number | string | boolean;

export interface IndicatorInputField {
  id: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  options?: { label: string; value: string | number }[];
  min?: number;
  max?: number;
  step?: number;
  default: InputValueType;
}

export interface IndicatorPlotPoint {
  time: number;
  value: number | null;
  color?: string;
}

export interface IndicatorCalculationResult {
  plots: Record<string, IndicatorPlotPoint[]>;
  bands?: {
    upperId: string;
    lowerId: string;
    fillColor: string;
  }[];
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  shortName: string;
  category: IndicatorCategory;
  overlay: boolean; // true = main chart price pane, false = sub-pane below
  description: string;
  inputs: IndicatorInputField[];
  defaultStyles: Record<string, IndicatorPlotStyle>;
  calculate: (
    candles: Candle[],
    inputs: Record<string, InputValueType>
  ) => IndicatorCalculationResult;
}

export interface ActiveIndicatorInstance {
  instanceId: string;
  indicatorId: string;
  name: string;
  overlay: boolean;
  inputs: Record<string, InputValueType>;
  styles: Record<string, IndicatorPlotStyle>;
  visible: boolean;
  paneIndex: number; // 0 = main chart, 1+ = subpanes
}
