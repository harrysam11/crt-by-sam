import type { ToolType } from '../types';

type DrawingEventListener = () => void;
type ToolSelectListener = (tool: ToolType) => void;

class DrawingEventEmitter {
  private undoListeners = new Set<DrawingEventListener>();
  private redoListeners = new Set<DrawingEventListener>();
  private clearListeners = new Set<DrawingEventListener>();
  private toolSelectListeners = new Set<ToolSelectListener>();

  onUndo(fn: DrawingEventListener): () => void {
    this.undoListeners.add(fn);
    return () => this.undoListeners.delete(fn);
  }

  onRedo(fn: DrawingEventListener): () => void {
    this.redoListeners.add(fn);
    return () => this.redoListeners.delete(fn);
  }

  onClear(fn: DrawingEventListener): () => void {
    this.clearListeners.add(fn);
    return () => this.clearListeners.delete(fn);
  }

  onSelectTool(fn: ToolSelectListener): () => void {
    this.toolSelectListeners.add(fn);
    return () => this.toolSelectListeners.delete(fn);
  }

  undo(): void {
    this.undoListeners.forEach((fn) => fn());
  }

  redo(): void {
    this.redoListeners.forEach((fn) => fn());
  }

  clear(): void {
    this.clearListeners.forEach((fn) => fn());
  }

  selectTool(tool: ToolType): void {
    this.toolSelectListeners.forEach((fn) => fn(tool));
  }
}

export const drawingEvents = new DrawingEventEmitter();
