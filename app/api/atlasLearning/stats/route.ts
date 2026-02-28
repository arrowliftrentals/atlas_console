import { NextRequest, NextResponse } from 'next/server';

const ATLAS_CORE_URL = process.env.ATLAS_CORE_URL || 'http://localhost:8000';

/**
 * GET /api/atlasLearning/stats
 *
 * Proxy to ATLAS Core: /v1/learning/stats
 * Returns comprehensive stats from all 5 learning subsystems.
 */
export async function GET(_request: NextRequest) {
    try {
        const url = `${ATLAS_CORE_URL}/v1/learning/stats`;

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
        console.error('[atlasLearning/stats API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch learning stats from ATLAS Core' },
            { status: 500 }
        );
    }
}
