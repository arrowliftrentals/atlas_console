'use client';

import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { X, BarChart3, Grid3x3, Clock, Search } from 'lucide-react';
import AnalysisPanel from './AnalysisPanel';
import DependencyMatrix from './DependencyMatrix';
import Timeline from './Timeline';
import { classifyNode, formatNodeLabel, CognitiveRegion } from './Neural3D/NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './Neural3D/NeuralVisualEncodingV2';
// Import layout plugins dynamically (will be registered in useEffect)
let layoutsRegistered = false;

interface ComponentNode {
  id: string;
  label: string;
  type: string;
  status: 'live' | 'stubbed' | 'implemented' | 'in_progress' | 'not_started';
  percent_complete?: number;
  description?: string;
  dependencies: string[];
  dependency_metadata?: DependencyMetadata[];
  file_path?: string;
}

interface DependencyMetadata {
  target_id: string;
  operation_type: string;
  call_pattern: string;
  data_format: string;
  cardinality: string;
}

interface ComponentEdge {
  source: string;
  target: string;
  metadata?: DependencyMetadata | null;
}

interface ArchitectureData {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
  updated_at: string;
}

interface TelemetryData {
  type: string;
  timestamp: string;
  active_traces?: any[];
  metrics?: Record<string, any>;
}

interface FlowParticle {
  id: string;
  source: string;
  target: string;
  progress: number;
  color: string;
}

export default function ArchitectureViewV2() {
  console.log('🎨 ArchitectureViewV2 component rendering');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nodeSelectorRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [selectedNode, setSelectedNode] = useState<ComponentNode | null>(null);
  const [telemetryConnected, setTelemetryConnected] = useState(false);
  const [flowParticles, setFlowParticles] = useState<FlowParticle[]>([]);
  const [layoutType, setLayoutType] = useState<'dagre' | 'klay' | 'cola'>('dagre');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [replayTrace, setReplayTrace] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [errorEdges, setErrorEdges] = useState<Set<string>>(new Set());
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodeSelectorSearch, setNodeSelectorSearch] = useState('');

  // Callback ref to disable Cytoscape zoom when hovering over node selector
  const handleNodeSelectorRef = React.useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    
    const handleMouseEnter = () => {
      if (cyRef.current) {
        cyRef.current.userZoomingEnabled(false);
      }
    };
    
    const handleMouseLeave = () => {
      if (cyRef.current) {
        cyRef.current.userZoomingEnabled(true);
      }
    };
    
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
  }, []);
  
  // Fetch architecture data and error edges
  useEffect(() => {
    fetchArchitectureData();
    fetchErrorEdges();
    
    // Poll for error edges every 5 seconds
    const interval = setInterval(fetchErrorEdges, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchArchitectureData = async () => {
    try {
      const response = await fetch('http://localhost:8000/v1/architecture/graph');
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch architecture:', error);
    }
  };
  
  const fetchErrorEdges = async () => {
    try {
      const response = await fetch('http://localhost:8000/v1/telemetry/error-edges');
      const result = await response.json();
      const errors = new Set<string>(
        result.error_edges.map((edge: any) => `${edge.source}-${edge.target}`)
      );
      setErrorEdges(errors);
    } catch (error) {
      console.error('Failed to fetch error edges:', error);
    }
  };

  // Register cytoscape layout plugins once
  useEffect(() => {
    if (!layoutsRegistered && typeof window !== 'undefined') {
      Promise.all([
        import('cytoscape-dagre').then(dagre => {
          cytoscape.use(dagre.default || dagre);
        }),
        import('cytoscape-klay').then(klay => {
          cytoscape.use(klay.default || klay);
        }),
        import('cytoscape-cola').then(cola => {
          cytoscape.use(cola.default || cola);
        })
      ]).then(() => {
        layoutsRegistered = true;
        // Force re-render after layouts are registered
        setInitError(null);
      });
    }
  }, []);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !data || !layoutsRegistered) {
      console.log('Waiting for container, data, or layouts...');
      return;
    }

    try {
      const elements: ElementDefinition[] = [];

      // Add nodes with cognitive region classification
      console.log('🎨 Classifying nodes by cognitive region:');
      data.nodes.forEach(node => {
        const cognitiveMetadata = classifyNode(node.id);
        console.log(`  ${node.id.padEnd(25)} -> ${cognitiveMetadata.region}`);
        elements.push({
          data: {
            id: node.id,
            label: formatNodeLabel(node.id, node.label),
            type: node.type,
            status: node.status,
            percent: node.percent_complete || 0,
            description: node.description,
            file_path: node.file_path,
            region: cognitiveMetadata.region,
          },
        });
      });
      console.log('✅ Node classification complete');
      
      // Debug: Log first few elements with region data
      console.log('🔍 Sample elements with region:', elements.slice(0, 5).map(e => ({
        id: e.data.id,
        region: e.data.region,
        type: e.data.type
      })));

      // Add edges from API
      data.edges.forEach(edge => {
        const edgeId = `${edge.source}-${edge.target}`;
        const hasError = errorEdges.has(edgeId);
        
        const edgeData: any = {
          id: edgeId,
          source: edge.source,
          target: edge.target,
          operation: edge.metadata?.operation_type || 'unknown',
          pattern: edge.metadata?.call_pattern || 'sync',
          format: edge.metadata?.data_format || 'json',
          cardinality: edge.metadata?.cardinality || '1:1',
        };
        
        // Only add hasError if true (Cytoscape selectors check for presence)
        if (hasError) {
          edgeData.hasError = 'true';
        }
        
        elements.push({ data: edgeData });
      });

    // Cytoscape stylesheet
    const stylesheet: any[] = [
      // Nodes base style with plastic appearance
      {
        selector: 'node',
        style: {
          'background-color': '#2D3748',
          'border-width': 2,
          'border-color': '#FFFFFF',
          'border-opacity': 0.4,
          'label': (ele: any) => {
            const label = ele.data('label');
            const status = ele.data('status');
            return status === 'stubbed' ? `${label}\nstubbed` : label;
          },
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#E2E8F0',
          'font-size': '12px',
          'font-weight': 'bold',
          'width': 120,
          'height': 60,
          'shape': 'roundrectangle',
          'text-wrap': 'wrap',
          'text-max-width': '110px',
        } as any,
      },
      // Cognitive region colors with full opacity and plastic effect
      {
        selector: 'node[region = "core"]',
        style: {
          'background-color': '#E67E00',
          'background-opacity': 1.0,
          'background-fill': 'linear-gradient',
          'background-gradient-direction': 'to-bottom',
          'background-gradient-stop-colors': 'rgba(255,255,255,0.4) #E67E00',
          'background-gradient-stop-positions': '0% 50%',
        } as any,
      },
      {
        selector: 'node[region = "memory"]',
        style: {
          'background-color': '#E6127F',
          'background-opacity': 1.0,
          'background-fill': 'linear-gradient',
          'background-gradient-direction': 'to-bottom',
          'background-gradient-stop-colors': 'rgba(255,255,255,0.4) #E6127F',
          'background-gradient-stop-positions': '0% 50%',
        } as any,
      },
      {
        selector: 'node[region = "perception"]',
        style: {
          'background-color': '#008B95',
          'background-opacity': 1.0,
          'background-fill': 'linear-gradient',
          'background-gradient-direction': 'to-bottom',
          'background-gradient-stop-colors': 'rgba(255,255,255,0.4) #008B95',
          'background-gradient-stop-positions': '0% 50%',
        } as any,
      },
      // Edges base style
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#4A5568',
          'target-arrow-color': '#4A5568',
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2,
          'source-endpoint': '50% 0%',
          'target-endpoint': 'outside-to-node',
        } as any,
      },
      // Edge operation type colors
      {
        selector: 'edge[operation = "read"]',
        style: {
          'line-color': '#0EA5E9',
          'target-arrow-color': '#0EA5E9',
        } as any,
      },
      {
        selector: 'edge[operation = "write"]',
        style: {
          'line-color': '#F59E0B',
          'target-arrow-color': '#F59E0B',
        } as any,
      },
      {
        selector: 'edge[operation = "query"]',
        style: {
          'line-color': '#10B981',
          'target-arrow-color': '#10B981',
        } as any,
      },
      {
        selector: 'edge[operation = "execute"]',
        style: {
          'line-color': '#EC4899',
          'target-arrow-color': '#EC4899',
        } as any,
      },
      // Edge call pattern styles
      {
        selector: 'edge[pattern = "async"]',
        style: {
          'line-style': 'dashed',
        } as any,
      },
      {
        selector: 'edge[pattern = "streaming"]',
        style: {
          'line-style': 'dotted',
          'width': 3,
        } as any,
      },
      // Error edges (highest priority - red)
      {
        selector: 'edge[hasError]',
        style: {
          'line-color': '#EF4444',
          'target-arrow-color': '#EF4444',
          'width': 3,
          'line-style': 'solid',
        } as any,
      },
      // Selected node highlight - only brighten, no size or border change
      {
        selector: 'node:selected[region = "core"]',
        style: {
          'width': 120,
          'height': 60,
          'background-opacity': 1.0,
          'transition-property': 'background-opacity',
          'transition-duration': '0.2s',
          'transition-timing-function': 'ease-out',
        } as any,
      },
      {
        selector: 'node:selected[region = "memory"]',
        style: {
          'width': 120,
          'height': 60,
          'background-opacity': 1.0,
          'transition-property': 'background-opacity',
          'transition-duration': '0.2s',
          'transition-timing-function': 'ease-out',
        } as any,
      },
      {
        selector: 'node:selected[region = "perception"]',
        style: {
          'width': 120,
          'height': 60,
          'background-opacity': 1.0,
          'transition-property': 'background-opacity',
          'transition-duration': '0.2s',
          'transition-timing-function': 'ease-out',
        } as any,
      },
    ];

    // Initialize Cytoscape
    const layoutConfig: any = {
      name: layoutType,
      animate: true,
      animationDuration: 500,
    };
    
    // Layout-specific parameters
    if (layoutType === 'dagre') {
      layoutConfig.rankDir = 'LR';
      layoutConfig.nodeSep = 100;
      layoutConfig.rankSep = 200;
    } else if (layoutType === 'klay') {
      layoutConfig.klay = {
        direction: 'RIGHT',
        spacing: 100,
      };
    } else if (layoutType === 'cola') {
      // Force-directed layout with better spacing
      layoutConfig.nodeSpacing = 80;
      layoutConfig.edgeLength = 120;
      layoutConfig.edgeSymDiffLength = 60;
      layoutConfig.edgeJaccardLength = 80;
      layoutConfig.unconstrIter = 500;
      layoutConfig.userConstIter = 250;
      layoutConfig.allConstIter = 250;
      layoutConfig.infinite = false;
      layoutConfig.centerGraph = true;
      layoutConfig.avoidOverlap = true;
      layoutConfig.fit = true;
      layoutConfig.padding = 50;
    }
    
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: stylesheet,
      layout: layoutConfig,
      minZoom: 0.3,
      maxZoom: 3,
      wheelSensitivity: 0.2,
    });
    
    // Debug: Check if region data is available in Cytoscape
    console.log('🎯 Cytoscape nodes with region:', cy.nodes().map(n => ({
      id: n.id(),
      region: n.data('region'),
      bg: n.style('background-color')
    })).slice(0, 5));
    
    // Debug: Test selector matching
    console.log('🔍 Selector test:');
    console.log('  Nodes with region="core":', cy.nodes('[region = "core"]').length);
    console.log('  Nodes with region="memory":', cy.nodes('[region = "memory"]').length);
    console.log('  Nodes with region="perception":', cy.nodes('[region = "perception"]').length);
    console.log('  Total nodes:', cy.nodes().length);

    // Create DOM overlay for LED status badges
    const container = cy.container();
    if (container) {
      // Remove existing badge overlay if present
      const existingOverlay = container.querySelector('.led-badge-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // Ensure container has relative positioning and overflow hidden
      container.style.position = 'relative';
      container.style.overflow = 'hidden';
      
      // Create badge overlay div
      const badgeOverlay = document.createElement('div');
      badgeOverlay.className = 'led-badge-overlay';
      badgeOverlay.style.position = 'absolute';
      badgeOverlay.style.top = '0';
      badgeOverlay.style.left = '0';
      badgeOverlay.style.width = '100%';
      badgeOverlay.style.height = '100%';
      badgeOverlay.style.pointerEvents = 'none';
      badgeOverlay.style.zIndex = '1';
      badgeOverlay.style.overflow = 'hidden';
      container.appendChild(badgeOverlay);
      
      // Function to update badge positions
      const updateBadges = () => {
        badgeOverlay.innerHTML = '';
        
        cy.nodes().forEach(node => {
          const status = node.data('status');
          if (!status) return;
          
          // Get node position and size in rendered coordinates
          const pos = node.renderedPosition();
          const width = node.renderedWidth();
          const height = node.renderedHeight();
          
          // Get zoom level to scale badge size
          const zoom = cy.zoom();
          const badgeSize = 8 * zoom; // Scale with zoom
          const badgeOffset = badgeSize / 2;
          
          // LED badge position: upper right corner
          const badgeX = pos.x + width / 2 - (10 * zoom);
          const badgeY = pos.y - height / 2 + (10 * zoom);
          
          // Determine badge color
          let badgeColor = '#64748B'; // default gray
          if (status === 'live' || status === 'implemented') {
            badgeColor = '#22C55E'; // green
          } else if (status === 'stubbed') {
            badgeColor = '#F59E0B'; // orange
          } else if (status === 'in_progress') {
            badgeColor = '#3B82F6'; // blue
          }
          
          // Create LED badge element
          const badge = document.createElement('div');
          badge.style.position = 'absolute';
          badge.style.left = `${badgeX}px`;
          badge.style.top = `${badgeY}px`;
          badge.style.width = `${badgeSize}px`;
          badge.style.height = `${badgeSize}px`;
          badge.style.borderRadius = '50%';
          badge.style.backgroundColor = badgeColor;
          badge.style.border = `${1.125 * zoom}px solid rgba(0, 0, 0, 0.5)`;
          badge.style.transform = 'translate(-50%, -50%)';
          badge.style.boxShadow = `0 0 ${3 * zoom}px ${badgeColor}`;
          badgeOverlay.appendChild(badge);
        });
      };
      
      // Update badges after every Cytoscape render
      // Using 'render' event ensures badges update in sync with node positions
      cy.on('render', updateBadges);
      
      // Initial update
      updateBadges();
      
      // Store overlay ref for visibility control
      (cy as any)._badgeOverlay = badgeOverlay;
    }

    // Node click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData = data.nodes.find(n => n.id === node.id());
      if (nodeData) {
        setSelectedNode(nodeData);
      }
    });

    // Background click to deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

      cyRef.current = cy;

      setInitError(null);
      
      return () => {
        if (cy && !cy.destroyed()) {
          try {
            cy.destroy();
          } catch (err) {
            console.warn('Error destroying Cytoscape:', err);
          }
        }
      };
    } catch (err) {
      console.error('Failed to initialize Cytoscape:', err);
      setInitError(err instanceof Error ? err.message : 'Failed to initialize graph visualization');
    }
  }, [data, layoutType]);
  
  // Update edge styles when error edges change (without full re-render)
  useEffect(() => {
    if (!cyRef.current) return;
    
    const cy = cyRef.current;
    
    // Remove hasError from all edges
    cy.edges().forEach(edge => {
      edge.data('hasError', undefined);
    });
    
    // Add hasError to edges with errors
    errorEdges.forEach(edgeId => {
      const edge = cy.getElementById(edgeId);
      if (edge.length > 0) {
        edge.data('hasError', 'true');
      }
    });
  }, [errorEdges]);

  // WebSocket telemetry connection
  useEffect(() => {
    if (typeof window === 'undefined') {
      return; // Don't run on server
    }

    let isUnmounted = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (isUnmounted) return;

      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        // Use localhost:8000 explicitly for backend since frontend runs on 3000
        const wsUrl = `${wsProtocol}://localhost:8000/v1/telemetry/stream`;
        
        console.log('🔌 Attempting WebSocket connection to', wsUrl);
        const ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('✅ Telemetry WebSocket connected');
          setTelemetryConnected(true);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data: TelemetryData = JSON.parse(event.data);
            console.log('📊 Telemetry data received:', data.type, {
              traces: data.active_traces?.length || 0,
              metrics: Object.keys(data.metrics || {}).length,
            });
            handleTelemetryUpdate(data);
          } catch (err) {
            console.warn('⚠️ Failed to parse telemetry data:', err);
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('❌ WebSocket connection error:', error);
          setTelemetryConnected(false);
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          console.log('Telemetry WebSocket closed');
          setTelemetryConnected(false);

          // Simple reconnect with backoff
          reconnectTimeout = setTimeout(() => {
            console.log('🔁 Reconnecting telemetry WebSocket...');
            connect();
          }, 3000);
        };
      } catch (err) {
        if (isUnmounted) return;
        console.warn('Failed to initialize WebSocket - telemetry disabled:', err);
        setTelemetryConnected(false);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeout !== undefined) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleTelemetryUpdate = (data: TelemetryData) => {
    // Handle updates with active traces
    if ((data.type === 'update' || data.type === 'initial_state') && cyRef.current) {
      const traces = data.active_traces || [];
      
      console.log('🔄 Processing', traces.length, 'traces');
      
      // Animate flow for active traces
      traces.forEach((trace: any) => {
        console.log('  Trace:', trace.trace_id, 'spans:', trace.spans?.length);
        if (trace.spans && trace.spans.length > 1) {
          // Sort spans by start_time to get correct order
          const sorted = [...trace.spans].sort((a: any, b: any) => 
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
          const path = sorted.map((s: any) => s.component_id);
          
          console.log('  🎬 Animating flow:', path.join(' → '));
          
          // Animate flow along the path
          for (let i = 0; i < path.length - 1; i++) {
            animateFlow(path[i], path[i + 1]);
          }
        }
      });
      
      // Update node activity based on metrics
      if (data.metrics && cyRef.current) {
        Object.entries(data.metrics).forEach(([componentId, metrics]: [string, any]) => {
          const node = cyRef.current?.$id(componentId);
          if (node && node.length > 0 && metrics.request_count > 0) {
            // Pulse node on activity
            node.animate({
              style: { 'border-width': 4, 'border-color': '#3B82F6' },
              duration: 300,
            }).delay(300).animate({
              style: { 'border-width': 3 },
              duration: 300,
            });
          }
        });
      }
    }
  };

  const animateFlow = (source: string, target: string) => {
    if (!cyRef.current) {
      console.log('  ❌ cyRef not initialized');
      return;
    }
    
    const edgeId = `${source}-${target}`;
    const edge = cyRef.current.$id(edgeId);
    
    console.log('  🔍 Looking for edge:', edgeId, 'found:', edge.length > 0);
    
    if (edge.length > 0) {
      console.log('  ✨ Animating edge:', edgeId);
      // Pulse the edge with bright color
      edge.animate({
        style: {
          'width': 5,
          'line-color': '#3B82F6',
          'target-arrow-color': '#3B82F6',
        },
        duration: 400,
      }).delay(400).animate({
        style: {
          'width': 2,
        },
        duration: 400,
      });
    }
    
    // Pulse source and target nodes
    const sourceNode = cyRef.current.$id(source);
    const targetNode = cyRef.current.$id(target);
    
    if (sourceNode.length > 0) {
      sourceNode.animate({
        style: { 'background-color': '#3B82F6', 'border-width': 5 },
        duration: 200,
      }).delay(200).animate({
        style: { 'border-width': 3 },
        duration: 200,
      });
    }
    
    if (targetNode.length > 0) {
      setTimeout(() => {
        targetNode.animate({
          style: { 'background-color': '#10B981', 'border-width': 5 },
          duration: 200,
        }).delay(200).animate({
          style: { 'border-width': 3 },
          duration: 200,
        });
      }, 400);
    }
  };

  const changeLayout = (type: 'dagre' | 'klay' | 'cola') => {
    setLayoutType(type);
  };
  
  // Handle layout changes without destroying Cytoscape
  useEffect(() => {
    if (!cyRef.current || !cyRef.current.nodes().length) return;
    
    const layoutConfig: any = {
      name: layoutType,
      animate: true,
      animationDuration: 500,
    };
    
    // Layout-specific parameters
    if (layoutType === 'dagre') {
      layoutConfig.rankDir = 'LR';
      layoutConfig.nodeSep = 100;
      layoutConfig.rankSep = 200;
    } else if (layoutType === 'klay') {
      layoutConfig.klay = {
        direction: 'RIGHT',
        spacing: 100,
      };
    } else if (layoutType === 'cola') {
      layoutConfig.nodeSpacing = 80;
      layoutConfig.edgeLength = 120;
      layoutConfig.avoidOverlap = true;
      layoutConfig.fit = true;
      layoutConfig.padding = 50;
    }
    
    try {
      cyRef.current.layout(layoutConfig).run();
    } catch (err) {
      console.warn('Error changing layout:', err);
    }
  }, [layoutType]);

  const highlightComponent = (componentId: string) => {
    if (!cyRef.current) return;
    
    // Normalize component ID - backend telemetry may use shortened names
    const normalizeId = (id: string): string => {
      const idMap: Record<string, string> = {
        'memory': 'memorymanager',
        'memory_l3_episodic': 'episodicstore',
        'memory_l6_attention': 'attentionstore',
        // Add more mappings if needed
      };
      return idMap[id] || id;
    };
    
    const normalizedId = normalizeId(componentId);
    const node = cyRef.current.$id(normalizedId);
    if (node.length > 0) {
      cyRef.current.animate({
        center: { eles: node },
        zoom: 1.5,
        duration: 500,
      });
      
      node.select();
      setTimeout(() => node.unselect(), 2000);
    } else {
      console.warn(`Component not found: ${componentId} (normalized: ${normalizedId})`);
    }
  };

  const handleTraceReplay = (trace: any) => {
    setReplayTrace(trace);
    
    // Animate the trace path
    if (cyRef.current && trace.spans) {
      // Compute component path from spans
      const sorted = [...trace.spans].sort((a: any, b: any) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      const path = sorted.map((s: any) => s.component_id);
      
      // Highlight all nodes in path
      path.forEach((compId: string, index: number) => {
        setTimeout(() => {
          const node = cyRef.current!.$id(compId);
          if (node.length > 0) {
            node.animate({
              style: { 'border-width': 6, 'border-color': '#3B82F6' },
              duration: 300,
            });
            
            setTimeout(() => {
              node.animate({
                style: { 'border-width': 3 },
                duration: 300,
              });
            }, 300);
          }
        }, index * 200);
      });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1E1E1E] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#252526] border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${telemetryConnected ? 'bg-green-500' : 'bg-gray-500'}`} title={telemetryConnected ? 'Live' : 'Disconnected'} />
            <div>
              <h2 className="text-lg font-semibold text-white whitespace-nowrap">Cognitive Architecture</h2>
              <p className="text-sm text-gray-400 whitespace-nowrap">Components</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setShowAnalysis(prev => !prev)}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                  showAnalysis && !showMatrix
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                Analysis
              </button>
              <button
                onClick={() => setShowMatrix(prev => !prev)}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                  showMatrix
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Grid3x3 className="w-3 h-3" />
                Matrix
              </button>
              <button
                onClick={() => setShowTimeline(prev => !prev)}
                className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                  showTimeline
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Clock className="w-3 h-3" />
                Timeline
              </button>
            </div>
            <button
              onClick={() => setShowNodeSelector(prev => !prev)}
              className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                showNodeSelector
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Search className="w-3 h-3" />
              Nodes
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => changeLayout('dagre')}
                className={`px-3 py-1 text-xs rounded ${
                  layoutType === 'dagre'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Hierarchical
              </button>
              <button
                onClick={() => changeLayout('klay')}
                className={`px-3 py-1 text-xs rounded ${
                  layoutType === 'klay'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Layered
              </button>
              <button
                onClick={() => changeLayout('cola')}
                className={`px-3 py-1 text-xs rounded ${
                  layoutType === 'cola'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Force
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden" style={{ minHeight: 0 }}>
        {/* Matrix View (Full Screen) */}
        {showMatrix && (
          <div className="absolute inset-0 z-30 bg-[#1E1E1E]">
            <DependencyMatrix />
          </div>
        )}

        {/* Graph Container */}
        <div 
          ref={containerRef}
          className={`${showAnalysis && !showMatrix ? 'flex-1 min-w-0' : 'flex-1'} bg-[#1E1E1E] ${showMatrix ? 'hidden' : ''} relative`}
          style={{ height: '100%' }}
        >
          {initError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
                <h3 className="text-red-400 font-semibold mb-2">Initialization Error</h3>
                <p className="text-gray-300 text-sm mb-4">{initError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                >
                  Reload Page
                </button>
              </div>
            </div>
          )}
          {!data && !initError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-400 text-sm">Loading architecture data...</div>
            </div>
          )}
          
          {/* Node Selector Panel */}
          {showNodeSelector && data && !showMatrix && (
            <div 
              ref={handleNodeSelectorRef}
              className="absolute bottom-4 right-4 w-80 bg-[#252526] border border-gray-700 rounded-lg shadow-xl z-50 max-h-[70vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Node Navigator</h3>
                <button
                  onClick={() => setShowNodeSelector(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Search */}
              <div className="p-3 border-b border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={nodeSelectorSearch}
                    onChange={(e) => setNodeSelectorSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#1e1e1e] border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              
              {/* Node List */}
              <div className="flex-1 overflow-y-auto p-2">
                {(() => {
                  const query = nodeSelectorSearch.toLowerCase();
                  const filtered = data.nodes.filter(node => 
                    node.id.toLowerCase().includes(query) || 
                    node.label.toLowerCase().includes(query)
                  );
                  
                  // Group by cognitive region
                  const grouped = { core: [], memory: [], perception: [] } as Record<CognitiveRegion, ComponentNode[]>;
                  filtered.forEach(node => {
                    const metadata = classifyNode(node.id);
                    grouped[metadata.region].push(node);
                  });
                  
                  // Sort nodes within each region by label with natural sorting (L1, L2, ..., L9, L10)
                  const naturalSort = (a: ComponentNode, b: ComponentNode) => {
                    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
                  };
                  grouped.core.sort(naturalSort);
                  grouped.memory.sort(naturalSort);
                  grouped.perception.sort(naturalSort);
                  
                  const regionLabels = {
                    core: 'Core Control & Reasoning',
                    memory: 'Memory Systems',
                    perception: 'Perception & Tools',
                  };
                  
                  return (
                    <>
                      {(['core', 'memory', 'perception'] as const).map(region => {
                        const regionNodes = grouped[region];
                        if (regionNodes.length === 0) return null;
                        
                        const regionColor = REGION_COLORS[region];
                        
                        return (
                          <div key={region} className="mb-3">
                            <div className="px-2 py-1.5 mb-1.5 flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: regionColor }}
                              />
                              <span className="text-sm font-bold text-gray-300 uppercase tracking-wide">
                                {regionLabels[region]}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({regionNodes.length})
                              </span>
                            </div>
                            
                            <div className="space-y-1">
                              {regionNodes.map(node => (
                                <button
                                  key={node.id}
                                  onClick={() => highlightComponent(node.id)}
                                  className="w-full px-3 py-1.5 bg-[#1e1e1e] hover:bg-[#2d2d2d] border border-gray-700 hover:border-gray-600 rounded text-left transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: regionColor }}
                                    />
                                    <span className="text-sm text-gray-200 truncate">
                                      {node.label}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      
                      {filtered.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          No nodes found
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              
              {/* Footer */}
              <div className="p-2 border-t border-gray-700 text-xs text-gray-400 text-center">
                {data.nodes.filter(n => 
                  nodeSelectorSearch ? 
                    n.id.toLowerCase().includes(nodeSelectorSearch.toLowerCase()) || 
                    n.label.toLowerCase().includes(nodeSelectorSearch.toLowerCase())
                  : true
                ).length} of {data.nodes.length} nodes
              </div>
            </div>
          )}
        </div>

        {/* Analysis Panel */}
        {showAnalysis && !showMatrix && (
          <div key="analysis-panel" className="w-80 flex-shrink-0">
            <AnalysisPanel onHighlightComponent={highlightComponent} />
          </div>
        )}

        {/* Node Details Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-96 bg-[#252526] border border-gray-700 rounded-lg shadow-xl z-10">
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedNode.label}
                    <span className="text-xs text-gray-400 ml-2">, {selectedNode.type}</span>
                  </h3>
                  {selectedNode.status && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        selectedNode.status === 'live' || selectedNode.status === 'implemented' ? 'bg-green-500' :
                        selectedNode.status === 'in_progress' || selectedNode.status === 'stubbed' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`} />
                      <span className="text-sm text-gray-200 capitalize">
                        {selectedNode.status.replace('_', ' ')}
                      </span>
                      {selectedNode.percent_complete !== undefined && (
                        <span className="text-xs text-gray-400">
                          ({selectedNode.percent_complete}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Description */}
              {selectedNode.description && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Description</div>
                  <div className="text-sm text-gray-200">{selectedNode.description}</div>
                </div>
              )}

              {/* File Path */}
              {selectedNode.file_path && (
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">File Path</div>
                  <div className="text-xs text-blue-400 font-mono bg-[#1e1e1e] p-2 rounded">
                    {selectedNode.file_path}
                  </div>
                </div>
              )}

              {/* Dependencies */}
              {selectedNode.dependencies && selectedNode.dependencies.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">Dependencies</div>
                  <div className="space-y-1">
                    {selectedNode.dependencies.map((depId, idx) => (
                      <div
                        key={idx}
                        className="text-sm text-gray-200 bg-[#1e1e1e] px-3 py-1.5 rounded"
                      >
                        {depId}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      {showTimeline && (
        <div className="relative z-50">
          <Timeline
            onTraceSelect={handleTraceReplay}
            onPlaybackSpeed={(speed) => console.log('Playback speed:', speed)}
          />
        </div>
      )}

      {/* Legend */}
      {!showTimeline && (
        <div className="px-4 py-2 bg-[#252526] border-t border-gray-700">
          <div className="space-y-2">
            {/* Cognitive Regions Row */}
            <div className="flex items-center gap-6 text-xs flex-wrap">
              <div className="font-semibold text-gray-300">Cognitive Regions:</div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#FF8C00] border-2 border-gray-600" />
                <span className="text-gray-400">Core (Control & Reasoning)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#FF1493] border-2 border-gray-600" />
                <span className="text-gray-400">Memory (Storage & Learning)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#00CED1] border-2 border-gray-600" />
                <span className="text-gray-400">Perception (Tools & Environment)</span>
              </div>
            </div>
            
            {/* Connection Types Row */}
            <div className="flex items-center gap-6 text-xs flex-wrap">
              <div className="font-semibold text-gray-300">Connections:</div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-[#4A5568]" />
                <span className="text-gray-400">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 bg-[#EF4444]" />
                <span className="text-gray-400">Error (Recent Failures)</span>
              </div>
              <div className="border-l border-gray-600 h-4" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-[#0EA5E9]" />
                <span className="text-gray-400">Read</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-[#F59E0B]" />
                <span className="text-gray-400">Write</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-[#10B981]" />
                <span className="text-gray-400">Query</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-[#EC4899]" />
                <span className="text-gray-400">Execute</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
