// Accurate simulation of React TTS implementation

const currentMessageRef = { content: "Good morning! How can I help you today?" };
let lastSpokenLength = 0;
let isPlaying = false;
let isSynthesizing = false;
const audioQueue = [];

const events = [];
function logEvent(msg) {
  const time = Date.now() - startTime;
  events.push({ time, msg });
  console.log(`[${time.toString().padStart(4, '0')}ms] ${msg}`);
}

async function synthesize(text) {
  logEvent(`Synthesize START: "${text.trim()}"`);
  await new Promise(resolve => setTimeout(resolve, 100));
  logEvent(`Synthesize END: "${text.trim()}"`);
  return { text, buffer: Buffer.from(text) };
}

async function playAudio(audioData) {
  isPlaying = true;
  const duration = audioData.text.length * 50;
  logEvent(`Playback START: "${audioData.text.trim()}" (${duration}ms)`);
  await new Promise(resolve => setTimeout(resolve, duration));
  logEvent(`Playback END: "${audioData.text.trim()}"`);
  isPlaying = false;
  
  // Trigger next immediately
  speakNext();
}

async function speakNext() {
  // Check if there's queued audio to play
  if (audioQueue.length > 0 && !isPlaying) {
    logEvent(`Queue: Playing queued audio (${audioQueue.length} in queue)`);
    const audioData = audioQueue.shift();
    await playAudio(audioData);
    return;
  }
  
  // Don't synthesize if already synthesizing or no more content
  if (!currentMessageRef || isSynthesizing) {
    return;
  }
  if (currentMessageRef.content.length <= lastSpokenLength) {
    logEvent('Done: All content spoken');
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
    
    if (isPlaying) {
      logEvent(`Queue: Audio playing, queuing "${textToSpeak.trim()}"`);
      audioQueue.push(audioData);
    } else {
      await playAudio(audioData);
    }
  } catch (error) {
    console.error('[Error]', error);
    isSynthesizing = false;
    isPlaying = false;
  }
  
  // Continue with next sentence (non-blocking)
  if (currentMessageRef && currentMessageRef.content.length > lastSpokenLength) {
    speakNext();
  }
}

console.log('============================================================');
console.log('Accurate TTS Pipeline Test');
console.log('Message:', currentMessageRef.content);
console.log('Sentence 1: "Good morning!" (14 chars, ~700ms playback)');
console.log('Sentence 2: "How can I help you today?" (25 chars, ~1250ms)');
console.log('============================================================\n');

const startTime = Date.now();

speakNext().then(() => {
  // Wait for all async operations to complete
  setTimeout(() => {
    const totalTime = Date.now() - startTime;
    console.log('\n============================================================');
    console.log('RESULTS');
    console.log('============================================================');
    console.log(`Total time: ${totalTime}ms`);
    console.log('');
    console.log('ANALYSIS:');
    
    // Find key events
    const synth1End = events.find(e => e.msg.includes('Synthesize END') && e.msg.includes('Good morning'));
    const play1Start = events.find(e => e.msg.includes('Playback START') && e.msg.includes('Good morning'));
    const play1End = events.find(e => e.msg.includes('Playback END') && e.msg.includes('Good morning'));
    const synth2Start = events.find(e => e.msg.includes('Synthesize START') && e.msg.includes('How can'));
    const synth2End = events.find(e => e.msg.includes('Synthesize END') && e.msg.includes('How can'));
    const play2Start = events.find(e => e.msg.includes('Playback START') && e.msg.includes('How can'));
    
    console.log(`Sentence 1 playback: ${play1Start.time}ms - ${play1End.time}ms (${play1End.time - play1Start.time}ms)`);
    console.log(`Sentence 2 synthesis: ${synth2Start.time}ms - ${synth2End.time}ms (${synth2End.time - synth2Start.time}ms)`);
    console.log(`Sentence 2 playback: ${play2Start.time}ms onwards`);
    console.log('');
    
    const gapBetweenSentences = play2Start.time - play1End.time;
    console.log(`Gap between sentences: ${gapBetweenSentences}ms`);
    
    if (synth2Start.time < play1End.time) {
      console.log('✓ PIPELINED: Synthesis of S2 started while S1 was playing');
      console.log(`  Overlap: ${play1End.time - synth2Start.time}ms`);
    } else {
      console.log('✗ NOT PIPELINED: Synthesis of S2 started after S1 finished');
      console.log(`  Gap: ${synth2Start.time - play1End.time}ms`);
    }
    
    console.log('============================================================');
  }, 2500);
});
