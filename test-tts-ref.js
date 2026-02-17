// Simulate the TTS logic with ref pattern

const currentMessageRef = { content: "Good morning! How can I help you today?" };
let lastSpokenLength = 0;
let isPlaying = false;

async function speakNext() {
  if (isPlaying || !currentMessageRef) {
    console.log('Blocked: isPlaying =', isPlaying, ', hasRef =', !!currentMessageRef);
    return;
  }
  
  const remaining = currentMessageRef.content.slice(lastSpokenLength);
  console.log(`\nRemaining (from pos ${lastSpokenLength}):`, JSON.stringify(remaining));
  
  const sentenceMatch = /[^.!?]+[.!?]+\s*/.exec(remaining);
  let textToSpeak = '';
  
  if (sentenceMatch) {
    textToSpeak = sentenceMatch[0];
  } else if (remaining.length > 0) {
    textToSpeak = remaining;
  } else {
    console.log('No more content to speak');
    return;
  }
  
  if (!textToSpeak) {
    console.log('Empty textToSpeak');
    return;
  }
  
  console.log('Speaking:', JSON.stringify(textToSpeak));
  lastSpokenLength += textToSpeak.length;
  isPlaying = true;
  
  // Simulate audio playback
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Simulate onended callback
  isPlaying = false;
  console.log('Finished speaking. Total spoken:', lastSpokenLength, '/', currentMessageRef.content.length);
  
  // Check if more content
  if (currentMessageRef && currentMessageRef.content.length > lastSpokenLength) {
    console.log('More content available, calling speakNext recursively...');
    await speakNext();
  } else {
    console.log('All content spoken!');
  }
}

// Run test
console.log('Full message:', currentMessageRef.content);
console.log('Length:', currentMessageRef.content.length);
console.log('='.repeat(50));

speakNext().then(() => {
  console.log('='.repeat(50));
  console.log('Test complete');
  console.log('Final lastSpokenLength:', lastSpokenLength);
  console.log('Message length:', currentMessageRef.content.length);
  console.log('Fully spoken?', lastSpokenLength === currentMessageRef.content.length);
});
