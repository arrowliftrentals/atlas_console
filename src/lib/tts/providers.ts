/**
 * TTS Provider System - Modular text-to-speech abstraction
 * 
 * Supports multiple TTS providers with unified interface:
 * - OpenAI (cloud, low latency)
 * - Bettany/XTTS (local, custom voice)
 * 
 * Provider selection via environment variable: NEXT_PUBLIC_TTS_PROVIDER
 */

export type TTSProvider = 'cartesia';

export interface TTSConfig {
  voice?: string;
  speed?: number;
  temperature?: number;
  top_p?: number;
}

export interface TTSProviderInterface {
  name: string;
  synthesize(text: string, config?: TTSConfig): Promise<ArrayBuffer>;
  getVoices(): Promise<string[]>;
  getDefaultVoice(): string;
}

/**
 * Cartesia Sonic 3 TTS Provider (fastest - 40ms latency)
 */
export class CartesiaTTSProvider implements TTSProviderInterface {
  name = 'Cartesia Sonic 3';
  
  async synthesize(text: string, config?: TTSConfig): Promise<ArrayBuffer> {
    const voice = config?.voice || '1463a4e1-56a1-4b41-b257-728d56e93605';
    const speed = config?.speed || 1.0;
    
    const response = await fetch('/api/tts/cartesia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speed }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Cartesia TTS failed');
    }
    
    return await response.arrayBuffer();
  }
  
  async getVoices(): Promise<string[]> {
    return ['1463a4e1-56a1-4b41-b257-728d56e93605']; // Default voice
  }
  
  getDefaultVoice(): string {
    return '1463a4e1-56a1-4b41-b257-728d56e93605';
  }
}

/**
 * TTS Provider Factory
 */
export class TTSProviderFactory {
  private static providers: Map<TTSProvider, TTSProviderInterface> = new Map([
    ['cartesia', new CartesiaTTSProvider()],
  ]);
  
  static getProvider(provider?: TTSProvider): TTSProviderInterface {
    // Get provider from env var or parameter, default to Cartesia
    const providerName = provider || 
      (typeof window !== 'undefined' && import.meta.env.VITE_TTS_PROVIDER as TTSProvider) || 
      'cartesia';
    
    const instance = this.providers.get(providerName);
    if (!instance) {
      console.warn(`Unknown TTS provider: ${providerName}, falling back to Cartesia`);
      return this.providers.get('cartesia')!;
    }
    
    return instance;
  }
  
  static getAllProviders(): { name: TTSProvider; label: string }[] {
    return [
      { name: 'cartesia', label: 'Cartesia Sonic 3 (40ms, Emotion, Laughter)' },
    ];
  }
}
