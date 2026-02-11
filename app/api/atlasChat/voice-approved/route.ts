/**
 * Voice-Approved Chat API Proxy Route
 * 
 * Proxies voice-approved requests to ATLAS backend.
 * Returns ApprovedUtterance with full governance validation.
 */

import { NextRequest, NextResponse } from 'next/server';

const atlasApiBase = process.env.ATLAS_API_BASE || 'http://127.0.0.1:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${atlasApiBase}/v1/atlas/chat/voice-approved`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Voice-Approved Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy voice-approved request', detail: error.message },
      { status: 500 }
    );
  }
}
