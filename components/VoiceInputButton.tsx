'use client';

import React, { useState, useEffect, useRef } from 'react';
import { STTProviderFactory, type STTTranscript } from '@/lib/stt/providers';
import { getSpeakerGate, type GateState } from '@/lib/stt/speakerGate';
import { classifyTranscript } from '@/lib/stt/transcriptFilter';

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
  const [gateState, setGateState] = useState<GateState>('disabled');

  // Subscribe to SpeakerGate state changes
  useEffect(() => {
    const gate = getSpeakerGate();
    const unsub = gate.onStateChange((state) => setGateState(state));
    setGateState(gate.state);
    return unsub;
  }, []);

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
            
            // Classify transcript: detect non-speech artifacts (coughs, garbled output)
            const classification = classifyTranscript(transcript.text, languageMode);
            if (classification.isNoise) {
              console.log(`[VoiceInput] 🔊 Non-speech artifact detected: "${transcript.text}" → reason: ${classification.reason}`);
              // For interim noise, just show placeholder — don't send yet
              if (!transcript.isFinal) {
                setInterimText('[...]');
                return;
              }
              // For final noise, send the semantic label so ATLAS can respond contextually
              // (e.g. JARVIS: "Are you okay, sir?")
            }
            
            const textToSend = classification.isNoise ? classification.text : transcript.text;
            
            // Store last transcript for VAD-based sending
            setLastTranscript(textToSend);
            
            // Send transcript to parent (both interim and final)
            onTranscript(textToSend, transcript.isFinal);
            
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
        className="px-3 py-2.5 rounded-lg transition-all relative"
        style={{
          backgroundColor: isListening ? '#ef4444' : 'var(--atlas-bg-subtle)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isListening ? '#ef4444' : 'var(--atlas-border)',
        }}
        title={isListening ? 'Stop listening' : 'Start voice input'}
      >
        {/* Speaker verification status dot */}
        {gateState !== 'disabled' && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white"
            style={{
              backgroundColor:
                gateState === 'open' ? '#22c55e' :
                gateState === 'closed' ? '#ef4444' :
                gateState === 'no_voiceprint' ? '#f59e0b' :
                '#9ca3af',
            }}
            title={
              gateState === 'open' ? 'Speaker verified' :
              gateState === 'closed' ? 'Speaker not verified' :
              gateState === 'no_voiceprint' ? 'No voiceprint enrolled' :
              'Verification disabled'
            }
          />
        )}
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
