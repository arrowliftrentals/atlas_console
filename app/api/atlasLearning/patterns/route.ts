import { NextRequest, NextResponse } from 'next/server';

const ATLAS_CORE_URL = process.env.ATLAS_CORE_URL || 'http://localhost:8000';

/**
 * GET /api/atlasLearning/patterns
 *
 * Proxy to ATLAS Core learning patterns endpoint: /api/learning/patterns
 */
export async function GET(request: NextRequest) {
    try {
        const url = `${ATLAS_CORE_URL}/api/learning/patterns`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
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
        console.error('[atlasLearning API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch learning patterns from ATLAS Core' },
            { status: 500 }
        );
    }
}
