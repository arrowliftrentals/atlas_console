/**
 * STT (Speech-to-Text) Provider System
 * 
 * Supports real-time speech transcription using:
 * - ElevenLabs Scribe v2 Realtime (150ms latency, 90+ languages)
 */

export type STTProvider = 'elevenlabs';

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
  isListening(): boolean;
}

/**
 * ElevenLabs Scribe v2 Realtime STT Provider
 * 150ms latency, 90+ languages, automatic language detection
 */
export class ElevenLabsSTTProvider implements STTProviderInterface {
  name = 'ElevenLabs Scribe v2';
  
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private listening = false;
  
  async startListening(
    onTranscript: (transcript: STTTranscript) => void,
    onError: (error: string) => void,
    config?: STTConfig
  ): Promise<void> {
    if (this.listening) {
      console.warn('[STT] Already listening');
      return;
    }
    
    // Check browser compatibility
    const isWebMSupported = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') || 
                            MediaRecorder.isTypeSupported('audio/webm');
    
    if (!isWebMSupported) {
      onError('Voice input not supported in this browser. Please use Chrome or Firefox for speech-to-text functionality.');
      return;
    }
    
    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      // Get single-use token from our backend (which uses the API key)
      const tokenResponse = await fetch('/api/stt/elevenlabs/token', {
        method: 'POST',
      });
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get STT authentication token');
      }
      
      const { token } = await tokenResponse.json();
      
      // Connect with token as query parameter (required for client-side usage)
      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=${token}`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('[STT] ✓ WebSocket connected to ElevenLabs');
        
        // No need to send auth or config - token in URL handles auth
        // Configuration is automatic based on token
        
        // Start recording and streaming audio
        console.log('[STT] Starting audio streaming...');
        this.startAudioStreaming();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different message types from ElevenLabs
          if (data.message_type === 'partial_transcript') {
            onTranscript({
              text: data.text,
              isFinal: false,
              confidence: data.confidence,
              timestamp: Date.now(),
            });
          } else if (data.message_type === 'committed_transcript') {
            onTranscript({
              text: data.text,
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
        console.log('[STT] WebSocket closed - Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
        
        // Provide helpful error messages based on close code
        if (event.code === 1000 && event.wasClean) {
          // Normal closure but might be due to format incompatibility
          const actualMimeType = this.mediaRecorder?.mimeType || 'unknown';
          if (actualMimeType.includes('mp4') || actualMimeType.includes('ogg')) {
            console.error('[STT] Connection closed - likely due to incompatible audio format:', actualMimeType);
            onError(`Browser audio format (${actualMimeType}) not supported by ElevenLabs. Use Chrome/Edge for voice input.`);
          }
        } else if (!event.wasClean) {
          console.error('[STT] Connection closed unexpectedly!');
          onError(`WebSocket closed unexpectedly (code: ${event.code})`);
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
  
  private startAudioStreaming() {
    if (!this.audioStream) return;
    
    // ElevenLabs prefers WebM with Opus, but we'll use what's available
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg', // Firefox fallback
    ];
    
    let mimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        console.log('[STT] Using MIME type:', mimeType);
        break;
      }
    }
    
    if (!mimeType) {
      console.warn('[STT] No compatible MIME type found, trying without mimeType option');
    }
    
    // Create MediaRecorder
    // Firefox sometimes reports types as supported but then fails, so we catch errors
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
    
    try {
      this.mediaRecorder = new MediaRecorder(this.audioStream, options);
      console.log('[STT] ✓ MediaRecorder created successfully with mimeType:', this.mediaRecorder.mimeType);
    } catch (error) {
      console.error('[STT] MediaRecorder creation failed with options:', options, 'Error:', error);
      console.log('[STT] Retrying without mimeType constraint...');
      // Try without any mimeType constraint
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      console.log('[STT] MediaRecorder created with browser default mimeType:', this.mediaRecorder.mimeType);
    }
    
    // Warn if using unsupported format
    const actualMimeType = this.mediaRecorder.mimeType.toLowerCase();
    if (actualMimeType.includes('mp4') || (!actualMimeType.includes('webm') && !actualMimeType.includes('ogg'))) {
      console.warn('[STT] ⚠️ Browser is using potentially incompatible format:', this.mediaRecorder.mimeType);
      console.warn('[STT] ⚠️ ElevenLabs prefers audio/webm or audio/ogg with Opus codec');
      console.warn('[STT] ⚠️ Connection may close immediately. Consider using Chrome/Edge for STT.');
    }
    
    let chunkCount = 0;
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        chunkCount++;
        if (chunkCount === 1) {
          console.log('[STT] First audio chunk sent, size:', event.data.size);
        }
        
        // Convert audio to base64 and send as input_audio_chunk message
        event.data.arrayBuffer().then((buffer) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            const message = {
              message_type: 'input_audio_chunk',
              audio_base_64: base64Audio,
              sample_rate: 16000,
            };
            this.ws.send(JSON.stringify(message));
          }
        });
      }
    };
    
    this.mediaRecorder.onerror = (event: any) => {
      console.error('[STT] MediaRecorder error:', event);
    };
    
    this.mediaRecorder.onstart = () => {
      console.log('[STT] MediaRecorder started');
    };
    
    this.mediaRecorder.onstop = () => {
      console.log('[STT] MediaRecorder stopped');
    };
    
    // Send audio chunks every 250ms (ElevenLabs recommendation)
    this.mediaRecorder.start(250);
  }
  
  stopListening(): void {
    console.log('[STT] Stopping listening');
    
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    this.cleanup();
  }
  
  private cleanup() {
    this.listening = false;
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.mediaRecorder = null;
    this.ws = null;
  }
  
  isListening(): boolean {
    return this.listening;
  }
}

/**
 * STT Provider Factory
 */
export class STTProviderFactory {
  private static providers: Map<STTProvider, STTProviderInterface> = new Map([
    ['elevenlabs', new ElevenLabsSTTProvider()],
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
    ];
  }
}
