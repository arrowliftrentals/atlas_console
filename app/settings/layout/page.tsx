"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutConfig,
  loadLayoutConfig,
  saveLayoutConfig,
  resetLayoutConfig,
  getAvailableCards,
  removeCard,
  moveCard,
  addRow,
  removeRow,
  reorderRow,
  SYSTEM_DEFAULT_LAYOUT,
  STORAGE_KEYS,
  CARD_MAP,
} from "@/lib/layoutConfig";

// Drag data for cross-component communication
let dragData: { cardId: string; fromRow: number } | null = null;

export default function LayoutSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<LayoutConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const originalConfigRef = useRef<string | null>(null);

  // Load config on mount
  useEffect(() => {
    const loaded = loadLayoutConfig();
    setConfig(loaded);
    originalConfigRef.current = JSON.stringify(loaded.rows);
  }, []);

  // Derive hasChanges from config comparison (no setState in effect)
  const hasChanges = useMemo(() => {
    if (!config || !originalConfigRef.current) return false;
    return JSON.stringify(config.rows) !== originalConfigRef.current;
  }, [config]);

  // Show loading state while config loads
  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#111118] to-[#0a0a0f] text-white p-8 flex items-center justify-center">
        <div className="text-white/50">Loading layout configuration...</div>
      </div>
    );
  }

  // All handlers below this point can safely assume config is non-null
  const handleApply = () => {
    saveLayoutConfig(config);
    // Clear runtime layout so dashboard picks up new defaults
    localStorage.removeItem(STORAGE_KEYS.LAYOUT_RUNTIME);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    resetLayoutConfig();
    setConfig(SYSTEM_DEFAULT_LAYOUT);
  };

  const handleAddRow = () => {
    setConfig(addRow(config));
  };

  const handleRemoveRow = (rowIndex: number) => {
    setConfig(removeRow(config, rowIndex));
  };

  const handleRemoveCard = (cardId: string) => {
    setConfig(removeCard(config, cardId));
  };

  const handleDragStart = (cardId: string, fromRow: number) => {
    dragData = { cardId, fromRow };
  };

  const handleDragEnd = () => {
    dragData = null;
  };

  const handleDropOnRow = (rowIndex: number, position?: number) => {
    if (!dragData) return;
    const pos = position ?? config.rows[rowIndex]?.length ?? 0;
    setConfig(moveCard(config, dragData.cardId, rowIndex, pos));
    dragData = null;
  };

  const handleDropOnAvailable = () => {
    if (!dragData) return;
    setConfig(removeCard(config, dragData.cardId));
    dragData = null;
  };

  const handleReorderRow = (rowIndex: number, newOrder: string[]) => {
    setConfig(reorderRow(config, rowIndex, newOrder));
  };

  const availableCards = getAvailableCards(config);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#111118] to-[#0a0a0f] text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Layout Configuration</h1>
            <p className="text-white/50 text-sm mt-1">
              Drag cards between rows to customize your dashboard layout
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-sm text-white/70 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Rows */}
        <div className="space-y-6 mb-8">
          {config.rows.map((row, rowIndex) => (
            <RowEditor
              key={rowIndex}
              rowIndex={rowIndex}
              cardIds={row}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDropOnRow}
              onRemoveCard={handleRemoveCard}
              onRemoveRow={handleRemoveRow}
              onReorder={handleReorderRow}
              canRemove={row.length === 0 && config.rows.length > 1}
            />
          ))}

          {/* Add Row Button */}
          <button
            onClick={handleAddRow}
            className="w-full py-4 border-2 border-dashed border-white/20 rounded-xl text-white/40 hover:text-white/70 hover:border-white/40 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Row
          </button>
        </div>

        {/* Available Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 text-white/70">Available Cards</h2>
          <div
            className="min-h-[80px] p-4 border-2 border-dashed border-white/20 rounded-xl flex flex-wrap gap-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropOnAvailable}
          >
            {availableCards.length === 0 ? (
              <p className="text-white/30 text-sm">All cards are in the layout. Drag cards here to remove them.</p>
            ) : (
              availableCards.map((card) => (
                <CardChip
                  key={card.id}
                  cardId={card.id}
                  label={card.label}
                  fromRow={-1}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-white/10">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Reset to System Default
          </button>
          
          <div className="flex items-center gap-4">
            {hasChanges && (
              <span className="text-yellow-400 text-sm">Unsaved changes</span>
            )}
            <button
              onClick={handleApply}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                saved
                  ? "bg-green-500/20 text-green-400"
                  : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              }`}
            >
              {saved ? "✓ Applied" : "Apply as Default"}
            </button>
          </div>
        </div>

        {/* Info */}
        <p className="text-white/30 text-xs mt-8 text-center">
          After applying, go to the Dashboard to fine-tune sizes and positions, then use "Save Layout" to preserve refinements.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// ROW EDITOR COMPONENT
// =============================================================================

interface RowEditorProps {
  rowIndex: number;
  cardIds: string[];
  onDragStart: (cardId: string, fromRow: number) => void;
  onDragEnd: () => void;
  onDrop: (rowIndex: number, position?: number) => void;
  onRemoveCard: (cardId: string) => void;
  onRemoveRow: (rowIndex: number) => void;
  onReorder: (rowIndex: number, newOrder: string[]) => void;
  canRemove: boolean;
}

function RowEditor({
  rowIndex,
  cardIds,
  onDragStart,
  onDragEnd,
  onDrop,
  onRemoveCard,
  onRemoveRow,
  onReorder,
  canRemove,
}: RowEditorProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(rowIndex, index);
    setDragOverIndex(null);
  };

  const handleRowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(rowIndex, cardIds.length);
    setDragOverIndex(null);
  };

  return (
    <div className="relative">
      {/* Row Label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/50">Row {rowIndex + 1}</span>
        {canRemove && (
          <button
            onClick={() => onRemoveRow(rowIndex)}
            className="text-xs text-red-400/50 hover:text-red-400 transition-colors"
          >
            Remove Row
          </button>
        )}
      </div>

      {/* Card Container */}
      <div
        className="min-h-[80px] p-4 bg-white/5 border border-white/10 rounded-xl flex flex-wrap gap-3 items-start"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleRowDrop}
      >
        {cardIds.length === 0 ? (
          <p className="text-white/30 text-sm">Drag cards here</p>
        ) : (
          cardIds.map((cardId, index) => (
            <React.Fragment key={cardId}>
              {/* Drop indicator */}
              {dragOverIndex === index && (
                <div className="w-1 h-16 bg-blue-500 rounded-full" />
              )}
              <CardChip
                cardId={cardId}
                label={CARD_MAP[cardId]?.label || cardId}
                fromRow={rowIndex}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onRemove={() => onRemoveCard(cardId)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              />
            </React.Fragment>
          ))
        )}
        {/* Drop indicator at end */}
        {dragOverIndex === cardIds.length && (
          <div className="w-1 h-16 bg-blue-500 rounded-full" />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CARD CHIP COMPONENT
// =============================================================================

interface CardChipProps {
  cardId: string;
  label: string;
  fromRow: number;
  onDragStart: (cardId: string, fromRow: number) => void;
  onDragEnd: () => void;
  onRemove?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

function CardChip({
  cardId,
  label,
  fromRow,
  onDragStart,
  onDragEnd,
  onRemove,
  onDragOver,
  onDragLeave,
  onDrop,
}: CardChipProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(cardId, fromRow)}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="group relative px-4 py-3 bg-white/10 border border-white/20 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/15 transition-colors"
    >
      <span className="text-sm font-medium">{label}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500/80 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          ×
        </button>
      )}
    </div>
  );
}
