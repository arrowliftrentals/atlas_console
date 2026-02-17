/**
 * Layout Configuration - Types and storage utilities for dashboard layout management.
 * 
 * Storage hierarchy:
 * 1. layout-config-default     <- Structural defaults set from Settings page
 * 2. dashboard-grid-*-layout   <- Runtime refinements (sizes, positions)
 * 3. dashboard-grid-*-saved    <- User's explicit "Save Layout" backup
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CardConfig {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  defaultWidth?: number;
  defaultHeight?: number;
}

export interface LayoutConfig {
  version: number;
  rows: string[][];           // Card IDs per row
  cardSizes: Record<string, { width: number; height: number }>;
  lastModified: string;
}

// =============================================================================
// AVAILABLE CARDS
// =============================================================================

export const AVAILABLE_CARDS: CardConfig[] = [
  // === EXISTING CARDS ===
  { id: 'cognition', label: 'Cognition', description: 'Neural organism visualization', defaultWidth: 400, defaultHeight: 420 },
  { id: 'architecture', label: 'Architecture', description: 'System component graph', defaultWidth: 400, defaultHeight: 420 },
  { id: 'memory', label: 'Memory', description: 'Memory layer status', defaultWidth: 400, defaultHeight: 420 },
  { id: 'logs', label: 'Logs', description: 'System logs viewer', defaultWidth: 400, defaultHeight: 420 },
  { id: 'tasks', label: 'Tasks', description: 'Active tasks and queue', defaultWidth: 400, defaultHeight: 420 },
  { id: 'sandbox', label: 'Sandbox', description: 'Code sandbox environment', defaultWidth: 400, defaultHeight: 420 },
  { id: 'security', label: 'Security', description: 'Security status and alerts', defaultWidth: 400, defaultHeight: 420 },
  { id: 'assessment', label: 'Assessment', description: 'System health assessment', defaultWidth: 400, defaultHeight: 420 },
  { id: 'recommendations', label: 'Recommendations', description: 'AI recommendations', defaultWidth: 400, defaultHeight: 420 },
  
  // === NEW CARDS - Performance & ML ===
  { id: 'classifier-stats', label: 'ML Classifiers', description: 'Intent/domain classifier performance, inference times, cache hit rates', defaultWidth: 400, defaultHeight: 320 },
  { id: 'learning-progress', label: 'Learning Progress', description: 'Active learning corrections, retraining status, improvement trends', defaultWidth: 400, defaultHeight: 320 },
  
  // === NEW CARDS - Telemetry & Traces ===
  { id: 'execution-traces', label: 'Execution Traces', description: 'Recent request traces with timing spans and component paths', defaultWidth: 500, defaultHeight: 380 },
  { id: 'hot-paths', label: 'Hot Paths', description: 'Most frequently executed code paths and their performance', defaultWidth: 400, defaultHeight: 320 },
  
  // === NEW CARDS - Infrastructure ===
  { id: 'database-health', label: 'Database Health', description: 'SQLite integrity, WAL checkpoint status, corruption detection', defaultWidth: 400, defaultHeight: 320 },
  { id: 'safety-stats', label: 'Safety Monitor', description: 'Blocked operations, sandbox executions, rollback counts', defaultWidth: 400, defaultHeight: 320 },
  
  // === NEW CARDS - Memory Layers Deep Dive ===
  { id: 'attention-focus', label: 'Attention Focus', description: 'Current cognitive focus targets and attention weights (L6)', defaultWidth: 400, defaultHeight: 280 },
  { id: 'goals-tracker', label: 'Goals Tracker', description: 'Active goals with progress percentages and blockers (L8)', defaultWidth: 400, defaultHeight: 380 },
  { id: 'skills-catalog', label: 'Skills Catalog', description: 'Learned procedural skills and execution success rates (L5)', defaultWidth: 400, defaultHeight: 380 },
  { id: 'world-state', label: 'World State', description: 'Current environment state and recent changes (L7)', defaultWidth: 400, defaultHeight: 320 },
  
  // === NEW CARDS - Timeline & Events ===
  { id: 'episodes-timeline', label: 'Episodes', description: 'Recent episodic events with timestamps and context (L3)', defaultWidth: 500, defaultHeight: 380 },
  { id: 'facts-knowledge', label: 'Knowledge Base', description: 'Stored facts with confidence levels (L4 Declarative)', defaultWidth: 400, defaultHeight: 380 },
];

export const CARD_MAP: Record<string, CardConfig> = Object.fromEntries(
  AVAILABLE_CARDS.map(c => [c.id, c])
);

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  /** Structural layout configuration (which cards, which rows) */
  LAYOUT_CONFIG: 'layout-config-default',
  /** Runtime layout refinements (sizes, exact positions) */
  LAYOUT_RUNTIME: 'dashboard-grid-dashboard-layout',
  /** User's saved layout backup */
  LAYOUT_SAVED: 'dashboard-grid-dashboard-layout-saved',
} as const;

// =============================================================================
// DEFAULT LAYOUT
// =============================================================================

export const SYSTEM_DEFAULT_LAYOUT: LayoutConfig = {
  version: 1,
  rows: [
    ['cognition', 'architecture'],
    ['assessment', 'sandbox', 'logs', 'tasks'],
    ['memory', 'security', 'recommendations'],
  ],
  cardSizes: {},
  lastModified: new Date().toISOString(),
};

// =============================================================================
// STORAGE FUNCTIONS
// =============================================================================

/**
 * Load layout configuration from localStorage.
 * Falls back to system default if not found.
 */
export function loadLayoutConfig(): LayoutConfig {
  if (typeof window === 'undefined') {
    return SYSTEM_DEFAULT_LAYOUT;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAYOUT_CONFIG);
    if (stored) {
      const parsed = JSON.parse(stored) as LayoutConfig;
      // Validate structure
      if (parsed.version && Array.isArray(parsed.rows)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load layout config:', e);
  }
  
  return SYSTEM_DEFAULT_LAYOUT;
}

/**
 * Save layout configuration to localStorage.
 */
export function saveLayoutConfig(config: LayoutConfig): void {
  if (typeof window === 'undefined') return;
  
  const updated: LayoutConfig = {
    ...config,
    lastModified: new Date().toISOString(),
  };
  
  localStorage.setItem(STORAGE_KEYS.LAYOUT_CONFIG, JSON.stringify(updated));
}

/**
 * Reset layout configuration to system default.
 */
export function resetLayoutConfig(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(STORAGE_KEYS.LAYOUT_CONFIG);
  localStorage.removeItem(STORAGE_KEYS.LAYOUT_RUNTIME);
}

/**
 * Get cards not currently in any row.
 */
export function getAvailableCards(config: LayoutConfig): CardConfig[] {
  const usedIds = new Set(config.rows.flat());
  return AVAILABLE_CARDS.filter(card => !usedIds.has(card.id));
}

/**
 * Convert layout config rows to DashboardGrid defaultRows format.
 */
export function configToDefaultRows(config: LayoutConfig): string[][] {
  return config.rows.filter(row => row.length > 0);
}

/**
 * Add a card to a specific row.
 */
export function addCardToRow(config: LayoutConfig, cardId: string, rowIndex: number): LayoutConfig {
  const newRows = config.rows.map((row, i) => 
    i === rowIndex ? [...row, cardId] : row
  );
  
  // Ensure the row exists
  while (newRows.length <= rowIndex) {
    newRows.push([]);
  }
  
  if (!newRows[rowIndex].includes(cardId)) {
    newRows[rowIndex] = [...newRows[rowIndex], cardId];
  }
  
  return { ...config, rows: newRows };
}

/**
 * Remove a card from all rows.
 */
export function removeCard(config: LayoutConfig, cardId: string): LayoutConfig {
  return {
    ...config,
    rows: config.rows.map(row => row.filter(id => id !== cardId)),
  };
}

/**
 * Move a card within or between rows.
 */
export function moveCard(
  config: LayoutConfig,
  cardId: string,
  toRowIndex: number,
  toPosition: number
): LayoutConfig {
  // Remove from current position
  let newRows = config.rows.map(row => row.filter(id => id !== cardId));
  
  // Ensure target row exists
  while (newRows.length <= toRowIndex) {
    newRows.push([]);
  }
  
  // Insert at new position
  newRows[toRowIndex] = [
    ...newRows[toRowIndex].slice(0, toPosition),
    cardId,
    ...newRows[toRowIndex].slice(toPosition),
  ];
  
  return { ...config, rows: newRows };
}

/**
 * Add a new empty row.
 */
export function addRow(config: LayoutConfig): LayoutConfig {
  return {
    ...config,
    rows: [...config.rows, []],
  };
}

/**
 * Remove an empty row.
 */
export function removeRow(config: LayoutConfig, rowIndex: number): LayoutConfig {
  if (config.rows[rowIndex]?.length > 0) {
    console.warn('Cannot remove non-empty row');
    return config;
  }
  
  return {
    ...config,
    rows: config.rows.filter((_, i) => i !== rowIndex),
  };
}

/**
 * Reorder cards within a row.
 */
export function reorderRow(config: LayoutConfig, rowIndex: number, newOrder: string[]): LayoutConfig {
  const newRows = [...config.rows];
  newRows[rowIndex] = newOrder;
  return { ...config, rows: newRows };
}
