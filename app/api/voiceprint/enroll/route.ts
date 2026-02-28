/**
 * Voiceprint Enroll Proxy Route
 * Proxies POST /api/voiceprint/enroll → ATLAS /v1/voice/voiceprint/enroll
 */

import { NextRequest, NextResponse } from 'next/server';

const atlasApiBase = process.env.ATLAS_API_BASE || 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${atlasApiBase}/v1/voice/voiceprint/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(err, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    console.error('[Voiceprint Enroll Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy enrollment', detail: error.message },
      { status: 500 }
    );
  }
}
