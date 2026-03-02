
import React, { useState, useEffect, useCallback, ReactNode } from "react";

interface DraggableItem {
  id: string;
  content: ReactNode;
  // Optional span for grid layout (e.g., 2 for spanning 2 columns)
  colSpan?: number;
  rowSpan?: number;
}

interface DraggableDashboardProps {
  items: DraggableItem[];
  columns?: number;
  gap?: number;
  persistKey?: string;
  onReorder?: (newOrder: string[]) => void;
}

/**
 * A draggable dashboard grid that allows reordering cards via drag and drop.
 * Order persists to localStorage when persistKey is provided.
 */
export default function DraggableDashboard({
  items,
  columns = 3,
  gap = 16,
  persistKey,
  onReorder,
}: DraggableDashboardProps) {
  const [order, setOrder] = useState<string[]>(() => items.map((item) => item.id));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Load persisted order
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`dashboard-order-${persistKey}`);
      if (saved) {
        try {
          const savedOrder = JSON.parse(saved) as string[];
          // Validate saved order contains all current items
          const currentIds = new Set(items.map((i) => i.id));
          const validOrder = savedOrder.filter((id) => currentIds.has(id));
          // Add any new items not in saved order
          const newItems = items.filter((i) => !savedOrder.includes(i.id)).map((i) => i.id);
          if (validOrder.length > 0) {
            setOrder([...validOrder, ...newItems]);
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, [persistKey, items]);

  // Save order when it changes
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      localStorage.setItem(`dashboard-order-${persistKey}`, JSON.stringify(order));
    }
  }, [order, persistKey]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Add drag image styling
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "0.5";
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = "1";
    setDraggedId(null);
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    
    if (sourceId && sourceId !== targetId) {
      setOrder((prev) => {
        const newOrder = [...prev];
        const sourceIndex = newOrder.indexOf(sourceId);
        const targetIndex = newOrder.indexOf(targetId);
        
        if (sourceIndex !== -1 && targetIndex !== -1) {
          // Remove from source position
          newOrder.splice(sourceIndex, 1);
          // Insert at target position
          newOrder.splice(targetIndex, 0, sourceId);
        }
        
        onReorder?.(newOrder);
        return newOrder;
      });
    }
    
    setDraggedId(null);
    setDragOverId(null);
  }, [onReorder]);

  // Build ordered items
  const orderedItems = order
    .map((id) => items.find((item) => item.id === id))
    .filter(Boolean) as DraggableItem[];

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `${gap}px`,
      }}
    >
      {orderedItems.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id)}
          className={`relative transition-all duration-200 ${
            draggedId === item.id ? "scale-[0.98] z-50" : ""
          } ${
            dragOverId === item.id ? "ring-2 ring-purple-500/50 ring-offset-2 ring-offset-transparent" : ""
          }`}
          style={{
            gridColumn: item.colSpan ? `span ${item.colSpan}` : undefined,
            gridRow: item.rowSpan ? `span ${item.rowSpan}` : undefined,
            cursor: "grab",
          }}
        >
          {/* Drag indicator */}
          <div className="absolute top-2 right-2 z-10 opacity-0 hover:opacity-100 transition-opacity">
            <div className="p-1 rounded bg-white/10 backdrop-blur-sm">
              <svg className="w-4 h-4 text-white/40" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
            </div>
          </div>
          {/* Drop indicator line */}
          {dragOverId === item.id && draggedId && (
            <div className="absolute -left-2 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
          )}
          {item.content}
        </div>
      ))}
    </div>
  );
}

/**
 * Wrapper to make a single section/row of cards draggable.
 * Use this when you want to reorder cards within a specific row.
 */
export function DraggableRow({
  items,
  gap = 16,
  persistKey,
}: {
  items: DraggableItem[];
  gap?: number;
  persistKey?: string;
}) {
  return (
    <DraggableDashboard
      items={items}
      columns={items.length}
      gap={gap}
      persistKey={persistKey}
    />
  );
}
