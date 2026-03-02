
import React, { useState, useEffect, useRef, ReactNode } from "react";

export interface DashboardCardItem {
  id: string;
  content: ReactNode;
}

interface CardLayout {
  row: number;
  order: number;
  width: number;
  height: number;
}

// Global drag state for cross-row movement
let dragData: { id: string } | null = null;

interface DashboardGridProps {
  cards: DashboardCardItem[];
  defaultRows?: string[][];  // Default card distribution: [[card ids for row 0], [card ids for row 1], ...]
  gap?: number;
  persistKey?: string;
}

// Helper to build initial layout from defaultRows
function buildInitialLayouts(
  defaultRows: string[][],
  cards: DashboardCardItem[]
): Record<string, CardLayout> {
  const initial: Record<string, CardLayout> = {};
  defaultRows.forEach((rowIds, rowIdx) => {
    rowIds.forEach((id, order) => {
      initial[id] = { row: rowIdx, order, width: 400, height: 420 };
    });
  });
  // Any cards not in defaultRows go to row 0
  cards.forEach((card, idx) => {
    if (!initial[card.id]) {
      initial[card.id] = { row: 0, order: idx + 100, width: 400, height: 420 };
    }
  });
  return initial;
}

export default function DashboardGrid({
  cards,
  defaultRows = [],
  gap = 16,
  persistKey,
}: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track whether we've mounted (for hydration safety)
  const [mounted, setMounted] = useState(false);
  
  // Layout state: which row each card is in, its order, width, height
  // Initialize with empty object to avoid hydration mismatch, then populate on mount
  const [layouts, setLayouts] = useState<Record<string, CardLayout>>({});

  // Resize state
  const [resizing, setResizing] = useState<{
    id: string;
    type: "width" | "height" | "both";
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Drag over state
  const [dragOverRow, setDragOverRow] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Initialize layouts on mount (client-side only to avoid hydration mismatch)
  useEffect(() => {
    setMounted(true);
    
    // Build initial layouts from defaultRows
    const initial = buildInitialLayouts(defaultRows, cards);
    
    // Merge with saved layouts from localStorage
    if (persistKey) {
      const saved = localStorage.getItem(`dashboard-grid-${persistKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            Object.keys(parsed).forEach(id => {
              if (cards.some(c => c.id === id)) {
                initial[id] = { ...initial[id], ...parsed[id] };
              }
            });
          }
        } catch { /* ignore */ }
      }
    }
    
    setLayouts(initial);
  }, [defaultRows, cards, persistKey]);

  // Save to localStorage (only after mount to avoid overwriting with empty object)
  useEffect(() => {
    if (!persistKey || typeof window === "undefined" || !mounted) return;
    // Don't save empty layouts - this would overwrite valid saved data
    if (Object.keys(layouts).length === 0) return;
    localStorage.setItem(`dashboard-grid-${persistKey}`, JSON.stringify(layouts));
  }, [persistKey, layouts, mounted]);

  // Handle resize
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      setLayouts(prev => {
        const layout = prev[resizing.id];
        if (!layout) return prev;

        const updated = { ...layout };
        if (resizing.type === "width" || resizing.type === "both") {
          updated.width = Math.max(200, resizing.startWidth + deltaX);
        }
        if (resizing.type === "height" || resizing.type === "both") {
          updated.height = Math.max(150, resizing.startHeight + deltaY);
        }
        return { ...prev, [resizing.id]: updated };
      });
    };

    const handleMouseUp = () => setResizing(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // Show loading state until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-white/40 text-sm animate-pulse">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  // Group cards by row
  const rowCount = Math.max(3, ...Object.values(layouts).map(l => l.row + 1));
  const rows: DashboardCardItem[][] = Array.from({ length: rowCount }, () => []);
  
  cards.forEach(card => {
    const layout = layouts[card.id];
    if (layout) {
      rows[layout.row] = rows[layout.row] || [];
      rows[layout.row].push(card);
    }
  });

  // Sort each row by order
  rows.forEach(row => {
    row.sort((a, b) => (layouts[a.id]?.order ?? 0) - (layouts[b.id]?.order ?? 0));
  });

  // Drag handlers
  const onDragStart = (e: React.DragEvent, id: string) => {
    dragData = { id };
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, rowIdx: number, targetId?: string) => {
    e.preventDefault();
    setDragOverRow(rowIdx);
    if (targetId) setDragOverId(targetId);
  };

  const onDragLeave = () => {
    setDragOverRow(null);
    setDragOverId(null);
  };

  const onDrop = (e: React.DragEvent, rowIdx: number, targetId?: string) => {
    e.preventDefault();
    
    if (!dragData) return;
    
    const { id: srcId } = dragData;
    const srcLayout = layouts[srcId];
    if (!srcLayout) return;

    setLayouts(prev => {
      const updated = { ...prev };
      
      // Get cards in target row sorted by order
      const targetRowCards = cards
        .filter(c => updated[c.id]?.row === rowIdx)
        .sort((a, b) => (updated[a.id]?.order ?? 0) - (updated[b.id]?.order ?? 0));

      // Calculate new order
      let newOrder: number;
      if (targetId && targetId !== srcId) {
        const targetIdx = targetRowCards.findIndex(c => c.id === targetId);
        const targetOrder = updated[targetId]?.order ?? 0;
        newOrder = targetOrder;
        // Shift other cards
        targetRowCards.forEach((c, idx) => {
          if (idx >= targetIdx && c.id !== srcId) {
            updated[c.id] = { ...updated[c.id], order: updated[c.id].order + 1 };
          }
        });
      } else {
        // Drop at end of row
        const maxOrder = Math.max(0, ...targetRowCards.map(c => updated[c.id]?.order ?? 0));
        newOrder = maxOrder + 1;
      }

      updated[srcId] = { ...updated[srcId], row: rowIdx, order: newOrder };
      
      return updated;
    });

    dragData = null;
    setDragOverRow(null);
    setDragOverId(null);
  };

  const onDragEnd = () => {
    dragData = null;
    setDragOverRow(null);
    setDragOverId(null);
  };

  const startResize = (id: string, type: "width" | "height" | "both", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const layout = layouts[id];
    if (!layout) return;
    setResizing({
      id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: layout.width,
      startHeight: layout.height,
    });
  };

  return (
    <div ref={containerRef} className="space-y-4">
      {rows.map((rowCards, rowIdx) => (
        <div
          key={rowIdx}
          className={`flex items-start min-h-[100px] rounded-xl transition-colors ${
            dragOverRow === rowIdx ? "bg-white/5" : ""
          }`}
          style={{ gap }}
          onDragOver={(e) => onDragOver(e, rowIdx)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, rowIdx)}
        >
          {rowCards.length === 0 && (
            <div className="flex-1 h-24 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center text-white/30 text-sm">
              Drop cards here
            </div>
          )}
          {rowCards.map((card) => {
            const layout = layouts[card.id];
            const isResizing = resizing?.id === card.id;
            const isDragOver = dragOverId === card.id;

            return (
              <div
                key={card.id}
                className={`relative flex-shrink-0 ${isDragOver ? "ring-2 ring-white/40 rounded-xl" : ""}`}
                style={{
                  width: layout?.width ?? 400,
                  height: layout?.height ?? 420,
                  transition: isResizing ? "none" : "width 0.1s, height 0.1s",
                }}
                draggable
                onDragStart={(e) => onDragStart(e, card.id)}
                onDragOver={(e) => onDragOver(e, rowIdx, card.id)}
                onDrop={(e) => { e.stopPropagation(); onDrop(e, rowIdx, card.id); }}
                onDragEnd={onDragEnd}
              >
                {/* Content */}
                <div className="w-full h-full overflow-hidden">
                  {card.content}
                </div>

                {/* Right edge - width resize */}
                <div
                  className="absolute right-0 top-0 bottom-3 w-2 cursor-ew-resize z-50 hover:bg-white/10"
                  onMouseDown={(e) => startResize(card.id, "width", e)}
                />

                {/* Bottom edge - height resize */}
                <div
                  className="absolute bottom-0 left-0 right-3 h-2 cursor-ns-resize z-50 hover:bg-white/10"
                  onMouseDown={(e) => startResize(card.id, "height", e)}
                />

                {/* Corner - both resize */}
                <div
                  className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize z-50 hover:bg-white/20"
                  onMouseDown={(e) => startResize(card.id, "both", e)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
