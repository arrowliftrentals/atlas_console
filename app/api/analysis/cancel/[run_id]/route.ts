import { NextRequest, NextResponse } from 'next/server';

const ATLAS_API_BASE = process.env.NEXT_PUBLIC_ATLAS_API_BASE || 'http://127.0.0.1:8000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  const { run_id } = await params;

  try {
    const response = await fetch(`${ATLAS_API_BASE}/api/analysis/cancel/${run_id}`, {
      method: 'POST',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Cancel analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel analysis' },
      { status: 500 }
    );
  }
}
