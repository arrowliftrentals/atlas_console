'use client';

import NeuralArchitecture3DV2 from '@/components/Neural3D/NeuralArchitecture3DV2';

export default function NeuralV2Page() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <NeuralArchitecture3DV2
        timeScale={1.0}
        maxParticles={50000}
      />
    </div>
  );
}
