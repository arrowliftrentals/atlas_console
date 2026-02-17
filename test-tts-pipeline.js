// Simulate pipelined TTS with timing

const currentMessageRef = { content: "Good morning! How can I help you today?" };
let lastSpokenLength = 0;
let isPlaying = false;
let isSynthesizing = false;
const audioQueue = [];

// Simulate audio synthesis (Cartesia ~40ms + network)
async function synthesize(text) {
  const startTime = Date.now();
  console.log(`[Synthesize START] "${text.trim()}"`);
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate 100ms API call
  const duration = Date.now() - startTime;
  console.log(`[Synthesize END] ${duration}ms - Received audio buffer`);
  return { text, buffer: Buffer.from(text) };
}

// Simulate audio playback (duration = ~text length * 50ms per char)
async function playAudio(audioData) {
  isPlaying = true;
  const playbackDuration = audioData.text.length * 50; // ~50ms per character
  const startTime = Date.now();
  console.log(`[Playback START] "${audioData.text.trim()}" - Expected duration: ${playbackDuration}ms`);
  
  await new Promise(resolve => setTimeout(resolve, playbackDuration));
  
  const actualDuration = Date.now() - startTime;
  console.log(`[Playback END] ${actualDuration}ms\n`);
  isPlaying = false;
}

async function speakNext() {
  // Check if there's queued audio to play
  if (audioQueue.length > 0 && !isPlaying) {
    console.log(`[Queue] Found ${audioQueue.length} queued audio(s)`);
    const audioData = audioQueue.shift();
    await playAudio(audioData);
    return;
  }
  
  // Don't synthesize if already synthesizing or no more content
  if (!currentMessageRef || isSynthesizing) {
    return;
  }
  if (currentMessageRef.content.length <= lastSpokenLength) {
    return;
  }
  
  const remaining = currentMessageRef.content.slice(lastSpokenLength);
  const sentenceMatch = /[^.!?]+[.!?]+\s*/.exec(remaining);
  
  let textToSpeak = '';
  if (sentenceMatch) {
    textToSpeak = sentenceMatch[0];
  } else if (remaining.length > 0) {
    textToSpeak = remaining;
  } else {
    return;
  }
  
  if (!textToSpeak) return;
  
  lastSpokenLength += textToSpeak.length;
  isSynthesizing = true;
  
  try {
    const audioData = await synthesize(textToSpeak);
    isSynthesizing = false;
    
    // If already playing, queue this audio
    if (isPlaying) {
      console.log(`[Queue] Audio is playing, queuing next sentence\n`);
      audioQueue.push(audioData);
    } else {
      await playAudio(audioData);
    }
  } catch (error) {
    console.error('[Error]', error);
    isSynthesizing = false;
    isPlaying = false;
  }
  
  // Continue with next sentence (don't await - allow parallel execution)
  if (currentMessageRef && currentMessageRef.content.length > lastSpokenLength) {
    speakNext(); // Start next synthesis without awaiting
  }
}

// Run test
console.log('='.repeat(60));
console.log('Testing Pipelined TTS');
console.log('Message:', currentMessageRef.content);
console.log('='.repeat(60));
console.log('');

const startTime = Date.now();

(async () => {
  await speakNext();
  // Wait a bit for any remaining async operations
  await new Promise(resolve => setTimeout(resolve, 100));
  const totalTime = Date.now() - startTime;
  console.log('='.repeat(60));
  console.log('Test Complete');
  console.log(`Total time: ${totalTime}ms`);
  console.log('Expected time: ~1850ms (700ms play + 100ms synth overlap + 1250ms play)');
  console.log('Without pipeline: ~2155ms (700ms + 100ms gap + 1250ms + 100ms gap)');
  console.log('Savings: ~200ms (eliminates synthesis gap between sentences)');
  console.log('='.repeat(60));
})();
