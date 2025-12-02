import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_ATLAS_WEB_API_BASE || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path') || '.';

    const url = new URL(`${BASE}/v1/console/files`);
    url.searchParams.set('path', path);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
