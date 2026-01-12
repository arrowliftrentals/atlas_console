# Phase 3 - Feature 1: Particle Flow Animations

**Feature**: Real-time particle visualization for data flows in Neural 3D  
**Priority**: P1 (High)  
**Status**: 🚧 In Progress  
**Backend Required**: ✅ Already available (WebSocket telemetry)

---

## Overview

Animate data flows between nodes in the 3D neural visualizer as colored particles traveling along edges. This provides real-time visual feedback of system activity.

---

## Requirements

### Functional
1. Listen to WebSocket telemetry for flow events
2. Create particle for each flow (source → target)
3. Animate particle along edge path
4. Color-code by intent type or component region
5. Fade out after reaching target
6. Support high throughput (100+ particles/sec)

### Visual
- Smooth bezier curve animation
- Particle size: 0.5-1.0 units
- Animation duration: 1-2 seconds
- Trail effect (optional stretch goal)
- Bloom/glow effect

### Performance
- Instanced rendering for efficiency
- Max 500 active particles simultaneously
- Automatic cleanup of completed animations
- No frame drops under heavy load

---

## Technical Design

### Data Flow
```
WebSocket Event → Parse Flow → Calculate Path → Create Particle → Animate → Cleanup
```

### Component Architecture

#### 1. Telemetry Event Handling
**Location**: `components/Neural3D/NeuralArchitecture3DV2.tsx`

```typescript
// Listen for flow events
useEffect(() => {
  if (!wsRef.current) return;
  
  const handleMessage = (event: MessageEvent) => {
    const data = JSON.parse(event.data);
    
    if (data.event_type === 'flow') {
      handleFlowEvent(data);
    }
  };
  
  wsRef.current.addEventListener('message', handleMessage);
  return () => wsRef.current?.removeEventListener('message', handleMessage);
}, []);
```

#### 2. Particle State Management
**Location**: `components/Neural3D/NeuralTelemetryStoreV2.ts`

```typescript
interface ParticleFlow {
  id: string;
  source: string;
  target: string;
  startTime: number;
  duration: number;
  color: string;
  intentType?: string;
}

// Add to store
particleFlows: Map<string, ParticleFlow>;
addParticleFlow(flow: ParticleFlow): void;
removeParticleFlow(id: string): void;
```

#### 3. Path Calculation
**Location**: New utility `components/Neural3D/NeuralPathUtils.ts`

```typescript
export function calculateEdgePath(
  sourcePos: Vector3,
  targetPos: Vector3,
  curveAmount: number = 0.3
): Vector3[] {
  // Generate bezier curve points
  const midpoint = new Vector3()
    .lerpVectors(sourcePos, targetPos, 0.5);
  
  const direction = new Vector3()
    .subVectors(targetPos, sourcePos)
    .normalize();
  
  // Perpendicular offset for curve
  const perpendicular = new Vector3(-direction.y, direction.x, 0)
    .multiplyScalar(curveAmount * sourcePos.distanceTo(targetPos));
  
  const controlPoint = midpoint.clone().add(perpendicular);
  
  // Sample points along bezier curve
  const points: Vector3[] = [];
  const segments = 50;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = quadraticBezier(sourcePos, controlPoint, targetPos, t);
    points.push(point);
  }
  
  return points;
}

function quadraticBezier(p0: Vector3, p1: Vector3, p2: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return new Vector3(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z
  );
}
```

#### 4. Particle Rendering
**Location**: Enhance `components/Neural3D/NeuralParticlesInstancedV2.tsx`

```typescript
// In useFrame loop
particles.forEach((particle, id) => {
  const elapsed = (Date.now() - particle.startTime) / particle.duration;
  
  if (elapsed >= 1.0) {
    // Animation complete - remove particle
    removeParticleFlow(id);
    return;
  }
  
  // Get position along path
  const pathIndex = Math.floor(elapsed * (particle.path.length - 1));
  const nextIndex = Math.min(pathIndex + 1, particle.path.length - 1);
  const segmentT = (elapsed * (particle.path.length - 1)) - pathIndex;
  
  const position = new Vector3().lerpVectors(
    particle.path[pathIndex],
    particle.path[nextIndex],
    segmentT
  );
  
  // Update instance matrix
  matrix.setPosition(position);
  instancedMesh.setMatrixAt(particle.instanceId, matrix);
  
  // Fade out near end
  const opacity = elapsed > 0.8 ? (1 - (elapsed - 0.8) / 0.2) : 1.0;
  instancedMesh.setColorAt(particle.instanceId, 
    new Color(particle.color).multiplyScalar(opacity)
  );
});

instancedMesh.instanceMatrix.needsUpdate = true;
if (instancedMesh.instanceColor) {
  instancedMesh.instanceColor.needsUpdate = true;
}
```

---

## Implementation Steps

### Step 1: WebSocket Event Parsing
**File**: `components/Neural3D/NeuralArchitecture3DV2.tsx`

- [ ] Add flow event listener to existing WebSocket
- [ ] Parse flow events (source, target, intent_type)
- [ ] Generate unique particle ID
- [ ] Determine particle color based on intent or region

### Step 2: Path Calculation Utility
**File**: `components/Neural3D/NeuralPathUtils.ts` (new)

- [ ] Create bezier curve calculator
- [ ] Sample curve into array of points (50 segments)
- [ ] Handle edge cases (same node, missing nodes)
- [ ] Add curve variation for multiple simultaneous flows

### Step 3: Store Enhancement
**File**: `components/Neural3D/NeuralTelemetryStoreV2.ts`

- [ ] Add `particleFlows` Map to store
- [ ] Add `addParticleFlow()` action
- [ ] Add `removeParticleFlow()` action
- [ ] Add `clearOldParticles()` cleanup action

### Step 4: Particle Rendering
**File**: `components/Neural3D/NeuralParticlesInstancedV2.tsx`

- [ ] Modify useFrame to animate along paths
- [ ] Implement fade-out effect
- [ ] Add automatic cleanup after animation
- [ ] Optimize instance updates

### Step 5: Color Coding
**File**: `components/Neural3D/NeuralVisualEncodingV2.ts`

- [ ] Define color palette for intent types
- [ ] Create `getFlowColor()` function
- [ ] Add fallback to region colors

### Step 6: Testing & Optimization
- [ ] Test with low flow rate (1-10/sec)
- [ ] Test with high flow rate (100+/sec)
- [ ] Verify no memory leaks
- [ ] Check 60fps maintained
- [ ] Add throttling if needed

---

## Color Scheme

### By Intent Type
- **user_query**: Blue (#3B82F6)
- **system_task**: Green (#10B981)
- **data_read**: Cyan (#06B6D4)
- **data_write**: Orange (#F59E0B)
- **error**: Red (#EF4444)
- **unknown**: Gray (#6B7280)

### By Source Region (Fallback)
- **core**: Gold (#FFD700)
- **memory**: Deep Pink (#FF1493)
- **perception**: Turquoise (#00CED1)

---

## Performance Considerations

### Optimization Strategies
1. **Instanced Rendering**: Use InstancedMesh for all particles
2. **Object Pooling**: Reuse particle instances instead of creating new ones
3. **Throttling**: Limit particle creation to 100/sec
4. **Culling**: Don't render particles outside camera frustum
5. **LOD**: Reduce particle detail when camera is far

### Memory Management
- Max 500 active particles
- Automatic cleanup after 5 seconds
- Clear completed animations immediately
- Monitor heap usage

---

## Expected Result

When complete, users will see:
- ✨ Smooth colored particles flowing between nodes
- 🎨 Color-coded by activity type
- 🚀 Real-time visualization of system activity
- 📊 Visual indication of hot paths
- 🔍 Easy identification of active connections

---

## Testing Plan

### Manual Testing
1. Start backend with active flow
2. Open Neural 3D tab
3. Verify particles appear
4. Check smooth animation
5. Confirm colors match intent types
6. Verify cleanup after completion

### Performance Testing
1. Monitor FPS with 50 particles
2. Monitor FPS with 200 particles
3. Monitor FPS with 500 particles
4. Check memory usage over 10 minutes
5. Verify no leaks after 1000 flows

---

## Acceptance Criteria

- [ ] Particles animate smoothly along edges
- [ ] Colors correctly represent intent types
- [ ] No performance degradation (60fps maintained)
- [ ] No memory leaks after extended use
- [ ] Automatic cleanup works correctly
- [ ] Handles high throughput (100+ flows/sec)
- [ ] Visual polish (fade-out, smooth curves)

---

**Implementation Start**: January 12, 2026  
**Estimated Duration**: 2-3 hours  
**Status**: Ready to begin
