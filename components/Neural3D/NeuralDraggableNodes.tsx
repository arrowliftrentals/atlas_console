// NeuralDraggableNodes.tsx
// Interactive draggable nodes that stay on shell surfaces

'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { NodeStateV2 } from './NeuralTelemetryTypesV2';
import { CORE_RADIUS, MEMORY_RADIUS, PERCEPTION_RADIUS } from './NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './NeuralVisualEncodingV2';

interface Props {
  nodes: Map<string, NodeStateV2>;
  edges: Map<string, any>;
  timeScale: number;
  onNodePositionChange: (nodeId: string, position: [number, number, number]) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  disabled?: boolean;
}

export function NeuralDraggableNodes({
  nodes,
  edges,
  timeScale,
  onNodePositionChange,
  onDragStateChange,
  disabled = false,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera, gl, raycaster, pointer } = useThree();
  
  const dragState = useRef<{
    isDragging: boolean;
    nodeIndex: number;
    nodeId: string;
    shellRadius: number;
    plane: THREE.Plane;
  } | null>(null);

  // Build node array
  const nodeArray = useMemo(() => {
    const arr = Array.from(nodes.values()).filter(n => n.position);
    console.log('[DraggableNodes] Node count:', arr.length);
    return arr;
  }, [nodes]);

  // Color by shell region using REGION_COLORS
  const getNodeColor = (node: NodeStateV2) => {
    if (!node.position) return new THREE.Color('#666666');
    const [x, y, z] = node.position;
    const dist = Math.sqrt(x * x + y * y + z * z);
    
    if (dist < CORE_RADIUS + 10) return new THREE.Color(REGION_COLORS.core);
    if (dist < MEMORY_RADIUS + 10) return new THREE.Color(REGION_COLORS.memory);
    return new THREE.Color(REGION_COLORS.perception);
  };

  // Get shell radius for a node
  const getShellRadius = (node: NodeStateV2): number => {
    if (!node.position) return PERCEPTION_RADIUS;
    const [x, y, z] = node.position;
    const dist = Math.sqrt(x * x + y * y + z * z);
    
    if (dist < CORE_RADIUS + 10) return CORE_RADIUS;
    if (dist < MEMORY_RADIUS + 10) return MEMORY_RADIUS;
    return PERCEPTION_RADIUS;
  };

  // Update instance matrices for rendering
  useFrame(() => {
    if (!meshRef.current) return;

    const tempObject = new THREE.Object3D();
    
    nodeArray.forEach((node, i) => {
      if (!node.position) return;

      // Position already includes shell rotation from parent
      const [x, y, z] = node.position;
      
      // Debug: log first 3 node positions
      if (i < 3 && Math.random() < 0.01) { // Only log occasionally to avoid spam
        console.log(`[DraggableNodes] Rendering node ${i} (${node.id}): [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}], dist=${Math.sqrt(x*x+y*y+z*z).toFixed(1)}`);
      }

      // Update instance transform
      tempObject.position.set(x, y, z);
      tempObject.scale.set(1.2, 1.2, 1.2);
      tempObject.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
      
      // Set color
      const color = getNodeColor(node);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  // Project point onto sphere surface
  const projectToSphere = (point: THREE.Vector3, radius: number): THREE.Vector3 => {
    const normalized = point.clone().normalize();
    return normalized.multiplyScalar(radius);
  };

  // Mouse event handlers
  useEffect(() => {
    if (disabled) return;
    
    const canvas = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      if (!meshRef.current || disabled) return;

      // Update pointer position
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to find clicked node
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(meshRef.current);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId!;
        const node = nodeArray[instanceId];
        if (!node || !node.position) return;

        const shellRadius = getShellRadius(node);
        
        // Create a plane perpendicular to the camera direction through the node
        const nodePos = new THREE.Vector3(...node.position);
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          cameraDir.negate(),
          nodePos
        );

        dragState.current = {
          isDragging: true,
          nodeIndex: instanceId,
          nodeId: node.id,
          shellRadius,
          plane,
        };

        canvas.style.cursor = 'grabbing';
        onDragStateChange?.(true);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragState.current?.isDragging) {
        // Update cursor for hover
        if (!meshRef.current || disabled) return;
        
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObject(meshRef.current);
        
        canvas.style.cursor = intersects.length > 0 ? 'grab' : 'default';
        return;
      }

      // Update pointer position
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to plane
      raycaster.setFromCamera(pointer, camera);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragState.current.plane, intersection);

      if (intersection) {
        // Project to sphere surface
        const projectedPoint = projectToSphere(intersection, dragState.current.shellRadius);
        
        // Update node position (will be applied via callback and re-render)
        onNodePositionChange(
          dragState.current.nodeId,
          [projectedPoint.x, projectedPoint.y, projectedPoint.z]
        );
      }
    };

    const onPointerUp = () => {
      if (dragState.current) {
        dragState.current.isDragging = false;
        dragState.current = null;
        canvas.style.cursor = 'default';
        onDragStateChange?.(false);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    };
  }, [camera, gl, raycaster, pointer, nodeArray, onNodePositionChange, disabled]);

  // Create geometry and material once
  const nodeGeometry = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const nodeMaterial = useMemo(() => new THREE.MeshStandardMaterial(), []);
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[nodeGeometry, nodeMaterial, nodeArray.length]}
      frustumCulled={false}
    />
  );
}
