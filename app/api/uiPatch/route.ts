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
    console.error("/api/uiPatch JSON parse error:", err);
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
    typeof (body as any).path !== "string" ||
    typeof (body as any).instructions !== "string"
  ) {
    return NextResponse.json(
      { error: "Request body must include string fields: project, path, instructions." },
      { status: 400 },
    );
  }

  const { project, path, instructions } = body as {
    project: string;
    path: string;
    instructions: string;
  };

  // Step 3: Validate non-empty fields
  if (!project.trim() || !path.trim() || !instructions.trim()) {
    return NextResponse.json(
      { error: "project, path, and instructions cannot be empty." },
      { status: 400 },
    );
  }

  // Step 4: Security - prevent path traversal
  if (path.includes("..") || path.startsWith("/")) {
    return NextResponse.json(
      { error: "Invalid file path: path traversal detected." },
      { status: 400 },
    );
  }

  // Step 5: Prepare payload for ATLAS Core
  const payload = {
    query: "ui patch infer",
    assumptions: [],
    context: JSON.stringify({ project, path, instructions }),
    override_unresolved_assumptions: true,
  };

  // Step 6: Call ATLAS Core
  let res: Response;
  try {
    res = await fetch(`${atlasApiBase}/v1/atlas/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Error calling ATLAS Core ui patch endpoint:", err);
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core ui patch endpoint." },
      { status: 502 },
    );
  }

  // Step 7: Parse ATLAS Core response
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

  // Step 8: Handle non-OK responses
  if (!res.ok) {
    console.error("ATLAS Core ui patch error:", res.status, data);
    return NextResponse.json(
      {
        error: "ATLAS Core ui patch request failed.",
        status: res.status,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(data, { status: 200 });
}
