'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface NeuralEdgeProps {
  source: [number, number, number];
  target: [number, number, number];
  weight: number; // 0-1
  bidirectional: boolean;
  activitySpeed: number;
  highlighted: boolean;
  hasActiveFlow: boolean;
}

interface Particle {
  progress: number;
  speed: number;
  direction: 1 | -1; // 1 = source->target, -1 = target->source
}

export default function NeuralEdge({
  source,
  target,
  weight,
  bidirectional,
  activitySpeed,
  highlighted,
  hasActiveFlow
}: NeuralEdgeProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [particleStates, setParticleStates] = React.useState<Particle[]>([]);
  
  // Create curved path (tube geometry)
  const { curve, tubeGeometry } = useMemo(() => {
    const start = new THREE.Vector3(...source);
    const end = new THREE.Vector3(...target);
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
    
    // Pull midpoint toward origin for brain-like curvature
    mid.multiplyScalar(0.7);
    
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, weight * 0.15 + 0.05, 8, false);
    
    return { curve, tubeGeometry };
  }, [source, target, weight]);
  
  // Initialize particles when hasActiveFlow changes
  React.useEffect(() => {
    console.log(`🔵 Edge effect: hasActiveFlow=${hasActiveFlow}, current particles=${particleStates.length}`);
    
    if (hasActiveFlow) {
      // Create particles when flow is active
      const particles: Particle[] = [];
      const particleCount = Math.ceil(weight * 5); // 1-5 particles based on weight
      
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          progress: i / particleCount, // Spread along path
          speed: 0.002 + Math.random() * 0.003,
          direction: 1 // Forward
        });
      }
      
      // Add reverse particles if bidirectional
      if (bidirectional) {
        for (let i = 0; i < particleCount; i++) {
          particles.push({
            progress: i / particleCount,
            speed: 0.002 + Math.random() * 0.003,
            direction: -1 // Reverse
          });
        }
      }
      
      particlesRef.current = particles;
      setParticleStates(particles);
      console.log(`✨ Created ${particles.length} particles for active flow`);
    } else {
      // Clear particles when flow stops
      if (particleStates.length > 0) {
        particlesRef.current = [];
        setParticleStates([]);
        console.log(`💨 Cleared particles - flow stopped`);
      }
    }
  }, [hasActiveFlow]);
  
  // Color based on weight/importance
  const edgeColor = useMemo(() => {
    const hue = 180 + weight * 60; // Cyan to blue gradient
    return new THREE.Color(`hsl(${hue}, 100%, ${40 + weight * 30}%)`);
  }, [weight]);
  
  // Animate edge glow and particles
  useFrame(({ clock }) => {
    if (!tubeRef.current) return;
    
    const time = clock.getElapsedTime();
    const material = tubeRef.current.material as THREE.MeshStandardMaterial;
    
    // Pulsing glow
    const pulse = 0.5 + Math.sin(time * 2) * 0.3;
    material.emissiveIntensity = (highlighted ? 2.0 : 1.0) * pulse * weight;
    
    // Update particle positions - modify state to trigger re-render
    const updated = particlesRef.current.map(particle => {
      let newProgress = particle.progress + particle.speed * activitySpeed * particle.direction;
      
      // Loop particles
      if (newProgress > 1) newProgress = 0;
      if (newProgress < 0) newProgress = 1;
      
      return { ...particle, progress: newProgress };
    });
    
    particlesRef.current = updated;
    setParticleStates(updated);
  });
  
  // Render particles along curve
  const particles = particleStates.map((particle, idx) => {
    const point = curve.getPoint(particle.progress);
    const isReverse = particle.direction === -1;
    
    return (
      <mesh key={idx} position={point}>
        <sphereGeometry args={[2.0, 16, 16]} />
        <meshBasicMaterial
          color={isReverse ? '#FF00FF' : '#00FFFF'} // Magenta for reverse, cyan for forward
          transparent
          opacity={1.0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    );
  });
  
  // Debug: log particle count
  if (particleStates.length > 0 && Math.random() < 0.01) {
    console.log(`🎯 Rendering ${particleStates.length} particles on edge`);
  }
  
  const opacity = highlighted ? 0.8 : (0.3 + weight * 0.3);
  
  return (
    <group>
      {/* Curved tube edge */}
      <mesh ref={tubeRef} geometry={tubeGeometry}>
        <meshStandardMaterial
          color={edgeColor}
          emissive={edgeColor}
          emissiveIntensity={1.0}
          transparent
          opacity={opacity}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>
      
      {/* Animated particles */}
      {particles}
    </group>
  );
}

/**
 * VISUAL CUSTOMIZATION:
 * 
 * Tube thickness: Adjust weight * 0.15 + 0.05 in tubeGeometry
 * Curve intensity: Change mid.multiplyScalar(0.7) - lower = more curved
 * Particle count: Modify Math.ceil(weight * 5) for more/fewer particles
 * Particle speed: Adjust 0.002 + Math.random() * 0.003 range
 * Colors: Change edgeColor HSL formula or particle colors
 * Glow: Modify emissiveIntensity calculation in useFrame
 */
