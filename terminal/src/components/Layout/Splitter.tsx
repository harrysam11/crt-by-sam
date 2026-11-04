import { useRef } from 'react';

/** Drag handle. dir 'v' resizes horizontally (vertical bar), 'h' resizes vertically. */
export default function Splitter({ dir, onDrag }: { dir: 'v' | 'h'; onDrag: (delta: number) => void }) {
  const last = useRef<number | null>(null);
  const pos = (e: React.PointerEvent) => (dir === 'v' ? e.clientX : e.clientY);
  return (
    <div
      role="separator"
      aria-orientation={dir === 'v' ? 'vertical' : 'horizontal'}
      className={`shrink-0 bg-grid transition-colors hover:bg-accent ${dir === 'v' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}`}
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); last.current = pos(e); }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const p = pos(e);
        onDrag(p - last.current);
        last.current = p;
      }}
      onPointerUp={() => { last.current = null; }}
      onPointerCancel={() => { last.current = null; }}
    />
  );
}
