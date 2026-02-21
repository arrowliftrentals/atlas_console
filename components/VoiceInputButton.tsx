'use client';

import React, { useState, useEffect, useRef } from 'react';
import { STTProviderFactory, type STTTranscript } from '@/lib/stt/providers';

type LanguageMode = 'auto' | 'en' | 'es';

interface VoiceInputButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  autoRestart?: boolean; // Auto-restart listening after sending message
  pauseWhileSpeaking?: boolean; // Pause mic while ATLAS is speaking
  onInterrupt?: () => void; // Called when user interrupts ATLAS
  // Optional: share playback graph for echo-aware gating
  audioContext?: AudioContext;
  playbackNode?: AudioNode;
  languageMode?: LanguageMode; // 'auto' | 'en' | 'es'
}

export default function VoiceInputButton({ onTranscript, onError, autoRestart = false, pauseWhileSpeaking = false, onInterrupt, audioContext, playbackNode, languageMode = 'auto' }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const silenceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const wasListeningRef = React.useRef(false);

  const sttProvider = STTProviderFactory.getProvider('elevenlabs');

  // Echo-aware gating: analysers and loop state
  const gateLoopRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const outAnalyserRef = useRef<AnalyserNode | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Track when ATLAS is speaking - gate microphone closed
  React.useEffect(() => {
    if (pauseWhileSpeaking && isListening) {
      // ATLAS started speaking - close the gate (mute mic)
      console.log('[VoiceInput] 🔇 ATLAS speaking - closing microphone gate');
      sttProvider.setGate?.(true); // Block all mic input
      setIsPaused(true);
    } else if (!pauseWhileSpeaking && isListening) {
      // ATLAS finished speaking - open the gate (unmute mic)
      console.log('[VoiceInput] 🎤 ATLAS finished - opening microphone gate');
      sttProvider.setGate?.(false); // Allow mic input
      setIsPaused(false);
    }
  }, [pauseWhileSpeaking, isListening, sttProvider]);

  const handleToggleListening = async () => {
    if (isListening) {
      // Stop correlation loop and analysers
      if (gateLoopRef.current !== null) {
        window.clearInterval(gateLoopRef.current);
        gateLoopRef.current = null;
      }
      micAnalyserRef.current?.disconnect();
      outAnalyserRef.current?.disconnect();
      micSourceNodeRef.current?.disconnect();
      micAnalyserRef.current = null;
      outAnalyserRef.current = null;
      micSourceNodeRef.current = null;

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
            // Gate handles echo prevention - transcripts only arrive when gate is open
            console.log('[VoiceInput] Transcript received:', transcript.text, `(final: ${transcript.isFinal}, paused: ${isPaused})`);
            
            // If we get a transcript while paused (shouldn't happen with gate), filter it
            if (isPaused) {
              console.log('[VoiceInput] 🚫 Ignoring transcript while gate closed');
              return;
            }
            
            // Store last transcript for VAD-based sending
            setLastTranscript(transcript.text);
            
            // Send transcript to parent (both interim and final)
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

              // Auto-restart listening for next turn if enabled
              if (autoRestart) {
                const delayMs = 500; // brief grace so TTS gating is active
                console.log(`[VoiceInput] 🔄 Auto-restart enabled - restarting in ${delayMs}ms...`);
                setTimeout(() => {
                  // Only restart if not already listening
                  if (!isListening) {
                    console.log('[VoiceInput] 🎤 Restarting listening for next turn...');
                    handleToggleListening();
                  }
                }, delayMs);
              }
            } else {
              // Interim transcript (realtime): do not auto-stop on client VAD; let server commit decide
              console.log('[VoiceInput] 📝 Interim transcript:', transcript.text);
              setInterimText(transcript.text);

              // DISABLED: Silence-based commit was causing premature cutoffs during natural pauses
              // Let ElevenLabs server-side VAD handle commit timing instead
              // User can manually stop by clicking the mic button
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
              }
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
            language: languageMode === 'auto' ? undefined : languageMode,
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

  // Prevent browser from pausing mic when other apps take focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isListening) {
        console.log('[VoiceInput] ⚠️ Page hidden but mic should stay active');
        // Don't stop - user may be interacting with ATLAS-opened apps
      } else if (!document.hidden && isListening) {
        console.log('[VoiceInput] ✓ Page visible again, mic still active');
      }
    };
    
    const handleFocus = () => {
      if (isListening) {
        console.log('[VoiceInput] 🔄 Window regained focus, ensuring mic is active');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isListening]);
  
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

      {/* Removed tooltip - transcription shows in input field only */}
    </div>
  );
}
