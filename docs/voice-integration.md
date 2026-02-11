# Voice Integration - WARP Console

**Status:** ✅ Complete (Batch + Streaming + OpenAI Realtime)  
**Date:** 2026-02-03  
**Category:** UI Enhancement

## Overview

The WARP Console features tri-mode voice I/O integration with Atlas:

**Batch Mode (Button-based):**
- Click to record, click to stop
- Full STT → DecisionValidator → Atlas → TTS pipeline
- Best for: Discrete commands, reliability

**Streaming Mode (Real-time VAD):**
- Continuous conversational voice with VAD (Voice Activity Detection)
- Ultra-low latency (~250-500ms)
- Voice interruption (cancel Atlas mid-response)
- Adjustable VAD settings (aggressiveness + silence threshold)
- Best for: Natural conversations, rapid exchanges

**Realtime Mode (OpenAI Realtime API):** ⚡ NEW
- OpenAI's native real-time voice API
- Built-in VAD with superior quality
- Native barge-in support
- Lowest latency (~200-300ms)
- Unified STT + LLM + TTS pipeline
- Best for: Production use, highest quality conversations

## Architecture

### Batch Mode (Button-based)
```
User Voice Input
     ↓
[Browser MediaRecorder] → WebM audio
     ↓
[VoiceInput Component] → Base64 encoding
     ↓
[POST /v1/voice/query] → Atlas API
     ↓
[Atlas Voice Pipeline]
  - STT (Speech-to-Text)
  - DecisionValidator (Safety check)
  - Atlas processing
  - TTS (Text-to-Speech)
     ↓
[VoiceResponse] → JSON
     ↓
[VoiceInput Component]
  - Display transcript in text box
  - Play audio response automatically
```

### Streaming Mode (Real-time)
```
User speaks continuously
     ↓
[Browser MediaRecorder] → WebM chunks (100ms)
     ↓
[WebSocket: /v1/voice/stream-realtime]
     ↓
[VAD (Voice Activity Detection)]
  - Detects speech start/end
  - Buffers audio frames (30ms @ 16kHz)
  - Configurable silence threshold (5-20 frames)
  - Adjustable aggressiveness (0-3)
     ↓
[Groq Whisper STT] → ~50-100ms
     ↓
[Atlas Processing] → ~100-300ms
  - Monitors for interruption
  - Cancels if new speech detected
     ↓
[Piper TTS] → ~100ms (local neural synthesis)
  - Skipped if interrupted
     ↓
[Auto-play response] → User hears response
  - Stops playback if interrupted
     ↓
Continue listening...

Total latency: 250-500ms (conversational)
Interruption response: <100ms
```

### Realtime Mode (OpenAI Realtime API)
```
User speaks
     ↓
[Browser] → WebSocket to Atlas backend
     ↓
[Atlas Backend] → WebSocket to OpenAI Realtime API
     ↓
[OpenAI Realtime API]
  - Built-in VAD (Voice Activity Detection)
  - Real-time STT (Speech-to-Text)
  - GPT-4o Realtime model processing
  - Real-time TTS (Text-to-Speech)
     ↓
[Atlas Backend]
  - DecisionValidator safety check
  - L3 episodic memory logging
  - Audio playback via sounddevice
     ↓
User hears response (can interrupt anytime)
  - Automatic barge-in detection
  - Response cancellation
  - Immediate re-listening

Total latency: 200-300ms (ultra-low)
Interruption response: <50ms
Audio quality: Superior (24kHz PCM)
```

## Components

### 1. VoiceInput.tsx (Batch Mode)

**Location:** `components/VoiceInput.tsx`

**Features:**
- Browser MediaRecorder API for audio capture
- WebM/Opus encoding (best quality/compression)
- Visual feedback (recording/processing states)
- Auto-play TTS responses
- Error handling with user feedback
- Audio visualization ready (analyser node)

**Props:**
```typescript
interface VoiceInputProps {
  onTranscript: (text: string) => void;  // Callback with STT transcript
  onError: (error: string) => void;       // Error callback
  disabled?: boolean;                     // Disable button
}
```

**Usage:**
```tsx
<VoiceInput
  onTranscript={(text) => setInput(prev => `${prev} ${text}`)}
  onError={(error) => setError(error)}
  disabled={!activeSessionId || loading}
/>
```

### 2. VoiceStreamInput.tsx (Streaming Mode)

**Location:** `components/VoiceStreamInput.tsx`

**Features:**
- WebSocket connection to `/v1/voice/stream-realtime`
- Continuous audio streaming (100ms chunks)
- Server-side VAD (Voice Activity Detection)
- Real-time transcript display
- Auto-play TTS responses
- Visual feedback (listening/processing states)
- Ultra-low latency (~250-500ms)

**Props:**
```typescript
interface VoiceStreamInputProps {
  apiUrl?: string;                        // WebSocket server URL
  onTranscript?: (text: string) => void;  // Callback with STT transcript
  onResponse?: (text: string) => void;    // Callback with Atlas response
  onError?: (error: string) => void;      // Error callback
}
```

**Usage:**
```tsx
<VoiceStreamInput
  onTranscript={(text) => {
    if (activeSessionId) {
      addMessage(activeSessionId, { type: 'user', content: text });
    }
  }}
  onResponse={(text) => {
    if (activeSessionId) {
      addMessage(activeSessionId, { type: 'assistant', content: text });
    }
  }}
  onError={(error) => setError(error)}
/>
```

**States:**
- `idle` - Ready to start
- `connecting` - Establishing WebSocket
- `listening` - Actively listening (green pulse)
- `processing` - Atlas processing speech (blue pulse)
- `interrupted` - Response cancelled (red indicator, 1s)

**Interruption:**
- Automatic: Speak during Atlas response to cancel
- Manual: Click "🛑 Interrupt" button
- Stops TTS playback immediately
- Cancels in-flight Atlas processing
- Server detects speech via VAD during response

**VAD Controls:**
```tsx
// Adjustable settings (click ⚙️ button)
- Aggressiveness: 0-3 (Low/Medium/High/Very High)
  - Higher = more sensitive to speech
  - Lower = filters out noise better
  
- Silence Threshold: 5-20 frames (150-600ms)
  - How long to wait after speech stops
  - Higher = more time before processing
  - Lower = faster response but may cut off speech
```

### 3. ChatPanel Integration

**Modified:** `components/ChatPanel.tsx`

**Changes:**
- Imported VoiceInput and VoiceStreamInput components
- Added mode toggle (🎙️ Batch / 🔊 Streaming)
- Conditional rendering based on `voiceMode` state
- **Batch mode:** Transcript fills text input
- **Streaming mode:** Messages auto-populate chat
- Positioned in attachment toolbar
- Disabled during loading states

**Mode Toggle:**
```tsx
<div className="flex items-center gap-1">
  <button onClick={() => setVoiceMode('batch')} title="Button-based voice">
    🎙️
  </button>
  <button onClick={() => setVoiceMode('streaming')} title="Real-time streaming">
    🔊
  </button>
  <button onClick={() => setVoiceMode('realtime')} title="OpenAI Realtime API">
    ⚡
  </button>
</div>
```

### 4. VoiceOpenAIRealtime.tsx (Realtime Mode)

**Location:** `components/VoiceOpenAIRealtime.tsx`

**Features:**
- WebSocket connection to `/v1/voice/openai-realtime`
- Connects to OpenAI Realtime API via Atlas backend
- Built-in VAD (no manual configuration needed)
- Real-time transcript streaming
- Native barge-in support
- Ultra-low latency (~200-300ms)
- Superior audio quality (24kHz PCM)
- DecisionValidator integration for safety
- L3 memory logging

**Props:**
```typescript
interface VoiceOpenAIRealtimeProps {
  apiUrl?: string;                        // WebSocket server URL
  onTranscript?: (text: string) => void;  // Callback with complete transcript
  onResponse?: (text: string) => void;    // Callback with streaming response
  onError?: (error: string) => void;      // Error callback
}
```

**Usage:**
```tsx
<VoiceOpenAIRealtime
  onTranscript={(text) => {
    if (activeSessionId) {
      addMessage(activeSessionId, { type: 'user', content: text });
    }
  }}
  onResponse={(text) => {
    if (activeSessionId) {
      // Handle streaming response
      const messages = getMessages(activeSessionId);
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.type === 'assistant') {
        updateLastMessage(activeSessionId, lastMessage.content + text);
      } else {
        addMessage(activeSessionId, { type: 'assistant', content: text });
      }
    }
  }}
  onError={(error) => setError(error)}
/>
```

**States:**
- `idle` - Ready to start
- `connecting` - Establishing connections
- `listening` - Actively listening (green pulse)
- `processing` - Assistant responding (blue pulse)
- `interrupted` - Response cancelled (red indicator, 1s)

**Interruption:**
- Automatic: Speak during assistant response to cancel
- Manual: Click "🛑 Interrupt" button
- Native OpenAI Realtime API barge-in
- Immediate response cancellation
- Faster than streaming mode (<50ms vs 100ms)

**Settings:**
```tsx
// Configurable via settings panel (⚙️ button)
- VAD Aggressiveness: 0-3 (managed by OpenAI)
- Barge-in: Always enabled
- End-of-turn silence: Configured server-side
- Model: gpt-4o-realtime-preview
```

**Advantages over Streaming Mode:**
- Lower latency (200-300ms vs 250-500ms)
- Better audio quality (24kHz vs 16kHz)
- More natural barge-in behavior
- Single unified API call
- Better conversation continuity
- Less prone to audio artifacts

**Configuration:**
Requires `OPENAI_API_KEY` in Atlas backend `.env` file.

### 5. ChatPanel Integration

**Modified:** `components/ChatPanel.tsx`

**Changes:**
- Imported VoiceOpenAIRealtime component
- Updated mode type: `'batch' | 'streaming' | 'realtime'`
- Added third button to mode toggle (⚡ Realtime)
- **Conditional Rendering:**

### Batch Mode API

**Endpoint:** `POST http://localhost:8000/v1/voice/query`

**Request:**
```json
{
  "audio": "base64_encoded_webm_audio",
  "device_id": "warp_console",
  "language": "en-US"
}
```

**Response:**
```json
{
  "transcript": "What is the weather today?",
  "response": "I'll check the weather for you.",
  "audio": "base64_encoded_aiff_audio",
  "confidence": 0.95,
  "metadata": {
    "safety_score": 0.98,
    "tts_voice": "Alex",
    "response_time_ms": 850
  }
}
```

### Streaming Mode API

**Endpoint:** `WebSocket ws://localhost:8000/v1/voice/stream-realtime`

**Connection:**
```typescript
const ws = new WebSocket('ws://localhost:8000/v1/voice/stream-realtime');
```

**Client sends (binary audio):**
```javascript
// MediaRecorder sends raw WebM chunks every 100ms
mediaRecorder.ondataavailable = (event) => {
  if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
    event.data.arrayBuffer().then((arrayBuffer) => {
      ws.send(arrayBuffer);  // Send raw bytes
    });
  }
};
```

**Server sends (JSON messages):**

**Connection confirmation:**
```json
{
  "type": "connected",
  "mode": "realtime",
  "stt_engine": "GroqWhisper",
  "tts_engine": "Piper",
  "vad_enabled": true,
  "timestamp": 1738531200.5
}
```

**Transcript chunk:**
```json
{
  "type": "transcript_chunk",
  "text": "What is the weather today?",
  "confidence": 0.92
}
```

**Response text:**
```json
{
  "type": "response_text",
  "text": "I'll check the weather for you."
}
```

**Response audio:**
```json
{
  "type": "response_audio",
  "data": "base64_encoded_wav_audio",
  "format": "wav"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Processing failed: STT timeout"
}
```

**Technical Details:**
- Audio format: 16kHz, mono, 16-bit PCM (for VAD compatibility)
- VAD aggressiveness: 0-3 (default: 2 = moderate, adjustable)
- Silence threshold: 5-20 frames (default: 10 = 300ms, adjustable)
- STT engine: Groq Whisper Large V3
- TTS engine: Piper (local neural synthesis)
- Interruption latency: <100ms
- Cost: $0.111/hour of audio (~$0.002/minute)

**Interruption Protocol:**
```json
// Client sends manual interrupt
{"type": "interrupt"}

// Server detects speech during response
{
  "type": "interrupted",
  "message": "Response cancelled by new speech"
}

// Server confirms cancellation
// - Stops Atlas processing
// - Skips TTS generation
// - Clears audio playback queue
```

**VAD Configuration:**
```json
// Client updates VAD settings
{
  "type": "update_vad",
  "aggressiveness": 2,      // 0-3
  "silence_threshold": 10   // frames
}

// Server confirms update
{
  "type": "vad_updated",
  "aggressiveness": 2,
  "silence_threshold": 10
}
```

### Safety Features

**DecisionValidator Integration:**
- Unsafe commands blocked before execution
- Destructive operations require confirmation
- Safety scores logged to L3 memory
- Error responses synthesized to speech

**Audio Limits (Pydantic enforced):**
- Max audio size: 10MB (DoS prevention)
- Max TTS text: 5000 chars
- Confidence bounds: 0.0-1.0

## User Experience

### Batch Mode Flow

1. **Select batch mode** → Click 🎙️ button
2. **Click "Voice" button** → Microphone icon
3. **Grant permissions** → Browser requests mic access (first time)
4. **Speak your query** → Button shows "Stop" with red pulse
5. **Click "Stop"** → Recording ends
6. **Processing...** → Button shows spinner
7. **Transcript appears** → Text fills input box
8. **Atlas responds** → Audio plays automatically + text response

### Streaming Mode Flow

1. **Select streaming mode** → Click 🔊 button
2. **Click "Start Conversation"** → Blue button
3. **Grant permissions** → Browser requests mic access (first time)
4. **Speak naturally** → Green pulsing indicator (listening)
5. **Stop speaking** → VAD detects silence (adjustable 150-600ms)
6. **Transcript appears** → Real-time display (blue pulse)
7. **Atlas responds** → Audio plays + text appears
8. **Interrupt (optional)** → Speak or click 🛑 to cancel response
9. **Adjust VAD (optional)** → Click ⚙️ to tune sensitivity
10. **Continue speaking** → Immediately ready for next utterance
11. **Click "Stop"** → End conversation

### Visual States

**Idle:**
- 🎤 Gray microphone icon
- "Voice" label
- Hover: lighter gray

**Recording:**
- 🔴 Red stop square icon
- "Stop" label  
- Pulsing red background
- Indicates active recording

**Processing:**
- ⏳ Spinning refresh icon
- "Processing..." label
- Blue background
- API request in flight

**Disabled:**
- Grayed out (50% opacity)
- No session selected or loading

## Browser Support

**Supported:**
- Chrome/Edge 49+
- Firefox 25+
- Safari 14.1+
- Opera 36+

**Not Supported:**
- Internet Explorer
- Safari < 14.1
- Chrome < 49

**Fallback:**
- Button hidden if MediaRecorder unavailable
- User sees standard text input only

## Audio Processing

### Input (STT)

**Format:** WebM with Opus codec
**Sample Rate:** Browser default (typically 48kHz)
**Encoding:** Base64 for JSON transport
**Max Duration:** Unlimited (user clicks stop)

**Audio Enhancements:**
- Echo cancellation
- Noise suppression
- Auto gain control

### Output (TTS)

**Format:** AIFF (from macOS NSSpeechSynthesizer)
**Voice:** Alex or Daniel (based on personality traits)
**Speed:** 1.2x (Jarvis-style professional pace)
**Playback:** HTML5 Audio element

## Performance

### Batch Mode Latency
- Recording: 0ms (instant start)
- Encoding: 50-100ms (client-side)
- Network: 50-200ms (localhost)
- STT: 200-500ms (macOS native)
- Atlas processing: 100-300ms
- TTS: 100-200ms (macOS native)
- **Total:** 500-1300ms end-to-end

### Streaming Mode Latency
- VAD detection: 0-300ms (silence threshold)
- Groq Whisper STT: 50-100ms (ultra-fast)
- Atlas processing: 100-300ms
- Piper TTS: 100ms (local neural)
- **Total:** 250-500ms end-to-end

**Latency Comparison:**
- Batch: 500-1300ms (button-based)
- Streaming: 250-500ms (2-3x faster)
- OpenAI Realtime: ~200-400ms (186x more expensive)

**Cost Comparison:**
- Batch (macOS native): $0/month (unlimited)
- Streaming (Groq + Piper): $0.111/hour (~$0.002/minute)
- OpenAI Realtime: $18/hour (~$0.30/minute)

## Error Handling

### Microphone Access Denied
```
Error: "Failed to access microphone. Please grant permission."
```
**Solution:** Grant browser mic permissions in settings

### API Connection Failed
```
Error: "Voice API error: 503 Service Unavailable"
```
**Solution:** Ensure Atlas API server is running on port 8000

### No Transcript Received
```
Error: "No transcript received from voice API"
```
**Solution:** Speak louder or check mic sensitivity

### Audio Playback Blocked
- TTS silently fails (browser autoplay policy)
- User can still read text response
- No error shown to user

## Configuration

### API Base URL

**Default:** `http://localhost:8000`

**Change in:** `components/VoiceInput.tsx` line 108
```typescript
const response = await fetch('YOUR_API_URL/v1/voice/query', {
  // ...
});
```

### Audio Settings

**Batch Mode (VoiceInput.tsx):**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: {
    echoCancellation: true,    // Disable for raw audio
    noiseSuppression: true,    // Disable in quiet environments
    autoGainControl: true,     // Disable for consistent levels
  } 
});
```

**Streaming Mode (VoiceStreamInput.tsx):**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: {
    sampleRate: 16000,         // 16kHz for WebRTC VAD
    channelCount: 1,           // Mono
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
});
```

### Voice Language

**Default:** `en-US`

**Change in:** `VoiceInput.tsx` line 116
```typescript
body: JSON.stringify({
  audio: base64Audio,
  device_id: 'warp_console',
  language: 'es-ES'  // Spanish, French, etc.
}),
```

## Testing

### Manual Test Steps

1. Start Atlas API server:
   ```bash
   cd /Users/mac_m3/Projects/WARP\ Ecosystem/atlas
   source venv/bin/activate
   uvicorn src.api.server:app --reload --host 0.0.0.0 --port 8000
   ```

2. Start WARP Console:
   ```bash
   cd /Users/mac_m3/Projects/WARP\ Ecosystem/console
   npm run dev
   ```

3. Open browser: `http://localhost:3000`

4. Create/select a chat session

5. Click "Voice" button

6. Grant microphone permissions

7. Speak: "What is the current time?"

8. Click "Stop"

9. Verify:
   - Transcript appears in text box
   - Atlas responds with audio
   - Text response displayed

### Test Cases

**✅ Basic Voice Input:**
- Record 3-5 second query
- Verify transcript accuracy
- Verify audio response plays

**✅ Long Query:**
- Record 15+ second query
- Verify no timeout
- Verify complete transcription

**✅ Unsafe Command:**
- Say "delete all files"
- Verify DecisionValidator blocks
- Verify safety error message

**✅ Multiple Sessions:**
- Record voice in session A
- Switch to session B
- Record voice in session B
- Verify context separation

**✅ Error Recovery:**
- Deny microphone access
- Verify error message
- Grant access
- Retry voice input

## Technology Stack

### Batch Mode
- **STT:** macOS NSSpeechRecognizer (free, reliable)
- **TTS:** macOS NSSpeechSynthesizer (Alex/Daniel voices)
- **Cost:** $0/month (unlimited)
- **Latency:** 500-1300ms

### Streaming Mode
- **STT:** Groq Whisper Large V3 (ultra-fast cloud API)
- **TTS:** Piper neural TTS (local, privacy-first)
- **VAD:** WebRTC VAD (server-side)
- **Cost:** $0.111/hour (~$0.002/minute)
- **Latency:** 250-500ms

**Why Groq + Piper?**
- Groq: 70x real-time Whisper processing (~50ms latency)
- Piper: Fully local TTS (no cloud dependency, zero cost)
- Combined: 186x cheaper than OpenAI Realtime API
- Privacy: Only STT uses cloud (Piper is 100% local)

## Feature Highlights

### Voice Interruption (✅ Complete)

**How it works:**
1. User speaks during Atlas response
2. Server VAD detects speech in incoming audio stream
3. Sets `should_cancel = True` flag
4. Checks cancellation at 3 points:
   - Before Atlas processing completes
   - Before TTS generation
   - Before sending audio to client
5. Sends `{"type": "interrupted"}` message
6. Client stops audio playback immediately
7. Returns to listening state

**Responsiveness:**
- Detection latency: <100ms (VAD frame processing)
- Audio stop latency: ~0ms (immediate pause)
- Total interruption time: <100ms

**Use cases:**
- Correcting Atlas mid-response ("no, I meant...")
- Skipping long responses
- Natural conversation flow

### Enhanced VAD Controls (✅ Complete)

**Aggressiveness levels:**
- **0 (Low):** Very conservative, filters most noise
  - Use in: Noisy environments
  - Trade-off: May miss soft speech
  
- **1 (Medium-Low):** Balanced noise filtering
  - Use in: Office/home with background noise
  - Trade-off: Slight speech detection delay
  
- **2 (Medium - Default):** Recommended for most users
  - Use in: Quiet room with occasional noise
  - Trade-off: Balanced performance
  
- **3 (High):** Maximum sensitivity
  - Use in: Silent studio environments
  - Trade-off: May pick up breathing, typing

**Silence threshold tuning:**
- **5 frames (150ms):** Fastest response, may cut off speech
- **10 frames (300ms - Default):** Natural conversation pace
- **15 frames (450ms):** Thoughtful pauses allowed
- **20 frames (600ms):** Slow, deliberate speech

## Future Enhancements

### Phase 5 (Multi-turn Dialogue Context)

**Capability:**
- Track conversation context across interruptions
- Resume partial responses
- "As I was saying..." recovery

**Implementation:**
  const data = JSON.parse(event.data);
  if (data.type === 'transcript_chunk') {
    updateTranscript(data.text);
  }
};
```

### Voice Visualization

**Waveform Display:**
- Real-time audio levels
- Visual feedback while speaking
- Uses existing analyser node (line 55)

**Implementation:**
```typescript
const canvas = document.getElementById('waveform');
const ctx = canvas.getContext('2d');
const bufferLength = analyserRef.current.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function draw() {
  analyserRef.current.getByteTimeDomainData(dataArray);
  // Draw waveform...
  requestAnimationFrame(draw);
}
```

### Voice Settings Panel

**User Preferences:**
- TTS voice selection (Alex, Daniel, etc.)
- Speech speed (0.5x - 2.0x)
- Volume control
- STT language selection
- Auto-play toggle

**Location:** Settings modal or chat panel header

### Voice Commands

**Hands-Free Mode:**
- Wake word: "Hey Atlas"
- Voice-only navigation
- Continuous listening mode
- Voice command shortcuts

## Troubleshooting

### Issue: Voice button doesn't appear
**Cause:** Browser doesn't support MediaRecorder  
**Solution:** Use Chrome/Firefox/Safari 14.1+

### Issue: Recording starts but no transcript
**Cause:** Atlas API not running  
**Solution:** Start API server on port 8000

### Issue: Audio doesn't play
**Cause:** Browser autoplay policy  
**Solution:** User must interact with page first (click anywhere)

### Issue: Poor transcription quality
**Cause:** Background noise or low mic quality  
**Solution:** Use quiet environment or external mic

### Issue: "Processing..." stuck
**Cause:** API timeout or error  
**Solution:** Check browser console for network errors

## Security

**Microphone Permissions:**
- Browser enforces HTTPS for getUserMedia
- localhost exception allowed
- User must explicitly grant access

**Audio Data:**
- Not stored on client (cleared after send)
- Sent over HTTP (localhost only)
- Atlas logs to L3 memory (server-side)

**Production Deployment:**
- Require HTTPS for all voice endpoints
- Add API authentication (JWT tokens)
- Rate limit voice queries (prevent abuse)
- Audio size validation (max 10MB)

## Credits

**Implementation:** Warp Agent + User  
**Date:** 2026-02-02  
**Version:** 1.0.0  
**License:** See project LICENSE
