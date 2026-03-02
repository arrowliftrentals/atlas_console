/* global AudioWorkletProcessor, registerProcessor, sampleRate */
/* Echo-aware mic capture for STT: 48k → 16k downsample, 20ms frames, gated */
class EchoAwareCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.downBuf = [];
    this.gate = false; // when true, suppress (likely echo)
    this.DOWNSAMPLE = Math.max(1, Math.round(sampleRate / 16000)); // ≈3 for 48k→16k
    this.FRAME_16K = 320; // 20 ms at 16 kHz

    this.port.onmessage = (ev) => {
      const { type, block } = ev.data || {};
      if (type === 'gate') {
        const prev = this.gate;
        this.gate = !!block;
        // Notify main thread of gate state transitions
        if (prev !== this.gate) {
          this.port.postMessage({ type: 'echo_gate_state', blocked: this.gate });
        }
      }
    };
  }

  process(inputs) {
    const input = inputs?.[0]?.[0];
    if (!input) return true;

    // Naive decimation 48k→16k (AEC still works upstream)
    for (let i = 0; i < input.length; i += this.DOWNSAMPLE) {
      this.downBuf.push(input[i]);
      if (this.downBuf.length >= this.FRAME_16K) {
        if (!this.gate) {
          // Convert Float32 → Int16 PCM (little-endian)
          const frame = this.downBuf.splice(0, this.FRAME_16K);
          const out = new Int16Array(frame.length);
          for (let j = 0; j < frame.length; j++) {
            const s = Math.max(-1, Math.min(1, frame[j]));
            out[j] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          this.port.postMessage({ type: 'audio', data: out.buffer }, [out.buffer]);
        } else {
          // Drop 20ms likely-echo frame
          this.downBuf.splice(0, this.FRAME_16K);
        }
      }
    }

    return true;
  }
}

registerProcessor('echo-aware-capture', EchoAwareCapture);
