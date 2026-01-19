import { NextRequest, NextResponse } from "next/server";

const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "100";
    const language = searchParams.get("language");

    let url = `${atlasApiBase}/api/sandbox/history?limit=${limit}`;
    if (language) {
      url += `&language=${language}`;
    }

    const res = await fetch(url, {
      method: "GET",
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
    console.error("/api/sandbox/history error:", err);
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core." },
      { status: 500 },
    );
  }
}
