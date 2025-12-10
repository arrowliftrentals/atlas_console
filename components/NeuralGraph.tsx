'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Node, Edge, Graph, ActiveFlow } from './NeuralNetworkScene';
import NeuralNode from './NeuralNode';
import NeuralEdge from './NeuralEdge';

interface NeuralGraphProps {
  graph: Graph;
  activitySpeed: number;
  showLabels: boolean;
  selectedNode: string | null;
  hoveredNode: string | null;
  activeFlows: ActiveFlow[];
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
}

/**
 * Layout algorithm: Spherical cluster layout
 * Groups nodes into spatial clusters (lobes) and distributes them in 3D
 */
function computeLayout(graph: Graph): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  
  // Group nodes by cluster
  const groups = new Map<string, Node[]>();
  graph.nodes.forEach(node => {
    const group = node.group || 'default';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(node);
  });
  
  // Position each cluster on a sphere around origin
  const groupArray = Array.from(groups.entries());
  const clusterRadius = 40; // Distance from center for each cluster
  
  groupArray.forEach(([groupName, groupNodes], clusterIdx) => {
    const clusterCount = groupArray.length;
    
    // Cluster center position (distributed on sphere)
    const phi = Math.acos(1 - 2 * (clusterIdx + 0.5) / clusterCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * clusterIdx; // Golden angle
    
    const clusterX = clusterRadius * Math.sin(phi) * Math.cos(theta);
    const clusterY = clusterRadius * Math.sin(phi) * Math.sin(theta);
    const clusterZ = clusterRadius * Math.cos(phi);
    
    // Distribute nodes within cluster (small sphere around cluster center)
    const nodeRadius = 8;
    groupNodes.forEach((node, idx) => {
      const nodeCount = groupNodes.length;
      const nodePhi = Math.acos(1 - 2 * (idx + 0.5) / nodeCount);
      const nodeTheta = Math.PI * (1 + Math.sqrt(5)) * idx;
      
      const x = clusterX + nodeRadius * Math.sin(nodePhi) * Math.cos(nodeTheta);
      const y = clusterY + nodeRadius * Math.sin(nodePhi) * Math.sin(nodeTheta);
      const z = clusterZ + nodeRadius * Math.cos(nodePhi);
      
      positions.set(node.id, [x, y, z]);
    });
  });
  
  return positions;
}

export default function NeuralGraph({
  graph,
  activitySpeed,
  showLabels,
  selectedNode,
  hoveredNode,
  activeFlows,
  onNodeClick,
  onNodeHover
}: NeuralGraphProps) {
  const layoutRef = useRef<Map<string, [number, number, number]>>(new Map());
  
  // Compute layout when graph changes
  const positions = useMemo(() => {
    const layout = computeLayout(graph);
    layoutRef.current = layout;
    return layout;
  }, [graph]);
  
  // Find connected edges for highlighting
  const getConnectedEdges = (nodeId: string) => {
    return graph.edges.filter(e => e.source === nodeId || e.target === nodeId);
  };
  
  const getConnectedNodes = (nodeId: string) => {
    const connectedEdges = getConnectedEdges(nodeId);
    const nodeIds = new Set<string>();
    connectedEdges.forEach(e => {
      nodeIds.add(e.source);
      nodeIds.add(e.target);
    });
    return Array.from(nodeIds);
  };
  
  const activeNodeId = hoveredNode || selectedNode;
  const connectedNodeIds = activeNodeId ? getConnectedNodes(activeNodeId) : [];
  const connectedEdgeKeys = activeNodeId 
    ? getConnectedEdges(activeNodeId).map(e => `${e.source}-${e.target}`)
    : [];
  
  return (
    <group>
      {/* Render all edges */}
      {graph.edges.map((edge, idx) => {
        const sourcePos = positions.get(edge.source);
        const targetPos = positions.get(edge.target);
        
        if (!sourcePos || !targetPos) return null;
        
        const edgeKey = `${edge.source}-${edge.target}`;
        const isHighlighted = connectedEdgeKeys.includes(edgeKey);
        
        // Check if this edge has active flow
        const hasActiveFlow = activeFlows.some(
          flow => flow.source === edge.source && flow.target === edge.target
        );
        
        if (hasActiveFlow && Math.random() < 0.1) {
          console.log(`🟢 Edge ${edge.source}→${edge.target} has active flow`);
        }
        
        return (
          <NeuralEdge
            key={`${edge.source}-${edge.target}-${idx}`}
            source={sourcePos}
            target={targetPos}
            weight={edge.weight || 0.5}
            bidirectional={edge.bidirectional || false}
            activitySpeed={activitySpeed}
            highlighted={isHighlighted}
            hasActiveFlow={hasActiveFlow}
          />
        );
      })}
      
      {/* Render all nodes */}
      {graph.nodes.map(node => {
        const position = positions.get(node.id);
        if (!position) return null;
        
        const isSelected = node.id === selectedNode;
        const isHovered = node.id === hoveredNode;
        const isConnected = connectedNodeIds.includes(node.id);
        const isDimmed = Boolean(activeNodeId && !isConnected && !isSelected && !isHovered);
        
        return (
          <NeuralNode
            key={node.id}
            node={node}
            position={position}
            activitySpeed={activitySpeed}
            showLabel={showLabels}
            isSelected={isSelected}
            isHovered={isHovered}
            isDimmed={isDimmed}
            onClick={() => onNodeClick(node.id)}
            onHover={(hovered: boolean) => onNodeHover(hovered ? node.id : null)}
          />
        );
      })}
    </group>
  );
}

/**
 * CUSTOMIZATION NOTES:
 * 
 * Layout: Modify computeLayout() to change spatial arrangement
 *   - Current: Spherical clusters (brain lobes)
 *   - Alternative: Force-directed, concentric rings, hierarchical
 * 
 * Visual tweaks in child components:
 *   - NeuralNode: colors, glow, size, pulsing
 *   - NeuralEdge: thickness, curve, particle speed, glow
 */
