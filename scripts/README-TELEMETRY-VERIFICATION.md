# Telemetry Flow Verification Tool

## Purpose

This tool verifies that the telemetry data flowing through the ATLAS system **exactly matches** what is visualized in the console. It sits on top of the real data stream and validates:

1. **Accuracy**: Every flow shown in telemetry corresponds to an actual edge in the architecture graph
2. **Completeness**: No flows are missing or incorrectly routed
3. **Consistency**: Component IDs in telemetry match those in the graph
4. **Direction**: Flow direction (source→target) is correct

## How It Works

```
┌──────────────────┐
│  ATLAS Backend   │
│   (port 8000)    │
└────────┬─────────┘
         │
         ├─────────────────┐
         │                 │
    Architecture      Telemetry
       Graph           Stream
         │              (WS)
         │                 │
         ▼                 ▼
    ┌─────────────────────────┐
    │  Verification Tool      │
    │  - Captures real flows  │
    │  - Compares with graph  │
    │  - Reports mismatches   │
    └─────────────────────────┘
```

## Usage

### Prerequisites

1. **Start ATLAS backend**:
   ```bash
   cd /Users/mac_m3/Projects/WARP-atlas
   ./run_atlas
   ```

2. **Verify backend is running**:
   ```bash
   curl -s http://localhost:8000/health
   ```

### Install Dependencies

The verification script requires Node.js v18+ (for built-in fetch) and the `ws` package:

```bash
cd "/Users/mac_m3/Projects/WARP Ecosystem/console/scripts"
npm install
```

Or install ws directly in the console directory:

```bash
cd "/Users/mac_m3/Projects/WARP Ecosystem/console"
npm install --no-save ws
```

### Run Verification

```bash
cd "/Users/mac_m3/Projects/WARP Ecosystem/console"
node scripts/verify-telemetry-flow.js
```

Or using npm script:

```bash
cd "/Users/mac_m3/Projects/WARP Ecosystem/console/scripts"
npm run verify-telemetry
```

### What You'll See

```
🔍 ATLAS Telemetry Flow Verification Tool

This tool verifies that telemetry flows match the architecture graph.

📥 Fetching architecture graph...
✅ Graph loaded: 42 nodes, 67 edges

🔌 Connecting to telemetry WebSocket...
✅ WebSocket connected

📊 Listening for telemetry data (Ctrl+C to stop)...

────────────────────────────────────────────────────────────────────────────────

🔄 Trace: trace-abc-123
   Path: coreloop → reasoningservice → memorymanager → episodicstore
   ✅ coreloop->reasoningservice (exists in graph)
   ✅ reasoningservice->memorymanager (exists in graph)
   ✅ memorymanager->episodicstore (exists in graph)

🔄 Trace: trace-def-456
   Path: agentrouter → llmclient → openaiclient
   ✅ agentrouter->llmclient (exists in graph)
   ❌ llmclient->openaiclient (MISSING in graph)  # ← This is a problem!

[Press Ctrl+C to stop]
```

### Trigger Some Activity

While the verification tool is running, **trigger some ATLAS operations** to generate telemetry:

**Option 1: Use the console**
- Open http://localhost:3000 in your browser
- Send a query through the chat interface
- The tool will capture and verify the resulting flows

**Option 2: Direct API call**
```bash
curl -s -X POST http://localhost:8000/v1/atlas/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "Test query to generate telemetry"}' \
  | jq .
```

**Option 3: Run ATLAS CLI commands**
```bash
cd /Users/mac_m3/Projects/WARP-atlas
# Run any CLI command that triggers system flows
```

### Interpreting Results

#### ✅ Success Case
```
📊 Final Statistics:
   Messages received: 15
   Traces processed: 8
   Unique flows found: 23
   Missing edges: 0

✅ All found flows exist in architecture graph: true
✅ SUCCESS: All telemetry flows are correctly represented in the architecture graph.
```
**Meaning**: The visualizations are accurate - every flow you see corresponds to real system behavior.

#### ⚠️ Warning Case
```
📊 Final Statistics:
   Messages received: 0
   Traces processed: 0
   Unique flows found: 0
   Missing edges: 0

⚠️  WARNING: No telemetry flows captured. Make sure to trigger some operations in ATLAS.
```
**Meaning**: The backend is connected but no operations were triggered. Try sending some queries.

#### ❌ Failure Case
```
📊 Final Statistics:
   Messages received: 12
   Traces processed: 5
   Unique flows found: 18
   Missing edges: 3

⚠️  MISSING EDGES (telemetry flows not in graph):
   - llmclient->openaiclient
   - fileops->filesystemadapter
   - memorymanager->cachestore

❌ FAILURE: Some telemetry flows are not in the architecture graph.
   This means the visualization may not accurately reflect the real system behavior.
```

**Meaning**: **Critical issue** - Some real system flows are NOT in the architecture graph. This means:
- The console cannot visualize these flows (edges don't exist)
- The architecture documentation is incomplete
- The Neural 3D viz is missing real data paths

**Action Required**: Update the architecture graph to include the missing edges.

## What This Proves

### If verification passes (✅):
1. **The console visualizations are accurate** - what you see is what's actually happening
2. **The architecture graph is complete** - all real component interactions are documented
3. **Component naming is consistent** - telemetry and graph use the same IDs
4. **Flow animations reflect reality** - blue pulses show actual data movement

### If verification fails (❌):
1. **Architecture graph is incomplete** - missing edges need to be added
2. **Component ID mismatch** - telemetry uses different names than the graph
3. **Visualization gap** - some real system behavior is invisible in the console

## Integration with Console

The console uses the **exact same logic** as this verification tool:

1. Both sort spans by `start_time`
2. Both extract `component_id` from spans
3. Both construct path as consecutive component pairs
4. Both animate/visualize these flows

So if this tool shows ✅, the console is showing accurate, real-time system behavior.

## Troubleshooting

### "Failed to fetch architecture graph"
- Backend not running on port 8000
- Solution: Start ATLAS backend with `./run_atlas`

### "WebSocket connection error"
- Telemetry endpoint not available
- Check if backend has telemetry enabled
- Verify WebSocket endpoint: `ws://localhost:8000/v1/telemetry/stream`

### No traces captured
- System is idle
- Send queries through the console or API to trigger activity
- Some ATLAS operations might not generate traces

### All edges missing
- Component ID naming mismatch
- Check if telemetry uses different component identifiers than the graph
- May need ID normalization mapping

## Next Steps

After running verification:

1. **If all flows match**: Confidence that visualizations are accurate ✅
2. **If edges are missing**: Update architecture graph to add missing edges
3. **If IDs don't match**: Add ID normalization in console code
4. **If no telemetry**: Verify backend telemetry implementation

## Developer Notes

### Extending the Tool

To add more validation:

```javascript
// In processTrace() function
function processTrace(trace, edgeSet) {
  // Add custom validation here
  // e.g., check for cycles, validate timing, etc.
}
```

### Exporting Data

The tool stores all captured flows in `capturedFlows` Map. To export:

```javascript
// Add before process.exit():
const fs = require('fs');
const flows = Array.from(capturedFlows.values());
fs.writeFileSync('captured-flows.json', JSON.stringify(flows, null, 2));
```

### Automated Testing

Integrate into CI/CD:

```bash
#!/bin/bash
# Start backend
./run_atlas &
BACKEND_PID=$!

# Wait for backend
sleep 5

# Run verification with timeout
timeout 30s node scripts/verify-telemetry-flow.js &
VERIFY_PID=$!

# Trigger test operations
curl -X POST http://localhost:8000/v1/atlas/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}' > /dev/null

# Wait for verification
wait $VERIFY_PID
EXIT_CODE=$?

# Cleanup
kill $BACKEND_PID

exit $EXIT_CODE
```
