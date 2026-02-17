'use client';

import React, { useState, useEffect } from 'react';
import TTSProviderSelector from './TTSProviderSelector';
import { STTProviderFactory } from '@/lib/stt/providers';

interface VoiceSettingsProps {
  onVoiceEnabledChange?: (enabled: boolean) => void;
}

export default function VoiceSettings({ onVoiceEnabledChange }: VoiceSettingsProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  
  useEffect(() => {
    // Load voice enabled state from localStorage
    const stored = localStorage.getItem('voice_enabled');
    const enabled = stored === 'true';
    setVoiceEnabled(enabled);
  }, []);
  
  const handleToggle = () => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    localStorage.setItem('voice_enabled', String(newState));
    
    // Notify parent component
    onVoiceEnabledChange?.(newState);
    
    // Show provider settings when enabling voice for first time
    if (newState && !showProviderSettings) {
      setShowProviderSettings(true);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Voice Enable/Disable Toggle */}
      <div 
        className="p-4 border rounded-lg"
        style={{
          backgroundColor: 'var(--atlas-bg-card)',
          borderColor: 'var(--atlas-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div 
              className="text-sm font-semibold mb-1"
              style={{ color: 'var(--atlas-text-primary)' }}
            >
              Voice Responses
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--atlas-text-secondary)' }}
            >
              Enable text-to-speech for ATLAS responses
            </div>
          </div>
          
          {/* Toggle Switch */}
          <button
            onClick={handleToggle}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: voiceEnabled ? 'var(--atlas-accent-primary)' : 'var(--atlas-bg-subtle)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: voiceEnabled ? 'var(--atlas-accent-primary)' : 'var(--atlas-border)',
            }}
            aria-checked={voiceEnabled}
            role="switch"
          >
            <span
              className={`${
                voiceEnabled ? 'translate-x-6' : 'translate-x-1'
              } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
          </button>
        </div>
        
        {/* Voice indicator when enabled */}
        {voiceEnabled && (
          <div 
            className="mt-3 flex items-center gap-2 text-xs"
            style={{ color: 'var(--atlas-text-secondary)' }}
          >
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
            <span>Voice responses enabled</span>
            <button
              onClick={() => setShowProviderSettings(!showProviderSettings)}
              className="ml-auto text-xs underline hover:no-underline"
              style={{ color: 'var(--atlas-accent-primary)' }}
            >
              {showProviderSettings ? 'Hide Settings' : 'Configure'}
            </button>
          </div>
        )}
      </div>
      
      {/* Provider Settings (shown when voice is enabled) */}
      {voiceEnabled && showProviderSettings && (
        <TTSProviderSelector />
      )}
      
      {/* Speech Input (STT) Settings */}
      <div 
        className="p-4 border rounded-lg"
        style={{
          backgroundColor: 'var(--atlas-bg-card)',
          borderColor: 'var(--atlas-border)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <div 
              className="text-sm font-semibold mb-1"
              style={{ color: 'var(--atlas-text-primary)' }}
            >
              Voice Input (Speech-to-Text)
            </div>
            <div 
              className="text-xs"
              style={{ color: 'var(--atlas-text-secondary)' }}
            >
              Real-time speech transcription with ElevenLabs Scribe v2
            </div>
          </div>
        </div>
        
        <div className="space-y-3">
          {/* STT Provider Info */}
          <div 
            className="flex items-start gap-2 p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--atlas-bg-subtle)',
            }}
          >
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--atlas-accent-primary)' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 text-xs">
              <div style={{ color: 'var(--atlas-text-primary)' }} className="font-medium mb-1">
                ElevenLabs Scribe v2 Realtime
              </div>
              <div style={{ color: 'var(--atlas-text-secondary)' }}>
                • 150ms latency • 90+ languages • Automatic voice activity detection
              </div>
            </div>
          </div>
          
          {/* Usage Instructions */}
          <div 
            className="text-xs p-3 rounded-lg"
            style={{
              backgroundColor: 'var(--atlas-bg-elevated)',
              color: 'var(--atlas-text-secondary)',
            }}
          >
            <div className="font-medium mb-2" style={{ color: 'var(--atlas-text-primary)' }}>
              How to use:
            </div>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Click the microphone button next to the chat input</li>
              <li>Speak your query naturally</li>
              <li>Your speech is transcribed in real-time</li>
              <li>The message is automatically sent when you finish speaking</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if voice is enabled
 */
export function useVoiceEnabled() {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  
  useEffect(() => {
    const stored = localStorage.getItem('voice_enabled');
    setVoiceEnabled(stored === 'true');
    
    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'voice_enabled') {
        setVoiceEnabled(e.newValue === 'true');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  return voiceEnabled;
}
