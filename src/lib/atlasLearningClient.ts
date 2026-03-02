/**
 * Client for ATLAS Learning API
 *
 * Provides functions to fetch learned fix patterns and success metrics.
 */

export interface FixPattern {
    tool: string;
    error_code: string;
    attempts: number;
    successes: number;
    failures: number;
    success_rate: number;
    last_updated?: string;
    similar_patterns?: string[];
}

export interface LearningStats {
    total_patterns: number;
    total_attempts: number;
    total_successes: number;
    total_failures: number;
    overall_success_rate: number;
    patterns_by_tool: Record<string, number>;
}

export interface LearningData {
    stats: LearningStats;
    patterns: FixPattern[];
}

/**
 * Fetch all learned patterns with statistics
 */
export async function fetchLearningPatterns(): Promise<LearningData> {
    const response = await fetch('/api/atlasLearning/patterns');
    if (!response.ok) {
        throw new Error(`Failed to fetch learning patterns: ${response.statusText}`);
    }
    return response.json();
}

/**
 * Fetch detailed information about a specific pattern
 */
export async function fetchPatternDetail(tool: string, errorCode: string): Promise<any> {
    const response = await fetch(`/api/atlasLearning/pattern/${tool}/${errorCode}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch pattern detail: ${response.statusText}`);
    }
    return response.json();
}
