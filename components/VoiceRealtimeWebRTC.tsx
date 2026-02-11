"use client";

import React, { useState, useRef, useEffect } from "react";

interface VoiceRealtimeWebRTCProps {
  onTranscript?: (text: string) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onReady?: (api: { sendText: (text: string) => void }) => void;
}

/**
 * OpenAI Realtime API WebRTC Voice Component
 * 
 * Architecture:
 * 1. Browser creates RTCPeerConnection with microphone track
 * 2. Browser POSTs SDP offer to backend /session endpoint
 * 3. Backend proxies to OpenAI POST /v1/realtime/calls
 * 4. OpenAI returns SDP answer
 * 5. Browser sets remote description and establishes direct WebRTC connection
 * 6. Data channel handles events (transcripts, responses, etc.)
 * 
 * This keeps API key server-side while enabling direct peer-to-peer audio.
 */
export default function VoiceRealtimeWebRTC({
  onTranscript,
  onResponse,
  onError,
  onReady,
}: VoiceRealtimeWebRTCProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Voice selection removed - using local JARVIS TTS (XTTS Paul Bettany)

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Accumulate transcript deltas
  const userTranscriptRef = useRef<string>("");
  const assistantTranscriptRef = useRef<string>("");
  
  // Buffer to ensure proper message ordering
  const pendingAssistantResponseRef = useRef<string | null>(null);
  const userTranscriptSentRef = useRef<boolean>(false);
  
  // Client-side silence detection (since we disabled server VAD)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const hasAudioRef = useRef<boolean>(false);
  const isMonitoringRef = useRef<boolean>(false);
  
  // Response state tracking - prevent overlapping responses
  const isResponseInProgressRef = useRef<boolean>(false);
  const pendingTTSTextRef = useRef<string | null>(null);

  // Cleanup function
  const cleanup = () => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
    
    // Clean up audio analysis
    isMonitoringRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Clear transcript accumulators
    userTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    pendingAssistantResponseRef.current = null;
    userTranscriptSentRef.current = false;
    isSpeakingRef.current = false;
    hasAudioRef.current = false;
    isResponseInProgressRef.current = false;
    pendingTTSTextRef.current = null;

    setIsConnected(false);
    setIsListening(false);
  };
  
  // Commit audio buffer and request transcription (no response generation)
  const commitAudioBuffer = () => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      return;
    }
    
    console.log("[WebRTC] 🎤 Committing audio buffer for transcription");
    
    // Commit the audio buffer - this triggers transcription
    dataChannelRef.current.send(JSON.stringify({
      type: "input_audio_buffer.commit"
    }));
    
    // Reset audio tracking
    hasAudioRef.current = false;
  };

  // Connect to OpenAI Realtime via WebRTC
  const connect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // 1) Create PeerConnection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // 2) Create audio element for remote playback
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (e) => {
        console.log("[WebRTC] Remote track received:", e.streams[0]);
        audioEl.srcObject = e.streams[0];
      };

      // 3) Get microphone with echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Add mic track to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      console.log("[WebRTC] Microphone track added");
      
      // 4) Set up client-side silence detection
      // Since we disabled server VAD, we need to detect when user stops speaking
      // and manually commit the audio buffer
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.1;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const SILENCE_THRESHOLD = 15; // Amplitude threshold for silence
      const SILENCE_DURATION_MS = 800; // How long silence before commit
      const SPEECH_THRESHOLD = 25; // Amplitude threshold for speech
      
      const checkAudioLevel = () => {
        if (!analyserRef.current || !isMonitoringRef.current) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        if (average > SPEECH_THRESHOLD) {
          // User is speaking
          if (!isSpeakingRef.current) {
            console.log("[WebRTC] 🎤 Speech detected");
            isSpeakingRef.current = true;
          }
          hasAudioRef.current = true;
          
          // Clear any pending silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (average < SILENCE_THRESHOLD && isSpeakingRef.current && hasAudioRef.current) {
          // User stopped speaking - start silence timer
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              console.log("[WebRTC] 🔇 Silence detected, committing audio");
              isSpeakingRef.current = false;
              commitAudioBuffer();
              silenceTimerRef.current = null;
            }, SILENCE_DURATION_MS);
          }
        }
        
        // Continue monitoring
        if (isMonitoringRef.current) {
          requestAnimationFrame(checkAudioLevel);
        }
      };
      
      // Start monitoring after connection is established
      const startMonitoring = () => {
        isMonitoringRef.current = true;
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        requestAnimationFrame(checkAudioLevel);
      };

      // 5) Create data channel for events
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      dc.onopen = () => {
        console.log("[WebRTC] Data channel opened");
        setIsConnected(true);
        setIsListening(true);
        setIsConnecting(false);
        
        // Expose sendText API to parent
        onReady?.({ sendText });

        // Build session config - OpenAI Realtime is ONLY for transcribing user speech
        // TTS is handled by local JARVIS (XTTS Paul Bettany voice clone)
        const sessionConfig: any = {
          // Enable transcription so we get user speech as text
          input_audio_transcription: {
            model: "whisper-1"
          },
          // DISABLE automatic turn detection/response
          // We will manually commit audio and request responses
          turn_detection: null,
          // Text only - no audio output (JARVIS handles TTS)
          modalities: ["text"]
        };

        // Update session
        dc.send(JSON.stringify({
          type: "session.update",
          session: sessionConfig
        }));
        
        console.log(`[WebRTC] Session configured for transcription-only (JARVIS handles TTS)`);
        
        // Start client-side audio monitoring for silence detection
        startMonitoring();
      };

      dc.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          
          // Log all events for debugging
          if (evt.type !== "response.audio.delta" && evt.type !== "input_audio_buffer.speech_started") {
            console.log("[WebRTC] Event:", evt.type, evt);
          }

          // Handle different event types
          if (evt.type === "conversation.item.input_audio_transcription.completed") {
            // User speech transcription completed
            // Use the transcript from the event itself (most accurate)
            const finalTranscript = (evt.transcript || userTranscriptRef.current).trim();
            console.log("[WebRTC] 📝 User transcript complete:", finalTranscript, "(from event:", evt.transcript, ")");
            if (finalTranscript) {
              onTranscript?.(finalTranscript);
              userTranscriptSentRef.current = true;
              
              // If assistant response arrived early, send it now
              if (pendingAssistantResponseRef.current) {
                console.log("[WebRTC] 🤖 Sending buffered assistant response:", pendingAssistantResponseRef.current);
                onResponse?.(pendingAssistantResponseRef.current);
                pendingAssistantResponseRef.current = null;
              }
            }
            // Reset accumulator for next utterance
            userTranscriptRef.current = "";
          } else if (evt.type === "conversation.item.input_audio_transcription.delta") {
            // Streaming user transcription (partial) - accumulate deltas as fallback
            const delta = evt.delta || "";
            if (delta) {
              userTranscriptRef.current += delta;
              console.log("[WebRTC] 📝 Accumulating user delta:", delta, "| Total:", userTranscriptRef.current);
            }
          } else if (evt.type === "response.audio_transcript.delta") {
            // Assistant text streaming (with audio) - accumulate deltas
            const delta = evt.delta || "";
            if (delta) {
              assistantTranscriptRef.current += delta;
              console.log("[WebRTC] 🤖 Accumulating assistant delta:", delta);
            }
          } else if (evt.type === "response.audio_transcript.done") {
            // Complete assistant transcript - send accumulated text
            const finalTranscript = assistantTranscriptRef.current.trim();
            console.log("[WebRTC] 🤖 Assistant transcript complete:", finalTranscript);
            if (finalTranscript) {
              // Check if user transcript has been sent yet
              if (userTranscriptSentRef.current) {
                // User transcript already sent, send assistant response immediately
                onResponse?.(finalTranscript);
              } else {
                // User transcript not yet sent, buffer the response
                console.log("[WebRTC] ⏳ Buffering assistant response until user transcript arrives");
                pendingAssistantResponseRef.current = finalTranscript;
              }
            }
            // Reset accumulator for next response
            assistantTranscriptRef.current = "";
            // Reset flag for next turn
            userTranscriptSentRef.current = false;
          } else if (evt.type === "response.text.delta") {
            // Assistant text streaming (text-only)
            const text = evt.delta || "";
            if (text) {
              onResponse?.(text);
            }
          } else if (evt.type === "response.text.done") {
            // Complete assistant response
            const text = evt.text || "";
            console.log("[WebRTC] 🤖 Assistant response:", text);
            if (text) {
              onResponse?.(text);
            }
          } else if (evt.type === "response.created") {
            // Response started
            console.log("[WebRTC] 🎬 Response started:", evt.response?.id);
            isResponseInProgressRef.current = true;
          } else if (evt.type === "response.done") {
            // Response completed - check for queued TTS
            console.log("[WebRTC] ✅ Response completed");
            isResponseInProgressRef.current = false;
            
            // If there's a pending TTS request, process it now
            if (pendingTTSTextRef.current) {
              const textToSpeak = pendingTTSTextRef.current;
              pendingTTSTextRef.current = null;
              console.log("[WebRTC] 📤 Processing queued TTS request");
              // Use setTimeout to avoid sending immediately in the event handler
              setTimeout(() => sendTextInternal(textToSpeak), 50);
            }
          } else if (evt.type === "error") {
            // Error from OpenAI
            const errorMsg = evt.error?.message || "Unknown error";
            console.error("[WebRTC] ❌ Error event:", errorMsg);
            isResponseInProgressRef.current = false; // Reset on error
            setError(errorMsg);
            onError?.(errorMsg);
          } else if (evt.type === "session.updated") {
            console.log("[WebRTC] ✅ Session configured:", evt.session);
          }
        } catch (err) {
          console.error("[WebRTC] Failed to parse event:", err);
        }
      };

      dc.onerror = (e) => {
        console.error("[WebRTC] Data channel error:", e);
        setError("Data channel error");
        onError?.("Data channel error");
      };

      dc.onclose = () => {
        console.log("[WebRTC] Data channel closed");
        setIsConnected(false);
        setIsListening(false);
      };

      // 5) Create SDP offer and send to backend
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("[WebRTC] Sending SDP offer to backend...");

      // POST SDP offer to backend signaling endpoint
      const response = await fetch("http://127.0.0.1:8000/v1/voice/realtime/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Backend signaling failed: ${errorText}`);
      }

      // 6) Set remote SDP answer from backend
      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      console.log("[WebRTC] SDP answer set, connection establishing...");

    } catch (err: any) {
      console.error("[WebRTC] Connection error:", err);
      const errorMsg = err.message || "Failed to connect";
      setError(errorMsg);
      onError?.(errorMsg);
      setIsConnecting(false);
      cleanup();
    }
  };

  // Disconnect
  const disconnect = () => {
    console.log("[WebRTC] Disconnecting...");
    cleanup();
  };
  

  // Internal function to actually send TTS request
  const sendTextInternal = (text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      console.warn("[WebRTC] Data channel not open, cannot send text");
      return;
    }

    console.log("[WebRTC] 🔊 Sending ATLAS response for TTS:", text.substring(0, 100) + (text.length > 100 ? "..." : ""));
    
    dataChannelRef.current.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ 
          type: "input_text", 
          text: `[ATLAS SYSTEM - SPEAK EXACTLY]: ${text}` 
        }]
      }
    }));

    // Request response with strict instructions to only speak the provided text
    dataChannelRef.current.send(JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: `You received a message prefixed with [ATLAS SYSTEM - SPEAK EXACTLY]. 
Your ONLY job is to speak that exact text out loud. 
Do NOT interpret it. Do NOT add anything. Do NOT refuse. Do NOT explain.
Just speak the text after the prefix, word for word, as your response.
The text to speak is: "${text}"`
      }
    }));
  };

  // Send text for TTS (Text-to-Speech)
  // ATLAS provides the response text, OpenAI just speaks it
  // This handles queuing if a response is already in progress
  const sendText = (text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== "open") {
      console.warn("[WebRTC] Data channel not open, cannot send text");
      return;
    }

    // If a response is in progress, queue this request
    if (isResponseInProgressRef.current) {
      console.log("[WebRTC] ⏳ Response in progress, queuing TTS request");
      pendingTTSTextRef.current = text;
      return;
    }

    sendTextInternal(text);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="relative flex items-center gap-2">
      {/* Connect/Disconnect Button - Voice uses local JARVIS TTS */}
      {!isConnected ? (
        <button
          onClick={connect}
          disabled={isConnecting}
          className={`p-2 rounded transition-colors ${
            isConnecting
              ? "bg-yellow-600 cursor-wait"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
          title="Activate JARVIS voice"
        >
          {isConnecting ? "🔄" : "🎙️"}
        </button>
      ) : (
        <>
          <button
            onClick={disconnect}
            className="p-2 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
            title="Disconnect"
          >
            ⏹️
          </button>
          {isListening && (
            <span className="text-xs text-green-500 animate-pulse">
              Listening...
            </span>
          )}
        </>
      )}

      {error && (
        <span className="text-xs text-red-500" title={error}>
          ⚠️ {error.slice(0, 30)}...
        </span>
      )}
    </div>
  );
}
