/**
 * SpeakerGate — Pre-STT speaker verification gate.
 *
 * Shared singleton that buffers ~3s of Int16 PCM audio, sends it to the
 * backend verify-stream WebSocket, and decides whether to allow audio
 * through to the STT provider.
 *
 * Architecture:
 * - Gate starts CLOSED (fail-secure) with a 3s cold-start buffer
 * - Cold-start buffer is flushed at 1.5× real-time once verified
 * - No long-lived cache: re-verify every ~3s cycle
 * - Pauses verification during TTS playback (echo gate coordination)
 * - Graceful fallback: if backend 404s or WS fails, gate opens (disabled)
 */

export type GateState = 'closed' | 'open' | 'disabled' | 'no_voiceprint';

export interface VerifyResult {
  verified: boolean;
  similarity: number;
  threshold: number;
  liveness_suspect: boolean;
  mic_mismatch: boolean;
  voiceprint_missing: boolean;
  processing_time_ms: number;
}

export interface SpeakerGateOptions {
  threshold?: number;
  micLabel?: string;
  userId?: string;
  /** Cycle duration in ms (how much audio to buffer before verifying) */
  cycleDurationMs?: number;
  /** Backend WebSocket base URL (auto-detected from window.location) */
  wsBaseUrl?: string;
}

type GateListener = (state: GateState, result?: VerifyResult) => void;

// Backend API base
const API_BASE = '/api/voiceprint';

class SpeakerGateImpl {
  private _state: GateState = 'closed';
  private _ws: WebSocket | null = null;
  private _buffer: Int16Array[] = [];
  private _bufferSamples = 0;
  private _cycleSamples: number;
  private _threshold: number;
  private _micLabel: string;
  private _userId: string;
  private _echoGateActive = false;
  private _enabled = false;
  private _listeners: Set<GateListener> = new Set();
  private _lastVerifyResult: VerifyResult | null = null;
  private _graceTimeout: ReturnType<typeof setTimeout> | null = null;
  private _coldStartBuffer: Int16Array[] = [];
  private _coldStartFlushed = false;

  constructor() {
    this._cycleSamples = 3 * 16000; // 3s at 16kHz
    this._threshold = 0.75;
    this._micLabel = 'unknown';
    this._userId = 'owner';
  }

  // ---- Public API ----

  get state(): GateState { return this._state; }
  get enabled(): boolean { return this._enabled; }
  get lastResult(): VerifyResult | null { return this._lastVerifyResult; }

  /**
   * Enable speaker verification gate.
   * Checks backend for voiceprint enrollment, opens WebSocket if enrolled.
   */
  async enable(opts?: SpeakerGateOptions): Promise<boolean> {
    if (opts?.threshold) this._threshold = opts.threshold;
    if (opts?.micLabel) this._micLabel = opts.micLabel;
    if (opts?.userId) this._userId = opts.userId;
    if (opts?.cycleDurationMs) this._cycleSamples = Math.round((opts.cycleDurationMs / 1000) * 16000);

    // Check enrollment status first
    try {
      const resp = await fetch(`${API_BASE}/status?user_id=${this._userId}`);
      if (resp.status === 404) {
        // Backend doesn't support speaker verification — disable gracefully
        console.log('[SpeakerGate] Backend 404 — disabling (old backend)');
        this._setState('disabled');
        return false;
      }
      if (!resp.ok) throw new Error(`Status check failed: ${resp.status}`);
      const data = await resp.json();
      if (!data.enrolled) {
        console.log('[SpeakerGate] No voiceprint enrolled — gate disabled');
        this._setState('no_voiceprint');
        return false;
      }
    } catch (err) {
      console.warn('[SpeakerGate] Status check failed, disabling:', err);
      this._setState('disabled');
      return false;
    }

    // Warm the model
    try {
      await fetch(`${API_BASE}/warmup`, { method: 'POST' });
    } catch { /* non-critical */ }

    // Open WebSocket
    this._connectWs(opts?.wsBaseUrl);

    this._enabled = true;
    this._coldStartFlushed = false;
    this._setState('closed');
    console.log('[SpeakerGate] Enabled (threshold=%f, mic=%s)', this._threshold, this._micLabel);
    return true;
  }

  /** Disable gate — all audio passes through. */
  disable(): void {
    this._enabled = false;
    this._closeWs();
    this._buffer = [];
    this._bufferSamples = 0;
    this._coldStartBuffer = [];
    this._setState('disabled');
    console.log('[SpeakerGate] Disabled');
  }

  /**
   * Feed raw Int16 PCM audio chunk from AudioWorklet.
   * Returns true if audio should be forwarded to STT, false if gated.
   */
  feedAudio(pcmInt16: Int16Array): boolean {
    if (!this._enabled) return true; // Disabled = pass-through
    if (this._echoGateActive) return false; // TTS playing

    // Buffer for verification
    this._buffer.push(pcmInt16);
    this._bufferSamples += pcmInt16.length;

    // Cold-start: also buffer audio for replay after first verification
    if (!this._coldStartFlushed) {
      this._coldStartBuffer.push(new Int16Array(pcmInt16));
    }

    // Send for verification when buffer reaches cycle size
    if (this._bufferSamples >= this._cycleSamples) {
      this._sendForVerification();
    }

    // Gate decision
    return this._state === 'open';
  }

  /**
   * Get cold-start buffer (audio captured before first verification passed).
   * Returns concatenated Int16 array, or null if already flushed.
   */
  flushColdStartBuffer(): Int16Array | null {
    if (this._coldStartFlushed || this._coldStartBuffer.length === 0) return null;
    this._coldStartFlushed = true;

    const totalLen = this._coldStartBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const chunk of this._coldStartBuffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this._coldStartBuffer = [];
    return merged;
  }

  /** Echo gate coordination: pause verification during TTS playback. */
  setEchoGate(active: boolean): void {
    this._echoGateActive = active;
    if (active) {
      // Clear buffer — audio during TTS is not useful for verification
      this._buffer = [];
      this._bufferSamples = 0;
    }
  }

  /** Subscribe to gate state changes. */
  onStateChange(listener: GateListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Cleanup on page unload. */
  destroy(): void {
    this.disable();
    this._listeners.clear();
  }

  // ---- Private ----

  private _setState(state: GateState, result?: VerifyResult): void {
    const prev = this._state;
    this._state = state;
    if (prev !== state) {
      console.log(`[SpeakerGate] State: ${prev} → ${state}`);
      this._listeners.forEach(fn => {
        try { fn(state, result); } catch {}
      });
    }
  }

  private _connectWs(baseUrl?: string): void {
    this._closeWs();

    const protocol = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = baseUrl || (typeof window !== 'undefined' ? window.location.host : '127.0.0.1:8000');
    const params = new URLSearchParams({
      threshold: String(this._threshold),
      mic: this._micLabel,
      user_id: this._userId,
    });
    const url = `${protocol}//${host}/v1/voice/voiceprint/verify-stream?${params}`;

    try {
      this._ws = new WebSocket(url);
      this._ws.binaryType = 'arraybuffer';

      this._ws.onopen = () => {
        console.log('[SpeakerGate] WebSocket connected');
      };

      this._ws.onmessage = (event) => {
        try {
          const result: VerifyResult = JSON.parse(event.data);
          this._lastVerifyResult = result;

          if (result.voiceprint_missing) {
            this._setState('no_voiceprint');
            return;
          }

          if (result.verified) {
            this._setState('open', result);
            // Clear grace timeout
            if (this._graceTimeout) {
              clearTimeout(this._graceTimeout);
              this._graceTimeout = null;
            }
          } else {
            // Don't immediately close — use 10s grace period
            if (this._state === 'open' && !this._graceTimeout) {
              this._graceTimeout = setTimeout(() => {
                if (this._state === 'open') {
                  this._setState('closed', result);
                }
                this._graceTimeout = null;
              }, 10_000);
            } else if (this._state !== 'open') {
              this._setState('closed', result);
            }
          }
        } catch {
          console.warn('[SpeakerGate] Bad WS message');
        }
      };

      this._ws.onclose = () => {
        console.log('[SpeakerGate] WebSocket closed');
        // Reconnect after 2s if still enabled
        if (this._enabled) {
          setTimeout(() => {
            if (this._enabled) this._connectWs(baseUrl);
          }, 2000);
        }
      };

      this._ws.onerror = (err) => {
        console.warn('[SpeakerGate] WebSocket error:', err);
      };
    } catch (err) {
      console.warn('[SpeakerGate] Failed to connect WebSocket:', err);
      this._setState('disabled');
    }
  }

  private _closeWs(): void {
    if (this._ws) {
      try { this._ws.close(); } catch {}
      this._ws = null;
    }
    if (this._graceTimeout) {
      clearTimeout(this._graceTimeout);
      this._graceTimeout = null;
    }
  }

  private _sendForVerification(): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      this._buffer = [];
      this._bufferSamples = 0;
      return;
    }

    // Merge buffer chunks into single binary
    const totalLen = this._buffer.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const chunk of this._buffer) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Send as binary frame
    try {
      this._ws.send(merged.buffer);
    } catch (err) {
      console.warn('[SpeakerGate] Failed to send audio:', err);
    }

    this._buffer = [];
    this._bufferSamples = 0;
  }
}

// ---- Singleton ----
let _instance: SpeakerGateImpl | null = null;

export function getSpeakerGate(): SpeakerGateImpl {
  if (!_instance) {
    _instance = new SpeakerGateImpl();

    // Cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        _instance?.destroy();
      });
    }
  }
  return _instance;
}

export type SpeakerGate = SpeakerGateImpl;
