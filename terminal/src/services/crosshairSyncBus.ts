/**
 * Crosshair and Visible Time Range Synchronization Bus.
 * Synchronizes crosshair time cursor and range movements across multi-chart panes.
 * ZERO EMOJI POLICY strictly enforced.
 */

export interface CrosshairSyncEvent {
  sourcePaneId: string;
  time: number | null;
  price?: number | null;
}

export interface RangeSyncEvent {
  sourcePaneId: string;
  from: number;
  to: number;
}

type CrosshairCallback = (e: CrosshairSyncEvent) => void;
type RangeCallback = (e: RangeSyncEvent) => void;

class ChartSyncBus {
  private crosshairListeners = new Set<CrosshairCallback>();
  private rangeListeners = new Set<RangeCallback>();

  public emitCrosshair(e: CrosshairSyncEvent): void {
    this.crosshairListeners.forEach((fn) => fn(e));
  }

  public subscribeCrosshair(fn: CrosshairCallback): () => void {
    this.crosshairListeners.add(fn);
    return () => {
      this.crosshairListeners.delete(fn);
    };
  }

  public emitRange(e: RangeSyncEvent): void {
    this.rangeListeners.forEach((fn) => fn(e));
  }

  public subscribeRange(fn: RangeCallback): () => void {
    this.rangeListeners.add(fn);
    return () => {
      this.rangeListeners.delete(fn);
    };
  }
}

export const chartSyncBus = new ChartSyncBus();
