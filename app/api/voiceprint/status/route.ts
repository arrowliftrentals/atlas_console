/**
 * Voiceprint Status Proxy Route
 * Proxies GET /api/voiceprint/status → ATLAS /v1/voice/voiceprint/status
 */

import { NextRequest, NextResponse } from 'next/server';

const atlasApiBase = process.env.ATLAS_API_BASE || 'http://127.0.0.1:8000';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id') || 'owner';
    const response = await fetch(
      `${atlasApiBase}/v1/voice/voiceprint/status?user_id=${userId}`
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(err, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    console.error('[Voiceprint Status Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy voiceprint status', detail: error.message },
      { status: 500 }
    );
  }
}
