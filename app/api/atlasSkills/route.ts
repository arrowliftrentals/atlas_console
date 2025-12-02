import { NextRequest, NextResponse } from 'next/server';

const ATLAS_CORE_URL = process.env.ATLAS_CORE_URL || 'http://localhost:8000';

/**
 * GET /api/atlasSkills
 *
 * Proxy to ATLAS Core skill execution endpoints:
 * - List executions: /v1/atlas/skill/executions (with optional query params)
 * - Get detail: /v1/atlas/skill/executions/{id}
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const targetProject = searchParams.get('target_project');
    const status = searchParams.get('status');

    try {
        let url: string;

        if (id) {
            // Fetch detail for specific execution
            url = `${ATLAS_CORE_URL}/v1/atlas/skill/executions/${id}`;
        } else {
            // List executions with optional filters
            const params = new URLSearchParams();
            if (targetProject) params.append('target_project', targetProject);
            if (status) params.append('status', status);

            const queryString = params.toString();
            url = `${ATLAS_CORE_URL}/v1/atlas/skill/executions${queryString ? `?${queryString}` : ''}`;
        }

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
        console.error('[atlasSkills API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch skill executions from ATLAS Core' },
            { status: 500 }
        );
    }
}
