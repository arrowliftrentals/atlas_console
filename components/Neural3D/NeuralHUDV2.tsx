// NeuralHUDV2.tsx
// Head-up display overlay for telemetry stats and controls

'use client';

import { NODE_COLORS } from './NeuralVisualEncodingV2';

interface Props {
  telemetryConnected: boolean;
  stats: {
    fps: number;
    nodeCount: number;
    edgeCount: number;
    particleCount: number;
  };
}

export function NeuralHUDV2({ telemetryConnected, stats }: Props) {
  return (
    <>
      {/* Header Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        backgroundColor: '#252526',
        borderBottom: '1px solid #3F3F46',
        pointerEvents: 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
        }}>
          {/* Left: Title and Status */}
          <div style={{
            display: 'flex',
            gap: '8px',
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: telemetryConnected ? '#10B981' : '#6B7280',
              marginTop: '8px',
              flexShrink: 0,
            }} title={telemetryConnected ? 'Live' : 'Disconnected'} />
            <div>
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}>
                Neural Telemetry
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#9CA3AF',
                whiteSpace: 'nowrap',
              }}>
                {stats.nodeCount} nodes • {stats.edgeCount} edges • {stats.particleCount} signals
              </p>
            </div>
          </div>

          {/* Controls hint */}
          <div style={{
            fontSize: '12px',
            color: '#9CA3AF',
            padding: '6px 12px',
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto',
          }}>
            <span style={{ color: '#60A5FA' }}>Drag</span> to rotate • <span style={{ color: '#60A5FA' }}>Scroll</span> to zoom
          </div>
        </div>
      </div>

      {/* Performance Stats (debug) */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        zIndex: 10,
        fontSize: '11px',
        color: '#6B7280',
        fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        {stats.fps.toFixed(0)} FPS
      </div>
    </>
  );
}
