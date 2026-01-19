import { NextRequest } from "next/server";

const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;
  
  // Simple proxy to backend progress endpoint
  // Frontend will poll this endpoint for updates
  try {
    const res = await fetch(`${atlasApiBase}/api/analysis/progress/${runId}`, {
      method: "GET",
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Backend error: ${res.status}` }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("/api/analysis/progress error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch progress", message: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
