import { NextRequest, NextResponse } from "next/server";

const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    
    const res = await fetch(`${atlasApiBase}/api/analysis/issues/${runId}`, {
      method: "GET",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Backend error: ${res.status} ${res.statusText}`, details: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("/api/analysis/issues error:", err);
    return NextResponse.json(
      { error: "Failed to fetch issues", message: err.message },
      { status: 500 }
    );
  }
}
