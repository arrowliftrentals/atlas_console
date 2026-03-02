/**
 * Voice Governance Runtime Guards (Frontend)
 * 
 * Client-side validation for ApprovedUtterance before sending to TTS.
 * Enforces Voice Governance Spec V1 (docs/governance/voice-governance.md).
 */

import { ApprovedUtterance } from './atlasClient';

/**
 * Voice subsystem health states per docs/ops/voice-fail-closed.md
 */
export enum VoiceHealth {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  RECOVERING = 'RECOVERING',
  LOCKED_OUT = 'LOCKED_OUT',
}

export interface VoiceHealthStatus {
  state: VoiceHealth;
  reason?: string;
  last_error?: string;
  degraded_at?: string;
}

/**
 * Validate ApprovedUtterance before sending to TTS
 * 
 * Enforces:
 * - V2 Speech Authority Invariant (approval stamp present)
 * - Content hash integrity
 * - Voice modality explicitly allowed
 * - assemble_context approval present
 * 
 * Throws Error if validation fails (fail-closed behavior)
 */
export async function validateUtteranceForSpeech(utterance: ApprovedUtterance): Promise<void> {
  // Check required fields present
  if (!utterance.utterance_id) {
    throw new Error('ApprovedUtterance missing utterance_id');
  }
  
  if (!utterance.content || utterance.content.trim() === '') {
    throw new Error('ApprovedUtterance has empty content');
  }
  
  if (!utterance.content_sha256) {
    throw new Error('ApprovedUtterance missing content_sha256');
  }
  
  // Check voice modality allowed
  if (!utterance.allowed_modalities || !utterance.allowed_modalities.includes('voice')) {
    throw new Error(
      `Voice modality not allowed for utterance ${utterance.utterance_id}. ` +
      `Allowed: ${JSON.stringify(utterance.allowed_modalities)}`
    );
  }
  
  // Check assemble_context approval
  if (!utterance.approved_by || !utterance.approved_by.includes('assemble_context')) {
    throw new Error(
      `Utterance ${utterance.utterance_id} not approved by assemble_context. ` +
      `Approved by: ${JSON.stringify(utterance.approved_by)}`
    );
  }
  
  // Verify content hash (client-side verification using Web Crypto API)
  const computedHash = await computeContentHashAsync(utterance.content);
  
  // Debug logging
  console.log('[Voice Governance] Hash verification:', {
    utterance_id: utterance.utterance_id,
    content_length: utterance.content.length,
    content_preview: utterance.content.substring(0, 50),
    expected_hash: utterance.content_sha256,
    computed_hash: computedHash,
    match: computedHash === utterance.content_sha256
  });
  
  if (computedHash !== utterance.content_sha256) {
    throw new Error(
      `Content hash mismatch for utterance ${utterance.utterance_id}. ` +
      `Expected: ${utterance.content_sha256}, Got: ${computedHash}. ` +
      `Speech output BLOCKED per Voice Governance Spec V1 §7.`
    );
  }
}

/**
 * Compute SHA-256 hash of content (client-side verification)
 * 
 * Uses Web Crypto API for hash computation
 */
async function computeContentHashAsync(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}


/**
 * Create VOICE_DEGRADED event log entry
 * 
 * Per Voice Governance Spec V1 §V4 (Auditability Invariant)
 */
export function createVoiceDegradedEvent(
  reason: string,
  error?: string,
  utterance_id?: string
): Record<string, any> {
  return {
    event_type: 'VOICE_DEGRADED',
    reason_code: reason,
    active_session_id: typeof window !== 'undefined' ? localStorage.getItem('atlas_session_id') : null,
    last_utterance_id: utterance_id,
    timestamp_ms: Date.now(),
    recovered: false,
    error_message: error,
  };
}

/**
 * Log voice event to console (for development)
 * In production, this should send to L3 episodic memory via API
 */
export function logVoiceEvent(
  event_type: string,
  utterance_id: string,
  details?: Record<string, any>
): void {
  const event = {
    event_type,
    utterance_id,
    timestamp: new Date().toISOString(),
    ...details,
  };
  
  console.log('[Voice Governance]', event);
  
  // TODO: Send to backend L3 episodic memory
  // POST /v1/memory/episodes with event data
}
