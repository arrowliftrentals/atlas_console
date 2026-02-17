/**
 * STT (Speech-to-Text) Provider System
 * 
 * Supports real-time speech transcription using:
 * - ElevenLabs Scribe v2 Realtime (150ms latency, 90+ languages)
 */

export type STTProvider = 'elevenlabs' | 'elevenlabs_batch' | 'elevenlabs_proxy' | 'elevenlabs_auto';

export interface STTConfig {
  language?: string;
  model?: string;
  enableVAD?: boolean; // Voice Activity Detection
}

export interface STTTranscript {
  text: string;
  isFinal: boolean;
  confidence?: number;
  timestamp?: number;
}

export interface STTProviderInterface {
  name: string;
  startListening(
    onTranscript: (transcript: STTTranscript) => void,
    onError: (error: string) => void,
    config?: STTConfig
  ): Promise<void>;
  stopListening(): void;
  // Ask the provider to finalize the current buffer and emit a committed transcript
  commit?(): void;
  isListening(): boolean;
  getAudioStream(): MediaStream | null;
  // Optional echo gate control (implemented by ElevenLabs provider)
  setGate?(block: boolean): void;
}

/**
 * ElevenLabs Scribe v2 Realtime STT Provider
 * 150ms latency, 90+ languages, automatic language detection
 */
export class ElevenLabsSTTProvider implements STTProviderInterface {
  name = 'ElevenLabs Scribe v2';
  
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioStream: MediaStream | null = null;
  private listening = false;
  private sampleRate = 16000;
  private _lastText: string = '';
  private _finalSent: boolean = false;
  private _onTranscript?: (t: STTTranscript) => void;
  private _onError?: (e: string) => void;
  private _lastPartialAt: number = 0;
  private _commitTimer: number | null = null;
  
  async startListening(
    onTranscript: (transcript: STTTranscript) => void,
    onError: (error: string) => void,
    config?: STTConfig
  ): Promise<void> {
    if (this.listening) {
      console.warn('[STT] Already listening');
      return;
    }
    
    // Check browser compatibility for AudioWorklet
    if (!window.AudioContext || !window.AudioWorkletNode) {
      onError('Voice input not supported in this browser. AudioWorklet requires a modern browser (Chrome 66+, Firefox 76+, Safari 14.1+).');
      return;
    }
    
    try {
      // init guards
      this._lastText = '';
      this._finalSent = false;
      this._onTranscript = onTranscript;
      this._onError = onError;
      this._lastPartialAt = 0;
      if (this._commitTimer) { clearTimeout(this._commitTimer); this._commitTimer = null; }
      // Get microphone access with aggressive echo cancellation
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 48000, // let browser run native rate; we downsample in worklet
          echoCancellation: { ideal: true },
          autoGainControl: { ideal: false },
          noiseSuppression: { ideal: true },
        } 
      });
      
      console.log('[STT] Microphone settings:', {
        echoCancellation: this.audioStream.getAudioTracks()[0].getSettings().echoCancellation,
        autoGainControl: this.audioStream.getAudioTracks()[0].getSettings().autoGainControl,
        noiseSuppression: this.audioStream.getAudioTracks()[0].getSettings().noiseSuppression,
      });
      
      // Get single-use token from our backend (which uses the API key)
      const tokenResponse = await fetch('/api/stt/elevenlabs/token', {
        method: 'POST',
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get STT authentication token');
      }
      
      const { token } = await tokenResponse.json();
      
      // Prefer server VAD to reliably emit committed transcripts
      const params = new URLSearchParams({
        token,
        model_id: 'scribe_v2_realtime',
        commit_strategy: 'vad',
        vad_silence_threshold_secs: '1.8'
      });
      // Only set language when explicitly provided (en/es); otherwise let server auto-detect
      const lang = (config?.language || '').toLowerCase();
      if (lang === 'en' || lang === 'es') params.set('language', lang);
      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;
      
      this.ws = new WebSocket(wsUrl);
      const connectionStartTime = Date.now();
      let sessionReady = false;
      
      this.ws.onopen = () => {
        const connectDuration = Date.now() - connectionStartTime;
        console.log(`[STT] ✓ WebSocket connected to ElevenLabs (${connectDuration}ms)`);
        // Wait for session_started before streaming
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Bootstrap once session is ready
          if (data.message_type === 'session_started') {
            sessionReady = true;
            console.log('[STT] Session started:', data.session_id);
            console.log('[STT] Starting audio streaming...');
            this.startAudioStreaming();
            return;
          }
          
          // Handle different message types from ElevenLabs
          // Alternate schema support
          if (data.message_type === 'transcript') {
            const txt = data.text || '';
            const isFinal = !!data.is_final;
            if (isFinal) {
              this._finalSent = true;
              onTranscript({ text: txt, isFinal: true, confidence: data.confidence, timestamp: Date.now() });
            } else {
              this._lastText = txt;
              onTranscript({ text: txt, isFinal: false, confidence: data.confidence, timestamp: Date.now() });
            }
            return;
          }

          if (data.message_type === 'partial_transcript') {
            const txt = data.text || '';
            const changed = txt !== this._lastText;
            this._lastText = txt;
            console.log('[STT] 📝 Partial transcript:', this._lastText, `(confidence: ${data.confidence}) changed=${changed}`);
            onTranscript({
              text: this._lastText,
              isFinal: false,
              confidence: data.confidence,
              timestamp: Date.now(),
            });
            // Only reset commit timer when partial actually changes
            if (changed) {
              this._lastPartialAt = Date.now();
              if (this._commitTimer) { clearTimeout(this._commitTimer); }
              // Ask server to commit if no new partial arrives within 1500ms
              // @ts-expect-error setTimeout typing
              this._commitTimer = setTimeout(() => {
                if (!this._finalSent) {
                  console.log('[STT] ⏱️ No change in partial for 1500ms → commit()');
                  this.commit();
                }
              }, 1500);
            }
          } else if (data.message_type === 'committed_transcript' || data.message_type === 'committed_transcript_with_timestamps') {
            const finalText = (data.text || data?.transcript?.text || '').trim();
            if (!finalText) {
              console.log('[STT] ⚠️ Committed transcript empty – ignoring and keeping session alive');
              return; // don't stop on empty finals
            }
            console.log('[STT] ✅ Committed transcript:', finalText, `(confidence: ${data.confidence})`);
            this._finalSent = true;
            onTranscript({
              text: finalText,
              isFinal: true,
              confidence: data.confidence,
              timestamp: Date.now(),
            });
          } else if (data.message_type === 'session_started') {
            console.log('[STT] Session started:', data.session_id);
          } else if (data.message_type === 'auth_error') {
            onError(data.error || 'Authentication failed');
          } else if (data.message_type === 'error') {
            onError(data.error || 'STT error');
          }
        } catch (err) {
          console.error('[STT] Failed to parse message:', err);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[STT] ✗ WebSocket error:', error);
        onError('WebSocket connection error');
      };
      
      this.ws.onclose = (event) => {
        const connectionDuration = Date.now() - connectionStartTime;
        console.log(`[STT] WebSocket closed after ${connectionDuration}ms - Code:`, event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
        
        // Detailed close code meanings
        const closeReasons: Record<number, string> = {
          1000: 'Normal closure',
          1001: 'Endpoint going away',
          1002: 'Protocol error',
          1003: 'Unsupported data type',
          1005: 'No status code present (client closed / normal for stopListening)',
          1006: 'Abnormal closure (no close frame)',
          1007: 'Invalid frame payload data',
          1008: 'Policy violation',
          1009: 'Message too big',
          1011: 'Server error',
        };
        
        const reason = closeReasons[event.code] || 'Unknown reason';
        
        // 1006 after receiving committed transcript is normal (server closes connection)
        const normalClose = event.wasClean && (event.code === 1000 || event.code === 1005);
        const normalAfterCommit = event.code === 1006 && this._finalSent && connectionDuration > 2000;
        const isNormalClosure = normalClose || normalAfterCommit;
        
        if (isNormalClosure) {
          console.log(`[STT] Session ended normally - ${reason}`);
        } else {
          // Only show errors for quick failures or unexpected closures without transcript
          console.error(`[STT] Close code ${event.code}: ${reason}`);
          if (connectionDuration < 2000) {
            console.error('[STT] Connection closed very quickly - check:');
            console.error('[STT]   - Audio format compatibility (check audio-processor.js)');
            console.error('[STT]   - ElevenLabs API quota');
            console.error('[STT]   - Network connectivity');
            onError(`WebSocket closed: ${reason} (code: ${event.code})`);
          }
        }
        // If server closed without sending a committed transcript, finalize with last partial
        if (!this._finalSent && this._lastText.trim()) {
          try { this._onTranscript?.({ text: this._lastText, isFinal: true, timestamp: Date.now() }); } catch {}
          this._finalSent = true;
        }
        this.cleanup();
      };
      
      this.listening = true;
      
    } catch (error: any) {
      console.error('[STT] Failed to start listening:', error);
      onError(error.message || 'Failed to access microphone');
      this.cleanup();
    }
  }
  
  private async startAudioStreaming() {
    if (!this.audioStream) return;
    
    try {
      // Create AudioContext with native sample rate (browser default, usually 48kHz)
      // We'll downsample to 16kHz in the AudioWorklet processor
      this.audioContext = new AudioContext();
      console.log('[STT] AudioContext created with sample rate:', this.audioContext.sampleRate);
      
      // Load AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');
      console.log('[STT] AudioWorklet processor loaded');
      
      // Create source from microphone stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.audioStream);
      
      // Create AudioWorklet node (20 ms frames + echo gating)
      this.processor = new AudioWorkletNode(this.audioContext, 'echo-aware-capture');
      
      // Handle audio data from worklet
      let chunkCount = 0;
      let totalBytesSent = 0;
      
      this.processor.port.onmessage = (event) => {
        if (event.data.type === 'audio' && this.ws?.readyState === WebSocket.OPEN) {
          chunkCount++;
          
          // Convert Int16 PCM to base64 (safe encoder for small frames)
          const int16Array = new Int16Array(event.data.data);
          const bytes = new Uint8Array(int16Array.buffer);
          
          if (chunkCount === 1) {
            console.log('[STT] First audio chunk received from worklet');
            console.log('[STT] Sample count:', int16Array.length);
            console.log('[STT] Byte count:', bytes.length);
            console.log('[STT] First 10 samples:', Array.from(int16Array.slice(0, 10)));
            console.log('[STT] Sample rate:', this.sampleRate);
          }
          
          // Avoid spreading large arrays into fromCharCode for safety (chunked encode)
          let binary = '';
          for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + 0x8000)) as unknown as number[]);
          }
          const base64Audio = btoa(binary);
          totalBytesSent += bytes.length;
          
          // Send to ElevenLabs
          const message = {
            message_type: 'input_audio_chunk',
            audio_base_64: base64Audio,
            sample_rate: this.sampleRate,
          };
          
          try {
            this.ws.send(JSON.stringify(message));
            
            if (chunkCount % 10 === 0) {
              console.log(`[STT] Sent ${chunkCount} chunks, ${totalBytesSent} bytes total`);
            }
          } catch (error) {
            console.error('[STT] Error sending audio chunk:', error);
          }
        }
      };
      
      // Connect: microphone -> worklet -> (no output, we just capture)
      this.sourceNode.connect(this.processor);
      // Don't connect to destination - we're just capturing, not playing
      
      console.log('[STT] ✓ Audio pipeline started (raw PCM 16kHz)');
      
    } catch (error) {
      console.error('[STT] Failed to start audio streaming:', error);
      throw error;
    }
  }
  
  stopListening(): void {
    console.log('[STT] Stopping listening');
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    this.cleanup();
  }

  private cleanup() {
    this.listening = false;
    // Disconnect audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      // @ts-expect-error worklet port may be null after disconnect
      this.processor.port && (this.processor.port.onmessage = null);
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop());
      this.audioStream = null;
    }
    this.ws = null;
  }

  isListening(): boolean {
    return this.listening;
  }

  commit(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        // Primary (per docs in many implementations)
        this.ws.send(JSON.stringify({ message_type: 'input_audio_buffer.commit' }));
        // Fallback for servers expecting commit flag on chunk
        this.ws.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: '',
          sample_rate: this.sampleRate,
          commit: true,
        }));
        console.log('[STT] ▶️ Sent commit request');
      } catch (e) {
        console.warn('[STT] Commit send failed:', e);
      }
    }
  }

  getAudioStream(): MediaStream | null {
    return this.audioStream;
  }
}

/**
 * ElevenLabs Scribe v2 Batch STT Provider (robust, non-realtime)
 */
export class ElevenLabsBatchSTTProvider implements STTProviderInterface {
  name = 'ElevenLabs Scribe v2 Batch';

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private listening = false;
  private stream: MediaStream | null = null;

  async startListening(
    onTranscript: (transcript: STTTranscript) => void,
    onError: (error: string) => void,
    config?: STTConfig
  ): Promise<void> {
    if (this.listening) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Let browser pick supported container (WebM/Opus widely supported)
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: false },
        },
      });

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: mime });
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onerror = (e: Event) => {
        onError(`Recorder error: ${(e as any).error?.message || 'unknown'}`);
      };

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
          const form = new FormData();
          form.append('file', blob, 'audio.webm');
          form.append('model_id', 'scribe_v2');
          const lang = (config?.language || '').toLowerCase();
          if (lang === 'en' || lang === 'es') form.append('language', lang);

          const resp = await fetch('/api/stt/elevenlabs/convert', {
            method: 'POST',
            body: form,
          });
          if (!resp.ok) {
            const t = await resp.text();
            throw new Error(`Transcribe failed (${resp.status}): ${t}`);
          }
          const data = await resp.json();
          const text = data?.text || '';
          onTranscript({ text, isFinal: true, timestamp: Date.now() });
        } catch (err: any) {
          onError(err.message || 'Upload failed');
        } finally {
          this.cleanup();
        }
      };

      this.mediaRecorder.start();
      this.listening = true;
    } catch (e: any) {
      onError(e.message || 'Microphone access failed');
      this.cleanup();
    }
  }

  stopListening(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    } else {
      this.cleanup();
    }
  }

  isListening(): boolean {
    return this.listening;
  }

  getAudioStream(): MediaStream | null {
    return this.stream;
  }

  private cleanup() {
    this.listening = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

/**
 * ElevenLabs Realtime via local WS proxy (ws://127.0.0.1:8787)
 */
export class ElevenLabsProxySTTProvider extends ElevenLabsSTTProvider {
  protected buildWsUrl(): string {
    // local proxy URL; the proxy applies xi-api-key headers server-side
    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      audio_format: 'pcm_16000',
      commit_strategy: 'vad',
      vad_silence_threshold_secs: '0.8',
    });
    const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    const scheme = isHttps ? 'wss' : 'ws';
    return `${scheme}://127.0.0.1:8787/?${params.toString()}`;
  }
}

/**
 * ElevenLabs Auto provider: try proxy → direct → batch
 */
export class ElevenLabsAutoSTTProvider implements STTProviderInterface {
  name = 'ElevenLabs Auto';
  private current: STTProviderInterface | null = null;
  private gotAnyTranscript = false;
  private finalDelivered = false;

  async startListening(
    onTranscript: (t: STTTranscript) => void,
    onError: (e: string) => void,
    config?: STTConfig
  ): Promise<void> {
    this.gotAnyTranscript = false;
    this.finalDelivered = false;

    const startWith = async (provider: STTProviderInterface, next?: () => Promise<void>) => {
      this.current = provider;
      let earlyTimer: number | null = null;
      const earlyTimeoutMs = 2000;

      const wrappedOnTranscript = (t: STTTranscript) => {
        this.gotAnyTranscript = true;
        if (t.isFinal) this.finalDelivered = true;
        onTranscript(t);
      };

      const wrappedOnError = async (msg: string) => {
        // If we failed very early and have a next option, try fallback
        if (!this.gotAnyTranscript && next) {
          try { this.current?.stopListening(); } catch {}
          await next();
          return;
        }
        onError(msg);
      };

      // Start and set an early-timeout fallback
      await provider.startListening(wrappedOnTranscript, wrappedOnError, config);
      if (next) {
        // setTimeout form; will be ignored if we already streamed any transcript
        // @ts-expect-error setTimeout return type in DOM
        earlyTimer = setTimeout(async () => {
          if (!this.gotAnyTranscript) {
            try { this.current?.stopListening(); } catch {}
            await next();
          }
        }, earlyTimeoutMs);
      }
    };

    const startBatch = async () => startWith(new ElevenLabsBatchSTTProvider());
    const startDirect = async () => startWith(new ElevenLabsSTTProvider(), startBatch);
    const startProxy = async () => startWith(new ElevenLabsProxySTTProvider(), startDirect);

    await startProxy();
  }

  stopListening(): void {
    this.current?.stopListening();
  }

  isListening(): boolean {
    return this.current?.isListening() || false;
  }

  getAudioStream(): MediaStream | null {
    return this.current?.getAudioStream() || null;
  }
}

/**
 * STT Provider Factory
 */
export class STTProviderFactory {
  private static providers: Map<STTProvider, STTProviderInterface> = new Map([
    ['elevenlabs', new ElevenLabsSTTProvider()],
    ['elevenlabs_batch', new ElevenLabsBatchSTTProvider()],
    ['elevenlabs_proxy', new ElevenLabsProxySTTProvider()],
    ['elevenlabs_auto', new ElevenLabsAutoSTTProvider()],
  ]);
  
  static getProvider(provider?: STTProvider): STTProviderInterface {
    const providerName = provider || 'elevenlabs';
    
    const instance = this.providers.get(providerName);
    if (!instance) {
      console.warn(`Unknown STT provider: ${providerName}, falling back to ElevenLabs`);
      return this.providers.get('elevenlabs')!;
    }
    
    return instance;
  }
  
  static getAllProviders(): { name: STTProvider; label: string }[] {
    return [
      { name: 'elevenlabs', label: 'ElevenLabs Scribe v2 Realtime (150ms, 90+ languages)' },
      { name: 'elevenlabs_batch', label: 'ElevenLabs Scribe v2 (Batch, robust)' },
      { name: 'elevenlabs_proxy', label: 'ElevenLabs Realtime via local proxy (reliable)' },
      { name: 'elevenlabs_auto', label: 'ElevenLabs Auto (proxy → direct → batch)' },
    ];
  }
}
