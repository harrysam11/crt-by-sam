import type { ToolType, DrawingItem } from '../types';

type DrawingEventListener = () => void;
type ToolSelectListener = (tool: ToolType) => void;
type UpdateDrawingListener = (id: string, patch: Partial<DrawingItem>) => void;
type DeleteDrawingListener = (id: string) => void;
type OpenDrawingSettingsListener = (drawing: DrawingItem) => void;
type ReloadDrawingsListener = (drawings?: DrawingItem[]) => void;

class DrawingEventEmitter {
  private undoListeners = new Set<DrawingEventListener>();
  private redoListeners = new Set<DrawingEventListener>();
  private clearListeners = new Set<DrawingEventListener>();
  private toolSelectListeners = new Set<ToolSelectListener>();
  private updateDrawingListeners = new Set<UpdateDrawingListener>();
  private deleteDrawingListeners = new Set<DeleteDrawingListener>();
  private openDrawingSettingsListeners = new Set<OpenDrawingSettingsListener>();
  private reloadDrawingsListeners = new Set<ReloadDrawingsListener>();

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

  onUpdateDrawing(fn: UpdateDrawingListener): () => void {
    this.updateDrawingListeners.add(fn);
    return () => this.updateDrawingListeners.delete(fn);
  }

  onDeleteDrawing(fn: DeleteDrawingListener): () => void {
    this.deleteDrawingListeners.add(fn);
    return () => this.deleteDrawingListeners.delete(fn);
  }

  onOpenDrawingSettings(fn: OpenDrawingSettingsListener): () => void {
    this.openDrawingSettingsListeners.add(fn);
    return () => this.openDrawingSettingsListeners.delete(fn);
  }

  onReloadDrawings(fn: ReloadDrawingsListener): () => void {
    this.reloadDrawingsListeners.add(fn);
    return () => this.reloadDrawingsListeners.delete(fn);
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

  emitUpdateDrawing(id: string, patch: Partial<DrawingItem>): void {
    this.updateDrawingListeners.forEach((fn) => fn(id, patch));
  }

  emitDeleteDrawing(id: string): void {
    this.deleteDrawingListeners.forEach((fn) => fn(id));
  }

  emitOpenDrawingSettings(drawing: DrawingItem): void {
    this.openDrawingSettingsListeners.forEach((fn) => fn(drawing));
  }

  emitReloadDrawings(drawings?: DrawingItem[]): void {
    this.reloadDrawingsListeners.forEach((fn) => fn(drawings));
  }
}

export const drawingEvents = new DrawingEventEmitter();
