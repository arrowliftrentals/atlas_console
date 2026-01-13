import { ConsoleSession, ConsoleFileListResponse, ConsoleSessionListResponse, AgentResponse, AtlasChatResponse } from './types';

const CONSOLE_API_BASE = '/api/console';
const ATLAS_API_BASE = '/api/atlas';

export async function fetchConsoleSessions(): Promise<ConsoleSessionListResponse> {
  try {
    const res = await fetch(`${CONSOLE_API_BASE}/sessions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[ConsoleClient] Failed to fetch console sessions:', res.status, res.statusText);
      return { sessions: [] }; // Return empty result instead of throwing
    }
    return res.json();
  } catch (err) {
    console.warn('[ConsoleClient] Error fetching console sessions:', err);
    return { sessions: [] }; // Return empty result on error
  }
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
  try {
    const params = new URLSearchParams({ path });
    const res = await fetch(`${CONSOLE_API_BASE}/files?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[ConsoleClient] Failed to fetch console files:', res.status, res.statusText);
      return { workspace_root: '', current_path: path, files: [], directories: [] }; // Return empty result instead of throwing
    }
    return res.json();
  } catch (err) {
    console.warn('[ConsoleClient] Error fetching console files:', err);
    return { workspace_root: '', current_path: path, files: [], directories: [] }; // Return empty result on error
  }
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
    const errorBody = await res.text();
    console.error('[ATLAS Client] Error response:', res.status, errorBody);
    throw new Error(`Failed to send ATLAS chat: ${res.statusText} - ${errorBody}`);
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
  try {
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
      console.warn('[ConsoleClient] Failed to fetch activity logs:', res.status, res.statusText);
      return []; // Return empty array instead of throwing
    }

    const data = await res.json();
    // Validate response is an array
    if (!Array.isArray(data)) {
      console.warn('[ConsoleClient] Invalid logs response (not an array):', data);
      return [];
    }
    return data;
  } catch (err) {
    console.warn('[ConsoleClient] Error fetching activity logs:', err);
    return []; // Return empty array on error
  }
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

/**
 * Send a chat request to ATLAS with streaming response
 * Calls callbacks as chunks arrive for real-time UI updates
 */
export async function atlasChatStream(
  payload: { query: string; session_id?: string; context?: string },
  onChunk: (chunk: string) => void,
  onToolCall?: (toolName: string, status: string) => void,
  onDone?: (sessionId: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  const streamPayload = {
    query: payload.query,
    session_id: payload.session_id,
    context: payload.context,
    assumptions: [],
    override_unresolved_assumptions: true,
  };

  console.debug('[atlasConsoleClient] Starting SSE stream');

  try {
    const response = await fetch('/api/atlasChat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(streamPayload),
    });

    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('[SSE] Received event:', data.type, data);
            
            switch (data.type) {
              case 'connected':
                console.debug('[SSE] Connected, session:', data.session_id);
                break;
              
              case 'info':
                console.debug('[SSE] Info:', data.message);
                break;
              
              case 'answer_chunk':
                console.log('[SSE] Answer chunk received:', data.content.length, 'chars');
                // Add 40% delay for slower typing effect (simulate 140% of original time)
                await new Promise(resolve => setTimeout(resolve, data.content.length * 2));
                onChunk(data.content);
                break;
              
              case 'tool_call':
                onToolCall?.(data.name, data.status);
                break;
              
              case 'done':
                console.debug('[SSE] Stream complete');
                onDone?.(data.session_id);
                break;
              
              case 'error':
                console.error('[SSE] Error:', data.message);
                onError?.(data.message);
                break;
              
              default:
                console.debug('[SSE] Unknown event type:', data.type);
            }
          } catch (e) {
            console.error('[SSE] Failed to parse event data:', line, e);
          }
        }
      }
    }
  } catch (error) {
    console.error('[SSE] Stream error:', error);
    onError?.(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
