'use client';

import React, { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { X, BarChart3, Grid3x3, Clock, Search, RefreshCw, Maximize2 } from 'lucide-react';
import AnalysisPanel from './AnalysisPanel';
import DependencyMatrix from './DependencyMatrix';
import Timeline from './Timeline';
import TabHeader from './TabHeader';
import { classifyNode, formatNodeLabel, CognitiveRegion } from './Neural3D/NeuralCognitiveLayoutV2';
import { REGION_COLORS } from './Neural3D/NeuralVisualEncodingV2';
// Import layout plugins dynamically (will be registered in useEffect)
let layoutsRegistered = false;
let layoutRegistrationAttempts = 0;
const MAX_LAYOUT_REGISTRATION_ATTEMPTS = 3;

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
  call_count?: number;  // Telemetry data
  data_source?: string;  // 'telemetry' or 'pattern'
  weight?: number;  // Normalized weight for visualization
}

interface ArchitectureData {
  nodes: ComponentNode[];
  edges: ComponentEdge[];
  updated_at: string;
}

interface TelemetryData {
  type: string;
  timestamp: string | number;
  // Legacy format (not used by current backend)
  active_traces?: any[];
  metrics?: Record<string, any>;
  // Actual backend format
  source?: string;
  target?: string;
  conversation_id?: string;
  intent_type?: string;
  duration_ms?: number;
  success?: boolean;
  events?: Array<{
    timestamp: string;
    conversation_id: string;
    intent_type: string;
    source: string;
    target: string;
    duration_ms: number;
    success: boolean;
  }>;
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
  const [layoutType, setLayoutType] = useState<'dagre' | 'klay' | 'cola' | 'elk'>('elk');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [replayTrace, setReplayTrace] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [errorEdges, setErrorEdges] = useState<Set<string>>(new Set());
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodeSelectorSearch, setNodeSelectorSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);
  const [layoutsReady, setLayoutsReady] = useState(false);
  const maxRetries = 3;

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
  
  // Window visibility handler - refresh when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Tab visible, checking visualization health...');
        
        // Verify Cytoscape is still healthy
        if (cyRef.current) {
          try {
            // Test if cytoscape is responsive
            cyRef.current.nodes().length;
            console.log('✅ Visualization is healthy');
          } catch (err) {
            console.warn('⚠️ Visualization unhealthy after tab visibility change, triggering recovery');
            setRetryCount(0);
            fetchArchitectureData();
          }
        } else if (data && layoutsReady) {
          console.log('⚠️ Cytoscape not initialized but data is ready, triggering re-init');
          setRetryCount(0);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [data, layoutsReady]);

  // Health check and proactive recovery
  useEffect(() => {
    const healthCheck = () => {
      // Check if Cytoscape instance is healthy
      if (cyRef.current && cyRef.current.destroyed()) {
        console.warn('⚠️ Cytoscape instance was destroyed unexpectedly, triggering recovery...');
        setInitError('Visualization was disrupted');
        setRetryCount(0);
        fetchArchitectureData();
      }
    };

    // Run health check every 10 seconds
    const healthCheckInterval = setInterval(healthCheck, 10000);

    return () => clearInterval(healthCheckInterval);
  }, []);

  // Fetch architecture data and error edges
  useEffect(() => {
    fetchArchitectureData();
    fetchErrorEdges();
    
    // Poll for error edges every 30 seconds (reduced from 5s)
    const interval = setInterval(fetchErrorEdges, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchArchitectureData = async (retryAttempt = 0) => {
    try {
      console.log('📡 Fetching architecture data...');
      const response = await fetch('http://localhost:8000/v1/architecture/graph', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📊 Architecture data received:', {
        nodes: result.nodes?.length || 0,
        edges: result.edges?.length || 0,
        discovery_method: result.discovery_method,
        sample_edges: result.edges?.slice(0, 3)
      });
      setData(result);
      console.log('✅ Architecture data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to fetch architecture:', error);
      
      // Retry up to 3 times with exponential backoff
      if (retryAttempt < 3) {
        const delay = Math.pow(2, retryAttempt) * 1000;
        console.log(`🔄 Retrying data fetch in ${delay}ms (attempt ${retryAttempt + 1}/3)...`);
        setTimeout(() => fetchArchitectureData(retryAttempt + 1), delay);
      } else {
        setInitError('Failed to load architecture data. Please check if the backend is running.');
      }
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

  // Register cytoscape layout plugins with retry and error handling
  useEffect(() => {
    const registerLayouts = async () => {
      if (layoutsRegistered || typeof window === 'undefined') {
        setLayoutsReady(layoutsRegistered);
        return;
      }

      if (layoutRegistrationAttempts >= MAX_LAYOUT_REGISTRATION_ATTEMPTS) {
        console.error('❌ Max layout registration attempts reached');
        setInitError('Failed to load visualization libraries after multiple attempts. Please reload the page.');
        return;
      }

      layoutRegistrationAttempts++;
      console.log(`🔄 Attempting to register Cytoscape layouts (attempt ${layoutRegistrationAttempts}/${MAX_LAYOUT_REGISTRATION_ATTEMPTS})`);

      try {
        await Promise.all([
          import('cytoscape-dagre').then(dagre => {
            cytoscape.use(dagre.default || dagre);
            console.log('✅ Dagre layout registered');
          }),
          import('cytoscape-klay').then(klay => {
            cytoscape.use(klay.default || klay);
            console.log('✅ Klay layout registered');
          }),
          import('cytoscape-cola').then(cola => {
            cytoscape.use(cola.default || cola);
            console.log('✅ Cola layout registered');
          }),
          import('cytoscape-elk').then(elk => {
            cytoscape.use(elk.default || elk);
            console.log('✅ ELK layout registered');
          })
        ]);
        
        layoutsRegistered = true;
        setLayoutsReady(true);
        setInitError(null);
        console.log('✅ All Cytoscape layouts registered successfully');
      } catch (err) {
        console.error('❌ Failed to register Cytoscape layouts:', err);
        
        // Retry after a delay
        if (layoutRegistrationAttempts < MAX_LAYOUT_REGISTRATION_ATTEMPTS) {
          console.log(`⏳ Retrying layout registration in 1 second...`);
          setTimeout(() => {
            registerLayouts();
          }, 1000);
        } else {
          setInitError('Failed to load visualization libraries. Please reload the page.');
        }
      }
    };

    registerLayouts();
  }, []);

  // Initialize Cytoscape with error recovery
  useEffect(() => {
    if (!containerRef.current || !data || !layoutsReady) {
      console.log('⏳ Waiting for container, data, or layouts...');
      return;
    }

    // Skip if recovering
    if (isRecovering) {
      console.log('🔄 Recovery in progress, skipping initialization');
      return;
    }

    const initializeCytoscape = () => {
      try {
        console.log('🎨 Initializing Cytoscape visualization...');
      const elements: ElementDefinition[] = [];

      // Compute node degrees (connection counts) for hub-centric layout
      const nodeDegrees = new Map<string, number>();
      data.edges.forEach(edge => {
        nodeDegrees.set(edge.source, (nodeDegrees.get(edge.source) || 0) + 1);
        nodeDegrees.set(edge.target, (nodeDegrees.get(edge.target) || 0) + 1);
      });
      
      // Find max degree for normalization
      const maxDegree = Math.max(...Array.from(nodeDegrees.values()), 1);
      console.log('📊 Node degrees computed:', { maxDegree, totalNodes: data.nodes.length });

      // Add nodes with cognitive region classification and degree data
      console.log('🎨 Classifying nodes by cognitive region:');
      data.nodes.forEach(node => {
        const cognitiveMetadata = classifyNode(node.id);
        const degree = nodeDegrees.get(node.id) || 0;
        const normalizedDegree = degree / maxDegree; // 0-1 scale
        
        console.log(`  ${node.id.padEnd(25)} -> ${cognitiveMetadata.region} (degree: ${degree})`);
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
            degree: degree,
            normalizedDegree: normalizedDegree,
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
          call_count: edge.call_count,  // Include telemetry call count
          data_source: edge.data_source,  // Track whether from telemetry or pattern
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
      // Node size scales with connectivity (degree) - hubs are larger
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
          // Scale node size based on connectivity (1.0x to 1.2x) - reduced to prevent overlap
          'width': (ele: any) => {
            const normalizedDegree = ele.data('normalizedDegree') || 0;
            return 120 * (1 + normalizedDegree * 0.2);
          },
          'height': (ele: any) => {
            const normalizedDegree = ele.data('normalizedDegree') || 0;
            return 60 * (1 + normalizedDegree * 0.2);
          },
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
          // Width scales with call count: 2px base, up to 5px for high traffic
          'width': (ele: any) => {
            const callCount = ele.data('call_count') || 0;
            if (callCount === 0) return 1.5;
            const normalizedLog = Math.min(Math.log10(callCount + 1) / 3, 1);
            return 2 + normalizedLog * 3; // 2px to 5px
          },
          // Color transitions from gray to vibrant neon blue based on call count
          'line-color': (ele: any) => {
            const callCount = ele.data('call_count') || 0;
            if (callCount === 0) return '#3a3f4b'; // Dim gray for unused
            // Interpolate from dull blue-gray to vibrant neon blue
            const normalizedLog = Math.min(Math.log10(callCount + 1) / 3, 1);
            // Low: #4A5568 (gray-blue), High: #00D4FF (neon cyan-blue)
            const r = Math.round(74 - normalizedLog * 74); // 74 -> 0
            const g = Math.round(85 + normalizedLog * 127); // 85 -> 212
            const b = Math.round(104 + normalizedLog * 151); // 104 -> 255
            return `rgb(${r}, ${g}, ${b})`;
          },
          'source-arrow-color': (ele: any) => {
            const callCount = ele.data('call_count') || 0;
            if (callCount === 0) return '#3a3f4b';
            const normalizedLog = Math.min(Math.log10(callCount + 1) / 3, 1);
            const r = Math.round(74 - normalizedLog * 74);
            const g = Math.round(85 + normalizedLog * 127);
            const b = Math.round(104 + normalizedLog * 151);
            return `rgb(${r}, ${g}, ${b})`;
          },
          'source-arrow-shape': 'triangle',
          'target-arrow-color': (ele: any) => {
            const callCount = ele.data('call_count') || 0;
            if (callCount === 0) return '#3a3f4b';
            const normalizedLog = Math.min(Math.log10(callCount + 1) / 3, 1);
            const r = Math.round(74 - normalizedLog * 74);
            const g = Math.round(85 + normalizedLog * 127);
            const b = Math.round(104 + normalizedLog * 151);
            return `rgb(${r}, ${g}, ${b})`;
          },
          'target-arrow-shape': 'triangle',
          'curve-style': 'bezier',
          'arrow-scale': 1.2,
          // Opacity based on call count
          'opacity': (ele: any) => {
            const callCount = ele.data('call_count') || 0;
            if (callCount === 0) return 0.25;
            const normalizedLog = Math.min(Math.log10(callCount + 1) / 3, 1);
            return 0.5 + normalizedLog * 0.5; // 0.5 to 1.0
          },
          // Show call count label if available (from telemetry)
          'label': (ele: any) => {
            const callCount = ele.data('call_count');
            return callCount ? `${callCount}` : '';
          },
          'font-size': '14px',
          'font-weight': 'bold',
          'color': '#FFFFFF',
          'text-background-color': '#000000',
          'text-background-opacity': 0.9,
          'text-background-padding': '5px',
          'text-background-shape': 'roundrectangle',
        } as any,
      },
      // Edge operation type colors
      {
        selector: 'edge[operation = "read"]',
        style: {
          'line-color': '#0EA5E9',
          'source-arrow-color': '#0EA5E9',
          'target-arrow-color': '#0EA5E9',
        } as any,
      },
      {
        selector: 'edge[operation = "write"]',
        style: {
          'line-color': '#F59E0B',
          'source-arrow-color': '#F59E0B',
          'target-arrow-color': '#F59E0B',
        } as any,
      },
      {
        selector: 'edge[operation = "query"]',
        style: {
          'line-color': '#10B981',
          'source-arrow-color': '#10B981',
          'target-arrow-color': '#10B981',
        } as any,
      },
      {
        selector: 'edge[operation = "execute"]',
        style: {
          'line-color': '#EC4899',
          'source-arrow-color': '#EC4899',
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
          'source-arrow-color': '#EF4444',
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
    
    // Layout-specific parameters with optimized settings for crossing minimization
    if (layoutType === 'dagre') {
      layoutConfig.rankDir = 'LR';
      layoutConfig.nodeSep = 120;      // Increased vertical separation
      layoutConfig.rankSep = 220;      // Increased horizontal separation
      layoutConfig.edgeSep = 30;       // Edge separation to reduce overlaps
      layoutConfig.ranker = 'tight-tree'; // Better crossing reduction algorithm
      layoutConfig.align = 'UL';       // Consistent node alignment
    } else if (layoutType === 'klay') {
      layoutConfig.klay = {
        direction: 'RIGHT',
        spacing: 120,
        edgeSpacingFactor: 0.5,           // Reduces edge crowding
        compactComponents: true,
        thoroughness: 10,                  // Higher = better layout quality
        crossingMinimization: 'LAYER_SWEEP', // Explicit crossing minimization
        nodeLayering: 'NETWORK_SIMPLEX',
        nodePlacement: 'BRANDES_KOEPF',    // Better node placement
        fixedAlignment: 'BALANCED',
      };
    } else if (layoutType === 'cola') {
      // Force-directed layout with better spacing
      layoutConfig.nodeSpacing = 100;   // Increased node spacing
      layoutConfig.edgeLength = 150;    // Longer edges for clarity
      layoutConfig.edgeSymDiffLength = 80;
      layoutConfig.edgeJaccardLength = 100;
      layoutConfig.unconstrIter = 500;
      layoutConfig.userConstIter = 250;
      layoutConfig.allConstIter = 250;
      layoutConfig.infinite = false;
      layoutConfig.centerGraph = true;
      layoutConfig.avoidOverlap = true;
      layoutConfig.fit = true;
      layoutConfig.padding = 60;
      layoutConfig.randomize = false;   // Deterministic layout
    } else if (layoutType === 'elk') {
      // ELK Stress: Hub-centric layout - high-connectivity nodes in center
      // Uses stress majorization which naturally places hubs centrally
      layoutConfig.name = 'elk';
      layoutConfig.elk = {
        algorithm: 'stress',
        'elk.stress.desiredEdgeLength': 600,
        'elk.stress.epsilon': 0.00001,
        'elk.stress.iterationLimit': 1000,
        'elk.spacing.nodeNode': 500,
        'elk.spacing.edgeNode': 250,
        'elk.spacing.componentComponent': 300,
        'elk.aspectRatio': 2.0,
      };
    }
    
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: stylesheet,
      layout: layoutConfig,
      minZoom: 0.1,  // Allow more zoom out to see all nodes
      maxZoom: 8,
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
        
        // LED Settings
        const settings = {
          badgeSize: 9.1,
          greenCircleDiameter: 100,
          badgeGreenGlow: 1.4,
          badgeOrangeGlow: 1.4,
          badgeBlueGlow: 1.4,
          badgeGrayGlow: 1.4,
          innerGlowSize: 2,
          innerGlowIntensity: 0.4,
          innerGlowOpacity: 1,
          outerGlowSize: 9,
          outerGlowIntensity: 0.3,
          outerGlowOpacity: 1,
          outlineThickness: 0.6,
          outlineOpacity: 0.45,
          reflectionSize: 120,
          reflectionLeft: -11,
          reflectionTop: -10,
          reflectionCenterOpacity: 0.5,
          reflectionMidOpacity: 0.15,
          reflectionEdgeOpacity: 0.2,
        };
        
        cy.nodes().forEach(node => {
          const status = node.data('status');
          if (!status) return;
          
          // Get node position and size in rendered coordinates
          const pos = node.renderedPosition();
          const width = node.renderedWidth();
          const height = node.renderedHeight();
          
          // Get zoom level to scale badge size
          const zoom = cy.zoom();
          const badgeSize = settings.badgeSize * zoom;
          const greenCircleSize = badgeSize * (settings.greenCircleDiameter / 100);
          
          // LED badge position: upper right corner
          const badgeX = pos.x + width / 2 - (10 * zoom);
          const badgeY = pos.y - height / 2 + (10 * zoom);
          
          // Determine badge color and glow intensity
          let badgeColor = '#64748B'; // default gray
          let glowIntensity = settings.badgeGrayGlow;
          let glowColorRGB = '100, 116, 139';
          let borderColor = 'rgba(75, 85, 99, 0.6)';
          
          if (status === 'live' || status === 'implemented') {
            badgeColor = '#22C55E'; // green
            glowIntensity = settings.badgeGreenGlow;
            glowColorRGB = '34, 197, 94';
            borderColor = 'rgba(34, 197, 94, 0.9)';
          } else if (status === 'stubbed') {
            badgeColor = '#F59E0B'; // orange
            glowIntensity = settings.badgeOrangeGlow;
            glowColorRGB = '245, 158, 11';
            borderColor = 'rgba(245, 158, 11, 0.8)';
          } else if (status === 'in_progress') {
            badgeColor = '#3B82F6'; // blue
            glowIntensity = settings.badgeBlueGlow;
            glowColorRGB = '59, 130, 246';
            borderColor = 'rgba(59, 130, 246, 0.8)';
          }
          
          // Create LED badge element
          const badge = document.createElement('div');
          badge.style.position = 'absolute';
          badge.style.left = `${badgeX}px`;
          badge.style.top = `${badgeY}px`;
          badge.style.width = `${greenCircleSize}px`;
          badge.style.height = `${greenCircleSize}px`;
          badge.style.borderRadius = '50%';
          badge.style.backgroundColor = badgeColor;
          badge.style.borderWidth = `${1.5 * zoom}px`;
          badge.style.borderStyle = 'solid';
          badge.style.borderColor = borderColor;
          badge.style.transform = 'translate(-50%, -50%)';
          
          // Build box shadow with inner and outer glow
          const innerGlow = `0 0 ${settings.innerGlowSize * zoom * settings.innerGlowIntensity * glowIntensity}px rgba(${glowColorRGB}, ${settings.innerGlowOpacity})`;
          const outerGlow = `0 0 ${settings.outerGlowSize * zoom * settings.outerGlowIntensity * glowIntensity}px rgba(${glowColorRGB}, ${settings.outerGlowOpacity})`;
          const outline = `0 0 0 ${settings.outlineThickness * zoom}px rgba(0, 0, 0, ${settings.outlineOpacity})`;
          badge.style.boxShadow = `${innerGlow}, ${outerGlow}, ${outline}`;
          
          // Add white reflection
          const reflection = document.createElement('div');
          reflection.style.position = 'absolute';
          reflection.style.left = `${settings.reflectionLeft}%`;
          reflection.style.top = `${settings.reflectionTop}%`;
          reflection.style.width = `${settings.reflectionSize}%`;
          reflection.style.height = `${settings.reflectionSize}%`;
          reflection.style.borderRadius = '50%';
          reflection.style.background = `radial-gradient(circle, rgba(255, 255, 255, ${settings.reflectionCenterOpacity}) 0%, rgba(255, 255, 255, ${settings.reflectionMidOpacity}) 50%, rgba(255, 255, 255, ${settings.reflectionEdgeOpacity}) 100%)`;
          reflection.style.pointerEvents = 'none';
          badge.appendChild(reflection);
          
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

      // Fit all nodes into view after layout completes
      cy.on('layoutstop', () => {
        cy.fit(undefined, 50); // 50px padding
      });
      
      // Fallback: fit after a short delay in case layoutstop doesn't fire
      setTimeout(() => {
        if (cy && !cy.destroyed()) {
          cy.fit(undefined, 50);
        }
      }, 800);

      setInitError(null);
      setRetryCount(0);
      console.log('✅ Cytoscape initialized successfully');
      
      return () => {
        if (cy && !cy.destroyed()) {
          try {
            cy.destroy();
          } catch (err) {
            console.warn('⚠️ Error destroying Cytoscape:', err);
          }
        }
      };
    } catch (err) {
      console.error('❌ Failed to initialize Cytoscape:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize graph visualization';
      setInitError(errorMessage);
      
      // Attempt automatic recovery
      if (retryCount < maxRetries) {
        console.log(`🔄 Attempting automatic recovery (${retryCount + 1}/${maxRetries})...`);
        setIsRecovering(true);
        
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setIsRecovering(false);
          setInitError(null);
          
          // Force re-fetch data to trigger re-initialization
          fetchArchitectureData();
        }, 2000);
      }
    }
  };

  initializeCytoscape();
  }, [data, layoutsReady, isRecovering, retryCount]);
  
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
        // Force ws:// for localhost since backend doesn't support TLS
        const wsUrl = 'ws://localhost:8000/v1/telemetry/stream';
        
        console.log('🔌 Attempting WebSocket connection to', wsUrl);
        const ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          console.log('✅ Telemetry WebSocket connected');
          setTelemetryConnected(true);
          // Set global state for HealthContext
          if (typeof window !== 'undefined') {
            (window as any).__atlasWebSocketState = { connected: true, error: false };
          }
          // Dispatch telemetry status event
          window.dispatchEvent(new CustomEvent('telemetry-status', { detail: { connected: true } }));
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const data: TelemetryData = JSON.parse(event.data);
            
            // Log telemetry based on type
            if (data.type === 'execution_flow') {
              console.log(`📊 Telemetry: ${data.source} → ${data.target}`);
            } else if (data.type === 'batch') {
              console.log(`📊 Telemetry batch: ${data.events?.length || 0} flows`);
            } else if (data.type === 'connected') {
              console.log('📊 Telemetry stream connected');
            } else {
              console.log('📊 Telemetry:', data.type);
            }
            
            handleTelemetryUpdate(data);
          } catch (err) {
            console.warn('⚠️ Failed to parse telemetry data:', err);
          }
        };

        ws.onerror = (error) => {
          if (isUnmounted) return;
          console.error('❌ WebSocket connection error:', error);
          setTelemetryConnected(false);
          // Set global state for HealthContext
          if (typeof window !== 'undefined') {
            (window as any).__atlasWebSocketState = { connected: false, error: true };
          }
          // Dispatch telemetry status event
          window.dispatchEvent(new CustomEvent('telemetry-status', { detail: { connected: false } }));
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          console.log('Telemetry WebSocket closed');
          setTelemetryConnected(false);
          // Set global state for HealthContext
          if (typeof window !== 'undefined') {
            (window as any).__atlasWebSocketState = { connected: false, error: false };
          }
          // Dispatch telemetry status event
          window.dispatchEvent(new CustomEvent('telemetry-status', { detail: { connected: false } }));

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
    if (!cyRef.current) return;
    
    // Handle individual execution_flow events (ACTUAL BACKEND FORMAT)
    if (data.type === 'execution_flow' && data.source && data.target) {
      console.log(`🔄 Flow: ${data.source} → ${data.target} (${data.duration_ms?.toFixed(2)}ms)`);
      animateFlow(data.source, data.target);
      return;
    }
    
    // Handle batch events (ACTUAL BACKEND FORMAT)
    if (data.type === 'batch' && data.events && data.events.length > 0) {
      console.log(`🔄 Processing batch of ${data.events.length} flows`);
      data.events.forEach(event => {
        console.log(`  ${event.source} → ${event.target}`);
        animateFlow(event.source, event.target);
      });
      return;
    }
    
    // Legacy format support (for backwards compatibility if backend changes)
    if ((data.type === 'update' || data.type === 'initial_state') && data.active_traces) {
      const traces = data.active_traces || [];
      console.log('🔄 Processing', traces.length, 'traces (legacy format)');
      
      traces.forEach((trace: any) => {
        if (trace.spans && trace.spans.length > 1) {
          const sorted = [...trace.spans].sort((a: any, b: any) => 
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
          const path = sorted.map((s: any) => s.component_id);
          
          for (let i = 0; i < path.length - 1; i++) {
            animateFlow(path[i], path[i + 1]);
          }
        }
      });
    }
    
    // Handle metrics-based node activity
    if (data.metrics) {
      Object.entries(data.metrics).forEach(([componentId, metrics]: [string, any]) => {
        const node = cyRef.current?.$id(componentId);
        if (node && node.length > 0 && metrics.request_count > 0) {
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
  };

  const animateFlow = (source: string, target: string) => {
    if (!cyRef.current) {
      console.log('  ❌ cyRef not initialized');
      return;
    }
    
    // Architecture graph now uses telemetry-compatible IDs directly
    const edgeId = `${source}-${target}`;
    const edge = cyRef.current.$id(edgeId);
    
    // Also try reverse direction (bidirectional edges)
    const reverseEdgeId = `${target}-${source}`;
    const reverseEdge = cyRef.current.$id(reverseEdgeId);
    
    console.log('  🔍 Looking for edge:', edgeId, 'found:', edge.length > 0, 'or reverse:', reverseEdgeId, 'found:', reverseEdge.length > 0);
    
    // Animate whichever edge exists
    const targetEdge = edge.length > 0 ? edge : reverseEdge;
    const foundEdgeId = edge.length > 0 ? edgeId : reverseEdgeId;
    
    if (targetEdge.length > 0) {
      console.log('  ✨ Animating edge:', foundEdgeId);
      // Pulse the edge with bright color
      targetEdge.animate({
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
    } else {
      console.log('  ⚠️ Edge not found:', source, '->', target);
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

  const changeLayout = (type: 'dagre' | 'klay' | 'cola' | 'elk') => {
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
    
    // Layout-specific parameters with optimized settings
    if (layoutType === 'dagre') {
      layoutConfig.rankDir = 'LR';
      layoutConfig.nodeSep = 120;
      layoutConfig.rankSep = 220;
      layoutConfig.edgeSep = 30;
      layoutConfig.ranker = 'tight-tree';
      layoutConfig.align = 'UL';
    } else if (layoutType === 'klay') {
      layoutConfig.klay = {
        direction: 'RIGHT',
        spacing: 120,
        edgeSpacingFactor: 0.5,
        compactComponents: true,
        thoroughness: 10,
        crossingMinimization: 'LAYER_SWEEP',
        nodeLayering: 'NETWORK_SIMPLEX',
        nodePlacement: 'BRANDES_KOEPF',
        fixedAlignment: 'BALANCED',
      };
    } else if (layoutType === 'cola') {
      layoutConfig.nodeSpacing = 100;
      layoutConfig.edgeLength = 150;
      layoutConfig.avoidOverlap = true;
      layoutConfig.fit = true;
      layoutConfig.padding = 60;
      layoutConfig.randomize = false;
    } else if (layoutType === 'elk') {
      // ELK Stress: Hub-centric layout - high-connectivity nodes in center
      layoutConfig.name = 'elk';
      layoutConfig.elk = {
        algorithm: 'stress',
        'elk.stress.desiredEdgeLength': 600,
        'elk.stress.epsilon': 0.00001,
        'elk.stress.iterationLimit': 1000,
        'elk.spacing.nodeNode': 500,
        'elk.spacing.edgeNode': 250,
        'elk.spacing.componentComponent': 300,
        'elk.aspectRatio': 2.0,
      };
    }
    
    try {
      cyRef.current.layout(layoutConfig).run();
    } catch (err) {
      console.warn('Error changing layout:', err);
    }
  }, [layoutType]);

  const highlightComponent = (componentId: string) => {
    if (!cyRef.current) return;
    
    // Architecture graph now uses telemetry-compatible IDs directly
    const node = cyRef.current.$id(componentId);
    if (node.length > 0) {
      cyRef.current.animate({
        center: { eles: node },
        zoom: 1.5,
        duration: 500,
      });
      
      node.select();
      setTimeout(() => node.unselect(), 2000);
    } else {
      console.warn(`Component not found: ${componentId}`);
    }
  };

  const handleTraceReplay = (trace: any) => {
    setReplayTrace(trace);
    
    // Animate the trace path using actual flow animations
    if (cyRef.current && trace.spans) {
      // Compute component path from spans
      const sorted = [...trace.spans].sort((a: any, b: any) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      const path = sorted.map((s: any) => s.component_id);
      
      console.log('🎬 Replaying trace with', path.length - 1, 'flows:', path.join(' → '));
      
      // Animate each flow sequentially (source → target)
      // Each flow takes ~800ms (same as real-time), stagger by 900ms for clear visualization
      for (let i = 0; i < path.length - 1; i++) {
        setTimeout(() => {
          console.log(`  Step ${i + 1}: ${path[i]} → ${path[i + 1]}`);
          animateFlow(path[i], path[i + 1]);
        }, i * 900);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#02030a] overflow-hidden">
      {/* Header */}
      <TabHeader
        title="Cognitive Architecture"
        subtitle="Components"
        statusConnected={telemetryConnected}
        statusLabel={telemetryConnected ? 'Live' : 'Disconnected'}
      >
            {/* Manual Reload Button */}
            <button
              onClick={() => {
                console.log('🔄 Manual reload triggered by user');
                setRetryCount(0);
                setIsRecovering(false);
                setInitError(null);
                fetchArchitectureData();
              }}
              className="px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center gap-2 transition-colors"
              title="Reload visualization"
            >
              <RefreshCw className="w-3 h-3" />
              Reload
            </button>
            {/* Fit All Button */}
            <button
              onClick={() => {
                if (cyRef.current) {
                  cyRef.current.fit(undefined, 50); // Fit with 50px padding
                  console.log('🔍 Fit all nodes to screen');
                }
              }}
              disabled={showMatrix}
              className={`px-3 py-2 bg-[#1E1E1E] hover:bg-gray-700 border border-gray-700 rounded text-xs text-gray-300 flex items-center gap-2 transition-colors ${
                showMatrix ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Fit all nodes to screen"
            >
              <Maximize2 className="w-3 h-3" />
              Fit All
            </button>
            {/* Detail Category */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Detail</div>
              <div className="bg-[#1E1E1E] rounded-lg px-3 py-2 border border-gray-700">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!showMatrix) {
                        if (showAnalysis) {
                          setShowAnalysis(false);
                        } else {
                          setShowNodeSelector(false);
                          setShowAnalysis(true);
                        }
                      }
                    }}
                    disabled={showMatrix}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                      showMatrix
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : showAnalysis
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <BarChart3 className="w-3 h-3" />
                    Analysis
                  </button>
                  <button
                    onClick={() => {
                      if (!showMatrix) {
                        if (showNodeSelector) {
                          setShowNodeSelector(false);
                        } else {
                          setShowAnalysis(false);
                          setShowNodeSelector(true);
                        }
                      }
                    }}
                    disabled={showMatrix}
                    className={`px-3 py-1 text-xs rounded flex items-center gap-1 ${
                      showMatrix
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : showNodeSelector
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <Search className="w-3 h-3" />
                    Nodes
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
              </div>
            </div>
            
            {/* View Category */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">View</div>
              <div className="bg-[#1E1E1E] rounded-lg px-3 py-2 border border-gray-700">
                <div className="flex gap-2">
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
                    onClick={() => !showMatrix && changeLayout('elk')}
                    disabled={showMatrix}
                    className={`px-3 py-1 text-xs rounded ${
                      showMatrix
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : layoutType === 'elk'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title="ELK Hub: High-connectivity nodes centered, minimal crossings"
                  >
                    Hub
                  </button>
                  <button
                    onClick={() => !showMatrix && changeLayout('dagre')}
                    disabled={showMatrix}
                    className={`px-3 py-1 text-xs rounded ${
                      showMatrix
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : layoutType === 'dagre'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title="Dagre: Hierarchical layout"
                  >
                    Hierarchical
                  </button>
                  <button
                    onClick={() => !showMatrix && changeLayout('klay')}
                    disabled={showMatrix}
                    className={`px-3 py-1 text-xs rounded ${
                      showMatrix
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : layoutType === 'klay'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title="Klay: Optimized layered layout"
                  >
                    Layered
                  </button>
                  <button
                    onClick={() => !showMatrix && changeLayout('cola')}
                    disabled={showMatrix}
                    className={`px-3 py-1 text-xs rounded ${
                      showMatrix
                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                        : layoutType === 'cola'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title="Cola: Force-directed layout"
                  >
                    Force
                  </button>
                </div>
              </div>
            </div>
      </TabHeader>

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden" style={{ minHeight: 0 }}>
        {/* Matrix View (Full Screen) */}
        {showMatrix && (
          <div className="absolute inset-0 z-30 bg-[#02030a]">
            <DependencyMatrix />
          </div>
        )}

        {/* Graph Container */}
        <div 
          ref={containerRef}
          className={`flex-1 bg-[#02030a] ${showMatrix ? 'hidden' : ''} relative`}
          style={{ height: '100%' }}
        >
          {initError && !isRecovering && (
            <div className="absolute inset-0 flex items-center justify-center z-50">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
                <h3 className="text-red-400 font-semibold mb-2 flex items-center gap-2">
                  <X className="w-5 h-5" />
                  Visualization Error
                </h3>
                <p className="text-gray-300 text-sm mb-4">{initError}</p>
                
                {retryCount < maxRetries ? (
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs">
                      Automatic recovery in progress ({retryCount}/{maxRetries} attempts)
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-gray-400 text-xs">
                      Automatic recovery failed after {maxRetries} attempts.
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRetryCount(0);
                      setIsRecovering(false);
                      setInitError(null);
                      fetchArchitectureData();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {isRecovering && (
            <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/50">
              <div className="bg-[#252526] border border-blue-500/30 rounded-lg p-6 max-w-md">
                <h3 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Recovering Visualization
                </h3>
                <p className="text-gray-300 text-sm">
                  Attempting to restore the architecture view...
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Attempt {retryCount + 1} of {maxRetries}
                </p>
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
              className="absolute top-4 bottom-4 right-4 w-80 bg-[#252526] border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col"
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
            <div className="absolute top-4 right-4 bottom-4 w-80 bg-[#252526] border border-gray-700 rounded-lg shadow-xl z-40 overflow-hidden">
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
            onComponentClick={highlightComponent}
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
