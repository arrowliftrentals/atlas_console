/**
 * Voiceprint Warmup Proxy Route
 * Proxies POST /api/voiceprint/warmup → ATLAS /v1/voice/voiceprint/warmup
 */

import { NextResponse } from 'next/server';

const atlasApiBase = process.env.ATLAS_API_BASE || 'http://127.0.0.1:8000';

export async function POST() {
  try {
    const response = await fetch(`${atlasApiBase}/v1/voice/voiceprint/warmup`, {
      method: 'POST',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(err, { status: response.status });
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    console.error('[Voiceprint Warmup Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy warmup', detail: error.message },
      { status: 500 }
    );
  }
}
