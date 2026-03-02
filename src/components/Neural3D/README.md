# Atlas Neural 3D Visualization V2

Complete reimplementation of the Atlas Neural 3D Visualization with performance optimizations, instanced rendering, and hierarchical layout.

## Overview

V2 is a ground-up redesign focused on:
- **Performance**: 90-120 FPS target with 10K nodes and 50K particles
- **Instanced Rendering**: Single draw call for all nodes, edges, and particles
- **Hierarchical Layout**: Ring-based subsystem organization matching spec
- **Modular Architecture**: Clean separation of concerns for maintainability

## Architecture

### Core Principles

1. **Instanced Rendering**: Uses Three.js `InstancedMesh` for nodes, edges, and particles
   - Nodes: Single geometry with per-instance transforms and colors
   - Edges: Instanced cylinders oriented along connections
   - Particles: Fixed 50K pool with efficient recycling

2. **Hierarchical Layout**: Ring-based spatial organization
   - Ring 0 (center): LLM Core
   - Ring 1: Working/Long-term Memory
   - Ring 2: Vector DB, Embedding Pipeline
   - Ring 3: Plugin Agents, Internal Services
   - Ring 4: I/O Interfaces, External Dependencies
   - Background Layer (z<0): Background Processes

3. **State Management**: Zustand store for centralized telemetry state
   - Decoupled from React rendering
   - Efficient updates without re-renders
   - Automatic activity decay

## File Structure

```
components/Neural3D/
├── NeuralArchitecture3DV2.tsx       # Main scene entrypoint
│
├── Data & Telemetry
├── NeuralTelemetryTypesV2.ts        # Type definitions
├── NeuralTelemetryStoreV2.ts        # Zustand state store
├── NeuralTelemetryUtilsV2.ts        # Event processing utilities
│
├── Layout & Rendering
├── NeuralLayoutEngineV2.ts          # Ring-based layout algorithm
├── NeuralVisualEncodingV2.ts        # Color palettes and mappings
├── NeuralNodesInstancedV2.tsx       # Instanced node rendering
├── NeuralEdgesInstancedV2.tsx       # Instanced edge rendering
├── NeuralParticlesInstancedV2.tsx   # Instanced particle system
│
└── UI & Interaction
    ├── NeuralHUDV2.tsx              # Overlay UI and stats
    └── README.md                     # This file
```

## Usage

```tsx
import NeuralArchitecture3DV2 from './components/Neural3D/NeuralArchitecture3DV2';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <NeuralArchitecture3DV2
        timeScale={1.0}         // Animation speed multiplier
        maxParticles={50000}    // Particle pool size
      />
    </div>
  );
}
```

## Performance Optimizations

### Instancing
- **Nodes**: Single `InstancedMesh` for all nodes (1 draw call vs N)
- **Edges**: Single `InstancedMesh` for all edges
- **Particles**: Fixed 50K pre-allocated pool with recycling

### Efficient Updates
- Per-instance matrices updated only when needed
- Color updates batched per frame
- No React component per node/edge/particle

### Layout Stability
- Deterministic positions based on node ID hash
- Small jitter for organic feel without motion
- No force simulation overhead

### Shader-Based Animation
- Breathing effect: Sinusoidal scale in shader (future enhancement)
- Glow intensity: Uniform updates, not per-node materials
- Flow animation: Shader-based edge direction (future enhancement)

## Comparison: V1 vs V2

| Feature | V1 (NeuralArchitecture3D.tsx) | V2 (Neural3D/) |
|---------|------------------------------|----------------|
| **Lines of Code** | 1427 lines (single file) | ~900 lines (modular) |
| **Node Rendering** | Individual meshes | Single `InstancedMesh` |
| **Edge Rendering** | Individual `Line` components | Single `InstancedMesh` |
| **Particle System** | Individual meshes | Fixed 50K pool |
| **Layout** | Atomic model | Hierarchical rings |
| **State Management** | React useState | Zustand store |
| **Draw Calls** | N nodes + M edges + P particles | 3 (nodes, edges, particles) |
| **Performance Target** | ~60 FPS (20 nodes, 50 particles) | 90-120 FPS (10K nodes, 50K particles) |
| **Subsystem Types** | 6 types (inferred) | 10 explicit subsystems |

## API & Telemetry

### WebSocket Connection
- Endpoint: `ws://localhost:8000/v1/telemetry/stream`
- Format: Same as V1 (active_traces with spans)
- Auto-reconnect on disconnect

### Architecture Graph
- Endpoint: `http://localhost:8000/v1/architecture/graph`
- Returns: Nodes and edges for static topology

### Event Processing
- Converts V1 trace format to V2 event schema
- Infers subsystem from node ID patterns
- Tracks bandwidth, latency, throughput

## Visual Encoding

### Node Colors by Subsystem
- **Cyan** (`#06B6D4`): LLM Core
- **Pink** (`#EC4899`): Working/Long-term Memory
- **Orange** (`#F59E0B`): Vector DB, Embedding Pipeline
- **Purple** (`#8B5CF6`): Plugin Agents
- **Green** (`#10B981`): I/O Interfaces, Internal Services
- **Gray** (`#6B7280`): External Dependencies

### Node States
- **Active**: High emissive intensity, glow visible
- **Idle**: Low intensity, dim
- **Overloaded**: Orange tint, larger glow
- **Error**: Red color
- **Blocked**: Dark red

### Edge Colors by Event Type
- **Blue**: Data transfer, agent communication
- **Green**: Memory read/write
- **Gold**: Vector retrieval, embedding ops
- **Purple**: Plugin invocation, external API
- **White**: High-priority token flow

### Particle Properties
- **Speed**: Priority-based (high=1.5x, low=0.3x)
- **Size**: Data volume (bytes → radius)
- **Color**: Event type (matches edges)

## Future Enhancements

### LOD System
- `NeuralLODManagerV2.ts`: Cluster nodes by subsystem at far zoom
- Reduce particle density based on camera distance
- Hide low-activity edges beyond threshold

### Advanced Features
- Time scrubber for historical replay
- Slow-motion mode (timeScale control)
- Heatmap overlays (activity, latency, memory)
- Node/edge selection and detail panel
- Snapshot export (PNG/SVG)

### WebGPU Integration
- `NeuralWebGPUContextV2.ts`: Detect and use WebGPU when available
- Compute shaders for particle movement
- Better handling of massive instance counts

## Development

### Prerequisites
- React 18+
- Three.js r152+
- React Three Fiber 8+
- @react-three/drei
- Zustand 4+

### Testing
```bash
# Start Atlas backend
cd atlas_core
./run_atlas

# Start console
cd atlas_console
npm run dev
```

### Debugging
- FPS counter in bottom-left
- Connection status in top-left
- Stats: node/edge/particle counts

## Credits

Designed and implemented by Claude Sonnet 4.5 in collaboration with Atlas AI, based on the "ATLAS Neural 3D Visualization – Performance Expectation & Technical Specification Document".

## License

Part of the ATLAS project.
