import { NextResponse } from 'next/server';

export async function GET() {
  // Simple diagnostic endpoint
  return NextResponse.json({
    message: 'Particle debug endpoint',
    timestamp: new Date().toISOString(),
    instructions: [
      '1. Check browser console for: 🎨 FlowParticle created',
      '2. Check for: ⚠️ FlowParticle groupRef is null',
      '3. Verify particle counter is incrementing',
      '4. Look for console.log messages from particle generator',
    ],
    expectedBehavior: {
      particleCreation: 'Should see 🎨 FlowParticle created messages',
      particleRendering: 'Large glowing spheres (1.2 radius) with point lights',
      pathIllumination: 'Bright cyan/yellow lines (0.9 opacity, 3.5 width)',
      continuousFlow: 'New particles every 600ms while traces active'
    }
  });
}
