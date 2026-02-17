'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTelemetry } from '@/contexts/TelemetryContext';

// Simplified brain particle system for dashboard preview
function BrainParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { latestFrame } = useTelemetry();
  
  // Create particle positions in brain-like shape
  const { positions, colors, count } = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const colors: THREE.Color[] = [];
    
    // Three regions like the full brain - more particles for fuller look
    const regions = [
      { center: new THREE.Vector3(0, -0.4, 0), spread: 0.5, color: '#FF6B35', count: 80 },   // Core - orange
      { center: new THREE.Vector3(0, 0.25, -0.15), spread: 0.6, color: '#9D4EDD', count: 100 }, // Memory - purple
      { center: new THREE.Vector3(0, 0.15, 0.4), spread: 0.7, color: '#00B4D8', count: 120 },  // Perception - cyan
    ];
    
    regions.forEach((region) => {
      for (let i = 0; i < region.count; i++) {
        // Spherical distribution with noise
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = region.spread * (0.2 + Math.random() * 0.8);
        
        const pos = new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        ).add(region.center);
        
        positions.push(pos);
        colors.push(new THREE.Color(region.color));
      }
    });
    
    return { positions, colors, count: positions.length };
  }, []);
  
  // Animation
  useFrame((state) => {
    if (!meshRef.current) return;
    
    const time = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    
    positions.forEach((pos, i) => {
      // Gentle floating motion
      const offset = new THREE.Vector3(
        Math.sin(time * 0.5 + i * 0.1) * 0.02,
        Math.cos(time * 0.3 + i * 0.15) * 0.02,
        Math.sin(time * 0.4 + i * 0.12) * 0.02
      );
      
      dummy.position.copy(pos).add(offset);
      
      // Pulse size
      const pulse = 1 + Math.sin(time * 2 + i * 0.5) * 0.2;
      dummy.scale.setScalar(0.025 * pulse);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, colors[i]);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
    
    // Slow rotation
    meshRef.current.rotation.y = time * 0.1;
  });
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.8} />
    </instancedMesh>
  );
}

// Connection lines between regions
function BrainConnections() {
  const linesRef = useRef<THREE.Group>(null!);
  
  const lines = useMemo(() => {
    const connections: { start: THREE.Vector3; end: THREE.Vector3; color: string }[] = [];
    
    // A few key connections
    const points = [
      { pos: new THREE.Vector3(0, -0.3, 0), color: '#FF6B35' },
      { pos: new THREE.Vector3(-0.2, 0.2, -0.1), color: '#9D4EDD' },
      { pos: new THREE.Vector3(0.2, 0.2, -0.1), color: '#9D4EDD' },
      { pos: new THREE.Vector3(0, 0.1, 0.4), color: '#00B4D8' },
    ];
    
    // Connect core to memory
    connections.push({ start: points[0].pos, end: points[1].pos, color: '#FF6B35' });
    connections.push({ start: points[0].pos, end: points[2].pos, color: '#FF6B35' });
    // Connect memory to perception
    connections.push({ start: points[1].pos, end: points[3].pos, color: '#9D4EDD' });
    connections.push({ start: points[2].pos, end: points[3].pos, color: '#9D4EDD' });
    
    return connections;
  }, []);
  
  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });
  
  return (
    <group ref={linesRef}>
      {lines.map((line, i) => {
        const points = [line.start, line.end];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: 0.3 });
        const lineObj = new THREE.Line(geometry, material);
        return <primitive key={i} object={lineObj} />;
      })}
    </group>
  );
}

export default function MiniBrainPreview() {
  return (
    <Canvas
      camera={{ position: [0, 0, 2], fov: 50 }}
      style={{ background: 'transparent' }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.5} />
      <BrainParticles />
      <BrainConnections />
    </Canvas>
  );
}
