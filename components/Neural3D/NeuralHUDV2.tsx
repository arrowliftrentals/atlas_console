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
      {/* Status Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px',
        }}>
          {/* Connection Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            backgroundColor: 'rgba(17, 24, 39, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(75, 85, 99, 0.5)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'auto',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: telemetryConnected ? '#10B981' : '#EF4444',
              }} />
              <span style={{
                fontSize: '14px',
                color: '#D1D5DB',
              }}>
                {telemetryConnected ? 'Neural Telemetry Active (V2)' : 'Connecting...'}
              </span>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#D1D5DB',
              fontWeight: 500,
            }}>
              {stats.nodeCount} nodes • {stats.edgeCount} edges • {stats.particleCount} signals
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
        FPS: {stats.fps}
      </div>
    </>
  );
}
