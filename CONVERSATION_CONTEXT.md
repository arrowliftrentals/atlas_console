# WARP Console - Complete Context for Fresh Conversation

**Document Created**: January 12, 2026  
**Purpose**: Maintain full continuity when starting a new Warp AI conversation  
**Repository**: `/Users/mac_m3/Projects/WARP - console`  
**Branch**: `main` (up to date with origin/main)  

---

## Executive Summary

Phase 2 of the WARP Console development has been **completed with extensive backend integration** but requires **comprehensive manual UI testing**. The console now features:
- Real-time telemetry tracking and performance analysis
- 3D neural architecture visualization with cognitive region classification
- Dynamic error edge visualization
- Interactive node selection with camera focus
- Atlas chat integration with LLM responses
- Cognitive region color-coding across all visualizations

**Current Status**: Backend APIs functional, substantial uncommitted changes to frontend components (~2787 additions, 761 deletions across 22 files).

---

## Project Context

### Three Interconnected Repositories

1. **WARP-atlas** (Backend - Not in current directory)
   - Path: `/Users/mac_m3/Projects/WARP-atlas`
   - Architecture: Symbolic core-based AI system
   - Status: Active development (Jarvis-level AI system)
   - Backend API: Runs on `http://127.0.0.1:8000`

2. **WARP - console** (Frontend - CURRENT DIRECTORY)
   - Path: `/Users/mac_m3/Projects/WARP - console`
   - Purpose: Next.js visualization and control interface
   - Status: Phase 2 complete, awaiting UI testing
   - Dev server: `http://localhost:3000`

3. **WARP - Attempt 1 Atlas** (Reference Only)
   - Path: `/Users/mac_m3/Projects/WARP - Attempt 1 Atlas`
   - Status: Deprecated (lessons learned from LLM-centric approach)

---

## Phase 2 Completion Status

### ✅ Completed Features (Backend Verified)

1. **Skills Integration** ⚠️
   - Endpoint: `/v1/atlas/skill/executions`
   - Returns 50 skill execution records
   - **CRITICAL ISSUE**: Data is stale (Jan 11), not tracking real-time executions

2. **Sandbox Integration** ✅
   - Endpoint: `/api/sandbox/execute`
   - Safe command execution via executor API
   - Status: Endpoint responds, behavior needs testing

3. **Enhanced Telemetry System** ✅
   - File: `src/monitoring/telemetry.py` (260 lines) in backend
   - Features: Bottleneck detection, hot paths, critical paths, flow tracking
   - Endpoints working:
     - `/v1/telemetry/bottlenecks` - Returns 4 bottlenecks (llmclient: 1139ms, coreloop: 886ms)
     - `/v1/telemetry/hot-paths` - Most used paths
     - `/v1/telemetry/critical-paths` - High impact paths
     - `/v1/telemetry/flows` - Recent 20 dependency flows

4. **Error Edge Visualization** ✅
   - Endpoint: `/v1/telemetry/error-edges`
   - Frontend polls every 5 seconds
   - Visual: Red edges (3px, #EF4444)
   - Status: Working (currently 0 error edges, no active errors)

5. **Node Status System** ✅
   - Binary status: "live" or "stubbed"
   - Visual: Green border (live, #22C55E, 4px) / Amber border (stubbed, #F59E0B, 4px)
   - 19 total nodes: 8 live, 11 stubbed

6. **Cognitive Region Colors** ✅
   - Three regions with distinct colors (50% opacity):
     - **Gold** (#FFD700): Core Control & Reasoning (5 nodes)
     - **Deep Pink** (#FF1493): Memory Systems (7 nodes)
     - **Dark Turquoise** (#00CED1): Perception/Tools (7 nodes)
   - Classification logic in `NeuralCognitiveLayoutV2.ts`

7. **Analysis Panel Enhancements** ✅
   - Visibility: Shows with Timeline, hides with Matrix
   - Color-coded by cognitive region
   - Tabs: Bottlenecks, Critical Paths, Hot Paths, Flows

8. **3D Neural Visualizer Node Selector** ✅
   - Component: `NodeSelectorPanel.tsx` (160 lines)
   - Features: Search, grouping by region, camera focus animation
   - Camera: Zoom 11.76 units, smooth Vector3 interpolation

9. **Atlas Chat LLM Integration** ✅
   - Issue resolved: Missing .env file
   - Solution: Restored .env with OPENAI_API_KEY, added `load_dotenv()` to server.py
   - Status: Chat responses working

---

## Current State - Uncommitted Changes

### Modified Files (22 files, 2787 additions, 761 deletions)

**Critical Components Modified:**
1. `components/Neural3D/NeuralArchitecture3DV2.tsx` (+171 lines)
   - Camera controller integration
   - Node selector panel integration

2. `components/ArchitectureViewV2.tsx` (+355 lines refactored)
   - Cognitive region colors
   - Error edge polling
   - Analysis panel visibility logic

3. `components/ChatPanel.tsx` (126 line changes)
   - Enhanced chat interface
   - Streaming response handling

4. `components/ConsoleProvider.tsx` (+40 lines)
   - Chat message state management
   - Session management improvements

5. `lib/atlasConsoleClient.ts` (+103 lines)
   - New functions: `fetchActivityLogs()`, `clearActivityLogs()`, `atlasChatStream()`
   - SSE streaming support

6. `components/Neural3D/NeuralNodesInstancedV2.tsx` (-316 lines refactored)
   - Simplified node rendering
   - Instance-based rendering optimization

7. `app/globals.css` (+135 lines)
   - Cognitive region color variables
   - Progress indicator styles

**New Files (Untracked):**
- `PHASE_2_COMPLETION.md` - Full feature documentation
- `PHASE_2_TEST_REPORT.md` - Comprehensive test report
- `WARP.md` - Project guidance for Warp AI
- `components/Neural3D/NodeSelectorPanel.tsx` - Node selection UI
- `components/PermanentProgressBar.tsx` - Progress indicator component
- `lib/debugLogger.ts` - Debug logging utility
- `app/api/debug-log/` - Debug logging endpoint
- `debug_logs/browser_console.log` - Browser debug output (335KB)

---

## Known Issues & Test Gaps

### 🔴 Critical Issues

1. **Skills Integration Not Working (HIGH PRIORITY)**
   - **Issue**: Endpoint returns stale data (Jan 11), new queries don't create records
   - **Impact**: Skills tab shows outdated information
   - **Action Required**: Investigate L2 memory recording and query logic in backend
   - **Files**: `src/api/server.py` in WARP-atlas backend

### 🟡 Medium Priority Issues

2. **Error Edge Testing Gap**
   - **Issue**: No reliable method to generate test errors
   - **Impact**: Error edge visualization untested with real errors
   - **Action Required**: Create test utility or document error generation steps

3. **Sandbox Behavior Unclear**
   - **Issue**: Response structure unclear, isolation not verified
   - **Impact**: Can't confirm sandbox safety
   - **Action Required**: Test with actual commands, verify isolation

---

## Manual UI Testing Checklist

**⚠️ IMPORTANT**: 60% of functionality requires browser-based testing. Backend APIs are working, but UI interactions are unverified.

### Architecture Tab
- [ ] Verify 19 nodes display
- [ ] Check cognitive region colors (50% opacity)
- [ ] Verify live nodes have green border, stubbed have amber border
- [ ] Test Analysis panel toggle (shows with Timeline, hides with Matrix)
- [ ] Test all 4 Analysis tabs (Bottlenecks, Critical Paths, Hot Paths, Flows)
- [ ] Verify cognitive region color-coding in Analysis panel
- [ ] Test layout algorithms: Hierarchical, Layered, Force
- [ ] Click nodes to verify details panel appears

### Neural 3D Tab
- [ ] Click "Show Nodes" button (bottom-right)
- [ ] Test node selector search functionality
- [ ] Verify cognitive region grouping and colors
- [ ] Click nodes to test camera focus animation
- [ ] Verify camera centers at [0,0,0] with zoom 11.76
- [ ] Test rotation around center
- [ ] Verify node selection highlights

### Chat Panel
- [ ] Send test query: "Hello, are you there?"
- [ ] Verify response within 2-3 seconds
- [ ] Check conversation history persists
- [ ] Test complex reasoning query
- [ ] Test error handling (disconnect network)
- [ ] Verify streaming updates (if enabled)

### Skills Tab
- [ ] Navigate to Skills tab
- [ ] Verify 50 executions display
- [ ] Check timestamp formatting
- [ ] **Note**: Data is stale (Jan 11) - expected behavior until backend fixed

### Other Tabs
- [ ] Code tab: File explorer functionality
- [ ] Matrix view: Dependency matrix display
- [ ] Timeline: Timeline panel at bottom
- [ ] Sandbox: Execute test commands
- [ ] Logs: Activity log display

---

## Key Technical Patterns

### Cognitive Region Classification
Nodes are classified by ID pattern matching in `NeuralCognitiveLayoutV2.ts`:
```typescript
// Core: coreloop, reasoningservice, agentrouter, *client, intentparser
// Memory: *store, episodic*, declarative*, procedural*, roadmap*, database, vectorstore
// Perception: *router, *api, telemetry*, execute_*, fileops*, sandbox*, learning*
```

### API Proxy Pattern
Frontend proxies to backend via Next.js API routes:
- `/api/atlasChat` → `http://127.0.0.1:8000/v1/atlas/chat`
- `/api/console/*` → Backend console endpoints
- Configured via `NEXT_PUBLIC_ATLAS_API_URL` env variable

### Instanced Rendering (React Three Fiber)
3D visualizer uses instanced meshes for performance:
- `InstancedMesh` for nodes, particles, edges
- Update via `setMatrixAt()` + `instanceMatrix.needsUpdate = true`
- Dynamic imports with `{ ssr: false }` to avoid SSR issues

### Streaming Chat Responses
SSE streaming via `atlasChatStream()` in `atlasConsoleClient.ts`:
- Calls `onChunk()` callback for real-time UI updates
- Handles tool call events via `onToolCall()`
- Completes via `onDone()` with session ID

---

## Backend Dependencies

### Required Services
1. **ATLAS Core Backend**
   - Start: `./run_atlas` (from `/Users/mac_m3/Projects/WARP-atlas`)
   - Health check: `curl -s http://localhost:8000/health`
   - Required for all console functionality

2. **Environment Variables**
   - `.env` file in WARP-atlas backend directory
   - Must contain: `OPENAI_API_KEY`, Pinecone config
   - Loaded via `load_dotenv()` in `src/api/server.py`

### Key Backend Endpoints
- `/v1/atlas/chat` - Main chat (POST)
- `/v1/atlas/skill/executions` - Skill history (GET)
- `/v1/telemetry/*` - Telemetry data (GET)
- `/v1/architecture/graph` - Architecture graph (GET)
- `/v1/console/sessions` - Session management (GET/POST)
- `/api/sandbox/execute` - Sandbox execution (POST)

---

## Development Commands

### Start Frontend Dev Server
```bash
npm run dev
# Access at http://localhost:3000
```

### Start Backend (ATLAS Core)
```bash
cd /Users/mac_m3/Projects/WARP-atlas
./run_atlas
# Runs on http://127.0.0.1:8000
```

### Build Production
```bash
npm run build
npm run start
```

### Linting
```bash
npm run lint
```

---

## Git State

### Recent Commits (Last 10)
1. `75f2db24` (HEAD, main, origin/main) - Fix console UI: instant tab switching, neural viz fixes, architecture loading
2. `3e6319a8` - feat: add SSE streaming client support
3. `b18f6466` - fix: update all API routes from /v1/console to /api/console
4. `6cdbf4d6` - Save optimized node positions: uniform Fibonacci distribution
5. `bc018635` - Add particle reflection and adjust perception shell transparency
6. `76e3881d` - Improve Neural 3D node and particle behavior
7. `c8dda372` - Clean up Neural 3D UI overlays
8. `b565004d` - Fix Neural V2: Add database and vector_store nodes
9. `4f48c3bf` - Fix Neural V2: Implement custom shader for per-instance colors
10. `32dd50b5` - Add Neural 3D visualization to console with telemetry integration

### Uncommitted Work
- 22 files modified (extensive changes)
- 8 new untracked files
- **Status**: All changes are intentional Phase 2 work
- **Action**: Should be committed after UI testing confirms functionality

---

## Next Steps (Immediate Actions)

### Before Phase 3
1. **Complete Manual UI Testing** - Use browser to verify all features (checklist above)
2. **Fix Skills Integration** - Debug backend L2 memory recording
3. **Commit Phase 2 Changes** - After UI verification
4. **Create Git Tag** - Mark Phase 2 completion milestone

### Phase 3 Planning (Future)
- Real-time telemetry particle animations
- Historical playback via Timeline
- Advanced filtering in Analysis panel
- Performance profiling with flame graphs
- Multi-session support
- Export/import architecture snapshots
- Real-time alerts for bottlenecks

---

## Important Files & Locations

### Configuration Files
- `.env.local` - Frontend environment variables (if needed)
- `.env` - Backend environment (in WARP-atlas directory)
- `next.config.js` - Next.js configuration
- `tsconfig.json` - TypeScript strict mode enabled

### Documentation Files (In This Directory)
- `WARP.md` - Project guidance for Warp AI (comprehensive)
- `ATLAS_QUERY_GUIDE.md` - Backend API usage guide
- `NEURAL_V2_COGNITIVE_ARCHITECTURE.md` - 3D visualizer architecture
- `PARTICLE_RENDERING_MECHANICS.md` - Particle system patterns
- `PHASE_2_COMPLETION.md` - Feature documentation (198 lines)
- `PHASE_2_TEST_REPORT.md` - Test report (322 lines)

### Key Source Directories
- `app/` - Next.js App Router pages
- `components/` - React components
- `lib/` - API clients and utilities
- `contexts/` - React contexts
- `components/Neural3D/` - 3D visualization components

---

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **React**: v19.2
- **3D Graphics**: React Three Fiber, @react-three/drei
- **Styling**: Tailwind CSS
- **State**: Zustand (telemetry), Context (console/session)
- **Graph**: Cytoscape.js with Reactflow
- **TypeScript**: Strict mode
- **Path Alias**: `@/*` → project root

---

## Common Gotchas

1. **Backend must be running** before frontend starts
2. **Dynamic imports required** for all Three.js components (`ssr: false`)
3. **React Strict Mode duplicates effects** - use ref-based deduplication
4. **ATLAS query field** is `"query"` not `"message"` (422 error if wrong)
5. **Cytoscape doesn't support rgba()** - use `background-opacity` with hex colors
6. **WebSocket doesn't auto-reconnect** - manual page refresh required

---

## Questions to Ask When Resuming

If you're picking up this work in a fresh conversation:

1. **"What was I working on before?"**
   → Phase 2 integration complete, awaiting manual UI testing

2. **"What needs to happen next?"**
   → Complete UI testing checklist, fix Skills Integration bug, commit changes

3. **"Are there any critical bugs?"**
   → Yes, Skills Integration returning stale data (HIGH priority)

4. **"What's uncommitted?"**
   → 22 files with ~2787 additions (all intentional Phase 2 work)

5. **"Can I start implementing new features?"**
   → Not yet, finish Phase 2 verification first

---

## Debug Resources

### Debug Logs
- `debug_logs/browser_console.log` (335KB from Jan 11)
- Console logging via `lib/debugLogger.ts`
- Debug endpoint: `app/api/debug-log/`

### Testing Backend APIs
```bash
# Health check
curl -s http://localhost:8000/health

# Telemetry bottlenecks
curl -s http://localhost:8000/v1/telemetry/bottlenecks | jq

# Architecture graph
curl -s http://localhost:8000/v1/architecture/graph | jq

# Skills (showing stale data issue)
curl -s http://localhost:8000/v1/atlas/skill/executions | jq
```

---

## Backup Strategy

**Rule**: When modifying any script, backup original to `backup/` folder before changes.

**Current State**: No backup folder exists yet. Consider creating:
```bash
mkdir -p backup/phase-2-pre-commit
```

---

## Summary for AI Assistant

When you read this document in a fresh conversation:

1. **Context is preserved** - All critical information is here
2. **Work is well-documented** - Phase 2 complete, issues identified
3. **Next steps are clear** - UI testing → bug fix → commit
4. **No guesswork needed** - All technical details included
5. **Safe to proceed** - Uncommitted changes are intentional

You can confidently:
- Answer questions about current state
- Guide manual UI testing
- Debug the Skills Integration issue
- Help commit Phase 2 changes
- Begin Phase 3 planning

**Do NOT**:
- Assume anything needs to be "fixed" without checking this document
- Make changes before UI testing confirms current functionality
- Commit changes without user approval
- Start Phase 3 work before Phase 2 is validated

---

**End of Context Document**  
**Last Updated**: January 12, 2026, 13:43 UTC  
**Document Version**: 1.0  
**Status**: ✅ Complete and ready for handoff
