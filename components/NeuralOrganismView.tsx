'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, CatmullRomLine, Float, Cloud, Sphere, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { RefreshCw, Wifi, WifiOff, Move } from 'lucide-react';
import TabHeader from './TabHeader';
import { classifyNode, CognitiveRegion } from './Neural3D/NeuralCognitiveLayoutV2';
import { useTelemetry } from '@/contexts/TelemetryContext';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ComponentNode {
  id: string;
  label: string;
  type: string;
  status: string;
  dependencies: string[];
}

interface ComponentEdge {
  source: string;
  target: string;
  call_count?: number;
}

interface ArchitectureData {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
}

interface OrganicNode {
  id: string;
  label: string;
  position: THREE.Vector3;
  region: CognitiveRegion;
  degree: number;
  pulsePhase: number; // Each node pulses at its own rhythm
  dendriteCount: number; // How many dendrites this neuron has
  baseSize: number; // Size of the neuron body
  incomingDirections: THREE.Vector3[]; // Directions toward nodes that connect TO this node
  incomingEdgeStrengths: number[]; // Strength of each incoming edge (for arrival flash timing)
  axonDirection: THREE.Vector3; // Direction of axon (opposite to dendrites, where outgoing signals originate)
  hasOutgoingConnections: boolean; // Whether this node sends signals to others
  outgoingConnectionCount: number; // Number of outgoing connections (scales axon bulb)
}

interface OrganicEdge {
  source: string;
  target: string;
  strength: number; // 0-1 based on call_count
  curvePoints: THREE.Vector3[]; // Spline control points
  terminationPoint: THREE.Vector3; // Where synapse lands on dendrite
}

// ═══════════════════════════════════════════════════════════════════════════
// BIOLUMINESCENT COLOR PALETTE
// Inspired by deep sea creatures, fireflies, neural imaging
// ═══════════════════════════════════════════════════════════════════════════

const BIO_COLORS = {
  // Core - bright amber for synapses/paths
  core: {
    primary: '#FF6B35',
    glow: '#FF8C42',
    pulse: '#FFD700',
  },
  // Memory - violet/magenta, like hippocampal staining
  memory: {
    primary: '#9D4EDD',
    glow: '#C77DFF',
    pulse: '#E0AAFF',
  },
  // Perception - cyan/teal, like sensory cortex activity
  perception: {
    primary: '#00B4D8',
    glow: '#48CAE4',
    pulse: '#00E5FF',  // Brighter cyan for better text visibility
  },
  // Synapses - pale gold, the spark of connection
  synapse: '#FFF8DC',
  // Background void
  void: '#030712',
};

// Separate node body colors (can differ from synapse colors)
const BIO_NODE_COLORS = {
  core: {
    primary: '#FF6B35',  // Original orange
    glow: '#FF8C42',
    pulse: '#FFD700',
  },
  memory: BIO_COLORS.memory,
  perception: BIO_COLORS.perception,
};

// ═══════════════════════════════════════════════════════════════════════════
// ORGANIC LAYOUT - positions nodes in brain-like regions
// ═══════════════════════════════════════════════════════════════════════════

// Region centers form a horizontal brain layout (as viewed from side/above)
// Z-axis = front-to-back, X-axis = left-right, Y-axis = up-down
// Each region occupies a DISTINCT part of the brain volume
// scale: per-axis multipliers (X, Y, Z) to create oblong shapes
const BRAIN_REGIONS: Record<CognitiveRegion, { center: THREE.Vector3; spread: number; scale: THREE.Vector3 }> = {
  // Core at center-bottom - brainstem/deep structures, spread along X
  core: { center: new THREE.Vector3(0, -10, -50), spread: 35, scale: new THREE.Vector3(1.8, 0.8, 0.8) },
  // Memory spread wide along X (left-right) - oblong shape
  memory: { center: new THREE.Vector3(0, 40, -10), spread: 60, scale: new THREE.Vector3(1.5, 0.6, 1.2) },
  // Perception spread across frontal lobe
  perception: { center: new THREE.Vector3(0, 25, 60), spread: 85, scale: new THREE.Vector3(1, 1, 1) },
};

function computeOrganicLayout(
  nodes: ComponentNode[],
  edges: ComponentEdge[]
): { nodes: OrganicNode[]; edges: OrganicEdge[] } {
  // Build adjacency for degree calculation
  const degrees = new Map<string, number>();
  edges.forEach(e => {
    degrees.set(e.source, (degrees.get(e.source) || 0) + 1);
    degrees.set(e.target, (degrees.get(e.target) || 0) + 1);
  });
  const maxDegree = Math.max(...Array.from(degrees.values()), 1);

  // Group by region
  const byRegion: Record<CognitiveRegion, ComponentNode[]> = {
    core: [], memory: [], perception: []
  };
  nodes.forEach(n => {
    const region = classifyNode(n.id).region;
    byRegion[region].push(n);
  });
  
  // Debug: log region counts
  console.log('[NeuralOrganism] Region counts:', {
    core: byRegion.core.length,
    memory: byRegion.memory.length,
    perception: byRegion.perception.length,
    perceptionNodes: byRegion.perception.map(n => n.id)
  });

  // Position nodes organically within each region
  const organicNodes: OrganicNode[] = [];
  const nodePositions = new Map<string, THREE.Vector3>();

  (Object.keys(byRegion) as CognitiveRegion[]).forEach(region => {
    const regionConfig = BRAIN_REGIONS[region];
    const regionNodes = byRegion[region];
    
    // Sort by degree - high degree nodes closer to center
    regionNodes.sort((a, b) => (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0));
    
    regionNodes.forEach((node, i) => {
      const degree = degrees.get(node.id) || 0;
      const normalizedDegree = degree / maxDegree;
      
      // Golden angle spiral with organic noise
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const t = i / Math.max(regionNodes.length - 1, 1);
      
      // Higher degree = closer to center
      const radius = regionConfig.spread * (0.2 + (1 - normalizedDegree) * 0.8) * (0.3 + t * 0.7);
      
      // Spherical coordinates with organic perturbation
      const theta = goldenAngle * i;
      const phi = Math.acos(1 - 2 * (i + 0.5) / regionNodes.length);
      
      // Add organic noise based on node ID hash
      const hash = hashString(node.id);
      // Reduced noise for tighter clustering
      const noiseMultiplier = region === 'perception' ? 25 : 12;
      const noise = new THREE.Vector3(
        (hash % 100) / 100 - 0.5,
        ((hash >> 8) % 100) / 100 - 0.5,
        ((hash >> 16) % 100) / 100 - 0.5
      ).multiplyScalar(noiseMultiplier);
      
      // Apply per-axis scaling for oblong shapes
      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta) * regionConfig.scale.x,
        radius * Math.cos(phi) * regionConfig.scale.y,
        radius * Math.sin(phi) * Math.sin(theta) * regionConfig.scale.z
      ).add(regionConfig.center).add(noise);
      
      nodePositions.set(node.id, position);
      
      const baseSize = 2 + (degree / 10) * 1.5;
      
      organicNodes.push({
        id: node.id,
        label: formatLabel(node.label || node.id),
        position,
        region,
        degree,
        pulsePhase: (hash % 1000) / 1000 * Math.PI * 2,
        dendriteCount: 0, // Will be set after we compute incoming directions
        baseSize,
        incomingDirections: [], // Will be populated next
        incomingEdgeStrengths: [], // Will be populated next
        axonDirection: new THREE.Vector3(0, -1, 0), // Default down, will be computed
        hasOutgoingConnections: false, // Will be set based on edges
        outgoingConnectionCount: 0, // Will be set based on edges
      });
    });
  });
  
  // Build node lookup
  const nodeById = new Map<string, OrganicNode>();
  organicNodes.forEach(n => nodeById.set(n.id, n));
  
  // Track which edge index maps to which dendrite for each node
  const nodeIncomingEdges = new Map<string, { sourceId: string; direction: THREE.Vector3 }[]>();
  
  // In architecture data, edge source->target may mean "source depends on target"
  // which means signal flows target->source. Check both directions to be safe.
  // Dendrites receive signals, so they point toward where signals come FROM.
  edges.forEach(edge => {
    const edgeStrength = Math.min((edge.call_count || 1) / 100, 1);
    
    // Option 1: source sends to target (source -> target)
    const targetNode = nodeById.get(edge.target);
    const sourcePos = nodePositions.get(edge.source);
    
    if (targetNode && sourcePos) {
      const direction = sourcePos.clone().sub(targetNode.position).normalize();
      targetNode.incomingDirections.push(direction);
      targetNode.incomingEdgeStrengths.push(edgeStrength);
      
      if (!nodeIncomingEdges.has(edge.target)) {
        nodeIncomingEdges.set(edge.target, []);
      }
      nodeIncomingEdges.get(edge.target)!.push({ sourceId: edge.source, direction });
    }
    
    // Option 2: Also add reverse - source depends on target, so target sends to source
    const sourceNode = nodeById.get(edge.source);
    const targetPos = nodePositions.get(edge.target);
    
    if (sourceNode && targetPos) {
      const direction = targetPos.clone().sub(sourceNode.position).normalize();
      sourceNode.incomingDirections.push(direction);
      sourceNode.incomingEdgeStrengths.push(edgeStrength);
      
      if (!nodeIncomingEdges.has(edge.source)) {
        nodeIncomingEdges.set(edge.source, []);
      }
      nodeIncomingEdges.get(edge.source)!.push({ sourceId: edge.target, direction });
    }
  });
  
  // Track outgoing connections and their target positions
  const nodeOutgoingTargets = new Map<string, THREE.Vector3[]>();
  edges.forEach(edge => {
    // Mark source nodes as having outgoing connections
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const targetPos = nodePositions.get(edge.target);
    const sourcePos = nodePositions.get(edge.source);
    
    if (sourceNode && targetPos) {
      sourceNode.hasOutgoingConnections = true;
      sourceNode.outgoingConnectionCount++;
      if (!nodeOutgoingTargets.has(edge.source)) {
        nodeOutgoingTargets.set(edge.source, []);
      }
      nodeOutgoingTargets.get(edge.source)!.push(targetPos.clone());
    }
    if (targetNode && sourcePos) {
      targetNode.hasOutgoingConnections = true; // Bidirectional
      targetNode.outgoingConnectionCount++;
      if (!nodeOutgoingTargets.has(edge.target)) {
        nodeOutgoingTargets.set(edge.target, []);
      }
      nodeOutgoingTargets.get(edge.target)!.push(sourcePos.clone());
    }
  });
  
  // Set dendrite count and compute axon direction based on OUTGOING targets
  // with minimum angular separation from dendrites (like biological axon hillock)
  const MIN_AXON_DENDRITE_ANGLE = Math.PI / 3; // 60 degrees minimum separation
  
  organicNodes.forEach(node => {
    // Exact match: 1 dendrite per incoming connection, capped at 12 for performance
    node.dendriteCount = Math.min(node.incomingDirections.length, 12);
    
    // Helper: find minimum angle between a direction and all dendrites
    const minAngleToDendrites = (dir: THREE.Vector3): number => {
      if (node.incomingDirections.length === 0) return Math.PI;
      return Math.min(...node.incomingDirections.map(d => dir.angleTo(d)));
    };
    
    // Helper: find the clearest direction away from all dendrites
    const findClearDirection = (preferredDir: THREE.Vector3): THREE.Vector3 => {
      // If preferred direction is already clear, use it
      if (minAngleToDendrites(preferredDir) >= MIN_AXON_DENDRITE_ANGLE) {
        return preferredDir;
      }
      
      // Sample directions to find the clearest spot
      let bestDir = preferredDir.clone();
      let bestAngle = minAngleToDendrites(preferredDir);
      
      // Try rotating around various axes to find clear direction
      const rotationAxes = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1),
      ];
      
      for (const axis of rotationAxes) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const testDir = preferredDir.clone().applyAxisAngle(axis, angle).normalize();
          const minAngle = minAngleToDendrites(testDir);
          if (minAngle > bestAngle) {
            bestAngle = minAngle;
            bestDir = testDir;
          }
        }
      }
      
      return bestDir;
    };
    
    // Compute initial axon direction toward outgoing targets
    let initialAxonDir: THREE.Vector3;
    const outgoingTargets = nodeOutgoingTargets.get(node.id) || [];
    
    if (outgoingTargets.length > 0) {
      const centroid = new THREE.Vector3();
      outgoingTargets.forEach(pos => centroid.add(pos));
      centroid.divideScalar(outgoingTargets.length);
      initialAxonDir = centroid.clone().sub(node.position).normalize();
    } else if (node.incomingDirections.length > 0) {
      // Fallback: opposite to average dendrite direction
      const avgDendriteDir = new THREE.Vector3();
      node.incomingDirections.forEach(dir => avgDendriteDir.add(dir));
      avgDendriteDir.divideScalar(node.incomingDirections.length).normalize();
      initialAxonDir = avgDendriteDir.clone().negate();
    } else {
      // No connections - point axon in a random but consistent direction
      const hash = hashString(node.id + 'axon');
      const theta = ((hash % 100) / 100) * Math.PI * 2;
      const phi = ((hash >> 8) % 100) / 100 * Math.PI;
      initialAxonDir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).normalize();
    }
    
    // Ensure axon has minimum angular separation from dendrites
    node.axonDirection = findClearDirection(initialAxonDir);
  });
  
  // Helper: calculate dendrite tip position
  const getDendriteTipPosition = (node: OrganicNode, directionIndex: number): THREE.Vector3 => {
    const direction = node.incomingDirections[directionIndex];
    if (!direction) return node.position.clone();
    
    // Match the dendrite length calculation from DendriteTrees
    const hash = hashString(node.id + directionIndex);
    const length = node.baseSize * (0.8 + (hash % 30) / 60);
    
    // The tip is roughly at: position + direction * (baseSize * 0.85 + length)
    // Account for branching - tip is further out
    const tipDistance = node.baseSize * 0.85 + length * 1.5; // Approximate tip of branched structure
    
    return node.position.clone().add(direction.clone().multiplyScalar(tipDistance));
  };

  // Create organic curved edges - synapses terminate at dendrite tips
  const organicEdges: OrganicEdge[] = edges.map(edge => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    
    if (!sourceNode || !targetNode) {
      return null;
    }

    // Source: emanates from axon terminal bulb (matches visual bulb at 2.5 * baseSize)
    const axonTipOffset = sourceNode.axonDirection.clone().multiplyScalar(sourceNode.baseSize * 2.5);
    const sourcePos = sourceNode.position.clone().add(axonTipOffset);
    
    // Find which dendrite index this edge corresponds to
    const incomingList = nodeIncomingEdges.get(edge.target) || [];
    const dendriteIndex = incomingList.findIndex(e => e.sourceId === edge.source);
    
    // Get the tip position of that specific dendrite
    const targetPos = dendriteIndex >= 0 
      ? getDendriteTipPosition(targetNode, dendriteIndex)
      : targetNode.position.clone();

    // Create curved path with control points
    const midpoint = sourcePos.clone().add(targetPos).multiplyScalar(0.5);
    
    // Curve outward from center for visual separation
    const toCenter = midpoint.clone().normalize();
    const perpendicular = new THREE.Vector3()
      .crossVectors(toCenter, new THREE.Vector3(0, 1, 0))
      .normalize();
    
    // Ensure perpendicular is valid
    if (perpendicular.length() < 0.1) {
      perpendicular.set(1, 0, 0);
    }
    
    // Random curve direction based on edge
    const hash = hashString(edge.source + edge.target);
    const curveAmount = 8 + (hash % 15);
    const curveDir = (hash % 2 === 0 ? 1 : -1);
    
    const controlPoint = midpoint.clone()
      .add(perpendicular.multiplyScalar(curveAmount * curveDir))
      .add(new THREE.Vector3(0, (hash % 20) - 10, 0));

    return {
      source: edge.source,
      target: edge.target,
      strength: Math.min((edge.call_count || 1) / 100, 1),
      curvePoints: [sourcePos, controlPoint, targetPos],
      terminationPoint: targetPos.clone(),
    };
  }).filter(Boolean) as OrganicEdge[];

  return { nodes: organicNodes, edges: organicEdges };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function formatLabel(label: string): string {
  return label
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// DENDRITE TREES - Memoized branching fractal geometry
// ═══════════════════════════════════════════════════════════════════════════

interface BranchData {
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  radiusTop: number;
  radiusBottom: number;
  length: number;
}

const DendriteTrees = React.memo(function DendriteTrees({ 
  node, 
  colors, 
  baseSize,
  isDimmed = false,
}: { 
  node: OrganicNode; 
  colors: { primary: string; glow: string; pulse: string };
  baseSize: number;
  isDimmed?: boolean;
}) {
  // Compute all branches once and memoize
  const allBranches = useMemo(() => {
    const branches: BranchData[] = [];
    
    for (let i = 0; i < node.dendriteCount; i++) {
      const hash = hashString(node.id + i);
      const treeBranches: { start: THREE.Vector3; end: THREE.Vector3; radius: number }[] = [];
      
      const generateBranches = (
        start: THREE.Vector3,
        direction: THREE.Vector3,
        length: number,
        radius: number,
        depth: number,
        branchHash: number
      ) => {
        if (depth > 3 || radius < 0.08) return;
        
        // Deterministic bend using hash (reduced for more directional fidelity)
        const bendAmount = ((branchHash % 100) / 100 - 0.5) * 0.25;
        const bendAxis = new THREE.Vector3(
          (branchHash >> 4) % 100 / 100 - 0.5,
          (branchHash >> 8) % 100 / 100 - 0.5,
          (branchHash >> 12) % 100 / 100 - 0.5
        ).normalize();
        
        const curvedDir = direction.clone().applyAxisAngle(bendAxis, bendAmount).normalize();
        const end = start.clone().add(curvedDir.clone().multiplyScalar(length));
        
        treeBranches.push({ start: start.clone(), end: end.clone(), radius });
        
        // Branching
        const numBranches = depth === 0 ? 2 + (branchHash % 2) : 1 + (branchHash % 2);
        const branchLength = length * (0.55 + (branchHash % 20) / 100);
        const branchRadius = radius * 0.6;
        
        for (let b = 0; b < numBranches; b++) {
          const subHash = hashString(branchHash.toString() + b);
          const spreadAngle = (0.25 + (subHash % 30) / 100) * (b % 2 === 0 ? 1 : -1);
          
          // Deterministic perpendicular axis
          const spreadAxis = new THREE.Vector3(
            (subHash >> 4) % 100 / 100 - 0.5,
            (subHash >> 8) % 100 / 100 - 0.5,
            (subHash >> 12) % 100 / 100 - 0.5
          ).cross(curvedDir).normalize();
          
          if (spreadAxis.length() < 0.1) {
            spreadAxis.set(1, 0, 0).cross(curvedDir).normalize();
          }
          
          const branchDir = curvedDir.clone().applyAxisAngle(spreadAxis, spreadAngle);
          generateBranches(end, branchDir, branchLength, branchRadius, depth + 1, subHash);
        }
      };
      
      // Use actual incoming direction if available
      const rootDir = node.incomingDirections[i]?.clone() || new THREE.Vector3(0, 1, 0);
      
      const rootStart = rootDir.clone().multiplyScalar(baseSize * 0.85);
      const rootLength = baseSize * (0.8 + (hash % 30) / 60);
      const rootRadius = 0.35 + (hash % 10) / 40;
      
      generateBranches(rootStart, rootDir, rootLength, rootRadius, 0, hash);
      
      // Convert to renderable data
      treeBranches.forEach(branch => {
        const dir = branch.end.clone().sub(branch.start);
        const len = dir.length();
        const mid = branch.start.clone().add(branch.end).multiplyScalar(0.5);
        
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        
        branches.push({
          position: [mid.x, mid.y, mid.z],
          quaternion,
          radiusTop: branch.radius * 0.5,
          radiusBottom: branch.radius,
          length: len,
        });
      });
    }
    
    return branches;
  }, [node.id, node.dendriteCount, node.incomingDirections, baseSize]);
  
  return (
    <group>
      {allBranches.map((branch, i) => (
        <mesh key={i} position={branch.position} quaternion={branch.quaternion}>
          <cylinderGeometry args={[branch.radiusTop, branch.radiusBottom, branch.length, 5]} />
          <meshStandardMaterial
            color={colors.primary}
            emissive={colors.pulse}
            emissiveIntensity={isDimmed ? 0.05 : 0.3}
            transparent
            opacity={isDimmed ? 0.1 : 0.5}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// NEURON COMPONENT - Organic, pulsing node with dendrite tendrils
// ═══════════════════════════════════════════════════════════════════════════

function Neuron({ 
  node, 
  isSelected,
  isDimmed,
  isHighlighted,
  globalPulse,
  isActive = false,
  onClick,
  dragEnabled = false,
  onDrag,
  onDragStart,
  onDragEnd,
}: { 
  node: OrganicNode;
  isSelected: boolean;
  isDimmed: boolean;
  isHighlighted: boolean; // Part of selected network (brighter)
  globalPulse: number;
  isActive?: boolean;
  onClick: () => void;
  dragEnabled?: boolean;
  onDrag?: (position: THREE.Vector3) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const bulbRef = useRef<THREE.Mesh>(null);
  const isDragging = useRef(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const dragOffset = useRef(new THREE.Vector3());
  
  // Compute text opacity based on state
  const textOpacity = isDimmed ? 0.05 : isHighlighted ? 0.95 : isActive ? 0.75 : 0.4;
  const coreColors = BIO_NODE_COLORS[node.region]; // Only for central body
  const colors = BIO_COLORS[node.region];          // For halo, axon, dendrites
  const baseSize = node.baseSize;
  
  // Track telemetry activity flash decay
  const activityRef = useRef(0);
  
  // Breathing animation + signal arrival flash + telemetry activity
  useFrame((state, delta) => {
    if (!groupRef.current || !coreRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // In real telemetry mode, inactive neurons are calm (no pulsing)
    // In demo mode or when active, neurons pulse
    const pulseAmount = isActive ? 1 : 0.1; // Minimal pulse when inactive
    const personalPulse = Math.sin(time * 0.8 + node.pulsePhase) * 0.5 + 0.5;
    const breathe = 1 + personalPulse * 0.15 * pulseAmount;
    
    // Update telemetry activity (spike on active, then decay)
    if (isActive) {
      activityRef.current = Math.min(1, activityRef.current + delta * 8); // Fast rise
    } else {
      activityRef.current = Math.max(0, activityRef.current - delta * 2); // Slow decay
    }
    const telemetryFlash = activityRef.current;
    
    // Calculate arrival flash from incoming signals (only when active)
    let arrivalFlash = 0;
    if (isActive) {
      node.incomingEdgeStrengths.forEach((strength, i) => {
        const speed = 0.3 + strength * 0.4;
        const t = (time * speed) % 1;
        // Flash when signal arrives (t near 1) with phase offset per edge
        const phaseOffset = (i * 0.1) % 1;
        const adjustedT = (t + phaseOffset) % 1;
        if (adjustedT > 0.85) {
          arrivalFlash = Math.max(arrivalFlash, (adjustedT - 0.85) / 0.15);
        } else if (adjustedT < 0.1) {
          arrivalFlash = Math.max(arrivalFlash, 1 - adjustedT / 0.1);
        }
      });
    }
    
    // Combine all flash effects
    const combinedFlash = Math.max(arrivalFlash, telemetryFlash);
    
    // Highlight boost when part of selected network
    const highlightBoost = isHighlighted ? 0.6 : 0;
    
    // Subtle floating motion (reduced when inactive)
    const floatAmount = isActive ? 2 : 0.5;
    groupRef.current.position.y = node.position.y + Math.sin(time * 0.3 + node.pulsePhase) * floatAmount;
    
    // Core pulsing + arrival flash + telemetry flash + highlight
    const flashScale = 1 + combinedFlash * 0.3 + (isHighlighted ? 0.15 : 0);
    coreRef.current.scale.setScalar(breathe * flashScale * (isSelected ? 1.3 : 1));
    
    // Update emissive intensity based on pulse + flash effects + dimming/highlighting
    // Inactive neurons are dimmer
    const material = coreRef.current.material as THREE.MeshStandardMaterial;
    const activeMultiplier = isActive ? 1 : 0.3;
    const baseIntensity = (0.3 + personalPulse * 0.4 * pulseAmount + combinedFlash * 1.0 + highlightBoost) * activeMultiplier;
    material.emissiveIntensity = isDimmed ? baseIntensity * 0.12 : baseIntensity;
    material.opacity = isDimmed ? 0.25 : isActive ? 1 : 0.5;
    
    // Animate axon terminal bulb - bright when transmitting signal
    if (bulbRef.current) {
      const bulbMat = bulbRef.current.material as THREE.MeshStandardMaterial;
      
      if (!isActive) {
        // Inactive: dim and static
        bulbMat.opacity = 0.15;
        bulbMat.emissiveIntensity = 0.05;
      } else {
        // Active: animate signal transmission
        const signalSpeed = 0.35; // Average speed matching synapses
        const signalT = (time * signalSpeed) % 1;
        // Bulb is bright at signal start (t near 0) when signal is leaving
        const transmitIntensity = signalT < 0.15 ? 1 - signalT / 0.15 : 0;
        
        if (isDimmed) {
          bulbMat.opacity = 0.2 + transmitIntensity * 0.3;
          bulbMat.emissiveIntensity = 0.08 + transmitIntensity * 0.3;
        } else {
          bulbMat.opacity = 0.4 + transmitIntensity * 0.6; // 0.4 idle, 1.0 when firing
          bulbMat.emissiveIntensity = (isHighlighted ? 0.6 : 0.3) + transmitIntensity * 0.7;
        }
      }
    }
    
  });

  // Drag handlers
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!dragEnabled || !onDrag) return;
    e.stopPropagation();
    isDragging.current = true;
    onDragStart?.();
    
    // Set up drag plane perpendicular to camera
    const camera = e.camera as THREE.Camera;
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    dragPlane.current.setFromNormalAndCoplanarPoint(cameraDir, node.position);
    
    // Calculate offset from ray intersection to node center
    const intersect = new THREE.Vector3();
    if (e.ray.intersectPlane(dragPlane.current, intersect)) {
      dragOffset.current.subVectors(node.position, intersect);
    }
    
    (e.target as any).setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current || !onDrag) return;
    e.stopPropagation();
    
    const intersect = new THREE.Vector3();
    if (e.ray.intersectPlane(dragPlane.current, intersect)) {
      const newPos = intersect.add(dragOffset.current);
      onDrag(newPos);
    }
  };
  
  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    onDragEnd?.();
    (e.target as any).releasePointerCapture(e.pointerId);
  };

  return (
    <group ref={groupRef} position={node.position}>
      {/* Core body - irregular, organic shape */}
      <mesh
        ref={coreRef}
        onClick={(e) => { if (!dragEnabled) { e.stopPropagation(); onClick(); } }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <icosahedronGeometry args={[baseSize, 1]} />
        <meshStandardMaterial
          color={coreColors.primary}
          emissive={coreColors.glow}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.1}
          transparent
        />
      </mesh>
      
      {/* Soft glow halo */}
      <Sphere args={[baseSize * (isHighlighted ? 3 : 2.5), 16, 16]}>
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={isDimmed ? 0.02 : isHighlighted ? 0.15 : 0.08}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Axon hillock - thick stem where outgoing signals originate */}
      {node.hasOutgoingConnections && (() => {
        // Scale bulb with connection count: more connections = larger bulb
        const connectionScale = 1 + Math.min(node.outgoingConnectionCount, 10) * 0.12;
        const bulbRadius = baseSize * 0.25 * connectionScale;
        const trunkTopRadius = baseSize * 0.12 * connectionScale;
        const trunkBottomRadius = baseSize * 0.35 * connectionScale;
        
        return (
          <group>
            {/* Main axon trunk - color varies by region */}
            <mesh
              position={[
                node.axonDirection.x * baseSize * 1.2,
                node.axonDirection.y * baseSize * 1.2,
                node.axonDirection.z * baseSize * 1.2,
              ]}
              quaternion={new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                node.axonDirection
              )}
            >
              <cylinderGeometry args={[trunkTopRadius, trunkBottomRadius, baseSize * 1.8, 8]} />
              <meshStandardMaterial
                color={node.region === 'memory' ? '#6B2D7B' : node.region === 'core' ? '#E07020' : '#1A5276'}
                emissive={node.region === 'memory' ? '#8B3D9B' : node.region === 'core' ? '#FF8533' : '#2874A6'}
                emissiveIntensity={isDimmed ? 0.08 : isHighlighted ? 0.7 : 0.4}
                transparent
                opacity={isDimmed ? 0.15 : 0.9}
              />
            </mesh>
            {/* Axon terminal bulb - scales with connection count */}
            <mesh
              ref={bulbRef}
              position={[
                node.axonDirection.x * baseSize * 2.5,
                node.axonDirection.y * baseSize * 2.5,
                node.axonDirection.z * baseSize * 2.5,
              ]}
            >
              <sphereGeometry args={[bulbRadius, 8, 8]} />
              <meshStandardMaterial
                color={colors.pulse}
                emissive={colors.pulse}
                emissiveIntensity={0.3}
                transparent
                opacity={0.4}
              />
            </mesh>
          </group>
        );
      })()}
      
      {/* Dendrite tendrils - branching fractal trees (memoized) */}
      <DendriteTrees node={node} colors={colors} baseSize={baseSize} isDimmed={isDimmed} />
      
      {/* Bioluminescent label - follows same dim/highlight as neuron */}
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <Text
          position={[0, baseSize * 3.5, 0]}
          fontSize={baseSize * 0.8}
          color={colors.pulse}
          anchorX="center"
          anchorY="middle"
          outlineWidth={isDimmed ? 0 : 0.06}
          outlineColor={colors.glow}
          outlineOpacity={textOpacity * 0.6}
          fillOpacity={textOpacity}
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNAPSE COMPONENT - Curved, pulsing connection with traveling signal
// ═══════════════════════════════════════════════════════════════════════════

function Synapse({
  edge,
  sourceRegion,
  globalPulse,
  isDimmed,
  isHighlighted,
  isActive = true,
}: {
  edge: OrganicEdge;
  sourceRegion: CognitiveRegion;
  globalPulse: number;
  isDimmed: boolean;
  isHighlighted: boolean;
  isActive?: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  
  const colors = BIO_COLORS[sourceRegion];
  
  // Create smooth curve for the synapse
  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      edge.curvePoints[0],
      edge.curvePoints[1],
      edge.curvePoints[2]
    );
  }, [edge.curvePoints]);
  
  const curvePoints = useMemo(() => curve.getPoints(20), [curve]);
  
  // Create line geometry
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    return geometry;
  }, [curvePoints]);
  
  // Calculate tube segments for opacity wave animation
  const tubeSegments = useMemo(() => {
    const numSegments = 20;
    const segments: { start: THREE.Vector3; end: THREE.Vector3; t: number }[] = [];
    for (let i = 0; i < numSegments; i++) {
      const t1 = i / numSegments;
      const t2 = (i + 1) / numSegments;
      segments.push({
        start: curve.getPoint(t1),
        end: curve.getPoint(t2),
        t: (t1 + t2) / 2,
      });
    }
    return segments;
  }, [curve]);
  
  // All connections are myelinated (have opacity wave effect)
  const isMyelinated = true;
  
  // Refs for animated segment materials
  const segmentRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  
  // Animate signal pulse and opacity waves traveling along synapse
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Signal travels along the synapse periodically
    const speed = 0.3 + edge.strength * 0.4;
    const t = (time * speed) % 1;
    
    if (pulseRef.current) {
      const point = curve.getPoint(t);
      pulseRef.current.position.copy(point);
      
      // Pulse brightness varies along journey, dim if not selected
      // In real telemetry mode, inactive edges don't show pulse
      const brightness = Math.sin(t * Math.PI);
      const material = pulseRef.current.material as THREE.MeshBasicMaterial;
      if (!isActive) {
        material.opacity = 0; // Hidden when not active in real mode
      } else if (isDimmed) {
        material.opacity = 0.05 + brightness * 0.08;
      } else {
        material.opacity = (isHighlighted ? 0.5 : 0.3) + brightness * (isHighlighted ? 0.5 : 0.7);
      }
    }
    
    // Animate colored waves radiating from signal pulse position
    if (isMyelinated) {
      segmentRefs.current.forEach((mat, i) => {
        if (mat) {
          const segT = tubeSegments[i]?.t || 0;
          // Calculate distance from pulse position
          const distFromPulse = Math.abs(segT - t);
          // Wave trails behind the pulse, fading with distance
          const waveRadius = 0.25;
          const wave = Math.max(0, 1 - distFromPulse / waveRadius);
          // Brighten near signal pulse - dim by default, bright when highlighted
          mat.color.set(colors.pulse);
          mat.emissive.set(colors.glow);
          // Wave effect only when active
          const effectiveWave = isActive ? wave : 0;
          
          if (isHighlighted) {
            // Selected pathway - bright, animated if active
            mat.opacity = 0.5 + effectiveWave * 0.4;
            mat.emissiveIntensity = 0.3 + effectiveWave * 0.5;
          } else if (isDimmed) {
            // Non-selected pathway when something is selected
            mat.opacity = 0.05 + effectiveWave * 0.08;
            mat.emissiveIntensity = 0.02 + effectiveWave * 0.05;
          } else if (!isActive) {
            // Real telemetry mode, no selection, inactive edge - match demo defaults
            mat.opacity = 0.26;
            mat.emissiveIntensity = 0.12;
          } else {
            // Default state - subtle with animation
            mat.opacity = 0.25 + effectiveWave * 0.12;
            mat.emissiveIntensity = 0.12 + effectiveWave * 0.1;
          }
        }
      });
    }
  });

  const baseOpacity = 0.4 + edge.strength * 0.4;
  const highlightBoost = isHighlighted ? 0.3 : 0;
  const lineOpacity = isDimmed ? baseOpacity * 0.08 : baseOpacity + highlightBoost;
  
  const lineMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: colors.pulse,
      transparent: true,
      opacity: lineOpacity,
    });
  }, [colors.pulse, lineOpacity, isDimmed, isHighlighted]);

  return (
    <group>
      {/* Opacity wave tube - animated traveling bands for myelinated, line for short */}
      {isMyelinated ? (
        tubeSegments.map((seg, i) => {
          const dir = seg.end.clone().sub(seg.start);
          const len = dir.length();
          const mid = seg.start.clone().add(seg.end).multiplyScalar(0.5);
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.normalize()
          );
          return (
            <mesh key={i} position={mid} quaternion={quat}>
              <cylinderGeometry args={[0.4, 0.4, len, 6]} />
              <meshStandardMaterial
                ref={(el) => { segmentRefs.current[i] = el; }}
                color={colors.pulse}
                emissive={colors.glow}
                emissiveIntensity={0.12}
                transparent
                opacity={0.25}
              />
            </mesh>
          );
        })
      ) : (
        <primitive object={new THREE.Line(lineGeometry, lineMaterial)} />
      )}
      
      {/* Traveling signal pulse - hidden when inactive */}
      {isActive && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[(isHighlighted ? 1.2 : 0.8) + edge.strength, 8, 8]} />
          <meshBasicMaterial
            color={BIO_COLORS.synapse}
            transparent
            opacity={isDimmed ? 0.08 : isHighlighted ? 1.0 : 0.8}
          />
        </mesh>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEURAL FOG - Volumetric ambient glow around regions
// Ellipsoid shapes that follow the natural cluster distributions
// ═══════════════════════════════════════════════════════════════════════════

// Ellipsoid scale factors for each region to match cluster shapes
// Horizontal brain layout with oblong regions
const REGION_ELLIPSOID_SCALES: Record<CognitiveRegion, [number, number, number]> = {
  // Core (back): matches oblong X spread
  core: [1.8, 0.8, 0.6],
  // Memory (top): wide along X, flat along Y
  memory: [1.5, 0.5, 1.0],
  // Perception (front): spherical spread
  perception: [1.0, 0.9, 1.0],
};

function NeuralFog({ region }: { region: CognitiveRegion }) {
  const config = BRAIN_REGIONS[region];
  const colors = BIO_COLORS[region];
  const ellipsoidScale = REGION_ELLIPSOID_SCALES[region];
  
  return (
    <group position={[config.center.x, config.center.y, config.center.z]}>
      {/* Multiple translucent ellipsoids for volumetric effect */}
      {[1.2, 0.85, 0.5].map((layerScale, i) => (
        <mesh
          key={i}
          scale={[
            config.spread * layerScale * ellipsoidScale[0] * config.scale.x,
            config.spread * layerScale * ellipsoidScale[1] * config.scale.y,
            config.spread * layerScale * ellipsoidScale[2] * config.scale.z,
          ]}
        >
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial
            color={colors.glow}
            transparent
            opacity={0.025 / (i + 1)}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GLIAL PARTICLES - Floating ambient particles like supporting cells
// ═══════════════════════════════════════════════════════════════════════════

function GlialParticles({ count = 200 }: { count?: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const particlesData = useRef<{ position: THREE.Vector3; velocity: THREE.Vector3; phase: number }[]>([]);
  
  // Initialize particles
  useMemo(() => {
    particlesData.current = Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 300,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 300
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      ),
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.elapsedTime;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    
    particlesData.current.forEach((particle, i) => {
      // Gentle drifting motion
      particle.position.add(particle.velocity);
      particle.position.y += Math.sin(time * 0.5 + particle.phase) * 0.02;
      
      // Wrap around bounds
      if (Math.abs(particle.position.x) > 150) particle.velocity.x *= -1;
      if (Math.abs(particle.position.y) > 150) particle.velocity.y *= -1;
      if (Math.abs(particle.position.z) > 150) particle.velocity.z *= -1;
      
      // Pulsing size
      const pulse = 0.5 + Math.sin(time + particle.phase) * 0.3;
      
      matrix.setPosition(particle.position);
      matrix.scale(new THREE.Vector3(pulse, pulse, pulse));
      meshRef.current!.setMatrixAt(i, matrix);
      
      // Soft color variation
      const hue = 0.55 + Math.sin(particle.phase) * 0.1;
      color.setHSL(hue, 0.3, 0.6);
      meshRef.current!.setColorAt(i, color);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[0.5, 6, 6]} />
      <meshBasicMaterial transparent opacity={0.3} />
    </instancedMesh>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BRAIN MEMBRANE - Outer containment shell giving organic boundary
// ═══════════════════════════════════════════════════════════════════════════

function BrainMembrane() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create brain-shaped geometry - horizontal orientation (like brain in skull)
  const brainGeometry = useMemo(() => {
    // Create sphere with actual size (not unit sphere)
    const geo = new THREE.SphereGeometry(90, 48, 32);
    const positions = geo.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      let x = positions.getX(i);
      let y = positions.getY(i);
      let z = positions.getZ(i);
      
      // Normalize to unit sphere for calculations
      const r = Math.sqrt(x*x + y*y + z*z);
      const nx = x / r;
      const ny = y / r;
      const nz = z / r;
      
      // Start with base radius
      let newR = r;
      
      // 1. Elongate front-to-back (Z-axis) - brain is longer than wide
      newR *= (1 + Math.abs(nz) * 0.25);
      
      // 2. Flatten bottom and taper back (brainstem area at -Z, -Y)
      if (nz < -0.3) {
        newR *= (0.75 + (nz + 1) * 0.25);
      }
      if (ny < -0.3) {
        newR *= (0.85 + (ny + 1) * 0.15);
      }
      
      // 3. Central fissure (groove on top, along Z axis)
      if (ny > 0.2) {
        const groove = Math.exp(-nx * nx * 25) * ny * 0.1;
        newR *= (1 - groove);
      }
      
      // 4. Frontal lobe bulge (front is bigger)
      if (nz > 0.3) {
        newR *= (1 + nz * 0.12);
      }
      
      // 5. Temporal lobe bulges (sides, toward front-middle)
      if (ny < 0.1 && ny > -0.3 && nz > -0.2) {
        const bulge = Math.abs(nx) * 0.1 * (1 - Math.abs(nz) * 0.3);
        newR *= (1 + bulge);
      }
      
      // 6. Subtle organic noise
      const noise = Math.sin(nx * 12 + ny * 10) * Math.cos(nz * 11) * 0.012;
      newR *= (1 + noise);
      
      // Apply new radius - scale and position to match node layout
      // X = width, Y = height, Z = depth (front-back)
      positions.setXYZ(i, nx * newR * 0.85, ny * newR * 0.7, nz * newR * 1.0);
    }
    
    geo.computeVertexNormals();
    return geo;
  }, []);
  
  // Subtle breathing animation
  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const breathe = 1 + Math.sin(time * 0.3) * 0.01;
    meshRef.current.scale.set(breathe, breathe, breathe);
  });
  
  return (
    <group>
      {/* Outer membrane - translucent brain surface */}
      <mesh ref={meshRef} geometry={brainGeometry}>
        <meshBasicMaterial
          color="#6080a0"
          transparent
          opacity={0.02}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Inner subtle glow */}
      <mesh geometry={brainGeometry} scale={0.95}>
        <meshBasicMaterial
          color="#4060a0"
          transparent
          opacity={0.008}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BREATHING CONTROLLER - Global rhythm for the organism
// ═══════════════════════════════════════════════════════════════════════════

function useGlobalPulse() {
  const [pulse, setPulse] = useState(0);
  
  useFrame((state) => {
    // Slow, steady breathing rhythm
    const breathe = Math.sin(state.clock.elapsedTime * 0.4) * 0.5 + 0.5;
    setPulse(breathe);
  });
  
  return pulse;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SCENE
// ═══════════════════════════════════════════════════════════════════════════

function OrganismScene({
  data,
  selectedNode,
  setSelectedNode,
  activeNodes,
  useRealTelemetry,
  dragEnabled,
  nodePositionOverrides,
  onNodeDrag,
  autoRotateSpeed = 0.3,
}: {
  data: ArchitectureData | null;
  selectedNode: string | null;
  setSelectedNode: (id: string | null) => void;
  activeNodes: Set<string>;
  useRealTelemetry: boolean;
  dragEnabled: boolean;
  nodePositionOverrides: Map<string, THREE.Vector3>;
  onNodeDrag: (nodeId: string, position: THREE.Vector3) => void;
  autoRotateSpeed?: number;
}) {
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const globalPulse = useGlobalPulse();
  
  // Compute organic layout
  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return computeOrganicLayout(data.nodes, data.edges);
  }, [data]);
  
  // Apply position overrides from dragging
  const nodes = useMemo(() => {
    return baseNodes.map(node => {
      const override = nodePositionOverrides.get(node.id);
      if (override) {
        return { ...node, position: override.clone() };
      }
      return node;
    });
  }, [baseNodes, nodePositionOverrides]);
  
  // Build node position map for edge recalculation
  const nodePositionMap = useMemo(() => {
    const map = new Map<string, THREE.Vector3>();
    nodes.forEach(n => map.set(n.id, n.position));
    return map;
  }, [nodes]);
  
  // Recalculate edges with updated node positions
  const edges = useMemo(() => {
    return baseEdges.map(edge => {
      const sourcePos = nodePositionMap.get(edge.source);
      const targetPos = nodePositionMap.get(edge.target);
      
      if (!sourcePos || !targetPos) return edge;
      
      // Recalculate curve points
      const midPoint = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
      const distance = sourcePos.distanceTo(targetPos);
      
      // Add organic curve offset - use deterministic hash for stable curves
      const perpendicular = new THREE.Vector3()
        .subVectors(targetPos, sourcePos)
        .cross(new THREE.Vector3(0, 1, 0))
        .normalize();
      
      // Deterministic offset based on edge IDs (stable across re-renders)
      const edgeHash = hashString(edge.source + edge.target);
      const hashNormalized = (edgeHash % 1000) / 1000; // 0-1 range
      const curveOffset = perpendicular.multiplyScalar(distance * 0.15 * (hashNormalized - 0.5 + 0.5));
      midPoint.add(curveOffset);
      midPoint.y += distance * 0.1;
      
      return {
        ...edge,
        curvePoints: [sourcePos.clone(), midPoint, targetPos.clone()],
        terminationPoint: targetPos.clone(),
      };
    });
  }, [baseEdges, nodePositionMap]);
  
  // Map for quick region lookup
  const nodeRegionMap = useMemo(() => {
    const map = new Map<string, CognitiveRegion>();
    nodes.forEach(n => map.set(n.id, n.region));
    return map;
  }, [nodes]);
  
  // Compute connected nodes
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const connected = new Set<string>();
    connected.add(selectedNode);
    edges.forEach(edge => {
      if (edge.source === selectedNode) connected.add(edge.target);
      if (edge.target === selectedNode) connected.add(edge.source);
    });
    return connected;
  }, [selectedNode, edges]);
  
  // Check if an edge involves the selected node
  const isEdgeHighlighted = useCallback((edge: OrganicEdge) => {
    if (!selectedNode) return true; // No selection = all visible
    return edge.source === selectedNode || edge.target === selectedNode;
  }, [selectedNode]);

  return (
    <>
      {/* Deep space lighting */}
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 50, 0]} intensity={0.8} color="#FF6B35" />
      <pointLight position={[-50, 0, 50]} intensity={0.5} color="#9D4EDD" />
      <pointLight position={[50, 0, -50]} intensity={0.5} color="#00B4D8" />
      
      
      {/* Outer brain membrane */}
      <BrainMembrane />
      
      {/* Regional fog volumes - disabled */}
      {/* <NeuralFog region="core" />
      <NeuralFog region="memory" />
      <NeuralFog region="perception" /> */}
      
      {/* Floating glial particles */}
      <GlialParticles count={150} />
      
      {/* Synaptic connections */}
      {edges.map((edge, i) => {
        const isEdgeConnected = isEdgeHighlighted(edge);
        return (
          <Synapse
            key={`synapse-${i}`}
            edge={edge}
            sourceRegion={nodeRegionMap.get(edge.source) || 'perception'}
            globalPulse={globalPulse}
            isDimmed={selectedNode !== null && !isEdgeConnected}
            isHighlighted={selectedNode !== null && isEdgeConnected}
            isActive={!useRealTelemetry || (activeNodes.has(edge.source) || activeNodes.has(edge.target))}
          />
        );
      })}
      
      {/* Neuron bodies */}
      {nodes.map(node => {
        const isConnected = connectedNodes.has(node.id);
        return (
          <Neuron
            key={node.id}
            node={node}
            isSelected={selectedNode === node.id}
            isDimmed={selectedNode !== null && !isConnected}
            isHighlighted={selectedNode !== null && isConnected}
            globalPulse={globalPulse}
            isActive={!useRealTelemetry || activeNodes.has(node.id)}
            onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
            dragEnabled={dragEnabled}
            onDrag={(pos) => onNodeDrag(node.id, pos)}
            onDragStart={() => setIsDraggingNode(true)}
            onDragEnd={() => setIsDraggingNode(false)}
          />
        );
      })}
      
      {/* Camera controls - disabled during node drag */}
      <OrbitControls
        enabled={!isDraggingNode}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.3}
        zoomSpeed={0.5}
        minDistance={65}
        maxDistance={500}
        autoRotate={!dragEnabled}
        autoRotateSpeed={autoRotateSpeed}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTED FOR EMBEDDING
// ═══════════════════════════════════════════════════════════════════════════

export { OrganismScene, BIO_COLORS };

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default function NeuralOrganismView() {
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useRealTelemetry, setUseRealTelemetry] = useState(true);
  const [dragEnabled, setDragEnabled] = useState(false);
  const [nodePositionOverrides, setNodePositionOverrides] = useState<Map<string, THREE.Vector3>>(new Map());
  
  // Real telemetry integration
  const { latestFrame, connectionStatus } = useTelemetry();
  
  // Track recently active nodes (with decay)
  const [recentlyActiveNodes, setRecentlyActiveNodes] = useState<Set<string>>(new Set());
  const activeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Extract active node IDs from telemetry - handle actual backend format
  useEffect(() => {
    if (!latestFrame) return;
    
    const newActive = new Set<string>();
    
    // Handle execution_flow events (ACTUAL BACKEND FORMAT)
    if (latestFrame.type === 'execution_flow' && latestFrame.source && latestFrame.target) {
      newActive.add(latestFrame.source);
      newActive.add(latestFrame.target);
    }
    
    // Handle batch events
    if (latestFrame.type === 'batch' && latestFrame.events) {
      latestFrame.events.forEach((event: any) => {
        if (event.source) newActive.add(event.source);
        if (event.target) newActive.add(event.target);
      });
    }
    
    // Legacy format support (active_traces)
    if (latestFrame.active_traces) {
      latestFrame.active_traces.forEach((trace: any) => {
        if (trace.spans) {
          trace.spans.forEach((span: any) => {
            if (span.source) newActive.add(span.source);
            if (span.target) newActive.add(span.target);
          });
        }
      });
    }
    
    // Add new nodes to active set with decay timeout
    if (newActive.size > 0) {
      setRecentlyActiveNodes(prev => {
        const updated = new Set(prev);
        newActive.forEach(nodeId => {
          updated.add(nodeId);
          
          // Clear existing timeout for this node
          const existingTimeout = activeTimeoutsRef.current.get(nodeId);
          if (existingTimeout) clearTimeout(existingTimeout);
          
          // Set new timeout to remove node after 2 seconds
          const timeout = setTimeout(() => {
            setRecentlyActiveNodes(current => {
              const next = new Set(current);
              next.delete(nodeId);
              return next;
            });
            activeTimeoutsRef.current.delete(nodeId);
          }, 2000);
          activeTimeoutsRef.current.set(nodeId, timeout);
        });
        return updated;
      });
    }
  }, [latestFrame]);
  
  // Use recentlyActiveNodes as the active set
  const activeNodes = recentlyActiveNodes;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/v1/architecture/graph');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load architecture data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats
  const stats = useMemo(() => {
    if (!data) return { nodes: 0, edges: 0, core: 0, memory: 0, perception: 0 };
    let core = 0, memory = 0, perception = 0;
    data.nodes.forEach(node => {
      const region = classifyNode(node.id).region;
      if (region === 'core') core++;
      else if (region === 'memory') memory++;
      else perception++;
    });
    return { nodes: data.nodes.length, edges: data.edges.length, core, memory, perception };
  }, [data]);
  
  // Real telemetry stats
  const telemetryStats = useMemo(() => {
    return {
      activeTraces: latestFrame?.type === 'execution_flow' ? 1 : (latestFrame?.events?.length || 0),
      activeSpans: latestFrame?.type === 'execution_flow' ? 1 : (latestFrame?.events?.length || 0),
      activeComponents: activeNodes.size,
    };
  }, [latestFrame, activeNodes]);
  
  const isTelemetryConnected = connectionStatus === 'open';
  
  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, position: THREE.Vector3) => {
    setNodePositionOverrides(prev => {
      const next = new Map(prev);
      next.set(nodeId, position.clone());
      return next;
    });
  }, []);
  
  // Export positions to console
  const exportPositions = useCallback(() => {
    const positions: Record<string, { x: number; y: number; z: number }> = {};
    nodePositionOverrides.forEach((pos, id) => {
      positions[id] = { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) };
    });
    console.log('Node position overrides:', JSON.stringify(positions, null, 2));
  }, [nodePositionOverrides]);

  return (
    <div className="h-full flex flex-col" style={{ background: BIO_COLORS.void }}>
      <TabHeader
        title="Neural Cognition"
        subtitle="Live Synaptic Map"
        statusConnected={!isLoading && !error}
        statusLabel={isLoading ? 'Loading...' : error ? 'Error' : 'Alive'}
      >
        <div className="flex items-center gap-2 mr-2 text-xs">
          {isTelemetryConnected ? (
            <Wifi className="w-3 h-3 text-green-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-gray-500" />
          )}
          <span className={isTelemetryConnected ? 'text-green-400' : 'text-gray-500'}>
            {isTelemetryConnected ? 'Live' : 'Offline'}
          </span>
        </div>
        <button
          onClick={() => setUseRealTelemetry(!useRealTelemetry)}
          className={`px-3 py-2 border rounded text-xs flex items-center gap-2 transition-colors ${
            useRealTelemetry 
              ? 'bg-green-900/50 border-green-600 text-green-400' 
              : 'bg-[#1E1E1E] border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${useRealTelemetry ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          {useRealTelemetry ? 'Real' : 'Demo'}
        </button>
        <button
          onClick={() => setDragEnabled(!dragEnabled)}
          className={`px-3 py-2 border rounded text-xs flex items-center gap-2 transition-colors ${
            dragEnabled 
              ? 'bg-amber-900/50 border-amber-600 text-amber-400' 
              : 'bg-[#1E1E1E] border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <Move className="w-3 h-3" />
          {dragEnabled ? 'Dragging' : 'Drag'}
        </button>
        {dragEnabled && nodePositionOverrides.size > 0 && (
          <button
            onClick={exportPositions}
            className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300"
          >
            Export ({nodePositionOverrides.size})
          </button>
        )}
        <button
          onClick={fetchData}
          className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" />
          Reload
        </button>
      </TabHeader>

      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [0, 80, 180], fov: 50 }}
          gl={{ antialias: true, alpha: false }}
          onPointerMissed={() => setSelectedNode(null)}
        >
          <color attach="background" args={[BIO_COLORS.void]} />
{/* <fog attach="fog" args={[BIO_COLORS.void, 350, 900]} /> */}
          <OrganismScene
            data={data}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
            activeNodes={activeNodes}
            useRealTelemetry={useRealTelemetry}
            dragEnabled={dragEnabled}
            nodePositionOverrides={nodePositionOverrides}
            onNodeDrag={handleNodeDrag}
          />
        </Canvas>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        )}

        {/* Stats HUD - organic styling */}
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs p-4 rounded-2xl border border-white/10">
          <div className="font-light tracking-wide mb-3 text-white/60">VITAL SIGNS</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: BIO_COLORS.core.primary }} />
              <span className="text-white/80">Core Nodes: {stats.core}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: BIO_COLORS.memory.primary }} />
              <span className="text-white/80">Memory Nodes: {stats.memory}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: BIO_COLORS.perception.primary }} />
              <span className="text-white/80">Perception Nodes: {stats.perception}</span>
            </div>
            <div className="mt-3 pt-2 border-t border-white/10 text-white/50">
              {stats.edges} Synaptic Connections
            </div>
          </div>
          
          {/* Real telemetry section */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <div className="font-light tracking-wide mb-2 text-white/60">LIVE ACTIVITY</div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-white/50">Active Traces:</span>
                <span className={telemetryStats.activeTraces > 0 ? 'text-green-400' : 'text-white/30'}>
                  {telemetryStats.activeTraces}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Active Spans:</span>
                <span className={telemetryStats.activeSpans > 0 ? 'text-green-400' : 'text-white/30'}>
                  {telemetryStats.activeSpans}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Firing Neurons:</span>
                <span className={telemetryStats.activeComponents > 0 ? 'text-amber-400' : 'text-white/30'}>
                  {telemetryStats.activeComponents}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
