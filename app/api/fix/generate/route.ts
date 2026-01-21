import { NextResponse } from "next/server";

const atlasApiBase =
  process.env.ATLAS_API_URL ||
  process.env.NEXT_PUBLIC_ATLAS_API_URL ||
  "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    console.log("[Console Proxy] Forwarding fix/generate request to Atlas...");
    const body = await request.json();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for initial response
    
    const res = await fetch(`${atlasApiBase}/api/fix/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    console.log(`[Console Proxy] Got response: ${res.status}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Console Proxy] Atlas returned error: ${res.status} ${text}`);
      return NextResponse.json(
        {
          error: `ATLAS Core error: ${res.status} ${res.statusText}`,
          details: text,
        },
        { status: 502 },
      );
    }

    const data = await res.json();
    console.log(`[Console Proxy] Returning job_id: ${data.job_id}`);
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    console.error("/api/fix/generate error:", err);
    if (err.name === 'AbortError') {
      return NextResponse.json(
        { error: "Request to Atlas timed out after 10s" },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Failed to reach ATLAS Core.", details: err.message },
      { status: 500 },
    );
  }
}
