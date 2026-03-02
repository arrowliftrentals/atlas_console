# Neural 3D Visualization - Physical Layout Documentation

**Last Updated:** December 12, 2025
**Status:** Optimized with convex arched pathways
**Files:** `NeuralCognitiveLayoutV2.ts`, `NeuralEdgesInstancedV2.tsx`, `NeuralArchitecture3DV2.tsx`

## Shell Configuration

### Core Shell
- **Radius:** 20 units
- **Color:** Gold wireframe (#FFD700)
- **Layout:** Helical pattern around vertical axis
- **Node Count:** ~10-15 nodes
- **Contains:** Central reasoning, coordination, core agents
- **Visibility:** Visible

### Memory Shell  
- **Radius:** 60 units
- **Color:** Cyan wireframe (#00FFFF)
- **Layout:** Fibonacci sphere with optimized ordering for minimal path crossings
- **Node Count:** 37 nodes (varies by architecture)
- **Contains:** All memory systems (episodic, declarative, procedural, planning, layered, vector, storage)
- **Visibility:** Visible
- **Algorithm:** Two-phase optimization
  1. Initial uniform Fibonacci sphere distribution
  2. Free force-directed optimization to minimize path lengths
  3. Remap to uniform Fibonacci spacing with optimized node ordering

### Perception Shell (Hidden)
- **Radius:** 100 units
- **Status:** Currently filtered out of visualization
- **Contains:** Tools, APIs, telemetry, console nodes
- **Visibility:** Hidden (filtered at render time)

## Memory Shell Node Positions

The memory shell uses **Fibonacci sphere distribution** with golden angle φ = 137.5° (π(3-√5)).

### Position Formula
For node index `i` out of `N` total nodes on memory shell:
```
y = 1 - (i / (N - 1)) * 2                    // Vertical: -1 to +1
radius_at_y = sqrt(1 - y²)                    // Horizontal radius at height y
theta = φ * i                                  // Golden angle rotation
x = cos(theta) * radius_at_y * RADIUS         // Final x coordinate
z = sin(theta) * radius_at_y * RADIUS         // Final z coordinate
```

Where RADIUS = 60 for memory shell.

### Example Optimized Positions (37 nodes)

After optimization, nodes are arranged with the following characteristics:
- **Uniform spacing:** Every node maintains equal angular separation
- **Minimal crossings:** Connected nodes are positioned near each other in the ordering
- **Geodesic paths:** Edges follow sphere surface when possible

**Sample positions** (format: [x, y, z]):
```
Node Index 0:  [0.0, 60.0, 0.0]              (North pole)
Node Index 1:  [37.1, 46.4, 0.0]             (Upper hemisphere)
Node Index 2:  [-14.2, 46.4, 34.7]           
Node Index 3:  [-14.2, 46.4, -34.7]          
...
Node Index 18: [0.0, 0.0, 60.0]              (Equator)
...
Node Index 36: [0.0, -60.0, 0.0]             (South pole)
```

## Pathway Rendering System

### Same-Shell Connections (Convex Arched Paths)
**Algorithm:** Quadratic Bezier curve with outward bulge
**Implementation:** `createHelicalRibbonPath()` in `NeuralEdgesInstancedV2.tsx`

#### Physical Properties
- **Curve Type:** Quadratic Bezier (3 control points: start, control, end)
- **Segments:** 20 points per path
- **Arch Direction:** Convex (bulges OUTWARD from sphere center)
- **Thickness:** 0.04 units (constant tube radius)

#### Arch Height Calculation (Distance-Based)
The arch height scales with the distance between connected nodes:

```typescript
distance = start.distanceTo(end)

if (distance < 20) {
  archHeightRatio = 0.10  // Short paths: 10% of distance
} else if (distance < 60) {
  // Linear interpolation from 10% to 25%
  archHeightRatio = 0.10 + ((distance - 20) / 40) * 0.15
} else {
  archHeightRatio = 0.25  // Long paths: 25% of distance
}

archHeight = distance * archHeightRatio
```

**Distance Ranges:**
- **Short paths** (< 20 units): 10% arch height
  - Example: 15 unit path → 1.5 unit arch
- **Medium paths** (20-60 units): 10% to 25% scaled
  - Example: 40 unit path → 7.5 unit arch
- **Long paths** (> 60 units): 25% arch height
  - Example: 100 unit path → 25 unit arch

#### Shell Surface Constraint
Paths are constrained to stay within the shell surface:

```typescript
midpointRadius = midPoint.length()
maxArchHeight = radius - midpointRadius
archHeight = Math.min(archHeight, maxArchHeight * 0.9) // 90% safety margin
```

This ensures arches never extend beyond the shell boundary, maintaining visual coherence.

#### Control Point Calculation
```typescript
midPoint = (start + end) / 2
toOrigin = midPoint.normalize()  // Unit vector pointing outward from center
controlPoint = midPoint + toOrigin * archHeight  // Bulge outward
```

The control point is positioned along the radial direction from the origin through the midpoint, creating a natural convex arch.

### Cross-Shell Connections (Lightly Arched Straight Lines)
**Algorithm:** Same convex arch logic with reduced height
**Implementation:** `createCrossShellHelicalPath()` in `NeuralEdgesInstancedV2.tsx`

#### Physical Properties
- **Curve Type:** Quadratic Bezier (same as same-shell)
- **Segments:** 20 points per path
- **Arch Direction:** Convex (bulges outward)
- **Thickness:** 0.04 units (matches same-shell paths)

#### Arch Height (Half of Same-Shell)
Cross-shell connections use 50% of the same-shell arch height for a more direct appearance:

```typescript
if (distance < 20) {
  archHeightRatio = 0.05  // 5% (half of 10%)
} else if (distance < 60) {
  archHeightRatio = 0.05 + ((distance - 20) / 40) * 0.075  // 5% to 12.5%
} else {
  archHeightRatio = 0.125  // 12.5% (half of 25%)
}
```

**Result:** Cross-shell pathways appear nearly straight but with subtle curvature, distinguishing them from same-shell connections while maintaining visual consistency.

### Path Selection Logic
```typescript
startRadius = √(x₁² + y₁² + z₁²)
endRadius = √(x₂² + y₂² + z₂²)

if (|startRadius - endRadius| < 10) {
  // Same shell - use full arch
  pathPoints = createHelicalRibbonPath(start, end, avgRadius)
} else {
  // Cross-shell - use light arch
  pathPoints = createCrossShellHelicalPath(start, end, startRadius, endRadius)
}
```

Paths within 10 units of the same radius are treated as same-shell connections.

## Shell Rotation System

Each shell can be independently rotated:
- **Core:** Rotation stored in `shellRotations.core` (x, y, z in degrees)
- **Memory:** Rotation stored in `shellRotations.memory`
- **Perception:** Rotation stored in `shellRotations.perception`

Rotations are applied via 4x4 transformation matrix in world space.

## Custom/Dragged Positions

Nodes with custom positions (dragged by user or optimized):
- Stored in: `customNodePositions` Map<string, [x, y, z]>
- **Override behavior:** Custom positions bypass shell rotation transforms
- **Persistence:** Currently stored in React state only (lost on page reload)

To restore optimized positions after reload, run the optimization algorithm again via the "Optimize Memory Shell" button.

## Optimization Algorithm

**File:** `NeuralNodePositionOptimizer.ts`

### Phase 1: Initial Fibonacci Sphere
```typescript
const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle
for each node i:
  y = 1 - (i / (count - 1)) * 2
  radius_at_y = sqrt(1 - y²)
  theta = phi * i
  x = cos(theta) * radius_at_y * RADIUS
  z = sin(theta) * radius_at_y * RADIUS
```

### Phase 2: Force-Directed Optimization
- **Iterations:** 1000 (configurable)
- **Forces:**
  - Attraction to connected neighbors (edges)
  - Repulsion from all other nodes (maintains spacing)
- **Constraint:** All movement tangent to sphere surface
- **Temperature:** Gradual cooling to prevent oscillation

### Phase 3: Remap to Uniform Spacing
- Sort optimized positions by spherical angle (atan2(z, x), then by y)
- Redistribute using Fibonacci sphere with new ordering
- **Result:** Uniform spacing + optimized connection proximity

## Visibility Filtering

**Current state:** Core + Memory shells visible, Perception hidden

Filter logic in `NeuralArchitecture3DV2.tsx`:
```typescript
if (dist < CORE_RADIUS + 10)        // dist < 30: Core nodes
else if (dist < MEMORY_RADIUS + 15) // dist < 75: Memory nodes  
else                                 // dist >= 75: Perception (filtered out)
```

## Notes

- Node positions are deterministic based on node ordering after optimization
- Positions are computed on component mount from `computeCognitiveLayout()`
- Optimization preserves uniform Fibonacci spacing while improving connection layout
- Pathways use helical ribbons to create visually distinct 3D arcs along sphere surfaces
