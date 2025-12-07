# Neural 3D Visualization Console Integration Notes

## Working State (Before Integration Attempt)
- Standalone page `/neural-3d` worked perfectly
- Particles flowing with proper multi-span trace data
- WebSocket connected: `ws://localhost:8000/v1/telemetry/stream`
- Backend serving traces with 3+ spans per trace

## Key Settings for Console Tab Integration

### 1. Canvas Layout (CRITICAL)
```tsx
// In MainTabs.tsx or wherever the neural-viz tab renders
{activeTab === "neural-viz" && <NeuralArchitecture3D />}
```

**DO NOT wrap in context providers that create layout conflicts**
- TelemetryProvider caused pointer event issues
- ThreeSceneProvider broke controls
- Keep it SIMPLE - conditional rendering only

### 2. Canvas Component Structure
```tsx
<Canvas
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'auto'  // MUST be auto for controls
  }}
  camera={{ position: [0, 0, 50], fov: 75 }}
>
  <OrbitControls enableDamping dampingFactor={0.05} />
  {/* Scene content */}
</Canvas>
```

### 3. Overlay Elements (if any)
```tsx
<div style={{ 
  position: 'absolute',
  pointerEvents: 'none'  // MUST be none to not block Canvas
}}>
  {/* UI overlays like counters */}
</div>
```

### 4. Backend Requirements

#### Telemetry Endpoint
- **WebSocket**: `ws://localhost:8000/v1/telemetry/stream`
- **Update Interval**: 2 seconds
- **Payload Structure**:
```json
{
  "traces": [...],
  "active_traces": [...],
  "metrics": {...},
  "signals": [...]
}
```

#### Multi-Span Traces (CRITICAL)
Traces MUST have 2+ spans to create particle paths:
```python
# Example: Keep spans active for duration
trace_id = tracer.start_trace("agent_router", "chat")
span_orch = tracer.start_span("orchestrator", "process_request")
span_llm = tracer.start_span("llm_gateway", "generate")

await asyncio.sleep(duration_seconds)  # Keep active!

tracer.end_span(span_llm, SpanStatus.OK)
tracer.end_span(span_orch, SpanStatus.OK)
tracer.end_trace(trace_id, SpanStatus.OK)
```

**DO NOT** use context managers that end spans immediately:
```python
# WRONG - ends span immediately
with trace_component(tracer, "orchestrator", "process"):
    pass  # Span already ended
```

#### Test Endpoint
```bash
curl -X POST 'http://localhost:8000/v1/telemetry/test/generate-flow?flow_type=all&duration_seconds=120'
```

### 5. Particle Creation Logic
Requires `trace.spans.length >= 2` to create paths:
```typescript
// In processTraceUpdate (NeuralArchitecture3D.tsx)
if (!trace.spans || trace.spans.length < 2) {
  return; // Skip single-span traces
}

// Create path from span chain
const path = trace.spans.map((span, i) => ({
  nodeId: span.component_id,
  spanId: span.span_id,
  timestamp: span.start_time,
  isSource: i === 0,
  isTarget: i === trace.spans.length - 1
}));
```

### 6. Debug Console Logs (Keep These)
```typescript
console.log('✅ Telemetry WebSocket connected');
console.log('🔄 Telemetry update:', { traces: data.traces?.length });
console.log('🎆 SETTING PARTICLES:', newParticles.length);
console.log('🔥 setParticles called: prev=' + prev.length);
```

## Known Breaking Patterns

### ❌ Provider Architecture (Broke Controls)
```tsx
// This broke pointer events
<TelemetryProvider>
  <ThreeSceneProvider>
    {activeTab === "neural-viz" && <NeuralArchitecture3D />}
  </ThreeSceneProvider>
</TelemetryProvider>
```

### ❌ Context Manager Spans (No Particles)
```python
# This creates spans that end immediately
with trace_component(tracer, "component", "operation"):
    do_work()  # Span ends here, not visible
```

### ❌ Single-Span Traces
```python
# Only one span = no path = no particles
trace_id = tracer.start_trace("component", "operation")
tracer.end_trace(trace_id, SpanStatus.OK)
```

## Working Pattern Summary

1. **Simple conditional rendering** in tab component
2. **Canvas with absolute positioning** and `pointerEvents: 'auto'`
3. **Overlays with `pointerEvents: 'none'`**
4. **Multi-span traces** kept active for visualization duration
5. **WebSocket** connects independently in NeuralArchitecture3D component
6. **No complex provider wrappers** that interfere with layout

## File Locations
- Frontend: `/Users/mac_m3/Projects/atlas_console/components/NeuralArchitecture3D.tsx`
- Backend WebSocket: `/Users/mac_m3/Projects/atlas_core/app/routers/telemetry.py`
- Test Endpoint: `/Users/mac_m3/Projects/atlas_core/app/routers/telemetry_test.py`
- Tab Container: `/Users/mac_m3/Projects/atlas_console/app/page.tsx`

## Last Known Good State
- Date: December 6, 2025
- Quote: "the signal visualizations were perfect just before you tried adding it to the console"
- Standalone `/neural-3d` page showed flowing particles
- Backend was serving multi-span traces properly
- Controls (zoom/rotate/pan) all working
