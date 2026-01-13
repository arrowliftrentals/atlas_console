# Memory Layer Labels (L1-L10) Added to Visualizations

## Summary

Added L1-L10 prefixes to memory node labels across all WARP console visualizations (Neural 3D and Architecture graphs).

## Changes Made

### 1. NeuralCognitiveLayoutV2.ts

**New Functions Added:**

```typescript
export function getMemoryLayerLabel(nodeId: string): string | null
```
- Detects memory layer from node ID patterns
- Returns 'L1' through 'L10' for memory nodes
- Returns null for non-memory nodes

```typescript
export function formatNodeLabel(nodeId: string, originalLabel?: string): string
```
- Formats node labels with layer prefix (e.g., "L3: sessionstore")
- Avoids duplicating prefix if already present
- Falls back to original label for non-memory nodes

**Updated Classifications:**
- L1: Working Memory (`working.*memory`, `active.*memory`)
- L2: Short-term Memory (`short.*term.*memory`, `recent.*memory`)
- L3: Episodic Memory (`episodic`, `sessionstore`)
- L4: Declarative Memory (`declarative`, `declarativefact`)
- L5: Procedural Memory (`procedural`, `proceduralskill`)
- L6: Attention Memory (`attention.*memory`, `focus.*memory`)
- L7: World State Memory (`world.*state`, `state.*memory`)
- L8: Goals Memory (`goals.*memory`, `planning.*memory`)
- L9: Social Memory (`social.*memory`, `user.*profile`)
- L10: Vector Memory (`vector.*memory`, `chroma`, `pinecone`)

### 2. NeuralTelemetryUtilsV2.ts

**Updated Node Label Assignment:**
- Line 79: `label: existing?.label || formatNodeLabel(event.source)`
- Line 102: `label: existing?.label || formatNodeLabel(event.target)`

**Import Added:**
```typescript
import { formatNodeLabel } from './NeuralCognitiveLayoutV2';
```

### 3. ArchitectureViewV2.tsx

**Updated Node Label Assignment:**
- Line 176: `label: formatNodeLabel(node.id, node.label)`

**Import Updated:**
```typescript
import { classifyNode, CognitiveRegion, formatNodeLabel } from './Neural3D/NeuralCognitiveLayoutV2';
```

## Visual Impact

### Before
```
sessionstore
episodic_memory
vectordb
memory_manager
```

### After
```
L3: sessionstore
L3: episodic_memory
L10: vectordb
L1: memory_manager
```

## Pattern Matching

The system uses flexible regex patterns to detect memory layers:

- **Word boundary matching**: `\bl3\b` matches "l3" but not "l30"
- **Semantic matching**: "working memory" → L1, "episodic" → L3
- **Generic fallback**: `session.*store` → L3, `vector` → L10

## Examples

| Node ID | Detected Layer | Label |
|---------|----------------|-------|
| `l1_working_memory` | L1 | `L1: l1_working_memory` |
| `sessionstore` | L3 | `L3: sessionstore` |
| `declarative_facts` | L4 | `L4: declarative_facts` |
| `procedural_skills` | L5 | `L5: procedural_skills` |
| `attention_tracker` | L6 | `L6: attention_tracker` |
| `world_state_manager` | L7 | `L7: world_state_manager` |
| `goals_planner` | L8 | `L8: goals_planner` |
| `user_profiles` | L9 | `L9: user_profiles` |
| `vector_memory` | L10 | `L10: vector_memory` |

## Integration Points

### Neural 3D Visualizer
- Labels automatically formatted when nodes are created from telemetry
- Displayed below each node in the 3D scene
- Billboard text follows camera for readability

### Architecture Graph (Cytoscape)
- Labels formatted when graph data is loaded from API
- Displayed in 2D graph layout
- Searchable through node selector panel

### Memory Region Shell
Memory nodes are positioned in the middle shell (radius 60) of the 3D visualization, making L1-L10 labels clearly visible in the Memory Systems region.

## Testing

To verify labels are working:

1. **Start WARP backend**:
   ```bash
   cd ~/Projects/WARP\ Ecosystem/atlas
   python3 src/api/server.py
   ```

2. **Process a command** (generates memory layer activity):
   ```bash
   # In Python
   from src.orchestrator.atlas import Atlas
   atlas = Atlas({...})
   await atlas.process_command("list applications")
   ```

3. **View in console**:
   - Open http://localhost:3000
   - Navigate to "Neural 3D" or "Architecture" tab
   - Look for nodes with "L1:", "L3:", "L10:" prefixes

## Benefits

1. **Immediate cognitive architecture visibility**: Users can instantly see which memory layer a node belongs to
2. **Consistent labeling**: Same format across all visualization types
3. **Educational**: Helps users learn the 10-layer memory architecture
4. **Debugging**: Makes it easier to track which layer is involved in data flows
5. **No breaking changes**: Original node IDs unchanged, only display labels affected

## Future Enhancements

- Color-code labels by layer (L1-L2 one color, L3-L5 another, etc.)
- Add tooltips with layer descriptions ("L3: Episodic Memory - What happened when")
- Filter visualization by memory layer
- Memory layer legend panel showing all 10 layers
