// NeuralShellDragRotation.tsx
// Enables drag-to-rotate interaction for selected shell


import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';

interface Props {
  selectedShell: 'core' | 'memory' | 'perception' | null;
  shellRotations: {
    core: { x: number; y: number; z: number };
    memory: { x: number; y: number; z: number };
    perception: { x: number; y: number; z: number };
  };
  onRotationChange: (shell: 'core' | 'memory' | 'perception', rotation: { x: number; y: number; z: number }) => void;
}

export function NeuralShellDragRotation({
  selectedShell,
  shellRotations,
  onRotationChange,
}: Props) {
  const { gl } = useThree();
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const startRotationRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!selectedShell) return;

    const canvas = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      if (!selectedShell) return;
      
      console.log('[ShellDrag] Pointer down, selected shell:', selectedShell);
      event.stopPropagation();
      isDraggingRef.current = true;
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      startRotationRef.current = { ...shellRotations[selectedShell] };
      canvas.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current || !startRotationRef.current || !selectedShell) return;

      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;

      // Convert pixel drag to rotation degrees
      // Horizontal drag = Y axis rotation
      // Vertical drag = X axis rotation
      const rotationSpeed = 0.3; // Smooth rotation speed
      const newRotation = {
        x: Math.max(-180, Math.min(180, startRotationRef.current.x + deltaY * rotationSpeed)),
        y: Math.max(-180, Math.min(180, startRotationRef.current.y + deltaX * rotationSpeed)),
        z: startRotationRef.current.z,
      };

      console.log('[ShellDrag] New rotation:', newRotation);
      onRotationChange(selectedShell, newRotation);
    };

    const onPointerUp = () => {
      console.log('[ShellDrag] Pointer up');
      isDraggingRef.current = false;
      dragStartRef.current = null;
      startRotationRef.current = null;
      canvas.style.cursor = selectedShell ? 'grab' : 'default';
    };

    // Set cursor on shell selection
    canvas.style.cursor = selectedShell ? 'grab' : 'default';

    // Use capture phase to ensure we get events first
    canvas.addEventListener('pointerdown', onPointerDown, true);
    canvas.addEventListener('pointermove', onPointerMove, true);
    canvas.addEventListener('pointerup', onPointerUp, true);
    canvas.addEventListener('pointerleave', onPointerUp, true);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('pointermove', onPointerMove, true);
      canvas.removeEventListener('pointerup', onPointerUp, true);
      canvas.removeEventListener('pointerleave', onPointerUp, true);
      canvas.style.cursor = 'default';
    };
  }, [selectedShell, gl, shellRotations, onRotationChange]);

  return null; // This component doesn't render anything
}
