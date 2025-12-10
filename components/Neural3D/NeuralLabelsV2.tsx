// NeuralLabelsV2.tsx
// Text labels for nodes using react-three/drei with billboard behavior

'use client';

import { Text, Billboard } from '@react-three/drei';
import { NodeStateV2 } from './NeuralTelemetryTypesV2';

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, any>;
}

export function NeuralLabelsV2({ nodes, edges }: Props) {
  const nodeArray = Array.from(nodes.values());

  // Calculate connection counts for node sizes (matching node rendering)
  const connectionCounts = new Map<string, number>();
  nodes.forEach((node) => connectionCounts.set(node.id, 0));
  edges.forEach((edge) => {
    connectionCounts.set(edge.sourceId, (connectionCounts.get(edge.sourceId) || 0) + 1);
    connectionCounts.set(edge.targetId, (connectionCounts.get(edge.targetId) || 0) + 1);
  });

  return (
    <group>
      {nodeArray.map((node) => {
        const [x, y, z] = node.position;
        
        // Calculate node scale (matching node rendering - updated to 0.9)
        const connectionCount = connectionCounts.get(node.id) || 0;
        const nodeScale = 0.9 * Math.pow(1.15, connectionCount);
        
        return (
          <group key={node.id} position={[x, y, z]}>
            <Billboard
              follow={true}
              lockX={false}
              lockY={false}
              lockZ={false}
            >
              <Text
                position={[0, -2.0 * nodeScale, 0]}
                fontSize={0.6}
                color="white"
                anchorX="center"
                anchorY="middle"
                maxWidth={5}
                textAlign="center"
                outlineWidth={0.03}
                outlineColor="#000000"
              >
                {node.label}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
