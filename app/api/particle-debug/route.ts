import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'This endpoint exists for debugging. Open browser console and run:',
    instructions: [
      '1. Open http://localhost:3000 in browser',
      '2. Navigate to Neural 3D tab',
      '3. Open browser console (F12)',
      '4. Click the purple "Test Particle" button',
      '5. Copy console output and send to assistant',
      '',
      'Or run in console:',
      'const store = require("@/components/Neural3D/NeuralTelemetryStoreV2").useNeuralTelemetryStoreV2.getState();',
      'console.log("Nodes:", store.nodes.size, "Edges:", store.edges.size, "ParticleEvents:", store.particleEvents.length);',
    ]
  });
}
