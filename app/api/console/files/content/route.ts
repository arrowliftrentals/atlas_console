import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.ATLAS_BACKEND_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'path parameter is required' },
        { status: 400 }
      );
    }

    const backendUrl = `${BACKEND_URL}/v1/console/files/content?path=${encodeURIComponent(path)}`;
    const backendRes = await fetch(backendUrl);

    if (!backendRes.ok) {
      let errorMessage = 'Failed to load file';
      try {
        const errorData = await backendRes.json();
        errorMessage = errorData.detail || errorData.error || errorMessage;
      } catch {
        errorMessage = await backendRes.text() || errorMessage;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error proxying file content:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
