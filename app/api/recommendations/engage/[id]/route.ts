import { NextRequest } from 'next/server';

const BACKEND_URL = process.env.ATLAS_BACKEND_URL || 'http://localhost:8000';

/**
 * Proxy POST to the ATLAS recommendations engage endpoint.
 * Passes the SSE stream through to the client unchanged.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: opportunityId } = await params;

  try {
    // Forward body if present (EngageRequest with optional depth)
    let body: string | undefined;
    try {
      const json = await req.json();
      body = JSON.stringify(json);
    } catch {
      // No body is fine — endpoint uses defaults
    }

    const backendRes = await fetch(
      `${BACKEND_URL}/v1/recommendations/engage/${encodeURIComponent(opportunityId)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'atlas-dev-key-001',
        },
        ...(body ? { body } : {}),
      }
    );

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: backendRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream SSE through to client
    return new Response(backendRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Recommendations Engage API] Exception:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
