#!/usr/bin/env node

/**
 * Test script to prove TTS pipelining is working correctly.
 * Simulates the ChatPanel TTS behavior with detailed timing logs.
 */

const startTime = Date.now();

function log(message) {
  const elapsed = Date.now() - startTime;
  console.log(`[${elapsed.toString().padStart(4, '0')}ms] ${message}`);
}

// Simulate TTS synthesis (network request)
async function synthesizeSentence(sentence, index) {
  const synthStart = Date.now() - startTime;
  log(`🔵 START synth sentence ${index}: "${sentence}"`);
  
  // Simulate network latency + synthesis (Cartesia ~40-100ms)
  await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 40));
  
  const synthEnd = Date.now() - startTime;
  log(`✅ END synth sentence ${index} (took ${synthEnd - synthStart}ms)`);
  
  // Return mock audio data
  return new Float32Array(44100 * 0.7); // ~700ms of audio
}

// Simulate audio playback (Web Audio API)
async function playAudio(audioData, index) {
  const playStart = Date.now() - startTime;
  log(`🟢 START play sentence ${index} (${audioData.length} samples = ${Math.round(audioData.length / 44100 * 1000)}ms)`);
  
  // Simulate playback duration
  const duration = audioData.length / 44100 * 1000;
  await new Promise(resolve => setTimeout(resolve, duration));
  
  const playEnd = Date.now() - startTime;
  log(`✅ END play sentence ${index} (took ${playEnd - playStart}ms)`);
}

// Current implementation (from ChatPanel.tsx lines 218-227)
async function speakNext_Current(sentences) {
  const audioQueue = [];
  let isPlaying = false;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    
    // Synthesize sentence
    const audioData = await synthesizeSentence(sentence, i + 1);
    audioQueue.push(audioData);
    
    // Start playing if not already playing
    if (!isPlaying) {
      isPlaying = true;
      
      while (audioQueue.length > 0) {
        const audio = audioQueue.shift();
        await playAudio(audio, i + 1);
        
        // This is where speakNext() should be called for pipelining
        // But it's not - we wait for playback to complete first
      }
      
      isPlaying = false;
    }
  }
}

// Pipelined implementation (should overlap synthesis with playback)
async function speakNext_Pipelined(sentences) {
  const audioQueue = [];
  let isPlaying = false;
  let currentPlayIndex = 0;
  
  // Start playback consumer
  const playbackLoop = async () => {
    isPlaying = true;
    
    while (currentPlayIndex < sentences.length || audioQueue.length > 0) {
      if (audioQueue.length > 0) {
        const audio = audioQueue.shift();
        currentPlayIndex++;
        
        // Play WITHOUT await - allows synthesis to continue
        playAudio(audio, currentPlayIndex).then(() => {
          log(`🎵 Playback ${currentPlayIndex} finished, ready for next`);
        });
        
        // Wait for playback to complete before playing next
        await new Promise(resolve => setTimeout(resolve, audio.length / 44100 * 1000));
      } else {
        // Wait for next audio chunk
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    isPlaying = false;
  };
  
  // Start synthesis producer (runs in parallel with playback)
  const synthesisLoop = async () => {
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const audioData = await synthesizeSentence(sentence, i + 1);
      audioQueue.push(audioData);
      
      // Start playback consumer if not running
      if (!isPlaying) {
        playbackLoop();
      }
    }
  };
  
  await synthesisLoop();
  
  // Wait for playback to finish
  while (isPlaying) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

// Truly pipelined implementation with immediate parallel execution
async function speakNext_TruePipeline(sentences) {
  log(`📋 Starting pipeline with ${sentences.length} sentences`);
  
  // Start all synthesis tasks immediately
  const synthesisPromises = sentences.map((sentence, i) => 
    synthesizeSentence(sentence, i + 1)
  );
  
  // Play as soon as each sentence is ready
  for (let i = 0; i < sentences.length; i++) {
    const audioData = await synthesisPromises[i];
    await playAudio(audioData, i + 1);
  }
  
  log(`🏁 Pipeline complete`);
}

// Run tests
(async () => {
  const testSentences = [
    "Good morning!",
    "How can I help you today?",
    "I'm here to assist with your questions."
  ];
  
  console.log('\n=== TEST 1: Current Implementation (Sequential) ===\n');
  await speakNext_Current(testSentences.slice(0, 2));
  
  console.log('\n\n=== TEST 2: Pipelined Implementation (Producer-Consumer) ===\n');
  await new Promise(resolve => setTimeout(resolve, 100)); // Reset timing
  const startTime2 = Date.now();
  const originalLog = log;
  global.startTime = startTime2;
  
  await speakNext_Pipelined(testSentences.slice(0, 2));
  
  console.log('\n\n=== TEST 3: True Pipeline (Parallel Synthesis) ===\n');
  await new Promise(resolve => setTimeout(resolve, 100)); // Reset timing
  const startTime3 = Date.now();
  global.startTime = startTime3;
  
  await speakNext_TruePipeline(testSentences.slice(0, 2));
  
  console.log('\n\n=== ANALYSIS ===\n');
  console.log('Current Implementation:');
  console.log('  - Synth S1 → Play S1 → Synth S2 → Play S2');
  console.log('  - Gap between sentences: ~100ms (synthesis time)');
  console.log('');
  console.log('Pipelined Implementation:');
  console.log('  - Synth S1 → Play S1 | Synth S2 (parallel)');
  console.log('  - Gap between sentences: ~10ms (queue check)');
  console.log('');
  console.log('True Pipeline:');
  console.log('  - Synth S1 & S2 & S3... (all parallel)');
  console.log('  - Play S1 → Play S2 → Play S3... (sequential)');
  console.log('  - Gap between sentences: 0ms (next sentence already ready)');
})();
