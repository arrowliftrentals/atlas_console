import { NextRequest, NextResponse } from "next/server";

const ATLAS_API_URL = process.env.NEXT_PUBLIC_ATLAS_API_URL || "http://127.0.0.1:8000";

/**
 * GET /api/tasks
 * Proxies to ATLAS backend /v1/atlas/tasks
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${ATLAS_API_URL}/v1/atlas/tasks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[API] ATLAS tasks endpoint failed: ${response.status}`);
      return NextResponse.json(
        { error: "Failed to fetch tasks from ATLAS" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
