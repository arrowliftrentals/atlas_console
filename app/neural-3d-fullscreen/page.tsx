'use client';

import NeuralArchitecture3D from '@/components/NeuralArchitecture3D';

export default function NeuralFullscreen() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <NeuralArchitecture3D />
    </div>
  );
}
