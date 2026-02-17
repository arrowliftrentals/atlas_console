// Test TTS sentence splitting logic

const text = "Good morning! How can I help you today?";
let lastSpokenLength = 0;

console.log('Full text:', text);
console.log('Length:', text.length);
console.log('---');

// First iteration
let newContent = text.slice(lastSpokenLength);
console.log('\nIteration 1:');
console.log('New content:', newContent);

const sentenceMatch1 = /[^.!?]+[.!?]+\s*/.exec(newContent);
console.log('Sentence match:', sentenceMatch1 ? sentenceMatch1[0] : 'NO MATCH');
console.log('Match length:', sentenceMatch1 ? sentenceMatch1[0].length : 0);

if (sentenceMatch1) {
  lastSpokenLength += sentenceMatch1[0].length;
  console.log('Updated lastSpokenLength:', lastSpokenLength);
}

// Second iteration
newContent = text.slice(lastSpokenLength);
console.log('\nIteration 2:');
console.log('New content:', newContent);
console.log('Has more content?', text.length > lastSpokenLength);

const sentenceMatch2 = /[^.!?]+[.!?]+\s*/.exec(newContent);
console.log('Sentence match:', sentenceMatch2 ? sentenceMatch2[0] : 'NO MATCH');
console.log('Match length:', sentenceMatch2 ? sentenceMatch2[0].length : 0);

if (sentenceMatch2) {
  lastSpokenLength += sentenceMatch2[0].length;
  console.log('Updated lastSpokenLength:', lastSpokenLength);
}

console.log('\nFinal state:');
console.log('Total spoken:', lastSpokenLength);
console.log('Total length:', text.length);
console.log('Fully spoken?', lastSpokenLength === text.length);
