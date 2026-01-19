import { AtlasChatRequest, AtlasChatResponse } from "./types";
import { getOrCreateSessionId, storeSessionId } from "./session";

const browserDefaultBase =
  process.env.NEXT_PUBLIC_ATLAS_WEB_API_BASE || ""; // e.g. "", "/atlas" etc.

// By default, call the local Next.js API proxy route.
const defaultApiUrl = `${browserDefaultBase}/api/atlasChat`;

// Direct backend URL for chunk retrieval (bypasses Next.js proxy)
const atlasApiBase =
  typeof window !== 'undefined'
    ? (window as any).__ATLAS_API_BASE || "http://127.0.0.1:8000"
    : "http://127.0.0.1:8000";

/**
 * Check if response is chunked by looking for chunking metadata in notes
 */
function isChunkedResponse(response: AtlasChatResponse): {
  isChunked: boolean;
  chunkSessionId?: string;
  current?: number;
  total?: number;
} {
  const notes = response.notes || "";
  const chunkMatch = notes.match(/\[CHUNKED_RESPONSE: chunk=(\d+)\/(\d+) session_id=([^\]]+)\]/);

  if (chunkMatch) {
    return {
      isChunked: true,
      current: parseInt(chunkMatch[1], 10),
      total: parseInt(chunkMatch[2], 10),
      chunkSessionId: chunkMatch[3],
    };
  }

  return { isChunked: false };
}

/**
 * Fetch the next chunk from the backend
 */
async function fetchNextChunk(chunkSessionId: string): Promise<AtlasChatResponse> {
  const res = await fetch(`${atlasApiBase}/v1/atlas/chat/chunk/${chunkSessionId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch chunk: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Automatically fetch and reassemble chunked responses
 */
async function reassembleChunkedResponse(
  initialResponse: AtlasChatResponse
): Promise<AtlasChatResponse> {
  const chunkInfo = isChunkedResponse(initialResponse);

  if (!chunkInfo.isChunked || !chunkInfo.chunkSessionId) {
    return initialResponse;
  }

  console.log(`📦 Receiving chunked response: ${chunkInfo.total} chunks total`);
  console.log(`   Chunk 1/${chunkInfo.total} received (${initialResponse.answer.length} chars)`);

  let fullAnswer = initialResponse.answer;

  // Fetch remaining chunks
  for (let i = 2; i <= chunkInfo.total!; i++) {
    console.log(`   Fetching chunk ${i}/${chunkInfo.total}...`);

    try {
      const chunkResponse = await fetchNextChunk(chunkInfo.chunkSessionId);

      if (!chunkResponse.answer) {
        console.warn(`   ⚠️  Chunk ${i} was empty, stopping`);
        break;
      }

      fullAnswer += chunkResponse.answer;
      console.log(`   Chunk ${i}/${chunkInfo.total} received (${chunkResponse.answer.length} chars)`);
    } catch (error) {
      console.error(`   ❌ Failed to fetch chunk ${i}:`, error);
      break;
    }
  }

  console.log(`✅ Complete response reassembled: ${fullAnswer.length} total characters`);

  // Remove chunking metadata from notes
  const cleanNotes = (initialResponse.notes || "").replace(/\s*\[CHUNKED_RESPONSE:[^\]]+\]\s*/g, "").trim();

  return {
    ...initialResponse,
    answer: fullAnswer,
    notes: cleanNotes || undefined,
  };
}

export async function atlasChat(
  payload: AtlasChatRequest,
  apiUrl?: string
): Promise<AtlasChatResponse> {
  const url = apiUrl || defaultApiUrl;

  // Get or create session_id (now always non-null; safe for SSR)
  const sessionId = payload.session_id ?? getOrCreateSessionId();

  // Debug: log what session_id we are using and whether it came from payload or storage
  // eslint-disable-next-line no-console
  console.debug('[atlasClient] atlasChat(): incoming payload.session_id =', payload.session_id);
  // eslint-disable-next-line no-console
  console.debug('[atlasClient] atlasChat(): effective sessionId =', sessionId);

  // Always include session_id (it is guaranteed non-empty string now)
  const payloadWithSession: AtlasChatRequest = {
    ...payload,
    session_id: sessionId,
  };

  // Debug: log the final payload being sent (without dumping huge fields)
  // eslint-disable-next-line no-console
  console.debug('[atlasClient] atlasChat(): sending payload to backend', {
    ...payloadWithSession,
    // Avoid logging very large fields if present
    query: payloadWithSession.query?.slice(0, 200),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payloadWithSession),
  });

  if (!res.ok) {
    let msg = `ATLAS Web API error: ${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.error) {
        msg = `${msg} – ${data.error}`;
      }
    } catch {
      // ignore parse errors
    }
    
    // Provide friendlier error message for rate limits
    if (res.status === 429 || msg.includes('429') || msg.includes('Too Many Requests')) {
      throw new Error('Rate limit reached. Please wait a moment before sending another message.');
    }
    
    throw new Error(msg);
  }

  const data = (await res.json()) as AtlasChatResponse;

  // Debug: log what session_id the backend responded with
  // eslint-disable-next-line no-console
  console.debug('[atlasClient] atlasChat(): backend response.session_id =', data.session_id);

  // If backend returns a canonical session_id, update storage
  if (data.session_id && data.session_id !== sessionId) {
    storeSessionId(data.session_id);
  }

  // Automatically handle chunked responses
  return await reassembleChunkedResponse(data);
}

/**
 * Stream chat responses using Server-Sent Events (SSE)
 */
export async function atlasChatStream(
  payload: AtlasChatRequest,
  onChunk: (chunk: string) => void,
  onToolCall?: (toolName: string, status: string) => void,
  onDone?: (sessionId: string) => void,
  onError?: (error: string) => void,
  apiUrl?: string
): Promise<void> {
  const url = apiUrl || defaultApiUrl.replace('/atlasChat', '/atlasChat/stream');

  // Get or create session_id
  const sessionId = payload.session_id ?? getOrCreateSessionId();

  const payloadWithSession: AtlasChatRequest = {
    ...payload,
    session_id: sessionId,
  };

  console.debug('[atlasClient] atlasChatStream(): starting SSE stream');

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payloadWithSession),
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
            
            switch (data.type) {
              case 'connected':
                console.debug('[SSE] Connected, session:', data.session_id);
                if (data.session_id) {
                  storeSessionId(data.session_id);
                }
                break;
              
              case 'answer_chunk':
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

// -----------------
// Types for logs
// -----------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AtlasLogEntry {
  id: string;
  timestamp: string; // ISO 8601 string
  level: LogLevel;
  message: string;
  // Extend as needed to match LogsView expectations:
  // source?: string;
  // sessionId?: string;
  // metadata?: Record<string, unknown>;
}

// -----------------
// Types for tasks
// -----------------

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'success' // Backend may return 'success' instead of 'completed'
  | 'failed'
  | 'cancelled';

export interface AtlasTask {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number; // 0-100
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string;
  // Extend as needed:
  // description?: string;
  // resultSummary?: string;
}

// -----------------
// Stub implementations
// -----------------

/**
 * Fetch logs for the Atlas console.
 *
 * Currently implemented as a stub that returns an empty array so the
 * console can render without a backing logs API. Replace the body with
 * a real API call when your backend exposes a logs endpoint.
 */
export async function fetchLogs(): Promise<AtlasLogEntry[]> {
  // Example real implementation (for later):
  //
  // const res = await fetch('/api/logs', {
  //   method: 'GET',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  // });
  //
  // if (!res.ok) {
  //   throw new Error(`Failed to fetch logs: ${res.status} ${res.statusText}`);
  // }
  //
  // return (await res.json()) as AtlasLogEntry[];

  // Stub: no logs yet
  return [];
}

/**
 * Fetch tasks for the Atlas console.
 *
 * Fetches active tasks and goals from L8 Planning Memory via /v1/atlas/tasks.
 */
export async function fetchTasks(): Promise<AtlasTask[]> {
  try {
    const response = await fetch("/api/tasks", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[fetchTasks] Failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.tasks || [];
  } catch (error) {
    console.error("[fetchTasks] Error:", error);
    return [];
  }
}
