import { NextRequest, NextResponse } from "next/server";

// Prefer server-side override, fall back to public env, then default.
const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  // Step 1: Parse JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    console.error("/api/uiPatchAuto JSON parse error:", err);
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 },
    );
  }

  // Step 2: Validate body structure and types
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as any).project !== "string" ||
    typeof (body as any).instructions !== "string"
  ) {
    return NextResponse.json(
      { error: "Request body must include string fields: project, instructions." },
      { status: 400 },
    );
  }

  const { project, instructions } = body as {
    project: string;
    instructions: string;
  };

  // Step 3: Validate non-empty fields
  if (!project.trim() || !instructions.trim()) {
    return NextResponse.json(
      { error: "project and instructions cannot be empty." },
      { status: 400 },
    );
  }

  // Step 4: Prepare payload for ATLAS Core
  const payload = {
    query: "ui patch auto",
    assumptions: [],
    context: JSON.stringify({ project, instructions }),
    override_unresolved_assumptions: true,
  };

  // Step 5: Call ATLAS Core
  let res: Response;
  try {
    res = await fetch(`${atlasApiBase}/v1/atlas/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Error calling ATLAS Core ui patch auto endpoint:", err);
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core ui patch auto endpoint." },
      { status: 502 },
    );
  }

  // Step 6: Parse ATLAS Core response
  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    console.error("ATLAS Core returned non-JSON response:", err);
    return NextResponse.json(
      { error: "ATLAS Core returned an invalid response." },
      { status: 502 },
    );
  }

  // Step 7: Handle non-OK responses
  if (!res.ok) {
    console.error("ATLAS Core ui patch auto error:", res.status, data);
    return NextResponse.json(
      {
        error: "ATLAS Core ui patch auto request failed.",
        status: res.status,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(data, { status: 200 });
}
