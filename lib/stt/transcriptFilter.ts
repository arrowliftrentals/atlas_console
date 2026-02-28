/**
 * STT Transcript Noise Filter
 *
 * Detects non-speech audio artifacts (coughs, sneezes, throat clearing, etc.)
 * that ElevenLabs Scribe misclassifies as foreign-language text or garbled output.
 *
 * Instead of silently dropping these, we reclassify them as semantic labels so
 * ATLAS can respond contextually (e.g. "Are you okay, sir?").
 */

export interface TranscriptClassification {
  /** Whether the transcript is likely a non-speech noise artifact */
  isNoise: boolean;
  /** Original transcript text from STT */
  originalText: string;
  /**
   * Cleaned text to send downstream:
   * - If noise: a descriptive label like "[non-speech sound detected]"
   * - If speech: the original text unchanged
   */
  text: string;
  /** Why the classifier flagged it (for logging) */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Known noise labels that Scribe emits for non-speech sounds
// ---------------------------------------------------------------------------
const KNOWN_NOISE_LABELS = new Set([
  'foreign',
  '(foreign)',
  '[foreign]',
  'music',
  '(music)',
  '[music]',
  'applause',
  '(applause)',
  '[applause]',
  'laughter',
  '(laughter)',
  '[laughter]',
  'silence',
  '(silence)',
  '[silence]',
  'inaudible',
  '(inaudible)',
  '[inaudible]',
  'background noise',
  'noise',
]);

// ---------------------------------------------------------------------------
// Unicode ranges for Latin script (Basic Latin + Latin Extended)
// ---------------------------------------------------------------------------
const LATIN_RANGE = /[\u0000-\u024F]/;
const NON_LATIN_CHAR = /[^\u0000-\u024F\s\d.,!?'"()\-:;]/;

/**
 * Semantic label sent to ATLAS when a noise artifact is detected.
 * Phrased descriptively so the JARVIS personality can respond naturally.
 */
const NOISE_LABEL =
  '[The user made a non-speech sound — possibly a cough, sneeze, or throat clearing]';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a raw STT transcript as speech or noise artifact.
 *
 * Heuristics (any match → noise):
 *  1. Exact match against known Scribe noise labels ("foreign", etc.)
 *  2. Predominantly non-Latin characters when user language is Latin-script
 *  3. Very short garbled output (≤ 3 real characters after trimming)
 *  4. Single-word transcripts that are entirely non-Latin
 */
export function classifyTranscript(
  rawText: string,
  /** Expected language hint: 'en' | 'es' | 'auto'. Defaults to 'auto'. */
  languageHint: string = 'auto',
): TranscriptClassification {
  const trimmed = rawText.trim();

  // Empty transcripts are noise by definition
  if (!trimmed) {
    return { isNoise: true, originalText: rawText, text: '', reason: 'empty' };
  }

  const lower = trimmed.toLowerCase();

  // 1. Known noise labels (exact or near-exact)
  if (KNOWN_NOISE_LABELS.has(lower)) {
    return noise(rawText, `known_label:${lower}`);
  }

  // Also catch "foreign language" variants
  if (/^\(?foreign\s*(language)?\)?$/i.test(trimmed)) {
    return noise(rawText, 'foreign_language_variant');
  }

  // 2. Predominantly non-Latin when language is Latin-script based
  const expectLatin = languageHint === 'en' || languageHint === 'es' || languageHint === 'auto';
  if (expectLatin) {
    const letters = trimmed.replace(/[\s\d.,!?'"()\-:;]/g, '');
    if (letters.length > 0) {
      const nonLatinCount = (letters.match(new RegExp(NON_LATIN_CHAR.source, 'g')) || []).length;
      const ratio = nonLatinCount / letters.length;

      // If > 60% non-Latin characters, it's likely garbled output
      if (ratio > 0.6) {
        return noise(rawText, `non_latin_ratio:${(ratio * 100).toFixed(0)}%`);
      }
    }
  }

  // 3. Very short garbled output (≤ 2 real letters)
  const letterOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letterOnly.length <= 2 && trimmed.length <= 4) {
    // Allow common short words: "ok", "no", "hi", "go", "yes", etc.
    const shortWhitelist = new Set(['ok', 'no', 'hi', 'go', 'up', 'on', 'so', 'do', 'me', 'we', 'si', 'ya', 'ah', 'oh', 'uh']);
    if (!shortWhitelist.has(lower)) {
      return noise(rawText, `too_short:${trimmed.length}chars`);
    }
  }

  // 4. Single-word entirely non-Latin
  const words = trimmed.split(/\s+/);
  if (words.length === 1 && words[0].length > 0) {
    const w = words[0];
    const latinChars = (w.match(new RegExp(LATIN_RANGE.source, 'g')) || []).filter(
      (c) => /[a-zA-Z]/.test(c),
    ).length;
    if (latinChars === 0) {
      return noise(rawText, 'single_word_no_latin');
    }
  }

  // Passes all checks — it's real speech
  return { isNoise: false, originalText: rawText, text: trimmed };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function noise(originalText: string, reason: string): TranscriptClassification {
  return {
    isNoise: true,
    originalText,
    text: NOISE_LABEL,
    reason,
  };
}
