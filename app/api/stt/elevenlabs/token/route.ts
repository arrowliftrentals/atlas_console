import { NextResponse } from 'next/server';

/**
 * Generate a single-use token for ElevenLabs STT
 * Required for client-side WebSocket authentication
 */
export async function POST() {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured' },
      { status: 500 }
    );
  }
  
  try {
    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[STT Token] ElevenLabs API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate token' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({ token: data.token });
  } catch (error: any) {
    console.error('[STT Token] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate token' },
      { status: 500 }
    );
  }
}
