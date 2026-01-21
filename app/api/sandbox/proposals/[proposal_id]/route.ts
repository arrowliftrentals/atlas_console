import { NextRequest, NextResponse } from "next/server";

const ATLAS_API_BASE = process.env.ATLAS_API_BASE || "http://127.0.0.1:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposal_id: string }> }
) {
  const { proposal_id } = await params;

  try {
    const response = await fetch(
      `${ATLAS_API_BASE}/api/proposals/${proposal_id}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch proposal details" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching proposal details:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal details" },
      { status: 500 }
    );
  }
}
