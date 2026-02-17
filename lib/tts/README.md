# TTS Provider System

Modular text-to-speech abstraction supporting multiple providers with zero code changes for switching.

## Providers

### OpenAI TTS (Default)
- **Latency**: ~1-2 seconds
- **Location**: Cloud API
- **Voices**: alloy, echo, fable, onyx (default), nova, shimmer
- **Cost**: $0.015 per 1K characters
- **Pros**: Fast, no setup required, high quality
- **Cons**: Requires internet, costs money, data sent to OpenAI

### Bettany JARVIS (Local)
- **Latency**: ~3-5 seconds (with warm server)
- **Location**: Local XTTS server
- **Voices**: Paul Bettany JARVIS clone
- **Cost**: Free (local inference)
- **Pros**: Custom voice, offline capable, free, private
- **Cons**: Requires local server, GPU recommended, higher latency

## Usage

### 1. Basic Usage (programmatic)

```typescript
import { TTSProviderFactory } from '@/lib/tts/providers';

// Get provider (reads from localStorage 'tts_provider' or defaults to 'openai')
const provider = TTSProviderFactory.getProvider();

// Synthesize speech
const audioData = await provider.synthesize("Hello world", {
  speed: 1.0,  // OpenAI: 0.25-4.0, Bettany: 0.5-2.0
});

// Play audio
const blob = new Blob([audioData], { type: 'audio/mpeg' }); // or 'audio/wav' for Bettany
const audio = new Audio(URL.createObjectURL(blob));
audio.play();
```

### 2. UI Selector Component

```typescript
import TTSProviderSelector from '@/components/TTSProviderSelector';

// In your settings page:
<TTSProviderSelector />
```

The selector:
- Shows available providers
- Lets users switch providers
- Tests latency with audio playback
- Persists choice to localStorage

### 3. Switching Providers

**Option A: UI Component (Recommended)**
1. Add `<TTSProviderSelector />` to settings
2. User clicks provider, choice saved to localStorage
3. All TTS calls use selected provider automatically

**Option B: Environment Variable**
```bash
# In .env.local
NEXT_PUBLIC_TTS_PROVIDER=bettany  # or 'openai'
```

**Option C: Programmatic**
```typescript
localStorage.setItem('tts_provider', 'bettany');
const provider = TTSProviderFactory.getProvider('bettany');
```

## Setup

### OpenAI (No setup required)
Just ensure `OPENAI_API_KEY` is set in `.env.local`

### Bettany (Requires setup)

1. **Start the JARVIS TTS Server**:
```bash
/Users/mac_m3/Projects/voice_training/venv/bin/python \
  /Users/mac_m3/Projects/voice_training/jarvis_tts_server.py
```

2. **(Optional) Configure server URL**:
```bash
# In .env.local (if server is on different host/port)
BETTANY_TTS_URL=http://192.168.1.100:5050
```

3. **Verify server is running**:
```bash
curl http://127.0.0.1:5050/health
# Should return: {"status": "ready"}
```

## API Routes

### `/api/tts/openai`
POST endpoint for OpenAI TTS
```json
{
  "text": "Hello world",
  "voice": "onyx",  // optional
  "speed": 1.0      // optional (0.25-4.0)
}
```

### `/api/tts/bettany`
POST endpoint for Bettany/XTTS TTS
```json
{
  "text": "Hello world",
  "speed": 1.1,           // optional (0.5-2.0)
  "temperature": 0.6,     // optional (0.1-1.0)
  "top_p": 0.8           // optional (0.1-1.0)
}
```

## Adding New Providers

1. **Create provider class** in `providers.ts`:
```typescript
export class NewProvider implements TTSProviderInterface {
  name = 'New Provider';
  
  async synthesize(text: string, config?: TTSConfig): Promise<ArrayBuffer> {
    // Implementation
  }
  
  async getVoices(): Promise<string[]> { return ['voice1']; }
  getDefaultVoice(): string { return 'voice1'; }
}
```

2. **Register in factory**:
```typescript
private static providers = new Map([
  ['openai', new OpenAITTSProvider()],
  ['bettany', new BettanyTTSProvider()],
  ['new', new NewProvider()],  // Add here
]);
```

3. **Create API route** at `/app/api/tts/new/route.ts`

4. **Update selector** in `getAllProviders()`:
```typescript
{ name: 'new', label: 'New Provider (Description)' }
```

Done! Provider is now available via UI and programmatically.

## Performance Comparison

| Provider | Cold Start | Warm Latency | Quality | Cost |
|----------|-----------|--------------|---------|------|
| OpenAI   | N/A       | 1-2s        | High    | $$$  |
| Bettany  | 20-30s    | 3-5s        | High    | Free |

**Recommendation**: 
- **Real-time chat**: Use OpenAI (default)
- **Batch processing**: Use Bettany
- **Custom voice needed**: Use Bettany
- **Offline required**: Use Bettany

## Troubleshooting

### "JARVIS TTS server not running"
Start the server:
```bash
/Users/mac_m3/Projects/voice_training/venv/bin/python \
  /Users/mac_m3/Projects/voice_training/jarvis_tts_server.py
```

### "TTS server timeout (60s)"
Text is too long or server is overloaded. Try shorter text or restart server.

### Bettany is slow (>10s)
- Server might be doing cold start (first request after boot)
- Check GPU availability: `nvidia-smi` (CUDA) or `mps` (Apple Silicon)
- Reduce text length

### Audio doesn't play
Check audio format:
- OpenAI returns `audio/mpeg` (MP3)
- Bettany returns `audio/wav` (WAV)

Ensure blob type matches:
```typescript
const blob = new Blob([audioData], { 
  type: provider.name === 'OpenAI TTS' ? 'audio/mpeg' : 'audio/wav' 
});
```
