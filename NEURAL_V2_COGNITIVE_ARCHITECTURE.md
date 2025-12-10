# ATLAS Neural 3D Visualizer V2 - Cognitive Architecture Layout

## Overview

The V2 visualizer now implements a **cognitively accurate 3D layout** that mirrors ATLAS's actual information processing architecture. Instead of an arbitrary force-directed layout, nodes are organized into three concentric spherical shells representing the three major cognitive regions:

1. **Core Control & Reasoning** (innermost sphere, ~20 unit radius)
2. **Memory Systems** (middle shell, ~60 unit radius)
3. **Perception, Tools & Environment** (outer shell, ~100 unit radius)

This layout makes the visualization **semantically meaningful** - the physical distance and position of nodes reflects their role in the cognitive architecture.

---

## Three Cognitive Regions

### 1. Core Control & Reasoning (Gold - #FFD700)

**Location**: Tight central sphere at the origin

**Contains**:
- `CoreLoop` / `LoopPhases` (geometric center)
- `AgentProfile`
- `ReasoningService` (primary reasoning engine)
- `ReasoningTraceStore`
- `LLM Router` / `AgentRouter` (decision hub)
- LLM Clients:
  - `OpenAIClient`
  - `OllamaClient`
  - `MultiProviderClient`

**Visual Characteristics**:
- **Color**: Gold tones (#FFD700)
- **Brightness**: Brightest nodes (importance 0.7-1.0)
- **Position**: Small radius cluster (0-20 units from center)
- **Shell Guide**: Gold wireframe sphere at r=20

**Cognitive Role**: Every significant action flows through this cluster. User queries enter → loop orchestrates → reasoning service analyzes → LLM router dispatches → tools/memory execute → results return.

---

### 2. Memory Systems (Deep Pink - #FF1493)

**Location**: Spherical shell surrounding the core

**Contains** (organized by latitude bands):

#### **North Pole (60°-90°)**: Planning & Roadmaps
- `Roadmaps`
- `RoadmapItems`
- `RoadmapEvents`
- `TaskStore`

#### **Upper Hemisphere (30°-60°)**: Declarative/Semantic Memory
- `DeclarativeFact`
- `KnowledgeChunks`
- `LTDM Store` (Long-term Declarative Memory)

#### **Equator (-30° to 30°)**: Episodic & Session Memory
- `SessionStore`
- `SessionService`
- `DB Session`, `DB SessionMessage`
- `EpisodicStore`
- `EpisodicEvent`

#### **Lower Hemisphere (-30° to -60°)**: Procedural Memory & Skills
- `ProceduralStore`
- `ProceduralSkill`
- `SkillExecutions`

#### **South Pole (-60° to -90°)**: Layered Memory Abstractions
- `LayeredMemory`
- `MemoryLayersModel`
- `L7 World State`
- `L8 Goals`
- `L9 Social`
- `L10 Governance`

**Visual Characteristics**:
- **Color**: Pink tones (#FF1493, #FF69B4, #FF6B9D)
- **Brightness**: Medium-high (importance 0.6-0.85)
- **Position**: Shell at r=60 with latitude stratification
- **Shell Guide**: Pink wireframe sphere with horizontal bands marking latitude zones

**Cognitive Role**: The core constantly reads and writes to these memory systems. Different memory types serve different purposes:
- **Episodic**: "What happened when"
- **Declarative**: "What is true"
- **Procedural**: "How to do things"
- **Planning**: "What to do next"
- **Layered**: High-level cognitive abstractions (world model, goals, social context)

---

### 3. Perception, Tools & Environment (Dark Turquoise - #00CED1)

**Location**: Outermost spherical shell

**Contains** (organized by longitude sectors):

#### **Sector 1 (0°-90°)**: Tools
- File Operations:
  - `list_files`, `read_file`, `write_file`, `apply_patch`, `search_codebase`
- Execution:
  - `execute_python`, `execute_shell_command`
- Workspace & Git:
  - `get_workspace_context`, `get_git_status`
- Testing:
  - `check_test_coverage`, pytest runners
- Vector & Standards:
  - `ingest_document`, `ingest_standard`, `search_standards`
- Academic/Web:
  - `search_academic_sources`, `get_paper_by_doi`

#### **Sector 2 (90°-180°)**: APIs & Routers
- Routers:
  - `agent`, `tools`, `telemetry`, `memory`, `roadmap`, `console`, `sandbox`
- API Layer:
  - `files`, `sessions`, `skills`, `tools`, `info`, `commands`

#### **Sector 3 (180°-270°)**: Telemetry & Observability
- `TelemetryTracer`
- `TelemetryMetrics`
- `TelemetryAnalyzer`
- `ObservabilityMetrics`
- `TelemetryMiddleware`

#### **Sector 4 (270°-360°)**: Console & UI
- `ConsoleApp` (Next.js frontend)
- `TelemetryContext`
- `ThreeSceneContext`
- `Neural3DViews` (this visualizer!)

**Visual Characteristics**:
- **Color**: Turquoise tones (#00CED1, #20B2AA, #40E0D0)
- **Brightness**: Medium (importance 0.5-0.75)
- **Position**: Shell at r=100 with longitude sectoring
- **Shell Guide**: Turquoise wireframe sphere with vertical planes marking longitude sectors

**Cognitive Role**: These are ATLAS's "senses and actuators":
- **Tools**: Act on the environment (files, code, workspace)
- **APIs**: Expose capabilities to external systems
- **Telemetry**: Observe and measure system behavior
- **Console**: Visualize and interact with the system

---

## Particle Flow Pathways

Particles follow actual data flows through the cognitive architecture:

### Typical Query Flow

```
1. User → Console → Routers → Core
   (Perception → Core)
   Particle: User query traveling inward

2. Core → Reasoning → LLM
   (Within Core)
   Particle: Prompt construction, reasoning steps

3. Core ↔ Memory
   (Core ↔ Memory bidirectional)
   - Reads: Faint particles from memory to core
   - Writes: Brighter particles from core to memory

4. Core → Tools
   (Core → Perception)
   Particle: Tool invocations, each spawning outward and returning

5. Core → Routers → Console
   (Core → Perception)
   Particle: Final answer traveling back outward
```

### Telemetry Overlay

Every event spawns a secondary particle:
```
Event source → TelemetryTracer → TelemetryContext → Neural3DView
```

This creates a **parallel observability flow** showing how ATLAS observes itself.

---

## Cognitive Mode Visualization

The layout enables **mode-based highlighting** to show different cognitive states:

### Planning Mode
- **Highlight**: `ReasoningService` ↔ `Roadmaps` ↔ `LayeredMemory` ↔ `L8 Goals`
- **Particle multiplier**: 1.5x
- **Visual**: More activity in north pole (planning) and south pole (layered memory)

### Execution Mode
- **Highlight**: `AgentRouter` ↔ Tools (file ops, execute, patch)
- **Particle multiplier**: 2.0x
- **Visual**: Intense activity in tools sector (outer shell, 0°-90°)

### Learning/Reflection Mode
- **Highlight**: All memory write operations
- **Particle multiplier**: 1.3x
- **Visual**: Particles flowing from core to all memory bands

### Idle Mode
- **Particle multiplier**: 0.5x
- **Visual**: Minimal background activity

---

## Visual Design Decisions

### Color Scheme
- **Gold (Core)**: Represents central importance, decision-making, "executive function"
- **Deep Pink (Memory)**: Warm, organic color suggesting storage and recall
- **Turquoise (Perception)**: Cool, outward-facing color suggesting external interaction

### Shell Wireframes
Subtle wireframe spheres (12% opacity) with:
- Gold wireframe at r=20 (core boundary)
- Pink wireframe at r=60 with latitude bands (memory structure)
- Turquoise wireframe at r=100 with longitude sectors (perception organization)

### Node Sizing
- **Base size**: Proportional to connection count (more connections = larger)
- **Importance multiplier**: 0.7 + (importance × 0.5)
- **Breathing animation**: ±5% sinusoidal scale variation

### Node Coloring
- **70% region color**: Dominant shell color
- **30% subsystem color**: Specific node type
- **Importance brightness**: More important nodes are brighter
- **Activity pulse**: Recent events cause temporary brightening

---

## Implementation Files

### New Files
- **`NeuralCognitiveLayoutV2.ts`**: Core layout algorithm
  - `classifyNode()`: Determines cognitive region for each node
  - `computeCognitiveLayout()`: Positions nodes in three shells
  - `getCognitiveModeHighlights()`: Returns mode-specific highlighting

- **`NeuralCognitiveShellsV2.tsx`**: Visual shell guides
  - Three wireframe spheres
  - Latitude bands for memory shell
  - Longitude sector planes for perception shell

### Modified Files
- **`NeuralArchitecture3DV2.tsx`**: Main scene
  - Switched from `computeNodePositionsV2` to `computeCognitiveLayout`
  - Added `<NeuralCognitiveShellsV2>` component

- **`NeuralVisualEncodingV2.ts`**: Color scheme
  - Added `REGION_COLORS` for three cognitive regions
  - Updated `NODE_COLORS` to reflect region-aware coloring

- **`NeuralNodesInstancedV2.tsx`**: Node rendering
  - Added `classifyNode()` call to get region metadata
  - Blend region color (70%) + subsystem color (30%)
  - Importance affects brightness

- **`NeuralHUDV2.tsx`**: Legend
  - Replaced subsystem legend with cognitive architecture legend
  - Shows three regions with descriptions

---

## Node Classification Rules

The `classifyNode()` function uses pattern matching on node IDs to classify nodes:

### Core Patterns
- `coreloop`, `loop_phases` → Core (importance 1.0)
- `reasoningservice`, `reasoning_service` → Core (0.95)
- `agentrouter`, `llm_router`, `llm_gateway` → Core (0.9)
- `openaiclient`, `ollamaclient`, `multi_provider` → Core (0.7-0.75)

### Memory Patterns
- **Episodic**: `sessionstore`, `episodicstore`, `session_message`
- **Declarative**: `declarativefact`, `knowledgechunk`, `ltdm`
- **Procedural**: `proceduralstore`, `proceduralskill`, `skill_`
- **Planning**: `roadmap`, `taskstore`
- **Layered**: `layeredmemory`, `l7`, `l8`, `l9`, `l10`

### Perception Patterns
- **Tools**: `fileops`, `execute_`, `workspace`, `test`, `academic`
- **API**: `router`, `api`, `endpoint`
- **Telemetry**: `telemetrytracer`, `observability`, `metrics`
- **Console**: `consoleapp`, `threescene`, `neural3d`

---

## Future Enhancements

### Possible Additions
1. **Cognitive mode detection**: Automatically detect which mode ATLAS is in based on particle patterns
2. **Time-series replay**: Record and replay telemetry sessions to see cognitive patterns over time
3. **Heatmaps**: Show which regions are most active during different operations
4. **Path tracing**: Highlight complete paths from user query → core → memory → tools → response
5. **LOD transitions**: Smooth interpolation between clustered and detailed views based on zoom
6. **Region statistics**: Show per-region throughput, latency, utilization metrics
7. **Interactive filtering**: Click regions to filter nodes/edges, isolate specific pathways

### Performance Optimizations
- **Instanced shells**: Use instanced rendering for latitude/longitude guides
- **Adaptive particle pool**: Dynamically adjust pool size based on load
- **Frustum culling**: Don't render nodes outside camera view
- **Level-of-detail**: Reduce node/particle detail when zoomed out

---

## Usage

### Accessing V2 Visualizer
- **Main view**: http://localhost:3000/neural-v2
- **Fullscreen**: http://localhost:3000/neural-3d-fullscreen?version=v2

### Controls
- **Drag**: Rotate camera
- **Scroll**: Zoom in/out
- **Double-click node**: Focus camera on node (future)
- **Shift+click region**: Isolate region (future)

### Telemetry Connection
- WebSocket: `ws://localhost:8000/v1/telemetry/stream`
- Architecture graph: `http://localhost:8000/v1/architecture/graph`

---

## Technical Notes

### Coordinate System
- Origin (0,0,0): Center of Core sphere
- Y-axis: Up/down (latitude on memory shell)
- X-Z plane: Horizontal (longitude on perception shell)

### Radius Values
- Core: r = 20 units
- Memory: r = 60 units (3× core)
- Perception: r = 100 units (5× core)

### Layout Algorithm
- **Core**: Force-directed with central CoreLoop anchor
- **Memory**: Fibonacci sphere distribution within latitude bands
- **Perception**: Fibonacci sphere distribution within longitude sectors

### Performance
- Max particles: 50,000 (configurable)
- Node pool: Dynamic based on architecture graph
- Edge pool: Dynamic based on observed connections
- Target frame rate: 60 FPS
- Telemetry processing: Deferred with requestAnimationFrame

---

## Summary

The V2 visualizer transforms ATLAS's neural telemetry from abstract node-link diagrams into a **semantically structured 3D cognitive architecture**. The three-shell layout makes it immediately obvious:

- Where decisions are made (gold core)
- Where information is stored (pink memory shell)
- How the system interacts with the world (turquoise perception shell)

Particle flows show actual data pathways through the cognitive architecture, making the visualization not just pretty, but **pedagogically and diagnostically valuable**. You can literally **see** ATLAS think.
