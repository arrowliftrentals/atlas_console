"use client";

import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";

interface FreeformItem {
  id: string;
  content: ReactNode;
  // Position as percentage of row width (0-100)
  x?: number;
  // Width as percentage of row width
  width?: number;
  // Minimum width in percentage
  minWidth?: number;
}

interface FreeformRowProps {
  items: FreeformItem[];
  height?: number | string;
  gap?: number;
  persistKey?: string;
  defaultItemWidth?: number; // Default width percentage for items
}

interface ItemPosition {
  x: number; // percentage
  width: number; // percentage
}

/**
 * A row where cards can be freely positioned horizontally.
 * - Drag cards left/right to reposition
 * - Drag edges to resize
 * - Positions persist to localStorage
 */
export default function FreeformRow({
  items,
  height = "auto",
  gap = 8,
  persistKey,
  defaultItemWidth = 100 / 3, // Default to 3 columns
}: FreeformRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate default positions (evenly distributed)
  const getDefaultPositions = useCallback((): Record<string, ItemPosition> => {
    const positions: Record<string, ItemPosition> = {};
    const itemWidth = defaultItemWidth;
    const totalGapPercent = (gap * (items.length - 1)) / 10; // Rough conversion
    const availableWidth = 100 - totalGapPercent;
    const actualWidth = availableWidth / items.length;
    
    items.forEach((item, index) => {
      positions[item.id] = {
        x: index * (actualWidth + totalGapPercent / items.length),
        width: item.width ?? actualWidth,
      };
    });
    return positions;
  }, [items, gap, defaultItemWidth]);

  const [positions, setPositions] = useState<Record<string, ItemPosition>>(getDefaultPositions);
  const [dragging, setDragging] = useState<{ id: string; type: "move" | "resize-left" | "resize-right"; startX: number; startPos: ItemPosition } | null>(null);

  // Load persisted positions
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`freeform-${persistKey}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as Record<string, ItemPosition>;
          // Validate all items exist
          const validPositions: Record<string, ItemPosition> = {};
          let hasAll = true;
          items.forEach((item) => {
            if (parsed[item.id]) {
              validPositions[item.id] = parsed[item.id];
            } else {
              hasAll = false;
            }
          });
          if (hasAll) {
            setPositions(validPositions);
          } else {
            setPositions(getDefaultPositions());
          }
        } catch {
          setPositions(getDefaultPositions());
        }
      }
    }
  }, [persistKey, items, getDefaultPositions]);

  // Save positions when they change
  useEffect(() => {
    if (persistKey && typeof window !== "undefined" && Object.keys(positions).length > 0) {
      localStorage.setItem(`freeform-${persistKey}`, JSON.stringify(positions));
    }
  }, [positions, persistKey]);

  // Handle mouse move during drag
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragging.startX;
      const deltaPercent = (deltaX / rect.width) * 100;

      setPositions((prev) => {
        const newPos = { ...prev };
        const item = newPos[dragging.id];
        if (!item) return prev;

        const minWidth = items.find((i) => i.id === dragging.id)?.minWidth ?? 15;

        if (dragging.type === "move") {
          // Move the item
          let newX = dragging.startPos.x + deltaPercent;
          // Clamp to container bounds
          newX = Math.max(0, Math.min(100 - item.width, newX));
          newPos[dragging.id] = { ...item, x: newX };
        } else if (dragging.type === "resize-left") {
          // Resize from left edge
          let newX = dragging.startPos.x + deltaPercent;
          let newWidth = dragging.startPos.width - deltaPercent;
          // Enforce minimum width
          if (newWidth < minWidth) {
            newWidth = minWidth;
            newX = dragging.startPos.x + dragging.startPos.width - minWidth;
          }
          // Clamp to container
          if (newX < 0) {
            newWidth = dragging.startPos.x + dragging.startPos.width;
            newX = 0;
          }
          newPos[dragging.id] = { x: newX, width: newWidth };
        } else if (dragging.type === "resize-right") {
          // Resize from right edge
          let newWidth = dragging.startPos.width + deltaPercent;
          // Enforce minimum width
          newWidth = Math.max(minWidth, newWidth);
          // Clamp to container
          newWidth = Math.min(100 - item.x, newWidth);
          newPos[dragging.id] = { ...item, width: newWidth };
        }

        return newPos;
      });
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, items]);

  const startDrag = (id: string, type: "move" | "resize-left" | "resize-right", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = positions[id];
    if (pos) {
      setDragging({ id, type, startX: e.clientX, startPos: { ...pos } });
    }
  };

  // Sort items by x position for rendering order
  const sortedItems = [...items].sort((a, b) => {
    const posA = positions[a.id]?.x ?? 0;
    const posB = positions[b.id]?.x ?? 0;
    return posA - posB;
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height, minHeight: 100 }}
    >
      {sortedItems.map((item) => {
        const pos = positions[item.id] || { x: 0, width: defaultItemWidth };
        const isDragging = dragging?.id === item.id;

        return (
          <div
            key={item.id}
            className={`absolute top-0 bottom-0 transition-shadow ${
              isDragging ? "z-50 shadow-2xl shadow-purple-500/20" : "z-10"
            }`}
            style={{
              left: `${pos.x}%`,
              width: `${pos.width}%`,
              transition: isDragging ? "none" : "left 0.15s ease-out, width 0.15s ease-out",
            }}
          >
            {/* Left resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 group"
              onMouseDown={(e) => startDrag(item.id, "resize-left", e)}
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500/0 group-hover:bg-purple-500/50 rounded-full transition-colors" />
            </div>

            {/* Right resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 group"
              onMouseDown={(e) => startDrag(item.id, "resize-right", e)}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500/0 group-hover:bg-purple-500/50 rounded-full transition-colors" />
            </div>

            {/* Move handle (top bar) */}
            <div
              className="absolute top-0 left-2 right-2 h-6 cursor-move z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              onMouseDown={(e) => startDrag(item.id, "move", e)}
            >
              <div className="flex gap-0.5">
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="w-1 h-1 rounded-full bg-white/30" />
              </div>
            </div>

            {/* Content */}
            <div className="h-full px-1">
              {item.content}
            </div>
          </div>
        );
      })}

      {/* Grid lines (visual guide when dragging) */}
      {dragging && (
        <div className="absolute inset-0 pointer-events-none z-0">
          {[25, 50, 75].map((pct) => (
            <div
              key={pct}
              className="absolute top-0 bottom-0 w-px bg-purple-500/20"
              style={{ left: `${pct}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Global drag state for cross-row movement
let globalDragData: { id: string; sourceRow: string; content: ReactNode } | null = null;

/**
 * Row of cards that can be dragged to reposition and resized by dragging edges.
 * - Drag card body to move it within row or to another row
 * - Drag right edge to resize width
 * - Drag bottom edge to resize height
 * - All persisted to localStorage
 */
export function FlexibleRow({
  items,
  gap = 16,
  persistKey,
  onReceiveCard,
  onRemoveCard,
}: {
  items: { id: string; content: ReactNode }[];
  gap?: number;
  persistKey?: string;
  onReceiveCard?: (id: string, content: ReactNode, fromRow: string) => void;
  onRemoveCard?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Store order, widths, and heights (in pixels)
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [cardWidths, setCardWidths] = useState<Record<string, number>>({});
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  
  // Drag state for resizing
  const [resizing, setResizing] = useState<{
    id: string;
    type: "width" | "height" | "both";
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Keep order in sync with items
  useEffect(() => {
    const itemIds = new Set(items.map(i => i.id));
    setOrder(prev => {
      const validOrder = prev.filter(id => itemIds.has(id));
      const newIds = items.filter(i => !prev.includes(i.id)).map(i => i.id);
      return [...validOrder, ...newIds];
    });
  }, [items]);

  // Initialize sizes based on container
  useEffect(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const defaultWidth = (containerWidth - gap * (items.length - 1)) / items.length;
    const defaultHeight = 420;
    
    setCardWidths((prev) => {
      const updated = { ...prev };
      items.forEach((item) => {
        if (!updated[item.id]) updated[item.id] = defaultWidth;
      });
      return updated;
    });
    setCardHeights((prev) => {
      const updated = { ...prev };
      items.forEach((item) => {
        if (!updated[item.id]) updated[item.id] = defaultHeight;
      });
      return updated;
    });
  }, [items, gap]);

  // Load from localStorage
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    const saved = localStorage.getItem(`row-${persistKey}`);
    if (saved) {
      try {
        const { order: savedOrder, widths, heights } = JSON.parse(saved);
        if (savedOrder) setOrder(savedOrder);
        if (widths) setCardWidths(widths);
        if (heights) setCardHeights(heights);
      } catch { /* ignore */ }
    }
  }, [persistKey]);

  // Save to localStorage
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    localStorage.setItem(`row-${persistKey}`, JSON.stringify({ 
      order, 
      widths: cardWidths,
      heights: cardHeights 
    }));
  }, [persistKey, order, cardWidths, cardHeights]);

  // Handle resize drag
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      if (resizing.type === "width" || resizing.type === "both") {
        const newWidth = Math.max(150, resizing.startWidth + deltaX);
        setCardWidths((prev) => ({ ...prev, [resizing.id]: newWidth }));
      }
      if (resizing.type === "height" || resizing.type === "both") {
        const newHeight = Math.max(150, resizing.startHeight + deltaY);
        setCardHeights((prev) => ({ ...prev, [resizing.id]: newHeight }));
      }
    };

    const handleMouseUp = () => setResizing(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing]);

  // Reorder via HTML5 drag (within row and cross-row)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [isDragOverRow, setIsDragOverRow] = useState(false);

  const onDragStart = (e: React.DragEvent, id: string, content: ReactNode) => {
    globalDragData = { id, sourceRow: persistKey || "", content };
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, idx?: number) => {
    e.preventDefault();
    if (idx !== undefined) setDragOverIdx(idx);
    setIsDragOverRow(true);
  };

  const onDrop = (e: React.DragEvent, idx?: number) => {
    e.preventDefault();
    
    if (!globalDragData) return;
    
    const { id, sourceRow, content } = globalDragData;
    const targetIdx = idx ?? order.length;
    
    if (sourceRow === persistKey) {
      // Same row - just reorder
      const srcIdx = order.indexOf(id);
      if (srcIdx !== -1 && srcIdx !== targetIdx) {
        setOrder((prev) => {
          const newOrder = [...prev];
          newOrder.splice(srcIdx, 1);
          const insertIdx = targetIdx > srcIdx ? targetIdx - 1 : targetIdx;
          newOrder.splice(insertIdx, 0, id);
          return newOrder;
        });
      }
    } else {
      // Cross-row movement
      if (onReceiveCard) {
        onReceiveCard(id, content, sourceRow);
        setOrder((prev) => {
          const newOrder = [...prev];
          newOrder.splice(targetIdx, 0, id);
          return newOrder;
        });
      }
    }
    
    globalDragData = null;
    setDragOverIdx(null);
    setIsDragOverRow(false);
  };

  const onDragEnd = () => {
    // If dropped on different row, remove from this row
    if (globalDragData && globalDragData.sourceRow === persistKey && onRemoveCard) {
      // Check if it was dropped somewhere else (globalDragData would be cleared)
    }
    setDragOverIdx(null);
    setIsDragOverRow(false);
  };

  const orderedItems = order
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as typeof items;

  return (
    <div 
      ref={containerRef} 
      className={`flex items-start ${isDragOverRow ? "bg-white/5 rounded-xl" : ""}`}
      style={{ gap }}
      onDragOver={(e) => onDragOver(e)}
      onDrop={(e) => onDrop(e)}
      onDragLeave={() => setIsDragOverRow(false)}
    >
      {orderedItems.map((item, idx) => {
        const width = cardWidths[item.id] || 300;
        const height = cardHeights[item.id] || 420;
        const isResizing = resizing?.id === item.id;
        const isDragOver = dragOverIdx === idx;

        return (
          <div
            key={item.id}
            className={`relative flex-shrink-0 ${isDragOver ? "ring-2 ring-white/30 rounded-xl" : ""}`}
            style={{ 
              width, 
              height,
              transition: isResizing ? "none" : "width 0.1s, height 0.1s" 
            }}
            draggable
            onDragStart={(e) => onDragStart(e, item.id, item.content)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={(e) => { e.stopPropagation(); onDrop(e, idx); }}
            onDragEnd={onDragEnd}
          >
            {/* Content wrapper */}
            <div className="w-full h-full overflow-hidden">
              {item.content}
            </div>

            {/* Right edge - width resize */}
            <div
              className="absolute right-0 top-0 bottom-3 w-2 cursor-ew-resize z-50 hover:bg-white/10"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResizing({
                  id: item.id,
                  type: "width",
                  startX: e.clientX,
                  startY: e.clientY,
                  startWidth: width,
                  startHeight: height,
                });
              }}
            />

            {/* Bottom edge - height resize */}
            <div
              className="absolute bottom-0 left-0 right-3 h-2 cursor-ns-resize z-50 hover:bg-white/10"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResizing({
                  id: item.id,
                  type: "height",
                  startX: e.clientX,
                  startY: e.clientY,
                  startWidth: width,
                  startHeight: height,
                });
              }}
            />

            {/* Corner - both resize */}
            <div
              className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize z-50 hover:bg-white/20"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setResizing({
                  id: item.id,
                  type: "both",
                  startX: e.clientX,
                  startY: e.clientY,
                  startWidth: width,
                  startHeight: height,
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
