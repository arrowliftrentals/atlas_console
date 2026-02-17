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
  getAudioStream(): MediaStream | null;
}

/**
 * ElevenLabs Scribe v2 Realtime STT Provider
 * 150ms latency, 90+ languages, automatic language detection
 */
export class ElevenLabsSTTProvider implements STTProviderInterface {
  name = 'ElevenLabs Scribe v2';
  
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private audioStream: MediaStream | null = null;
  private listening = false;
  private sampleRate = 16000;
  
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
      // Get microphone access with aggressive echo cancellation
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: { ideal: true },
          autoGainControl: { ideal: true },
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
      
      // Connect with token as query parameter (required for client-side usage)
      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=${token}`;
      
      this.ws = new WebSocket(wsUrl);
      const connectionStartTime = Date.now();
      
      this.ws.onopen = () => {
        const connectDuration = Date.now() - connectionStartTime;
        console.log(`[STT] ✓ WebSocket connected to ElevenLabs (${connectDuration}ms)`);
        
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
            console.log('[STT] 📝 Partial transcript:', data.text, `(confidence: ${data.confidence})`);
            onTranscript({
              text: data.text,
              isFinal: false,
              confidence: data.confidence,
              timestamp: Date.now(),
            });
          } else if (data.message_type === 'committed_transcript') {
            console.log('[STT] ✅ Committed transcript:', data.text, `(confidence: ${data.confidence})`);
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
        const connectionDuration = Date.now() - connectionStartTime;
        console.log(`[STT] WebSocket closed after ${connectionDuration}ms - Code:`, event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
        
        // Detailed close code meanings
        const closeReasons: Record<number, string> = {
          1000: 'Normal closure',
          1001: 'Endpoint going away',
          1002: 'Protocol error',
          1003: 'Unsupported data type',
          1006: 'Abnormal closure (no close frame)',
          1007: 'Invalid frame payload data',
          1008: 'Policy violation',
          1009: 'Message too big',
          1011: 'Server error',
        };
        
        const reason = closeReasons[event.code] || 'Unknown reason';
        console.error(`[STT] Close code ${event.code}: ${reason}`);
        
        // Only treat as error if closed very quickly (< 2 seconds) or with error code
        const isError = connectionDuration < 2000 || (!event.wasClean && event.code !== 1000 && event.code !== 1005);
        
        if (isError) {
          console.error('[STT] Connection closed unexpectedly!');
          console.error('[STT] This often means:');
          console.error('[STT]   - Audio format incompatible (check audio-processor.js)');
          console.error('[STT]   - ElevenLabs API quota exceeded');
          console.error('[STT]   - Network connectivity issues');
          onError(`WebSocket closed: ${reason} (code: ${event.code})`);
        } else {
          console.log('[STT] Session ended normally (timeout or user stopped)');
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
      
      // Create AudioWorklet node
      this.processor = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');
      
      // Handle audio data from worklet
      let chunkCount = 0;
      this.processor.port.onmessage = (event) => {
        if (event.data.type === 'audio' && this.ws?.readyState === WebSocket.OPEN) {
          chunkCount++;
          
          if (chunkCount === 1) {
            console.log('[STT] First audio chunk received from worklet');
          }
          
          // Convert Int16 PCM to base64
          const int16Array = new Int16Array(event.data.data);
          const bytes = new Uint8Array(int16Array.buffer);
          const base64Audio = btoa(String.fromCharCode(...bytes));
          
          // Send to ElevenLabs
          const message = {
            message_type: 'input_audio_chunk',
            audio_base_64: base64Audio,
            sample_rate: this.sampleRate,
          };
          
          this.ws.send(JSON.stringify(message));
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
      this.processor.port.onmessage = null;
      this.processor = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    this.ws = null;
  }
  
  isListening(): boolean {
    return this.listening;
  }
  
  getAudioStream(): MediaStream | null {
    return this.audioStream;
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
