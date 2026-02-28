import { ConsoleSession, ConsoleFileListResponse, ConsoleSessionListResponse, AgentResponse, AtlasChatResponse } from './types';

const CONSOLE_API_BASE = '/api/console';
const ATLAS_API_BASE = '/api/atlas';

export async function fetchConsoleSessions(): Promise<ConsoleSessionListResponse> {
  try {
    console.log('[ConsoleClient] Fetching sessions from:', `${CONSOLE_API_BASE}/sessions`);
    const res = await fetch(`${CONSOLE_API_BASE}/sessions`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    if (!res.ok) {
      console.error('[ConsoleClient] Failed to fetch console sessions:', res.status, res.statusText);
      return { sessions: [] }; // Return empty result instead of throwing
    }
    const data = await res.json();
    console.log('[ConsoleClient] Sessions fetched:', data.sessions?.length || 0, 'sessions');
    return data;
  } catch (err) {
    console.error('[ConsoleClient] Error fetching console sessions:', err);
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
    // API returns { logs: [...], count: N } - extract the logs array
    const logs = data.logs || data;
    if (!Array.isArray(logs)) {
      console.warn('[ConsoleClient] Invalid logs response (not an array):', data);
      return [];
    }
    return logs;
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
/** A single step in ATLAS's thinking process, emitted during ReAct reasoning. */
export interface ThinkingStep {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'observation' | 'reflection' | 'progress';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export async function atlasChatStream(
  payload: { query: string; session_id?: string; context?: string },
  onChunk: (chunk: string) => void,
  onToolCall?: (toolName: string, status: string) => void,
  onDone?: (sessionId: string) => void,
  onError?: (error: string) => void,
  onThinking?: (step: ThinkingStep) => void
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
                console.debug('[SSE] Connected, session:', data.metadata?.session_id || data.session_id);
                break;
              
              case 'info':
                console.debug(`[SSE] ${data.type}:`, data.content || data.message);
                break;
              
              case 'progress':
                console.debug(`[SSE] progress:`, data.content || data.message);
                onThinking?.({
                  type: 'progress',
                  content: data.content || data.message || '',
                  metadata: data.metadata,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
                break;
              
              case 'metadata': {
                // Intentionally do not surface raw routing metadata in the
                // user-facing thinking stream — it frequently contains internal
                // identifiers (providers/handlers) and adds noise.
                console.debug(`[SSE] metadata:`, data.content || data.message);
                break;
              }
              
              case 'chunk':  // Backend sends 'chunk', not 'answer_chunk'
                if (data.content) {
                  onChunk(data.content);
                }
                break;
              
              case 'thinking':
              case 'reflection':
              case 'observation':
              case 'tool_result':
                onThinking?.({
                  type: data.type as ThinkingStep['type'],
                  content: data.content || '',
                  metadata: data.metadata,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
                break;
              
              case 'tool_call':
                onToolCall?.(data.name || data.content, data.status || 'running');
                // Also emit as thinking step for visualization
                onThinking?.({
                  type: 'tool_call',
                  content: data.name || data.content || '',
                  metadata: data.metadata,
                  timestamp: data.timestamp || new Date().toISOString(),
                });
                break;
              
              case 'done':
                console.debug('[SSE] Stream complete');
                onDone?.(data.metadata?.session_id || data.session_id || '');
                break;
              
              case 'error': {
                const errMsg = data.content || data.message || 'Unknown streaming error';
                console.error('[SSE] Error:', errMsg);
                onError?.(errMsg);
                break;
              }
              
              default:
                console.debug('[SSE] Unhandled event type:', data.type);
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


// =============================================================================
// Strategic Opportunity Engagement
// =============================================================================

export interface EngageResponse {
  opportunity_id: string;
  content: string;
  status: 'completed' | 'error';
}

/**
 * Stream an implementation plan from ATLAS for a strategic opportunity.
 *
 * Opens an SSE connection to the engage endpoint and calls `onChunk` as
 * content chunks arrive. Returns an AbortController so the caller can cancel.
 */
export function engageOpportunityStream(
  opportunityId: string,
  depth: 'overview' | 'detailed' | 'full' = 'full',
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(
        `http://localhost:8000/v1/recommendations/engage/${encodeURIComponent(opportunityId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ depth }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const errorBody = await res.text();
        onError(`Engage failed (${res.status}): ${errorBody}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError('Response body is not readable');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk' && data.content) {
              onChunk(data.content);
            } else if (data.type === 'done') {
              onDone();
            } else if (data.type === 'error') {
              onError(data.content || 'Unknown error');
            }
            // thinking / tool_call / metadata events are silently consumed
          } catch {
            // Ignore unparseable lines
          }
        }
      }

      // Stream ended without explicit done event
      onDone();
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(err instanceof Error ? err.message : String(err));
    }
  })();

  return controller;
}

/**
 * Non-streaming fallback: engage an opportunity and return the full result.
 */
export async function engageOpportunity(
  opportunityId: string,
  depth: 'overview' | 'detailed' | 'full' = 'full',
): Promise<EngageResponse> {
  let content = '';

  return new Promise((resolve, reject) => {
    engageOpportunityStream(
      opportunityId,
      depth,
      (chunk) => { content += chunk; },
      () => resolve({ opportunity_id: opportunityId, content, status: 'completed' }),
      (err) => reject(new Error(err)),
    );
  });
}
