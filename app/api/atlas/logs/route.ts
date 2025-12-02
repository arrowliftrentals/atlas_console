import { NextRequest, NextResponse } from 'next/server';

const ATLAS_BACKEND_URL = process.env.ATLAS_BACKEND_URL || 'http://localhost:8000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    const sessionId = searchParams.get('session_id');

    const params = new URLSearchParams({ limit });
    if (sessionId) {
      params.append('session_id', sessionId);
    }

    const response = await fetch(
      `${ATLAS_BACKEND_URL}/v1/atlas/logs?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Backend returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API /api/atlas/logs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
