import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.ATLAS_BACKEND_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[ATLAS API] Received request, forwarding to:', `${BACKEND_URL}/v1/atlas/chat`);
    console.log('[ATLAS API] Request body:', JSON.stringify(body).substring(0, 200));
    
    const backendRes = await fetch(`${BACKEND_URL}/v1/atlas/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'atlas-dev-key-001',
      },
      body: JSON.stringify(body),
    });

    console.log('[ATLAS API] Backend response status:', backendRes.status);
    
    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      console.error('[ATLAS API] Backend error:', backendRes.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    console.log('[ATLAS API] Success, response length:', JSON.stringify(data).length);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[ATLAS API] Exception:', error.message, error.stack);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
