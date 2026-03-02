import NeuralArchitecture3D from '@/components/Neural3D/NeuralArchitecture3DV2';

export default function Neural3DFullscreenPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      <NeuralArchitecture3D />
    </div>
  );
}
