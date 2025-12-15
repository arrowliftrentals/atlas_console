import { NextRequest } from "next/server";

// Prefer server-side override, fall back to public env, then default.
const atlasApiBase =
    process.env.ATLAS_API_URL ||
    process.env.NEXT_PUBLIC_ATLAS_API_URL ||
    "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();

        const res = await fetch(`${atlasApiBase}/v1/atlas/chat/stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text();
            return new Response(
                JSON.stringify({ error: `ATLAS Core error: ${res.status} ${res.statusText}`, details: text }),
                { 
                    status: 502,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
        }

        // Stream the response back to the client
        return new Response(res.body, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });
    } catch (err: any) {
        console.error("Error in /api/atlasChat/stream proxy:", err);
        return new Response(
            JSON.stringify({ error: "Failed to reach ATLAS Core streaming endpoint." }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}
