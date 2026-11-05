import type React from 'react';
import type { DrawingItem, DrawingHandle, Point2D, ToolType } from '../types';
import type { CoordinateHelper } from './CoordinateHelper';

export abstract class BaseDrawingTool {
  public id: string;
  public type: ToolType;
  public p1: Point2D;
  public p2?: Point2D;
  public p3?: Point2D;
  public points?: Point2D[];
  public color: string;
  public fillColor?: string;
  public fillOpacity?: number;
  public lineWidth: number;
  public lineStyle?: 'solid' | 'dashed' | 'dotted';
  public locked: boolean;
  public hidden: boolean;
  public zIndex: number;
  public text?: string;
  public fontSize?: number;
  public entryPrice?: number;
  public stopPrice?: number;
  public targetPrice?: number;
  public riskReward?: number;
  public templateName?: string;

  constructor(item: DrawingItem) {
    this.id = item.id;
    this.type = item.type;
    this.p1 = { ...item.p1 };
    this.p2 = item.p2 ? { ...item.p2 } : undefined;
    this.p3 = item.p3 ? { ...item.p3 } : undefined;
    this.points = item.points ? item.points.map((p) => ({ ...p })) : undefined;
    this.color = item.color || '#38bdf8';
    this.fillColor = item.fillColor;
    this.fillOpacity = item.fillOpacity !== undefined ? item.fillOpacity : 0.15;
    this.lineWidth = item.lineWidth || 2;
    this.lineStyle = item.lineStyle || 'solid';
    this.locked = !!item.locked;
    this.hidden = !!item.hidden;
    this.zIndex = item.zIndex || 0;
    this.text = item.text;
    this.fontSize = item.fontSize || 12;
    this.entryPrice = item.entryPrice;
    this.stopPrice = item.stopPrice;
    this.targetPrice = item.targetPrice;
    this.riskReward = item.riskReward;
    this.templateName = item.templateName;
  }

  // Abstract methods to implement in specific tool classes
  abstract renderSVG(
    isSelected: boolean,
    isHovered: boolean,
    coord: CoordinateHelper,
    symbol: string
  ): React.ReactNode;

  abstract hitTest(x: number, y: number, coord: CoordinateHelper): boolean;

  abstract getHandles(coord: CoordinateHelper): DrawingHandle[];

  // Dragging a handle
  onDragHandle(handleId: string, point: Point2D): void {
    if (this.locked) return;
    if (handleId === 'p1') {
      this.p1 = { ...point };
    } else if (handleId === 'p2') {
      this.p2 = { ...point };
    } else if (handleId === 'p3') {
      this.p3 = { ...point };
    }
  }

  // Move entire drawing by delta price & delta time
  onTranslate(deltaPrice: number, deltaTime: number): void {
    if (this.locked) return;
    this.p1.price += deltaPrice;
    if (this.p1.time !== undefined && deltaTime) this.p1.time += deltaTime;

    if (this.p2) {
      this.p2.price += deltaPrice;
      if (this.p2.time !== undefined && deltaTime) this.p2.time += deltaTime;
    }
    if (this.p3) {
      this.p3.price += deltaPrice;
      if (this.p3.time !== undefined && deltaTime) this.p3.time += deltaTime;
    }
    if (this.points) {
      this.points = this.points.map((p) => ({
        ...p,
        price: p.price + deltaPrice,
        time: p.time !== undefined ? p.time + deltaTime : undefined,
      }));
    }
    if (this.entryPrice !== undefined) this.entryPrice += deltaPrice;
    if (this.stopPrice !== undefined) this.stopPrice += deltaPrice;
    if (this.targetPrice !== undefined) this.targetPrice += deltaPrice;
  }

  applyPatch(patch: Partial<DrawingItem>): void {
    Object.assign(this, patch);
  }

  abstract clone(): BaseDrawingTool;

  toJSON(): DrawingItem {
    return {
      id: this.id,
      type: this.type,
      p1: { ...this.p1 },
      p2: this.p2 ? { ...this.p2 } : undefined,
      p3: this.p3 ? { ...this.p3 } : undefined,
      points: this.points ? this.points.map((p) => ({ ...p })) : undefined,
      color: this.color,
      fillColor: this.fillColor,
      fillOpacity: this.fillOpacity,
      lineWidth: this.lineWidth,
      lineStyle: this.lineStyle,
      locked: this.locked,
      hidden: this.hidden,
      zIndex: this.zIndex,
      text: this.text,
      fontSize: this.fontSize,
      entryPrice: this.entryPrice,
      stopPrice: this.stopPrice,
      targetPrice: this.targetPrice,
      riskReward: this.riskReward,
      templateName: this.templateName,
    };
  }
}
