import { NextRequest, NextResponse } from "next/server";

const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proposalId = searchParams.get("proposal_id");

    if (!proposalId) {
      return NextResponse.json(
        { success: false, error: "proposal_id is required" },
        { status: 400 },
      );
    }

    const res = await fetch(`${atlasApiBase}/api/sandbox/rollback-changes?proposal_id=${proposalId}`, {
      method: "POST",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          success: false,
          error: `ATLAS Core error: ${res.status} ${res.statusText}`,
          details: text,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("/api/sandbox/rollback-changes error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to reach ATLAS Core." },
      { status: 500 },
    );
  }
}
