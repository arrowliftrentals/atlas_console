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
    console.error("/api/atlasPatch JSON parse error:", err);
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
    typeof (body as any).diff !== "string"
  ) {
    return NextResponse.json(
      { error: "Request body must include string fields: project, path, diff." },
      { status: 400 },
    );
  }

  const { project, path, diff } = body as {
    project: string;
    path: string;
    diff: string;
  };

  // Step 3: Validate non-empty fields
  if (!project.trim() || !path.trim() || !diff.trim()) {
    return NextResponse.json(
      { error: "project, path, and diff cannot be empty." },
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

  // Step 5: Limit diff size (prevent DoS)
  const MAX_DIFF_BYTES = 2 * 1024 * 1024; // 2MB
  if (Buffer.byteLength(diff, "utf8") > MAX_DIFF_BYTES) {
    return NextResponse.json(
      { error: "Diff is too large (max 2MB)." },
      { status: 413 },
    );
  }

  // Step 6: Call ATLAS Core
  const payload = {
    query: `patch file project ${project} ${path}`,
    assumptions: [],
    context: diff,
    override_unresolved_assumptions: true,
  };

  let res: Response;
  try {
    res = await fetch(`${atlasApiBase}/v1/atlas/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Error calling ATLAS Core patch endpoint:", err);
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core patch endpoint." },
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
    console.error("ATLAS Core patch error:", res.status, data);
    return NextResponse.json(
      {
        error: "ATLAS Core patch request failed.",
        status: res.status,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(data, { status: 200 });
}
