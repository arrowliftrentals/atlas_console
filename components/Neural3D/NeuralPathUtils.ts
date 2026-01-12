import { Vector3 } from 'three';

/**
 * Calculate a bezier curve path between two nodes
 * Returns an array of Vector3 points along the curve
 */
export function calculateEdgePath(
  sourcePos: Vector3,
  targetPos: Vector3,
  curveAmount: number = 0.3,
  segments: number = 50
): Vector3[] {
  // Generate bezier curve points
  const midpoint = new Vector3().lerpVectors(sourcePos, targetPos, 0.5);
  
  const direction = new Vector3()
    .subVectors(targetPos, sourcePos)
    .normalize();
  
  // Create perpendicular offset for curve
  // In 3D space, use cross product with up vector for consistent curves
  const up = new Vector3(0, 0, 1);
  const perpendicular = new Vector3()
    .crossVectors(direction, up)
    .normalize()
    .multiplyScalar(curveAmount * sourcePos.distanceTo(targetPos));
  
  const controlPoint = midpoint.clone().add(perpendicular);
  
  // Sample points along bezier curve
  const points: Vector3[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = quadraticBezier(sourcePos, controlPoint, targetPos, t);
    points.push(point);
  }
  
  return points;
}

/**
 * Calculate point on quadratic bezier curve
 */
function quadraticBezier(
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  t: number
): Vector3 {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const ut2 = 2 * u * t;
  
  return new Vector3(
    uu * p0.x + ut2 * p1.x + tt * p2.x,
    uu * p0.y + ut2 * p1.y + tt * p2.y,
    uu * p0.z + ut2 * p1.z + tt * p2.z
  );
}

/**
 * Get position along path at normalized time t (0-1)
 */
export function getPathPosition(path: Vector3[], t: number): Vector3 {
  if (path.length === 0) return new Vector3();
  if (path.length === 1) return path[0].clone();
  
  const clampedT = Math.max(0, Math.min(1, t));
  const index = clampedT * (path.length - 1);
  const pathIndex = Math.floor(index);
  const nextIndex = Math.min(pathIndex + 1, path.length - 1);
  const segmentT = index - pathIndex;
  
  return new Vector3().lerpVectors(
    path[pathIndex],
    path[nextIndex],
    segmentT
  );
}

/**
 * Determine color for flow based on intent type or source region
 */
export function getFlowColor(
  intentType: string | undefined,
  sourceRegion: 'core' | 'memory' | 'perception'
): string {
  // Color by intent type (priority)
  const intentColors: Record<string, string> = {
    'user_query': '#3B82F6',      // Blue
    'system_task': '#10B981',     // Green
    'data_read': '#06B6D4',       // Cyan
    'data_write': '#F59E0B',      // Orange
    'error': '#EF4444',           // Red
    'tool_call': '#8B5CF6',       // Purple
    'llm_request': '#3B82F6',     // Blue
    'memory_read': '#EC4899',     // Pink
    'memory_write': '#F97316',    // Orange-red
  };
  
  if (intentType && intentColors[intentType]) {
    return intentColors[intentType];
  }
  
  // Fallback to source region color
  const regionColors: Record<string, string> = {
    'core': '#FFD700',      // Gold
    'memory': '#FF1493',    // Deep Pink
    'perception': '#00CED1' // Turquoise
  };
  
  return regionColors[sourceRegion] || '#6B7280'; // Gray fallback
}
