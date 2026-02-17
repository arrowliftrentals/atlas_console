'use client';

import React, { useState, useEffect } from 'react';
import { STTProviderFactory, type STTTranscript } from '@/lib/stt/providers';

interface VoiceInputButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export default function VoiceInputButton({ onTranscript, onError }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const silenceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const sttProvider = STTProviderFactory.getProvider('elevenlabs');

  const handleToggleListening = async () => {
    if (isListening) {
      // Stop listening and send the last transcript as final
      console.log('[VoiceInput] User clicked stop - sending last transcript as final:', lastTranscript);
      sttProvider.stopListening();
      setIsListening(false);
      setInterimText('');
      
      // Send the last interim transcript as final
      if (lastTranscript.trim()) {
        onTranscript(lastTranscript, true);
      }
      setLastTranscript('');
    } else {
      // Start listening
      try {
        await sttProvider.startListening(
          (transcript: STTTranscript) => {
            console.log('[VoiceInput] Transcript received:', {
              text: transcript.text,
              isFinal: transcript.isFinal,
              confidence: transcript.confidence,
            });
            
            // Store last transcript for VAD-based sending
            setLastTranscript(transcript.text);
            
            // Always send transcript to parent (both interim and final)
            onTranscript(transcript.text, transcript.isFinal);
            
            if (transcript.isFinal) {
              // Final transcript from ElevenLabs - stop listening and send
              console.log('[VoiceInput] ✅ FINAL transcript from ElevenLabs:', transcript.text);
              setInterimText('');
              sttProvider.stopListening();
              setIsListening(false);
              
              // Clear any pending silence timer
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
            } else {
              // Interim transcript - implement OpenAI-style VAD
              console.log('[VoiceInput] 📝 Interim transcript:', transcript.text);
              setInterimText(transcript.text);
              
              // Clear previous silence timer
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
              }
              
              // Start new silence timer - if no new transcript in 1.5s, treat as final
              silenceTimerRef.current = setTimeout(() => {
                console.log('[VoiceInput] ⏱️ 1.5s silence detected - treating as final');
                if (transcript.text.trim()) {
                  onTranscript(transcript.text, true);
                  sttProvider.stopListening();
                  setIsListening(false);
                  setInterimText('');
                  setLastTranscript('');
                }
              }, 1500); // 1.5 seconds of silence = end of utterance
            }
          },
          (error: string) => {
            console.error('[Voice Input] Error:', error);
            alert(`Voice Input Error: ${error}`);
            onError?.(error);
            setIsListening(false);
            setInterimText('');
          },
          {
            language: 'en',
            enableVAD: true,
          }
        );
        setIsListening(true);
      } catch (error: any) {
        console.error('[Voice Input] Failed to start:', error);
        alert(`Failed to start voice input: ${error.message}`);
        onError?.(error.message || 'Failed to start voice input');
        setIsListening(false);
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sttProvider.isListening()) {
        sttProvider.stopListening();
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={handleToggleListening}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="px-3 py-2.5 rounded-lg transition-all"
        style={{
          backgroundColor: isListening ? '#ef4444' : 'var(--atlas-bg-subtle)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isListening ? '#ef4444' : 'var(--atlas-border)',
        }}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          style={{ color: isListening ? 'white' : 'var(--atlas-text-muted)' }}
        >
          {isListening ? (
            // Microphone active (red)
            <>
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path
                fillRule="evenodd"
                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                clipRule="evenodd"
              />
            </>
          ) : (
            // Microphone icon (off)
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          )}
        </svg>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full right-0 mb-2 px-2 py-1 text-xs rounded whitespace-nowrap z-50"
          style={{
            backgroundColor: 'var(--atlas-bg-elevated)',
            border: '1px solid var(--atlas-border)',
            color: 'var(--atlas-text-primary)',
          }}
        >
          {isListening ? 'Listening... (click to stop)' : 'Voice Input'}
        </div>
      )}

      {/* Live transcription indicator */}
      {interimText && (
        <div
          className="absolute bottom-full right-0 mb-12 px-3 py-2 text-sm rounded-lg max-w-md z-50"
          style={{
            backgroundColor: 'var(--atlas-bg-elevated)',
            border: '2px solid var(--atlas-accent-primary)',
            color: 'var(--atlas-text-primary)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-xs text-gray-400 mb-1">Transcribing...</div>
          <div>{interimText}</div>
        </div>
      )}
    </div>
  );
}
