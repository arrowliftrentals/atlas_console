import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_ATLAS_WEB_API_BASE || 'http://localhost:8000';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const res = await fetch(`${BASE}/v1/console/sessions/${sessionId}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clear session' },
      { status: 500 }
    );
  }
}
