# Particle Event Flow Diagnostic

## Expected Flow

1. **Backend sends telemetry** → WebSocket receives at `NeuralArchitecture3DV2.tsx:493`
2. **handleTelemetryUpdate called** → Line 567, logs `[handleTelemetryUpdate] Called with data:`
3. **Events processed** → Lines 580-617 (memory_write) OR 619-721 (trace updates)
4. **ingestEvents called** → Logs `[V2] Calling ingestEvents with X events`
5. **Store adds to particleEvents** → `NeuralTelemetryStoreV2.ts:57` checks `!ev.skipParticles`
6. **Component receives events** → `NeuralArchitecture3DV2.tsx:100` extracts `particleEvents` from store
7. **Particles spawn in useFrame** → `NeuralParticlesInstancedV2.tsx:134` loops through `spawnEvents`

## What to Check in Browser Console (F12)

### Step 1: Verify WebSocket Connection
Look for:
```
[V2] Telemetry connected
```

### Step 2: Verify Telemetry Received
When you send a chat message, look for:
```
[V2] Telemetry message received: [array of keys]
[handleTelemetryUpdate] Called with data: ...
```

### Step 3: Verify Event Format
Check what type of data is received:
```
[handleTelemetryUpdate] Found events array with X items
OR
[handleTelemetryUpdate] Single memory_write event: X → Y
OR
[handleTelemetryUpdate] Unrecognized format, keys: ...
```

### Step 4: Verify Events Created
Look for:
```
[TELEMETRY UPDATE] {type: 'update', traceCount: X, ...}
[EVENT PUSHED] {source: 'X', target: 'Y', ...}
[EVENTS CREATED] X events: [...]
[V2] Calling ingestEvents with X events
```

### Step 5: Verify Store Ingestion
Look for:
```
[STORE] ingestEvents called with X events
[STORE] Before: Y nodes, Z edges
[STORE] After: Y nodes, Z edges
```

**CRITICAL**: Check if you see `skipParticles: true` in the events. This would block particle spawning.

### Step 6: Verify Component Receives Events
Look for:
```
[V2 EFFECT] particleEvents updated, length: X
[V2 EFFECT] First event: {...}
```

### Step 7: Verify Particle Spawning Attempt
Look for:
```
[PARTICLE FRAME] Processing X spawn events
[PARTICLE FRAME] Nodes available: Y, Edges available: Z
```

### Step 8: Check for Failures
Look for warnings:
```
[PARTICLE] Missing nodes for edge: X->Y
[PARTICLE] Edge not found: X->Y
```

### Step 9: Verify Success
Look for:
```
[PARTICLE ACTIVATED] edgeId: X->Y, particle index: N
[PARTICLE SPAWN] {source: X, target: Y, spawn_count: N, size: N}
```

## Common Issues

### Issue: No telemetry received
**Symptom**: No `[V2] Telemetry message received` logs
**Cause**: WebSocket not connected or backend not sending events
**Fix**: Check backend is running, refresh page to reconnect WebSocket

### Issue: Events have skipParticles: true
**Symptom**: Events created but no particles spawn
**Cause**: Events marked as architecture loading events
**Fix**: Should only happen on initial load, not on chat queries

### Issue: Unrecognized format
**Symptom**: `[handleTelemetryUpdate] Unrecognized format, keys: ...`
**Cause**: Backend sending different telemetry format than expected
**Fix**: Update handleTelemetryUpdate to handle new format

### Issue: particleEvents length is 0
**Symptom**: `[V2 EFFECT] particleEvents updated, length: 0`
**Cause**: Events being cleared immediately or skipParticles blocking them
**Fix**: Check if clearParticleEvents is called too early

### Issue: Missing nodes or edges
**Symptom**: `[PARTICLE] Missing nodes` or `[PARTICLE] Edge not found`
**Cause**: Event references nodes/edges that don't exist in store
**Fix**: Verify architecture graph loaded correctly from `/v1/architecture/graph`

### Issue: processedEventsRef blocking
**Symptom**: No activation logs despite events present
**Cause**: Events already processed (duplicate timestamps)
**Fix**: Check if event timestamps are unique

## Manual Test

Run in browser console:
```javascript
// Check store state
const store = require('@/components/Neural3D/NeuralTelemetryStoreV2').useNeuralTelemetryStoreV2.getState();
console.log('Nodes:', store.nodes.size);
console.log('Edges:', store.edges.size);
console.log('Particle events:', store.particleEvents.length);
console.log('Events:', store.particleEvents);
```

## Inject Test Event

Run in browser console:
```javascript
const { ingestEvents } = require('@/components/Neural3D/NeuralTelemetryStoreV2').useNeuralTelemetryStoreV2.getState();
ingestEvents([{
  source: 'agent_router',
  target: 'llm_gateway',
  type: 'data_transfer',
  timestamp: Date.now(),
  bytes: 1024,
  priority: 'high',
  is_parent_trace: true,
  spawn_count: 3,
  skipParticles: false  // IMPORTANT: must be false
}]);
```
