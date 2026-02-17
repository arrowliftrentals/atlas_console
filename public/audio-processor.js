/**
 * AudioWorklet Processor for ElevenLabs STT
 * Extracts raw PCM audio from microphone input and sends to main thread
 */

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // Process in 4096 sample chunks
    this.buffer = [];
    this.targetSampleRate = 16000; // ElevenLabs expects 16kHz
    this.downsampleRatio = Math.round(sampleRate / this.targetSampleRate);
  }

  process(inputs, outputs, parameters) {
    try {
      const input = inputs[0];
      
      // If no input or no channels, skip
      if (!input || !input.length) {
        return true;
      }
      
      // Get first channel (mono)
      const inputChannel = input[0];
      
      // Validate input channel
      if (!inputChannel || inputChannel.length === 0) {
        return true;
      }
      
      // Downsample from 48kHz (typical) to 16kHz
      for (let i = 0; i < inputChannel.length; i += this.downsampleRatio) {
        const sample = inputChannel[i];
        
        // Skip NaN or invalid samples
        if (isNaN(sample) || !isFinite(sample)) {
          continue;
        }
        
        this.buffer.push(sample);
        
        // Send buffer when we have enough samples
        if (this.buffer.length >= this.bufferSize) {
          // Convert Float32 to Int16 PCM
          const int16Array = new Int16Array(this.buffer.length);
          for (let j = 0; j < this.buffer.length; j++) {
            // Clamp to [-1, 1] and convert to 16-bit integer
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            int16Array[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send to main thread
          this.port.postMessage({
            type: 'audio',
            data: int16Array.buffer,
          }, [int16Array.buffer]); // Transfer ownership for efficiency
          
          this.buffer = [];
        }
      }
      
      return true; // Keep processor alive
    } catch (error) {
      // Log error but keep processor alive
      console.error('[AudioWorklet] Error processing audio:', error);
      return true;
    }
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
