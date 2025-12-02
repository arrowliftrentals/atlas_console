import { NextRequest, NextResponse } from "next/server";

// Prefer server-side override, fall back to public env, then default.
const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const res = await fetch(`${atlasApiBase}/v1/atlas/sandbox/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `ATLAS Core sandbox error: ${res.status} ${res.statusText}`,
          details: text,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("/api/sandbox error:", err);
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core sandbox." },
      { status: 500 },
    );
  }
}
