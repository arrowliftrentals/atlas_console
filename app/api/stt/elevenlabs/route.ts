import { NextRequest } from 'next/server';
import { WebSocket as WSClient } from 'ws';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Check if API key is configured
  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ElevenLabs API key not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // This is a WebSocket upgrade request
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 });
  }

  try {
    // Connect to ElevenLabs Scribe v2 Realtime WebSocket
    const elevenLabsWS = new WSClient(
      'wss://api.elevenlabs.io/v1/speech-to-text/realtime',
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
      }
    );

    // Get the WebSocket from the request
    // Note: This is a simplified version. In production, you'd use a proper WebSocket library
    // or Next.js middleware to handle WebSocket upgrades

    elevenLabsWS.on('open', () => {
      console.log('[STT Proxy] Connected to ElevenLabs');
    });

    elevenLabsWS.on('message', (data) => {
      // Forward transcription results to client
      // In a full implementation, this would go through the upgraded WebSocket
      console.log('[STT Proxy] Received:', data.toString().substring(0, 100));
    });

    elevenLabsWS.on('error', (error) => {
      console.error('[STT Proxy] Error:', error);
    });

    elevenLabsWS.on('close', () => {
      console.log('[STT Proxy] Connection closed');
    });

    return new Response('WebSocket upgrade initiated', { status: 101 });
  } catch (error: any) {
    console.error('[STT Proxy] Failed to connect:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
