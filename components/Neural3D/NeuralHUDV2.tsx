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

      {/* Cognitive Architecture Legend */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        right: '16px',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Cognitive Regions */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          borderRadius: '8px',
          border: '1px solid rgba(75, 85, 99, 0.5)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#9CA3AF',
            marginBottom: '8px',
            letterSpacing: '0.5px',
          }}>
            COGNITIVE ARCHITECTURE
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#FFD700',
                boxShadow: '0 0 12px #FFD700',
                border: '2px solid rgba(255, 215, 0, 0.3)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#FFD700', fontWeight: 600 }}>
                  Core Control
                </div>
                <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                  Reasoning • LLM Router • Agents
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#FF1493',
                boxShadow: '0 0 12px #FF1493',
                border: '2px solid rgba(255, 20, 147, 0.3)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#FF1493', fontWeight: 600 }}>
                  Memory Systems
                </div>
                <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                  Episodic • Declarative • Procedural
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#00CED1',
                boxShadow: '0 0 12px #00CED1',
                border: '2px solid rgba(0, 206, 209, 0.3)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#00CED1', fontWeight: 600 }}>
                  Perception & Tools
                </div>
                <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                  APIs • Telemetry • Console
                </div>
              </div>
            </div>
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
