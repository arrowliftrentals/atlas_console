/**
 * TTS Text Sanitizer
 *
 * Converts raw markdown / technical output from ATLAS into clean,
 * naturally speakable prose for TTS synthesis.
 *
 * The visual display still shows full markdown — this only affects
 * what gets sent to the voice engine.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitize text for TTS consumption.
 *
 * Strips markdown formatting, code blocks, raw metric dumps,
 * file paths, URLs, and other artifacts that sound unnatural
 * when read aloud by a speech synthesizer.
 */
export function sanitizeForTTS(raw: string): string {
  let text = raw;

  // 0a. Strip <think>...</think> blocks (reasoning model internal monologue)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, ' ');

  // 0b. Strip other reasoning model tags (<reasoning>, <reflection>, <internal>)
  text = text.replace(/<(?:reasoning|reflection|internal|thought)>[\s\S]*?<\/(?:reasoning|reflection|internal|thought)>/gi, ' ');

  // 0c. Strip leading thinking preamble lines ("Understanding your question...",
  //     "Reasoning through...", "Let me analyze...", etc.)
  //     These are LLM-generated internal monologue that leaked into the answer.
  text = text.replace(
    /^(?:Understanding your (?:question|query|request)|Reasoning through|Let me (?:analyze|think|consider|examine|look)|I need to (?:gather|analyze|think|consider|examine)|Gathering (?:information|data|metrics|performance)|Analyzing (?:performance|data|the)|Measuring (?:component|performance))[^.]*\.\s*/gim,
    ''
  );

  // 1. Remove fenced code blocks entirely (```...```)
  text = text.replace(/```[\s\S]*?```/g, ' ');

  // 2. Remove inline code backticks, keep inner text
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Remove markdown images ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

  // 4. Convert markdown links [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  // 5. Strip markdown headers (# through ######)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 6. Strip bold/italic markers
  text = text.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  text = text.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

  // 7. Strip horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // 8. Strip bullet / numbered list markers (keep the text)
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');

  // 9. Strip blockquote markers
  text = text.replace(/^\s*>\s?/gm, '');

  // 10. Remove parenthetical metric dumps
  //     e.g. (p50 3050 ms, p95 178554 ms, max 178895 ms)
  text = text.replace(/\([^)]*(?:p\d+|p50|p95|p99|ms\b|MB\b|GB\b|KB\b)[^)]*\)/g, '');

  // 11. Remove standalone metric expressions like "p50 3446 ms"
  //     that aren't inside parentheses (already caught above)
  text = text.replace(/\bp\d+\s+\d[\d,]*\s*(?:ms|s)\b/gi, '');

  // 12a. File paths with :line_number and optional line ranges
  //      e.g. src/ai/bert_classifier.py:117 → bert classifier
  //      e.g. src/governance/audit_log.py:418, 422-426, 430-434 → audit log
  text = text.replace(
    /(?:[\w\-.]+\/)+[\w\-.]+\.\w+:\d+(?:\s*,\s*\d+(?:-\d+)?)*/g,
    (match) => {
      const pathPart = match.split(':')[0];
      const segments = pathPart.split('/');
      const last = segments[segments.length - 1]
        .replace(/\.\w+$/, '')
        .replace(/[_-]/g, ' ');
      return last;
    },
  );

  // 12b. Glob paths: src/memory/* → memory
  text = text.replace(
    /(?:[\w\-.]+\/)+\*/g,
    (match) => {
      const segments = match.replace(/\/\*$/, '').split('/');
      return segments[segments.length - 1].replace(/[_-]/g, ' ');
    },
  );

  // 12c. Standard file paths without line numbers
  //      e.g. src/orchestrator/intent_router.py → intent router
  text = text.replace(
    /(?:[\w\-.]+\/)+[\w\-.]+(?:\.\w+)?/g,
    (match) => {
      const segments = match.split('/');
      const last = segments[segments.length - 1]
        .replace(/\.\w+$/, '')  // strip extension
        .replace(/[_-]/g, ' '); // underscores/hyphens to spaces
      return last;
    },
  );

  // 12d. CWE identifiers: (CWE-502) → remove entirely (visual-only context)
  text = text.replace(/\(CWE-\d+\)/gi, '');
  text = text.replace(/CWE-\d+/gi, '');

  // 12e. Standalone snake_case identifiers (code terms after backtick removal)
  //      e.g. state_dict → state dict, shell_exec → shell exec
  //      Only match 2+ segments joined by underscores (avoid false positives)
  text = text.replace(/\b([a-z]+(?:_[a-z]+)+)\b/g, (match) => match.replace(/_/g, ' '));

  // 13. Remove raw URLs
  text = text.replace(/https?:\/\/\S+/g, '');

  // 14. Convert common abbreviations to speakable forms
  text = text.replace(/\bms\b/g, 'milliseconds');
  text = text.replace(/\bMB\b/g, 'megabytes');
  text = text.replace(/\bGB\b/g, 'gigabytes');
  text = text.replace(/\bKB\b/g, 'kilobytes');
  text = text.replace(/\bCPU\b/g, 'CPU');
  text = text.replace(/\bETA\b/g, 'E.T.A.');

  // 15. Strip table formatting (pipes and alignment rows)
  text = text.replace(/^\|.*\|$/gm, (line) => {
    // Skip alignment rows (|---|---|)
    if (/^[\s|:-]+$/.test(line)) return '';
    // Extract cell contents
    return line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(', ');
  });

  // 16. Collapse multiple whitespace / newlines into single space
  text = text.replace(/\n{2,}/g, '. ');
  text = text.replace(/\n/g, ' ');
  text = text.replace(/\s{2,}/g, ' ');

  // 17. Clean up artifacts: double periods, orphaned punctuation
  text = text.replace(/\.\s*\./g, '.');
  text = text.replace(/,\s*\./g, '.');
  text = text.replace(/\(\s*\)/g, '');    // empty parens
  text = text.replace(/,\s*,/g, ',');     // double commas
  text = text.replace(/\s+([.,;:!?])/g, '$1'); // space before punctuation

  return text.trim();
}
