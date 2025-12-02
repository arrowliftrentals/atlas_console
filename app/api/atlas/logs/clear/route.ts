import { NextRequest, NextResponse } from 'next/server';

const ATLAS_BACKEND_URL = process.env.ATLAS_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const response = await fetch(
      `${ATLAS_BACKEND_URL}/v1/atlas/logs/clear`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
    console.error('[API /api/atlas/logs/clear] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
