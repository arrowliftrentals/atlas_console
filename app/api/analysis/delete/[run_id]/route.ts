import { NextRequest, NextResponse } from "next/server";

const ATLAS_API_BASE = process.env.ATLAS_API_BASE || "http://127.0.0.1:8000";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ run_id: string }> }
) {
  const { run_id } = await params;

  try {
    const response = await fetch(
      `${ATLAS_API_BASE}/api/analysis/delete/${run_id}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error deleting analysis run:", error);
    return NextResponse.json(
      { error: "Failed to delete analysis run" },
      { status: 500 }
    );
  }
}
