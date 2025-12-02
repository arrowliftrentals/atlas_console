import { ConsoleSession, ConsoleFileListResponse, AgentResponse, AtlasChatResponse } from './types';

const CONSOLE_API_BASE = '/api/console';
const ATLAS_API_BASE = '/api/atlas';

export async function listConsoleSessions(): Promise<{sessions: ConsoleSession[], total: number}> {
  const res = await fetch(`${CONSOLE_API_BASE}/sessions`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch console sessions');
  return res.json();
}

export async function createConsoleSession(
  payload: { session_id?: string; project_id?: string; root_path?: string; data?: any }
): Promise<{ session_id: string; status: string }> {
  const res = await fetch(`${CONSOLE_API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create console session');
  return res.json();
}

export async function fetchConsoleFiles(path: string = '.'): Promise<ConsoleFileListResponse> {
  const params = new URLSearchParams({ path });
  const res = await fetch(`${CONSOLE_API_BASE}/files?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch console files');
  return res.json();
}

export async function clearConsoleSession(sessionId: string): Promise<{status: string, session_id: string}> {
  const res = await fetch(`${CONSOLE_API_BASE}/sessions/${sessionId}/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to clear console session');
  return res.json();
}

/**
 * Send a chat request to ATLAS and get a structured response
 */
export async function sendAtlasChat(
  query: string,
  sessionId?: string,
  context?: string
): Promise<AgentResponse> {
  const payload = {
    query,
    session_id: sessionId,
    context,
    assumptions: [],
    override_unresolved_assumptions: true,
  };

  const res = await fetch(`${ATLAS_API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to send ATLAS chat: ${res.statusText}`);
  }

  const backendResponse: AtlasChatResponse = await res.json();
  return mapBackendResponseToAgentResponse(backendResponse);
}

/**
 * Transform backend AtlasChatResponse to frontend AgentResponse format
 * This adapter ensures frontend components work with properly typed data
 */
function mapBackendResponseToAgentResponse(backend: AtlasChatResponse): AgentResponse {
  return {
    answer: backend.answer,
    tool_calls: backend.tool_calls || undefined,
    patches: backend.patches || undefined,
    commands: backend.commands || undefined,
    tests: backend.tests || undefined,
    context_requests: backend.context_requests || undefined,
    skills: backend.skills || undefined,
    assumptions_used: backend.assumptions_used || [],
    unresolved_assumptions: backend.unresolved_assumptions || [],
    notes: backend.notes || undefined,
  };
}

/**
 * Fetch recent activity logs from ATLAS backend
 * Shows tool calls, LLM iterations, and processing details
 */
export async function fetchActivityLogs(
  limit: number = 100,
  sessionId?: string
): Promise<Array<{
  timestamp: string;
  level: string;
  message: string;
  session_id?: string;
  details?: Record<string, any>;
}>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (sessionId) {
    params.append('session_id', sessionId);
  }

  const res = await fetch(`${ATLAS_API_BASE}/logs?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch activity logs: ${res.statusText}`);
  }

  return res.json();
}

/**
 * Clear all activity logs
 */
export async function clearActivityLogs(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${ATLAS_API_BASE}/logs/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Failed to clear activity logs: ${res.statusText}`);
  }

  return res.json();
}
