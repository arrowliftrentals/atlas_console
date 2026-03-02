
import React, { useState, useRef, useCallback } from 'react';

interface SampleQuality {
  sample_index: number;
  snr_db: number;
  inter_similarity: number;
  accepted: boolean;
  rejection_reason: string | null;
}

interface EnrollResult {
  success: boolean;
  voiceprint_id?: string;
  sample_count: number;
  per_sample_quality: SampleQuality[];
  overall_quality_score: number;
  message: string;
}

type EnrollStep = 'consent' | 'calibrate' | 'recording' | 'processing' | 'result';

const REQUIRED_SAMPLES = 4;
const SAMPLE_DURATION_MS = 8000; // 8 seconds per sample
const AMBIENT_DURATION_MS = 3000; // 3 seconds of room tone

/**
 * Phonetically diverse enrollment prompts.
 *
 * Each prompt is designed to cover a different region of the phonetic space
 * so the averaged voiceprint generalises across natural speech:
 *  1. Declarative — broad vowels, nasals, liquids
 *  2. Command — plosives, fricatives, sibilants
 *  3. Question — rising intonation, varied rhythm
 *  4. Conversational — natural pace, contractions, filler patterns
 */
const ENROLLMENT_PROMPTS: { label: string; text: string; tip: string }[] = [
  {
    label: 'Declarative',
    text: 'The quick brown fox jumps over the lazy dog near the calm river bank every morning.',
    tip: 'Read at a natural, steady pace — like narrating.',
  },
  {
    label: 'Command',
    text: 'Please start the backup process, check the system status, and verify the configuration files.',
    tip: 'Speak clearly and directly — like giving instructions.',
  },
  {
    label: 'Question',
    text: 'Should we update the project settings before running the deployment, or wait until after the review?',
    tip: 'Natural question tone — let your pitch rise at the end.',
  },
  {
    label: 'Conversational',
    text: "I was thinking about reorganizing that folder structure, but honestly we should probably just run the tests first.",
    tip: "Relaxed and casual — like you're talking to a colleague.",
  },
];

export default function VoiceEnrollment({
  onComplete,
  onCancel,
}: {
  onComplete?: (voiceprintId: string) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<EnrollStep>('consent');
  const [samples, setSamples] = useState<string[]>([]);
  const [currentSample, setCurrentSample] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<EnrollResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ambientSample, setAmbientSample] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrateProgress, setCalibrateProgress] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufferRef = useRef<Int16Array[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Record ambient room tone for noise calibration. */
  const startCalibration = useCallback(async () => {
    setError(null);
    setIsCalibrating(true);
    setCalibrateProgress(0);
    bufferRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const nativeSR = ctx.sampleRate;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const ratio = nativeSR / 16000;
        const outLen = Math.floor(input.length / ratio);
        const int16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const srcIdx = i * ratio;
          const lo = Math.floor(srcIdx);
          const hi = Math.min(lo + 1, input.length - 1);
          const frac = srcIdx - lo;
          const sample = input[lo] + frac * (input[hi] - input[lo]);
          const clamped = Math.max(-1, Math.min(1, sample));
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        bufferRef.current.push(int16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setCalibrateProgress(Math.min(elapsed / AMBIENT_DURATION_MS, 1));

        if (elapsed >= AMBIENT_DURATION_MS) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsCalibrating(false);
          setCalibrateProgress(1);

          // Merge buffer → base64
          const totalLen = bufferRef.current.reduce((s, c) => s + c.length, 0);
          const merged = new Int16Array(totalLen);
          let off = 0;
          for (const chunk of bufferRef.current) { merged.set(chunk, off); off += chunk.length; }
          const bytes = new Uint8Array(merged.buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i += 0x8000) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + 0x8000)) as unknown as number[]);
          }
          setAmbientSample(btoa(binary));

          // Cleanup audio
          processor.disconnect();
          stream.getTracks().forEach(t => t.stop());
          ctx.close();
          audioContextRef.current = null;
          bufferRef.current = [];

          // Advance to recording step
          setStep('recording');
        }
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Microphone access failed');
      setIsCalibrating(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    audioContextRef.current = null;
    processorRef.current = null;
    streamRef.current = null;
    bufferRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setIsRecording(true);
    setProgress(0);
    bufferRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      // Use the browser's native sample rate to avoid cross-rate connection errors,
      // then downsample to 16 kHz in the processor callback.
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const nativeSR = ctx.sampleRate;
      const source = ctx.createMediaStreamSource(stream);

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);

        // Downsample from native rate to 16 kHz via linear interpolation
        const ratio = nativeSR / 16000;
        const outLen = Math.floor(input.length / ratio);
        const int16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const srcIdx = i * ratio;
          const lo = Math.floor(srcIdx);
          const hi = Math.min(lo + 1, input.length - 1);
          const frac = srcIdx - lo;
          const sample = input[lo] + frac * (input[hi] - input[lo]);
          const clamped = Math.max(-1, Math.min(1, sample));
          int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        }
        bufferRef.current.push(int16);
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      // Progress timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setProgress(Math.min(elapsed / SAMPLE_DURATION_MS, 1));

        if (elapsed >= SAMPLE_DURATION_MS) {
          stopRecording();
        }
      }, 100);
    } catch (err: any) {
      setError(err.message || 'Microphone access failed');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setProgress(1);

    // Merge buffer
    const totalLen = bufferRef.current.reduce((sum, c) => sum + c.length, 0);
    const merged = new Int16Array(totalLen);
    let offset = 0;
    for (const chunk of bufferRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64
    const bytes = new Uint8Array(merged.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + 0x8000)) as unknown as number[]);
    }
    const b64 = btoa(binary);

    setSamples(prev => [...prev, b64]);
    setCurrentSample(prev => prev + 1);

    // Cleanup audio resources
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const submitEnrollment = useCallback(async () => {
    setStep('processing');
    setError(null);

    try {
      // Detect mic label
      let micLabel = 'unknown';
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mic = devices.find(d => d.kind === 'audioinput' && d.deviceId === 'default');
        if (mic?.label) micLabel = mic.label;
      } catch {}

      const resp = await fetch('/api/voiceprint/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_samples: samples,
          ambient_sample: ambientSample,
          sample_rate: 16000,
          user_id: 'owner',
          mic_device_label: micLabel,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || `Enrollment failed (${resp.status})`);
      }

      const data: EnrollResult = await resp.json();
      setResult(data);
      setStep('result');

      if (data.success && data.voiceprint_id) {
        onComplete?.(data.voiceprint_id);
      }
    } catch (err: any) {
      setError(err.message || 'Enrollment failed');
      setStep('recording');
    }
  }, [samples, ambientSample, onComplete]);

  // ---- Render ----

  if (step === 'consent') {
    return (
      <div className="space-y-4 p-4 border rounded-lg" style={{ backgroundColor: 'var(--atlas-bg-card)', borderColor: 'var(--atlas-border)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--atlas-text-primary)' }}>
          Voice Enrollment — Privacy Notice
        </div>
        <div className="text-xs space-y-2" style={{ color: 'var(--atlas-text-secondary)' }}>
          <p>ATLAS will create a voiceprint to verify your identity when using voice input. This ensures only your voice controls the system.</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your voiceprint is stored <strong>locally only</strong>, encrypted at rest</li>
            <li>It is <strong>never</strong> sent to external services</li>
            <li>You can delete it at any time from Voice Settings</li>
            <li>Raw audio samples are discarded after processing</li>
          </ul>
          <p>First, we&apos;ll record 3 seconds of room ambient to calibrate noise filtering. Then you&apos;ll record {REQUIRED_SAMPLES} voice samples with guided prompts.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setStep('calibrate')}
            className="px-4 py-2 text-xs font-medium rounded-lg text-white"
            style={{ backgroundColor: 'var(--atlas-accent-primary)' }}
          >
            I Consent — Begin Enrollment
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium rounded-lg"
              style={{ backgroundColor: 'var(--atlas-bg-subtle)', color: 'var(--atlas-text-secondary)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'calibrate') {
    return (
      <div className="space-y-4 p-4 border rounded-lg" style={{ backgroundColor: 'var(--atlas-bg-card)', borderColor: 'var(--atlas-border)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--atlas-text-primary)' }}>
          Ambient Noise Calibration
        </div>
        <div className="text-xs space-y-2" style={{ color: 'var(--atlas-text-secondary)' }}>
          <p>Stay quiet for 3 seconds so ATLAS can learn your room&apos;s background noise. This lets us filter it out of your voice samples.</p>
        </div>

        {isCalibrating && (
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--atlas-bg-subtle)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${calibrateProgress * 100}%`, backgroundColor: '#f59e0b' }}
            />
          </div>
        )}

        {isCalibrating && (
          <div className="flex items-center gap-2 text-xs" style={{ color: '#f59e0b' }}>
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            Listening to room ambient… stay quiet
          </div>
        )}

        {error && (
          <div className="text-xs p-2 rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2">
          {!isCalibrating && (
            <button
              onClick={startCalibration}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white"
              style={{ backgroundColor: '#f59e0b' }}
            >
              Start Calibration
            </button>
          )}
          {!isCalibrating && (
            <button
              onClick={() => setStep('recording')}
              className="px-4 py-2 text-xs font-medium rounded-lg"
              style={{ backgroundColor: 'var(--atlas-bg-subtle)', color: 'var(--atlas-text-secondary)' }}
            >
              Skip
            </button>
          )}
          {onCancel && !isCalibrating && (
            <button
              onClick={() => { cleanup(); onCancel(); }}
              className="px-4 py-2 text-xs font-medium rounded-lg"
              style={{ backgroundColor: 'var(--atlas-bg-subtle)', color: 'var(--atlas-text-secondary)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'recording') {
    const allCollected = currentSample >= REQUIRED_SAMPLES;
    return (
      <div className="space-y-4 p-4 border rounded-lg" style={{ backgroundColor: 'var(--atlas-bg-card)', borderColor: 'var(--atlas-border)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--atlas-text-primary)' }}>
          Record Voice Samples ({currentSample}/{REQUIRED_SAMPLES})
        </div>
        {allCollected ? (
          <div className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>
            All samples collected! Click &quot;Enroll&quot; to create your voiceprint.
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="text-xs font-medium px-2 py-0.5 rounded-full inline-block"
              style={{ backgroundColor: 'var(--atlas-bg-subtle)', color: 'var(--atlas-accent-primary)' }}
            >
              {ENROLLMENT_PROMPTS[currentSample].label}
            </div>
            <div
              className="text-sm leading-relaxed p-3 rounded-lg border italic"
              style={{
                backgroundColor: 'var(--atlas-bg-subtle)',
                borderColor: 'var(--atlas-border)',
                color: 'var(--atlas-text-primary)',
              }}
            >
              &ldquo;{ENROLLMENT_PROMPTS[currentSample].text}&rdquo;
            </div>
            <div className="text-xs" style={{ color: 'var(--atlas-text-muted)' }}>
              {ENROLLMENT_PROMPTS[currentSample].tip}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {isRecording && (
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--atlas-bg-subtle)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress * 100}%`, backgroundColor: '#ef4444' }}
            />
          </div>
        )}

        {/* Sample indicators */}
        <div className="flex gap-2">
          {Array.from({ length: REQUIRED_SAMPLES }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
              style={{
                backgroundColor: i < currentSample ? 'var(--atlas-accent-primary)' : 'var(--atlas-bg-subtle)',
                color: i < currentSample ? 'white' : 'var(--atlas-text-muted)',
              }}
            >
              {i < currentSample ? '✓' : i + 1}
            </div>
          ))}
        </div>

        {error && (
          <div className="text-xs p-2 rounded" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="flex gap-2">
          {!allCollected && !isRecording && (
            <button
              onClick={startRecording}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white"
              style={{ backgroundColor: '#ef4444' }}
            >
              🎤 Record Sample {currentSample + 1}
            </button>
          )}
          {isRecording && (
            <button
              onClick={stopRecording}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white animate-pulse"
              style={{ backgroundColor: '#ef4444' }}
            >
              ⬛ Recording...
            </button>
          )}
          {allCollected && (
            <button
              onClick={submitEnrollment}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white"
              style={{ backgroundColor: 'var(--atlas-accent-primary)' }}
            >
              Enroll Voiceprint
            </button>
          )}
          {onCancel && (
            <button
              onClick={() => { cleanup(); onCancel(); }}
              className="px-4 py-2 text-xs font-medium rounded-lg"
              style={{ backgroundColor: 'var(--atlas-bg-subtle)', color: 'var(--atlas-text-secondary)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="p-4 border rounded-lg text-center" style={{ backgroundColor: 'var(--atlas-bg-card)', borderColor: 'var(--atlas-border)' }}>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--atlas-text-primary)' }}>
          Processing Voiceprint...
        </div>
        <div className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>
          Extracting speaker embedding and validating quality
        </div>
        <div className="mt-3 animate-spin w-6 h-6 border-2 border-current border-t-transparent rounded-full mx-auto" style={{ color: 'var(--atlas-accent-primary)' }} />
      </div>
    );
  }

  // Result step
  return (
    <div className="space-y-3 p-4 border rounded-lg" style={{ backgroundColor: 'var(--atlas-bg-card)', borderColor: 'var(--atlas-border)' }}>
      <div className="text-sm font-semibold" style={{ color: result?.success ? 'var(--atlas-accent-primary)' : '#dc2626' }}>
        {result?.success ? '✓ Voiceprint Enrolled' : '✗ Enrollment Failed'}
      </div>
      <div className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>
        {result?.message}
      </div>

      {/* Per-sample quality */}
      {result?.per_sample_quality && result.per_sample_quality.length > 0 && (
        <div className="space-y-1">
          {result.per_sample_quality.map((sq) => (
            <div
              key={sq.sample_index}
              className="flex items-center gap-2 text-xs p-1 rounded"
              style={{ backgroundColor: sq.accepted ? 'var(--atlas-bg-subtle)' : '#fef2f2' }}
            >
              <span style={{ color: sq.accepted ? 'green' : '#dc2626' }}>
                {sq.accepted ? '✓' : '✗'}
              </span>
              <span style={{ color: 'var(--atlas-text-secondary)' }}>
                Sample {sq.sample_index + 1}: SNR {sq.snr_db.toFixed(1)}dB
                {sq.rejection_reason && ` — ${sq.rejection_reason}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {result?.success && result.overall_quality_score > 0 && (
        <div className="text-xs" style={{ color: 'var(--atlas-text-secondary)' }}>
          Quality score: {(result.overall_quality_score * 100).toFixed(0)}%
        </div>
      )}

      {!result?.success && (
        <button
          onClick={() => { setSamples([]); setCurrentSample(0); setStep('recording'); }}
          className="px-4 py-2 text-xs font-medium rounded-lg"
          style={{ backgroundColor: 'var(--atlas-bg-subtle)', color: 'var(--atlas-text-primary)' }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
