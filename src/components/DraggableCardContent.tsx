
import React, { useState, useRef, useEffect, useCallback } from "react";

interface DraggableItem {
  id: string;
  content: React.ReactNode;
  width?: string; // e.g., "1fr", "200px", "auto"
}

interface DraggableCardContentProps {
  items: DraggableItem[];
  onReorder?: (items: DraggableItem[]) => void;
  gap?: number;
  direction?: "horizontal" | "vertical";
  persistKey?: string; // localStorage key for persisting order
}

export default function DraggableCardContent({
  items: initialItems,
  onReorder,
  gap = 12,
  direction = "horizontal",
  persistKey,
}: DraggableCardContentProps) {
  const [items, setItems] = useState<DraggableItem[]>(initialItems);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load persisted order on mount
  useEffect(() => {
    if (persistKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`draggable-order-${persistKey}`);
      if (saved) {
        try {
          const savedOrder = JSON.parse(saved) as string[];
          const reorderedItems = savedOrder
            .map((id) => initialItems.find((item) => item.id === id))
            .filter(Boolean) as DraggableItem[];
          // Add any new items not in saved order
          const newItems = initialItems.filter(
            (item) => !savedOrder.includes(item.id)
          );
          setItems([...reorderedItems, ...newItems]);
        } catch {
          setItems(initialItems);
        }
      }
    }
  }, [persistKey, initialItems]);

  // Save order when it changes
  const saveOrder = useCallback(
    (newItems: DraggableItem[]) => {
      if (persistKey && typeof window !== "undefined") {
        localStorage.setItem(
          `draggable-order-${persistKey}`,
          JSON.stringify(newItems.map((item) => item.id))
        );
      }
    },
    [persistKey]
  );

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    // Add drag styling
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    setDragOverId(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== draggedId) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = items.findIndex((item) => item.id === draggedId);
    const targetIndex = items.findIndex((item) => item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    setItems(newItems);
    saveOrder(newItems);
    onReorder?.(newItems);
    setDraggedId(null);
    setDragOverId(null);
  };

  const isHorizontal = direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? "flex-row" : "flex-col"} w-full`}
      style={{ gap: `${gap}px` }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, item.id)}
          className={`
            relative cursor-grab active:cursor-grabbing
            transition-all duration-200 ease-out
            ${dragOverId === item.id ? "scale-105" : ""}
            ${draggedId === item.id ? "opacity-50" : "opacity-100"}
          `}
          style={{
            flex: item.width || "1",
            minWidth: isHorizontal ? "0" : undefined,
          }}
        >
          {/* Drag indicator */}
          <div
            className={`
              absolute ${isHorizontal ? "left-0 top-0 bottom-0 w-1" : "top-0 left-0 right-0 h-1"}
              bg-purple-500 rounded-full opacity-0 transition-opacity
              ${dragOverId === item.id ? "opacity-100" : ""}
            `}
          />
          {/* Drag handle overlay (shows on hover) */}
          <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
            <div
              className={`
                absolute ${isHorizontal ? "left-1 top-1/2 -translate-y-1/2" : "top-1 left-1/2 -translate-x-1/2"}
                w-4 h-4 flex items-center justify-center
                bg-white/10 rounded
              `}
            >
              <svg
                className="w-3 h-3 text-white/40"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
              </svg>
            </div>
          </div>
          {item.content}
        </div>
      ))}
    </div>
  );
}

// Simpler version: just allows reordering via drag handles
interface SimpleDraggableProps {
  children: React.ReactNode[];
  onReorder?: (indices: number[]) => void;
  direction?: "horizontal" | "vertical";
  gap?: number;
}

export function SimpleDraggable({
  children,
  onReorder,
  direction = "horizontal",
  gap = 8,
}: SimpleDraggableProps) {
  const [order, setOrder] = useState<number[]>(
    children.map((_, i) => i)
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newOrder = [...order];
    const draggedOrderIndex = newOrder.indexOf(draggedIndex);
    const targetOrderIndex = newOrder.indexOf(targetIndex);

    newOrder.splice(draggedOrderIndex, 1);
    newOrder.splice(targetOrderIndex, 0, draggedIndex);

    setOrder(newOrder);
    onReorder?.(newOrder);
    setDraggedIndex(null);
  };

  const isHorizontal = direction === "horizontal";

  return (
    <div
      className={`flex ${isHorizontal ? "flex-row" : "flex-col"}`}
      style={{ gap: `${gap}px` }}
    >
      {order.map((originalIndex) => (
        <div
          key={originalIndex}
          draggable
          onDragStart={() => handleDragStart(originalIndex)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(originalIndex)}
          className="cursor-grab active:cursor-grabbing"
        >
          {children[originalIndex]}
        </div>
      ))}
    </div>
  );
}
