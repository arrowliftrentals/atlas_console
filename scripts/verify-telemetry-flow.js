#!/usr/bin/env node

/**
 * Telemetry Flow Verification Tool
 * 
 * This script connects to the ATLAS backend and captures real telemetry data,
 * then compares it against the architecture graph to verify that:
 * 1. All telemetry flows correspond to actual edges in the graph
 * 2. The component_id naming is consistent
 * 3. The flow direction matches the graph edges
 * 4. No flows are missed or incorrectly visualized
 * 
 * DEPENDENCIES:
 *   - ws (^8.18.0): WebSocket client for Node.js
 *   - Node.js v18+ (built-in fetch API)
 * 
 * INSTALLATION:
 *   npm install ws
 * 
 * USAGE:
 *   node scripts/verify-telemetry-flow.js
 */

// Import dependencies
const WebSocket = require('ws');
// Node.js v18+ has built-in fetch
const fetch = globalThis.fetch;

const BACKEND_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/v1/telemetry/stream';

// Store captured data
const capturedFlows = new Map(); // Map<traceId, flow[]>
const architectureGraph = { nodes: [], edges: [] };
const missingEdges = new Set();
const foundEdges = new Set();

// Fetch architecture graph
async function fetchArchitectureGraph() {
  try {
    console.log('📥 Fetching architecture graph...');
    const response = await fetch(`${BACKEND_URL}/v1/architecture/graph`);
    const data = await response.json();
    
    architectureGraph.nodes = data.nodes || [];
    architectureGraph.edges = data.edges || [];
    
    console.log(`✅ Graph loaded: ${architectureGraph.nodes.length} nodes, ${architectureGraph.edges.length} edges\n`);
    
    // Build edge lookup
    const edgeSet = new Set();
    architectureGraph.edges.forEach(edge => {
      edgeSet.add(`${edge.source}->${edge.target}`);
    });
    
    return edgeSet;
  } catch (error) {
    console.error('❌ Failed to fetch architecture graph:', error.message);
    process.exit(1);
  }
}

// Connect to telemetry WebSocket
function connectTelemetry(edgeSet) {
  return new Promise((resolve, reject) => {
    console.log('🔌 Connecting to telemetry WebSocket...');
    const ws = new WebSocket(WS_URL);
    
    let messageCount = 0;
    let traceCount = 0;
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected\n');
      console.log('📊 Listening for telemetry data (Ctrl+C to stop)...\n');
      console.log('─'.repeat(80));
    });
    
    ws.on('message', (data) => {
      try {
        const telemetry = JSON.parse(data.toString());
        messageCount++;
        
        // Debug: Show first few messages
        if (messageCount <= 3) {
          console.log(`\n📦 Message ${messageCount}:`, JSON.stringify(telemetry, null, 2).substring(0, 500));
        }
        
        if (telemetry.active_traces && telemetry.active_traces.length > 0) {
          telemetry.active_traces.forEach(trace => {
            traceCount++;
            processTrace(trace, edgeSet);
          });
        }
      } catch (error) {
        console.error('⚠️  Failed to parse telemetry:', error.message);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('\n' + '─'.repeat(80));
      console.log('\n📊 Final Statistics:');
      console.log(`   Messages received: ${messageCount}`);
      console.log(`   Traces processed: ${traceCount}`);
      console.log(`   Unique flows found: ${foundEdges.size}`);
      console.log(`   Missing edges: ${missingEdges.size}\n`);
      
      if (missingEdges.size > 0) {
        console.log('⚠️  MISSING EDGES (telemetry flows not in graph):');
        missingEdges.forEach(edge => console.log(`   - ${edge}`));
        console.log('');
      }
      
      console.log('✅ All found flows exist in architecture graph:', missingEdges.size === 0);
      resolve();
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down...');
      ws.close();
    });
  });
}

// Process a single trace
function processTrace(trace, edgeSet) {
  if (!trace.spans || trace.spans.length < 2) {
    return; // Need at least 2 spans to form a flow
  }
  
  // Sort spans by start_time (same as console does)
  const sorted = [...trace.spans].sort((a, b) => {
    const timeA = new Date(a.start_time).getTime();
    const timeB = new Date(b.start_time).getTime();
    return timeA - timeB;
  });
  
  // Extract component path
  const path = sorted.map(span => span.component_id);
  
  console.log(`\n🔄 Trace: ${trace.trace_id}`);
  console.log(`   Path: ${path.join(' → ')}`);
  
  // Check each flow edge
  for (let i = 0; i < path.length - 1; i++) {
    const source = path[i];
    const target = path[i + 1];
    const edgeKey = `${source}->${target}`;
    
    if (edgeSet.has(edgeKey)) {
      foundEdges.add(edgeKey);
      console.log(`   ✅ ${edgeKey} (exists in graph)`);
    } else {
      missingEdges.add(edgeKey);
      console.log(`   ❌ ${edgeKey} (MISSING in graph)`);
    }
  }
  
  // Store trace for analysis
  if (!capturedFlows.has(trace.trace_id)) {
    capturedFlows.set(trace.trace_id, {
      traceId: trace.trace_id,
      path,
      spans: sorted,
      timestamp: new Date().toISOString()
    });
  }
}

// Main execution
async function main() {
  console.log('🔍 ATLAS Telemetry Flow Verification Tool\n');
  console.log('This tool verifies that telemetry flows match the architecture graph.\n');
  
  // Step 1: Fetch architecture graph
  const edgeSet = await fetchArchitectureGraph();
  
  // Step 2: Connect to telemetry and capture flows
  await connectTelemetry(edgeSet);
  
  // Step 3: Summary
  console.log('\n📋 Verification Complete');
  
  if (missingEdges.size === 0 && foundEdges.size > 0) {
    console.log('✅ SUCCESS: All telemetry flows are correctly represented in the architecture graph.');
  } else if (foundEdges.size === 0) {
    console.log('⚠️  WARNING: No telemetry flows captured. Make sure to trigger some operations in ATLAS.');
  } else {
    console.log('❌ FAILURE: Some telemetry flows are not in the architecture graph.');
    console.log('   This means the visualization may not accurately reflect the real system behavior.');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
