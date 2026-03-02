
import React, { useEffect } from 'react';
import { useThreeScene } from '@/contexts/ThreeSceneContext';
import { useTelemetry } from '@/contexts/TelemetryContext';
import NeuralArchitecture3D from './Neural3D/NeuralArchitecture3DV2';

export const NeuralArchitecture3DHost: React.FC = () => {
  const { isInteractive } = useThreeScene();
  const { connectionStatus, latestFrame } = useTelemetry();

  useEffect(() => {
    console.log('[Host] Mounted, isInteractive:', isInteractive, 'telemetry:', connectionStatus);
  }, []);

  useEffect(() => {
    if (latestFrame) {
      console.log('[Host] Telemetry frame from context:', {
        type: latestFrame.type,
        traces: latestFrame.active_traces?.length || 0
      });
    }
  }, [latestFrame]);

  return (
    <div
      id="neural-architecture-3d-host"
      className="w-full h-full"
      style={{
        pointerEvents: isInteractive ? 'auto' : 'none',
      }}
    >
      {/* Use the original component which has all the rendering logic */}
      <NeuralArchitecture3D />
    </div>
  );
};
