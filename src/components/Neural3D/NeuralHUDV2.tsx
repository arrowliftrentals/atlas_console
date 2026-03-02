// NeuralHUDV2.tsx
// Head-up display overlay for telemetry stats and controls


import { NODE_COLORS } from './NeuralVisualEncodingV2';
import { useHealth } from '@/contexts/HealthContext';

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
  const { health } = useHealth();
  
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
          <div>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 
                  health.telemetry === 'connected' ? '#10B981' :
                  health.telemetry === 'disconnected' ? '#6B7280' :
                  '#EF4444',
                flexShrink: 0,
                boxShadow: health.telemetry === 'connected' 
                  ? '0 0 6px rgba(34, 197, 94, 0.8)' 
                  : health.telemetry === 'error'
                  ? '0 0 6px rgba(239, 68, 68, 0.8)'
                  : 'none',
                border: health.telemetry === 'connected'
                  ? '1.5px solid rgba(34, 197, 94, 0.9)'
                  : health.telemetry === 'error'
                  ? '1.5px solid rgba(239, 68, 68, 0.9)'
                  : '1.5px solid rgba(75, 85, 99, 0.6)',
              }} title={
                health.telemetry === 'connected' ? 'Telemetry Connected' :
                health.telemetry === 'disconnected' ? 'Telemetry Disconnected' :
                'Telemetry Error'
              } />
              <h2 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}>
                Neural Telemetry
              </h2>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#9CA3AF',
              whiteSpace: 'nowrap',
              marginLeft: '18px',
            }}>
              {stats.nodeCount} nodes • {stats.edgeCount} edges • {stats.particleCount} signals
            </p>
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
