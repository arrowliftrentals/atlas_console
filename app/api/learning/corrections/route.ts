import { NextRequest, NextResponse } from "next/server";

const ATLAS_BASE_URL = process.env.ATLAS_BASE_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${ATLAS_BASE_URL}/v1/learning/corrections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ATLAS API error:", errorText);
      return NextResponse.json(
        { error: "Failed to submit correction" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error submitting correction:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(
      `${ATLAS_BASE_URL}/v1/learning/corrections/stats`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ATLAS API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch stats" },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Wrap in corrections array for frontend compatibility
    return NextResponse.json({ corrections: [] });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
