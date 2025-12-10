// NeuralCognitiveLegendV2.tsx
// Interactive legend showing cognitive architecture regions and memory types

'use client';

import { useState } from 'react';

interface Props {
  nodeStats: {
    core: number;
    memory: number;
    perception: number;
    memoryTypes: {
      episodic: number;
      declarative: number;
      procedural: number;
      planning: number;
      layered: number;
    };
    perceptionTypes: {
      tools: number;
      api: number;
      telemetry: number;
      console: number;
    };
  };
}

export function NeuralCognitiveLegendV2({ nodeStats }: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      position: 'absolute',
      bottom: '21px',
      left: '16px',
      zIndex: 10,
      pointerEvents: 'auto',
    }}>
      <div style={{
        backgroundColor: 'rgba(17, 24, 39, 0.75)',
        borderRadius: '12px',
        border: '1px solid rgba(75, 85, 99, 0.5)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        minWidth: '210px',
        maxWidth: '250px',
      }}>
        {/* Header */}
        <div 
          style={{
            padding: '12px 16px',
            borderBottom: expanded ? '1px solid rgba(75, 85, 99, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#F3F4F6',
            letterSpacing: '0.5px',
          }}>
            COGNITIVE ARCHITECTURE
          </div>
        </div>

        {/* Expandable content */}
        {expanded && (
          <div style={{ padding: '12px 16px' }}>
            {/* Three main regions */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px',
            }}>
              {/* Core */}
              <RegionCard
                name="Core Control"
                description="Reasoning & LLM Router"
                color="#FFD700"
                count={nodeStats.core}
                radius="r = 20"
              />

              {/* Memory */}
              <RegionCard
                name="Memory Systems"
                description="Storage & Recall"
                color="#FF1493"
                count={nodeStats.memory}
                radius="r = 60"
                subItems={[
                  { label: 'Episodic', count: nodeStats.memoryTypes.episodic, detail: 'Sessions & events' },
                  { label: 'Declarative', count: nodeStats.memoryTypes.declarative, detail: 'Facts & knowledge' },
                  { label: 'Procedural', count: nodeStats.memoryTypes.procedural, detail: 'Skills & how-to' },
                  { label: 'Planning', count: nodeStats.memoryTypes.planning, detail: 'Roadmaps & tasks' },
                  { label: 'Layered', count: nodeStats.memoryTypes.layered, detail: 'World state & goals' },
                ]}
              />

              {/* Perception */}
              <RegionCard
                name="Perception & Tools"
                description="Environment Interaction"
                color="#00CED1"
                count={nodeStats.perception}
                radius="r = 100"
                subItems={[
                  { label: 'Tools', count: nodeStats.perceptionTypes.tools, detail: 'File ops & execution' },
                  { label: 'APIs', count: nodeStats.perceptionTypes.api, detail: 'Routers & endpoints' },
                  { label: 'Telemetry', count: nodeStats.perceptionTypes.telemetry, detail: 'Observability' },
                  { label: 'Console', count: nodeStats.perceptionTypes.console, detail: 'UI & visualization' },
                ]}
              />
            </div>

            {/* Flow explanation */}
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}>
              <div style={{
                fontSize: '10px',
                color: '#93C5FD',
                marginBottom: '4px',
                fontWeight: 600,
              }}>
                DATA FLOW
              </div>
              <div style={{
                fontSize: '10px',
                color: '#D1D5DB',
                lineHeight: '1.4',
              }}>
                Query → <span style={{ color: '#00CED1' }}>Perception</span> → <span style={{ color: '#FFD700' }}>Core</span> ↔ <span style={{ color: '#FF1493' }}>Memory</span> → <span style={{ color: '#00CED1' }}>Tools</span> → Response
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface RegionCardProps {
  name: string;
  description: string;
  color: string;
  count: number;
  radius: string;
  subItems?: Array<{ label: string; count: number; detail: string }>;
}

function RegionCard({ name, description, color, count, radius, subItems }: RegionCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div>
      <div 
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          cursor: subItems ? 'pointer' : 'default',
        }}
        onClick={() => subItems && setShowDetails(!showDetails)}
      >
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}`,
          border: `2px solid ${color}40`,
          flexShrink: 0,
          marginTop: '2px',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '2px',
          }}>
            <div style={{
              fontSize: '12px',
              color: color,
              fontWeight: 600,
            }}>
              {name}
              {subItems && (
                <span style={{
                  marginLeft: '6px',
                  fontSize: '10px',
                  color: '#9CA3AF',
                }}>
                  {showDetails ? '▼' : '▶'}
                </span>
              )}
            </div>

          </div>
          <div style={{
            fontSize: '10px',
            color: '#9CA3AF',
            marginBottom: '2px',
          }}>
            {description}
          </div>

        </div>
      </div>

      {/* Sub-items */}
      {subItems && showDetails && (
        <div style={{
          marginLeft: '28px',
          marginTop: '8px',
          paddingLeft: '12px',
          borderLeft: `2px solid ${color}40`,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          {subItems.map((item) => (
            <div key={item.label} style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '8px',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '10px',
                  color: '#D1D5DB',
                  fontWeight: 500,
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: '9px',
                  color: '#9CA3AF',
                  marginTop: '1px',
                }}>
                  {item.detail}
                </div>
              </div>
              <div style={{
                fontSize: '10px',
                color: '#6B7280',
                fontFamily: 'monospace',
                flexShrink: 0,
              }}>
                {item.count}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
