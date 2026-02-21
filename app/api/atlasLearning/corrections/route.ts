import { NextRequest, NextResponse } from 'next/server';

const ATLAS_CORE_URL = process.env.ATLAS_CORE_URL || 'http://localhost:8000';

/**
 * GET /api/atlasLearning/corrections
 *
 * Proxy to ATLAS Core: /v1/learning/corrections/list
 * Returns individual intent correction records.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '50';
        const offset = searchParams.get('offset') || '0';

        const url = `${ATLAS_CORE_URL}/v1/learning/corrections/list?limit=${limit}&offset=${offset}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { error: `ATLAS Core returned ${response.status}: ${errorText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[atlasLearning/corrections API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch corrections from ATLAS Core' },
            { status: 500 }
        );
    }
}
