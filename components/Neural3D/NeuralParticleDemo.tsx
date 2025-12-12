// NeuralParticleDemo.tsx
// Demo component that generates particle flow events through the neural network

'use client';

import { useEffect, useRef } from 'react';
import { useNeuralTelemetryStoreV2 } from './NeuralTelemetryStoreV2';

interface Props {
  enabled?: boolean;
  particlesPerSecond?: number;
  complexTaskMode?: boolean;
}

export function NeuralParticleDemo({
  enabled = true,
  particlesPerSecond = 5,
  complexTaskMode = false,
}: Props) {
  const { nodes, edges, ingestEvents } = useNeuralTelemetryStoreV2();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const nodeArrayRef = useRef<any[]>([]);
  const coreNodesRef = useRef<any[]>([]);
  const memoryNodesRef = useRef<any[]>([]);
  const perceptionNodesRef = useRef<any[]>([]);
  
  // Update node arrays when nodes change (separate effect to avoid infinite loop)
  useEffect(() => {
    const nodeArray = Array.from(nodes.values());
    nodeArrayRef.current = nodeArray;
    
    // Classify nodes by shell
    coreNodesRef.current = nodeArray.filter(n => {
      const pos = n.position;
      if (!pos) return false;
      const [x, y, z] = pos;
      const dist = Math.sqrt(x * x + y * y + z * z);
      return dist < 30; // Core radius + buffer
    });
    
    memoryNodesRef.current = nodeArray.filter(n => {
      const pos = n.position;
      if (!pos) return false;
      const [x, y, z] = pos;
      const dist = Math.sqrt(x * x + y * y + z * z);
      return dist >= 30 && dist < 70; // Memory shell
    });
    
    perceptionNodesRef.current = nodeArray.filter(n => {
      const pos = n.position;
      if (!pos) return false;
      const [x, y, z] = pos;
      const dist = Math.sqrt(x * x + y * y + z * z);
      return dist >= 70; // Perception shell
    });
  }, [nodes]);
  
  useEffect(() => {
    // Clear interval immediately when disabled
    if (!enabled) {
      if (intervalRef.current) {
        console.log('[ParticleDemo] Stopping demo');
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    if (nodeArrayRef.current.length === 0) {
      console.log('[ParticleDemo] No nodes yet, waiting...');
      return;
    }
    
    console.log('[ParticleDemo] Starting demo with', nodeArrayRef.current.length, 'nodes');
    
    // Complex task simulation: multi-step workflows with parallel operations
    const generateComplexTask = () => {
      const events = [];
      const now = Date.now();
      const coreNodes = coreNodesRef.current;
      const memoryNodes = memoryNodesRef.current;
      const perceptionNodes = perceptionNodesRef.current;
      
      // Task 1: User Query Processing (high priority cascade)
      // Stagger events with longer delays to create visible workflow
      if (perceptionNodes.length > 0 && memoryNodes.length > 0 && coreNodes.length > 0) {
        const apiNode = perceptionNodes[0];
        const vectorNode = memoryNodes.find((n: any) => n.id.includes('vector')) || memoryNodes[0];
        const llmNode = coreNodes[0];
        const dbNode = memoryNodes.find((n: any) => n.id.includes('database')) || memoryNodes[1] || memoryNodes[0];
        
        // Step 1: API receives query
        events.push({
          source: apiNode.id,
          target: vectorNode.id,
          type: 'vector_retrieval' as const,
          timestamp: now,
          bytes: 8000,
          priority: 'high' as const,
        });
        
        // Step 2: Vector to LLM (delayed)
        events.push({
          source: vectorNode.id,
          target: llmNode.id,
          type: 'token_flow' as const,
          timestamp: now + 800,
          bytes: 15000,
          priority: 'high' as const,
        });
        
        // Step 3: LLM to Database (delayed)
        events.push({
          source: llmNode.id,
          target: dbNode.id,
          type: 'memory_write' as const,
          timestamp: now + 1600,
          bytes: 6000,
          priority: 'normal' as const,
        });
        
        // Step 4: LLM back to API (delayed)
        events.push({
          source: llmNode.id,
          target: apiNode.id,
          type: 'data_transfer' as const,
          timestamp: now + 2400,
          bytes: 4000,
          priority: 'high' as const,
        });
      }
      
      // Task 2: Background Analysis (parallel multi-node processing)
      if (memoryNodes.length > 2 && coreNodes.length > 0) {
        const sourceMemory = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        
        // Fan-out with visible delays
        coreNodes.slice(0, Math.min(3, coreNodes.length)).forEach((coreNode: any, idx: number) => {
          events.push({
            source: sourceMemory.id,
            target: coreNode.id,
            type: 'data_transfer' as const,
            timestamp: now + 400 + (idx * 200),
            bytes: 3000,
            priority: 'low' as const,
          });
        });
      }
      
      // Task 3: Plugin Invocation Chain
      if (perceptionNodes.length > 2 && coreNodes.length > 0) {
        const tool1 = perceptionNodes[1] || perceptionNodes[0];
        const tool2 = perceptionNodes[2] || perceptionNodes[0];
        const orchestrator = coreNodes[0];
        
        events.push({
          source: orchestrator.id,
          target: tool1.id,
          type: 'plugin_invocation' as const,
          timestamp: now + 200,
          bytes: 2500,
          priority: 'normal' as const,
        });
        
        events.push({
          source: tool1.id,
          target: tool2.id,
          type: 'plugin_invocation' as const,
          timestamp: now + 1000,
          bytes: 3500,
          priority: 'normal' as const,
        });
        
        events.push({
          source: tool2.id,
          target: orchestrator.id,
          type: 'data_transfer' as const,
          timestamp: now + 1800,
          bytes: 4500,
          priority: 'normal' as const,
        });
      }
      
      // Task 4: Telemetry & Monitoring (continuous background)
      if (perceptionNodes.length > 0 && memoryNodes.length > 0) {
        const telemetryNode = perceptionNodes[perceptionNodes.length - 1];
        const storageNode = memoryNodes[memoryNodes.length - 1];
        
        events.push({
          source: telemetryNode.id,
          target: storageNode.id,
          type: 'telemetry_metric' as const,
          timestamp: now + 600,
          bytes: 800,
          priority: 'low' as const,
        });
      }
      
      // Task 5: Inter-agent communication
      if (coreNodes.length > 1) {
        const agent1 = coreNodes[0];
        const agent2 = coreNodes[1];
        
        events.push({
          source: agent1.id,
          target: agent2.id,
          type: 'agent_communication' as const,
          timestamp: now + 300,
          bytes: 3000,
          priority: 'normal' as const,
        });
        
        events.push({
          source: agent2.id,
          target: agent1.id,
          type: 'agent_communication' as const,
          timestamp: now + 1100,
          bytes: 2800,
          priority: 'normal' as const,
        });
      }
      
      if (events.length > 0) {
        console.log('[ParticleDemo] Generated', events.length, 'complex task events');
        ingestEvents(events);
      }
    };
    
    // Simple flow pattern
    const generateParticleFlow = () => {
      const events = [];
      const now = Date.now();
      const coreNodes = coreNodesRef.current;
      const memoryNodes = memoryNodesRef.current;
      const perceptionNodes = perceptionNodesRef.current;
      
      // Core → Memory
      if (coreNodes.length > 0 && memoryNodes.length > 0) {
        const source = coreNodes[Math.floor(Math.random() * coreNodes.length)];
        const target = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        
        events.push({
          source: source.id,
          target: target.id,
          type: 'data_transfer' as const,
          timestamp: now,
          bytes: Math.floor(Math.random() * 10000) + 1000,
          priority: 'normal' as const,
        });
      }
      
      // Memory → Perception
      if (memoryNodes.length > 0 && perceptionNodes.length > 0) {
        const source = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        const target = perceptionNodes[Math.floor(Math.random() * perceptionNodes.length)];
        
        events.push({
          source: source.id,
          target: target.id,
          type: 'data_transfer' as const,
          timestamp: now + 100,
          bytes: Math.floor(Math.random() * 10000) + 1000,
          priority: 'normal' as const,
        });
      }
      
      // Perception → Memory (feedback)
      if (perceptionNodes.length > 0 && memoryNodes.length > 0) {
        const source = perceptionNodes[Math.floor(Math.random() * perceptionNodes.length)];
        const target = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        
        events.push({
          source: source.id,
          target: target.id,
          type: 'memory_write' as const,
          timestamp: now + 200,
          bytes: Math.floor(Math.random() * 5000) + 500,
          priority: 'high' as const,
        });
      }
      
      // Memory → Core
      if (memoryNodes.length > 0 && coreNodes.length > 0) {
        const source = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        const target = coreNodes[Math.floor(Math.random() * coreNodes.length)];
        
        events.push({
          source: source.id,
          target: target.id,
          type: 'memory_read' as const,
          timestamp: now + 300,
          bytes: Math.floor(Math.random() * 5000) + 500,
          priority: 'high' as const,
        });
      }
      
      // Core internal
      if (coreNodes.length > 1) {
        const source = coreNodes[Math.floor(Math.random() * coreNodes.length)];
        const target = coreNodes[Math.floor(Math.random() * coreNodes.length)];
        if (source.id !== target.id) {
          events.push({
            source: source.id,
            target: target.id,
            type: 'token_flow' as const,
            timestamp: now + 50,
            bytes: Math.floor(Math.random() * 2000) + 200,
            priority: 'normal' as const,
          });
        }
      }
      
      // Memory internal
      if (memoryNodes.length > 1) {
        const source = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        const target = memoryNodes[Math.floor(Math.random() * memoryNodes.length)];
        if (source.id !== target.id) {
          events.push({
            source: source.id,
            target: target.id,
            type: 'data_transfer' as const,
            timestamp: now + 150,
            bytes: Math.floor(Math.random() * 3000) + 300,
            priority: 'low' as const,
          });
        }
      }
      
      // Perception internal
      if (perceptionNodes.length > 1) {
        const source = perceptionNodes[Math.floor(Math.random() * perceptionNodes.length)];
        const target = perceptionNodes[Math.floor(Math.random() * perceptionNodes.length)];
        if (source.id !== target.id) {
          events.push({
            source: source.id,
            target: target.id,
            type: 'external_api_call' as const,
            timestamp: now + 250,
            bytes: Math.floor(Math.random() * 8000) + 800,
            priority: 'normal' as const,
          });
        }
      }
      
      if (events.length > 0) {
        console.log('[ParticleDemo] Generated', events.length, 'particle events');
        ingestEvents(events);
      }
    };
    
    // Choose flow generator
    const flowGenerator = complexTaskMode ? generateComplexTask : generateParticleFlow;
    
    // Generate particles at specified rate
    const intervalMs = 1000 / particlesPerSecond;
    intervalRef.current = setInterval(flowGenerator, intervalMs);
    
    // Generate initial burst
    flowGenerator();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, particlesPerSecond, complexTaskMode, ingestEvents]);
  
  return null; // This is a logic-only component
}
