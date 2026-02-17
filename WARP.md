# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is the ATLAS Web Console, a Next.js-based visualization and control interface for the ATLAS Core AI assistant. The console provides a VS Code-style multi-panel interface with:
- Real-time 3D neural network visualization using React Three Fiber
- Interactive chat interface with streaming responses
- File explorer and code viewer
- Telemetry and observability displays
- Architecture graph visualization

The frontend proxies API requests to the ATLAS Core backend (FastAPI) running on `http://127.0.0.1:8000`.

## Development Commands

### Run Development Server
```bash
npm run dev
```
Access at `http://localhost:3000`

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm run start
```
Must run `npm run build` first.

### Linting
```bash
npm run lint
```

### Backend Connection
The console expects the ATLAS Core backend to be running at `http://127.0.0.1:8000`. The backend provides:
- `/v1/atlas/agent` - Main agent query endpoint (accepts `{"query": "..."}`)
- `/v1/telemetry/stream` - WebSocket stream for real-time telemetry
- `/v1/architecture/graph` - Architecture graph data

See `ATLAS_QUERY_GUIDE.md` for detailed backend API usage.

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **React**: v19.2 with client-side state management
- **3D Graphics**: React Three Fiber (@react-three/fiber, @react-three/drei)
- **Styling**: Tailwind CSS
- **State Management**: Zustand (for telemetry store), React Context (for console/session state)
- **Graph Visualization**: Cytoscape.js with Reactflow
- **TypeScript**: Strict mode enabled
- **Path Alias**: `@/*` resolves to project root

### Project Structure
```
app/                    # Next.js App Router pages
  ├── page.tsx         # Main console (tabbed interface)
  ├── layout.tsx       # Root layout (sidebar, chat panel, terminal)
  ├── neural-3d/       # Neural 3D standalone page
  └── api/             # API route handlers (proxy to backend)
components/            # React components
  ├── Neural3D/        # V2 3D neural architecture visualization
  ├── ConsoleProvider.tsx  # Global console state context
  ├── ChatPanel.tsx    # Right-side chat interface
  ├── Sidebar.tsx      # Left-side navigation
  ├── MainTabs.tsx     # Tab switcher (Code, Architecture, Neural Viz, etc.)
  └── [others]         # View components for each tab
contexts/              # React contexts
  ├── TelemetryContext.tsx    # Telemetry data stream
  └── ThreeSceneContext.tsx   # 3D scene interaction state
lib/                   # Utilities and API clients
  ├── atlasClient.ts          # Main ATLAS chat API client (chunked responses)
  ├── atlasConsoleClient.ts   # Console-specific API (sessions, files, logs)
  └── types.ts                # Shared TypeScript types
```

### Key Components

#### Neural 3D Visualization (`components/Neural3D/`)
The V2 visualizer implements a **cognitively accurate 3D layout** representing ATLAS's information processing architecture:

- **Three Cognitive Regions** (concentric spheres):
  - **Core Control & Reasoning** (Gold, r=20): CoreLoop, ReasoningService, LLM Router, LLM clients
  - **Memory Systems** (Deep Pink, r=60): Episodic, Declarative, Procedural, Planning memory stores
  - **Perception/Tools/Environment** (Turquoise, r=100): File operations, APIs, telemetry, console

- **Key Files**:
  - `NeuralArchitecture3DV2.tsx` - Main scene orchestrator
  - `NeuralCognitiveLayoutV2.ts` - Node classification and positioning algorithm
  - `NeuralParticlesInstancedV2.tsx` - Instanced particle rendering (50k particles)
  - `NeuralNodesInstancedV2.tsx` - Instanced node rendering
  - `NeuralEdgesInstancedV2.tsx` - Instanced edge rendering
  - `NeuralTelemetryStoreV2.ts` - Zustand store for telemetry events

- **Data Flow**: WebSocket telemetry → Telemetry store → Position calculation → Instanced rendering

See `NEURAL_V2_COGNITIVE_ARCHITECTURE.md` for detailed architecture explanation.

#### Console State Management
The `ConsoleProvider` (components/ConsoleProvider.tsx) provides global state for:
- Session management (active session ID)
- Chat message history per session
- File selection state
- Session loading/error states

All components under the layout tree have access via `useConsole()` hook.

#### API Proxy Pattern
API routes in `app/api/` proxy requests to the ATLAS backend to avoid CORS issues:
- `/api/atlasChat` → `http://127.0.0.1:8000/v1/atlas/chat`
- `/api/atlasChat/stream` → SSE streaming endpoint
- `/api/console/*` → Console-specific endpoints

The backend URL is configurable via `NEXT_PUBLIC_ATLAS_API_URL` environment variable.

## Important Technical Patterns

### Chunked Response Handling
The ATLAS backend may return large responses in chunks. The `atlasClient.ts` automatically reassembles chunked responses:
1. Detects `[CHUNKED_RESPONSE: ...]` in response `notes` field
2. Fetches remaining chunks via `/v1/atlas/chat/chunk/{session_id}`
3. Concatenates full answer before returning to UI

### Particle Rendering Mechanics
The 3D particle system requires careful handling to avoid duplicate creation in React Strict Mode:
- Use `useRef` with timestamp deduplication (100ms debounce)
- Each particle has unique ID: `particle-[direction]-${timestamp}-${counter}`
- Particles auto-cleanup after 60 seconds
- Forward and reverse particles use the same edge with visual offset

See `PARTICLE_RENDERING_MECHANICS.md` for verified working patterns.

### Dynamic Imports for 3D Components
3D components using React Three Fiber must be dynamically imported with `{ ssr: false }`:
```typescript
const NeuralArchitecture3D = dynamic(
  () => import("@/components/Neural3D/NeuralArchitecture3DV2"),
  { ssr: false }
);
```
This prevents server-side rendering issues with WebGL/Three.js.

### Node Classification
The cognitive layout uses pattern matching on node IDs to determine region:
- Core: `coreloop`, `reasoningservice`, `agentrouter`, `*client`
- Memory: `*store`, `episodic*`, `declarative*`, `procedural*`, `roadmap*`
- Perception: `*router`, `*api`, `telemetry*`, `execute_*`, `fileops*`

## Environment Configuration

### Required Environment Variables
- `NEXT_PUBLIC_ATLAS_API_URL` - ATLAS backend URL (default: `http://127.0.0.1:8000`)

Set in `.env.local` or via `next.config.js` env section.

### Backend Prerequisites
Before running the console:
1. Start ATLAS Core backend: `./run_atlas` (from atlas_core directory)
2. Verify backend health: `curl -s http://localhost:8000/health`

## Color Scheme & Styling

The console uses a VS Code-inspired dark theme:
- Background: `#1e1e1e`
- Sidebar: `#252526`
- Borders: `border-gray-700`
- Text: `text-gray-100`

All components use Tailwind utility classes. Panel widths are managed via CSS variables:
- `--sidebar-width` (default: 256px)
- `--chat-panel-width` (default: 460px)

## React Three Fiber Best Practices

1. **Instanced Rendering**: Use `InstancedMesh` for large numbers of similar objects (nodes, particles)
2. **useFrame Sparingly**: Avoid heavy computations in render loop; defer to `requestAnimationFrame` callbacks
3. **Position Updates**: Update `InstancedMesh` via `setMatrixAt()` + `instanceMatrix.needsUpdate = true`
4. **Color Handling**: Use `Color.setStyle()` for hex colors to ensure proper sRGB conversion
5. **Cleanup**: Always dispose geometries, materials, and textures in `useEffect` cleanup

## TypeScript Configuration

- **Strict Mode**: Enabled (`strict: true`)
- **Target**: ES2020
- **Module Resolution**: Bundler
- **JSX**: `react-jsx` (automatic runtime)
- **No JavaScript**: `allowJs: false`

All components must be properly typed. Use types from `lib/types.ts` for API responses.

## Common Gotchas

1. **ATLAS Query Field Name**: Backend expects `{"query": "..."}` NOT `{"message": "..."}` (422 error if wrong)
2. **Session Persistence**: Session IDs are stored in localStorage; clear storage if sessions appear stale
3. **React Strict Mode Duplication**: Effects run twice in development; use ref-based deduplication for side effects like particle creation
4. **Three.js in Next.js**: Always use dynamic imports with `ssr: false` for any component importing from `three` or `@react-three/fiber`
5. **WebSocket Reconnection**: Telemetry WebSocket doesn't auto-reconnect; manual page refresh required if connection drops

## Backend Integration Notes

### ATLAS Query Structure
When calling ATLAS, include all relevant context in the `query` field:
- Error messages with stack traces
- Code snippets showing the issue
- What was expected vs. actual behavior
- Previous solutions attempted

Example from working queries:
```json
{
  "query": "React Three Fiber particle color issue: useMemo computes correct colors (#8B5CF6 purple) verified in console logs. But particles visually render cyan/pink instead. Tried: useEffect with materialRef.current.color.set() - no change. Tried: key={color} on material - no change. What causes R3F materials to not update despite prop changes?"
}
```

### Telemetry WebSocket
Connect to `ws://localhost:8000/v1/telemetry/stream` for real-time events:
- Architecture updates (node/edge changes)
- Particle flow events (data transfer between nodes)
- Performance metrics
- Tool call traces

Events are JSON objects with `event_type` discriminator.

## File Backup Strategy

When revising any script or component, back up the original file to the `backup/` folder before making changes. Keep all revisions for the same project in the same folder.

## Utilities

### ASCII Diagram Generator (`scripts/diagram_generator.py`)
Generates properly aligned box diagrams using Unicode box-drawing characters that render correctly in Warp terminal.

**Usage:**
```bash
# Run demo to see examples
python3 scripts/diagram_generator.py

# Or import in Python
from scripts.diagram_generator import box, row_of_boxes, print_diagram
```

**Key Functions:**
- `box("text")` - Single box with text
- `box(["line1", "line2"])` - Multi-line box
- `row_of_boxes(["a", "b", "c"])` - Horizontal row of equal-width boxes
- `connector_down(width)` - Vertical line with arrow (│ → ▼)
- `merge_lines(width, positions)` - Merge multiple sources to center
- `split_lines(width, positions)` - Split from center to multiple targets
- `print_diagram(lines)` - Output to terminal

**Example Output:**
```
┌─────────┐  ┌─────────┐  ┌─────────┐
│ pytest  │  │ CI/CD   │  │ Voice   │
└─────────┘  └─────────┘  └─────────┘
```

**Important:** Always generate diagrams in the terminal first to verify alignment before copying to documentation or plans.
