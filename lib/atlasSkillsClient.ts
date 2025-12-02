/**
 * Client for ATLAS Skills API
 *
 * Provides functions to fetch skill execution history and details.
 */

export interface SkillExecutionSummary {
    id: number;
    created_at: string;
    name: string;
    version: string;
    target_project: string;
    status: string;
    message: string;
}

export interface SkillExecutionDetail extends SkillExecutionSummary {
    spec_json: any;
    result_json: any;
}

/**
 * Fetch list of skill executions with optional filters
 */
export async function fetchSkillExecutions(
    targetProject?: string,
    status?: string
): Promise<SkillExecutionSummary[]> {
    const params = new URLSearchParams();
    if (targetProject) params.append('target_project', targetProject);
    if (status) params.append('status', status);

    const queryString = params.toString();
    const url = `/api/atlasSkills${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch skill executions: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Fetch detailed information for a specific skill execution
 */
export async function fetchSkillExecutionDetail(
    id: number
): Promise<SkillExecutionDetail> {
    const response = await fetch(`/api/atlasSkills?id=${id}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch skill execution detail: ${response.statusText}`);
    }

    return response.json();
}
