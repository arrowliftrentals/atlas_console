import { NextResponse } from "next/server";

const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    // Extract query parameters from the request URL
    const { searchParams } = new URL(request.url);
    const run_id = searchParams.get('run_id');
    const max_issues = searchParams.get('max_issues') || '10';
    const min_priority = searchParams.get('min_priority') || '50';
    
    if (!run_id) {
      return NextResponse.json(
        { error: "run_id is required" },
        { status: 400 }
      );
    }
    
    // Forward as query parameters to backend
    const backendUrl = `${atlasApiBase}/api/fix/batch?run_id=${encodeURIComponent(run_id)}&max_issues=${max_issues}&min_priority=${min_priority}`;
    
    const res = await fetch(backendUrl, {
      method: "POST",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `ATLAS Core error: ${res.status} ${res.statusText}`,
          details: text,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("/api/fix/batch error:", err);
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core." },
      { status: 500 },
    );
  }
}
