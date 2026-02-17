'use client';

import React, { useState, useEffect } from 'react';
import { TTSProviderFactory, TTSProvider } from '@/lib/tts/providers';

export default function TTSProviderSelector() {
  const [currentProvider, setCurrentProvider] = useState<TTSProvider>('openai');
  const [latency, setLatency] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  
  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem('tts_provider') as TTSProvider;
    if (stored) {
      setCurrentProvider(stored);
    }
  }, []);
  
  const handleProviderChange = (provider: TTSProvider) => {
    setCurrentProvider(provider);
    localStorage.setItem('tts_provider', provider);
    setLatency(null); // Reset latency when switching
  };
  
  const testProvider = async () => {
    setTesting(true);
    setLatency(null);
    
    try {
      console.log('[TTS Test] Starting test for provider:', currentProvider);
      const provider = TTSProviderFactory.getProvider(currentProvider);
      const testText = "Hello, this is a test of the text-to-speech system.";
      
      console.log('[TTS Test] Calling synthesize...');
      const startTime = performance.now();
      const audioData = await provider.synthesize(testText);
      const endTime = performance.now();
      console.log('[TTS Test] Synthesis complete, received', audioData.byteLength, 'bytes');
      
      setLatency(Math.round(endTime - startTime));
      
      // For testing purposes, convert Cartesia PCM to a simple playable format
      // In production (ChatPanel), we use Web Audio API for streaming
      console.log('[TTS Test] Received audio data, size:', audioData.byteLength, 'provider:', currentProvider);
      
      if (currentProvider === 'cartesia') {
        
        try {
          // Cartesia returns raw PCM - convert to WAV for broader compatibility
          console.log('[TTS Test] Converting PCM to WAV format');
          
          // Create WAV header for 32-bit float PCM
          const numSamples = audioData.byteLength / 4;
          const sampleRate = 44100;
          const numChannels = 1;
          const bitsPerSample = 32;
          const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
          const blockAlign = numChannels * (bitsPerSample / 8);
          const dataSize = audioData.byteLength;
          
          // WAV header is 44 bytes
          const wavBuffer = new ArrayBuffer(44 + dataSize);
          const view = new DataView(wavBuffer);
          
          // RIFF header
          view.setUint32(0, 0x52494646, false); // "RIFF"
          view.setUint32(4, 36 + dataSize, true); // File size - 8
          view.setUint32(8, 0x57415645, false); // "WAVE"
          
          // fmt chunk
          view.setUint32(12, 0x666d7420, false); // "fmt "
          view.setUint32(16, 16, true); // Chunk size
          view.setUint16(20, 3, true); // Audio format (3 = IEEE float)
          view.setUint16(22, numChannels, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, byteRate, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, bitsPerSample, true);
          
          // data chunk
          view.setUint32(36, 0x64617461, false); // "data"
          view.setUint32(40, dataSize, true);
          
          // Copy audio data
          new Uint8Array(wavBuffer, 44).set(new Uint8Array(audioData));
          
          console.log('[TTS Test] WAV file created, size:', wavBuffer.byteLength);
          
          // Use AudioContext with compatibility for Safari
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();
          
          // Resume context if suspended (autoplay policy)
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          
          console.log('[TTS Test] Decoding audio data...');
          const audioBuffer = await audioContext.decodeAudioData(wavBuffer);
          console.log('[TTS Test] Audio decoded, duration:', audioBuffer.duration, 'seconds');
          
          // Play the audio buffer
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start(0);
          
          console.log('[TTS Test] Playback started');
          
        } catch (pcmError: any) {
          console.error('[TTS Test] PCM playback error:', pcmError);
          throw new Error(`PCM playback failed: ${pcmError.message}`);
        }
        
      } else {
        console.log('[TTS Test] Playing MP3 audio, size:', audioData.byteLength);
        // Other providers (ElevenLabs, OpenAI) return MP3 - use HTML5 audio
        const blob = new Blob([audioData], { 
          type: currentProvider === 'openai' ? 'audio/mpeg' : 'audio/mpeg' 
        });
        const audio = new Audio(URL.createObjectURL(blob));
        await audio.play();
        console.log('[TTS Test] MP3 playback started');
      }
    } catch (error: any) {
      console.error('TTS test failed:', error);
      alert(`TTS test failed: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };
  
  const providers = TTSProviderFactory.getAllProviders();
  
  return (
    <div 
      className="p-4 border rounded-lg"
      style={{
        backgroundColor: 'var(--atlas-bg-card)',
        borderColor: 'var(--atlas-border)',
      }}
    >
      <div className="mb-3">
        <div 
          className="text-sm font-semibold mb-1"
          style={{ color: 'var(--atlas-text-primary)' }}
        >
          TTS Provider
        </div>
        <div 
          className="text-xs"
          style={{ color: 'var(--atlas-text-secondary)' }}
        >
          Choose between cloud (fast) or local (custom voice)
        </div>
      </div>
      
      <div className="space-y-2 mb-3">
        {providers.map((provider) => (
          <button
            key={provider.name}
            onClick={() => handleProviderChange(provider.name)}
            className="w-full text-left px-3 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: currentProvider === provider.name 
                ? 'var(--atlas-accent-primary)' 
                : 'var(--atlas-bg-subtle)',
              color: currentProvider === provider.name
                ? 'white'
                : 'var(--atlas-text-primary)',
              border: currentProvider === provider.name
                ? '2px solid var(--atlas-accent-primary)'
                : '1px solid var(--atlas-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{provider.label}</div>
                {provider.name === 'bettany' && (
                  <div className="text-xs opacity-70 mt-1">
                    Requires JARVIS TTS server running
                  </div>
                )}
              </div>
              {currentProvider === provider.name && (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
      
      <button
        onClick={testProvider}
        disabled={testing}
        className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        style={{
          backgroundColor: 'var(--atlas-btn-secondary)',
          color: 'white',
        }}
      >
        {testing ? 'Testing...' : 'Test Voice'}
      </button>
      
      {latency !== null && (
        <div 
          className="mt-2 text-xs text-center"
          style={{ color: 'var(--atlas-text-secondary)' }}
        >
          ✓ Latency: {latency}ms
        </div>
      )}
    </div>
  );
}
