// lib/session.ts
/**
 * Session management utilities for Atlas Console
 * Handles persistent session_id storage across page refreshes
 *
 * SECURITY NOTE: session_id is stored in localStorage for conversation continuity.
 * It is NOT an authentication token. The backend must enforce that session_id
 * belongs to the authenticated user if accessing protected data.
 */

const SESSION_STORAGE_KEY = 'atlas_session_id';

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
    const inBrowser =
        typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    if (!inBrowser) {
        // Debug: log once per call site to see SSR vs browser usage
        // eslint-disable-next-line no-console
        console.debug('[session] isBrowser() = false (likely SSR or non-browser env)');
    }
    return inBrowser;
}

/**
 * Create a random session ID
 * Uses crypto.randomUUID() if available, with fallback for older browsers
 */
function createRandomId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Get the stored session ID from localStorage
 * Returns null if not in browser or if no session exists
 */
export function getStoredSessionId(): string | null {
    if (!isBrowser()) {
        // eslint-disable-next-line no-console
        console.debug('[session] getStoredSessionId(): not in browser, returning null');
        return null;
    }
    try {
        const value = window.localStorage.getItem(SESSION_STORAGE_KEY);
        // eslint-disable-next-line no-console
        console.debug('[session] getStoredSessionId(): existing value =', value);
        return value;
    } catch (err) {
        console.warn('Failed to read session_id from localStorage', err);
        return null;
    }
}

/**
 * Store a session ID in localStorage
 */
export function storeSessionId(sessionId: string): void {
    if (!isBrowser()) {
        // eslint-disable-next-line no-console
        console.debug(
            '[session] storeSessionId(): not in browser, skipping localStorage write for',
            sessionId,
        );
        return;
    }
    try {
        window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
        // eslint-disable-next-line no-console
        console.debug('[session] storeSessionId(): stored session_id =', sessionId);
    } catch (err) {
        console.warn('Failed to store session_id in localStorage', err);
    }
}

/**
 * Get existing session ID or create a new one.
 *
 * IMPORTANT:
 * - Always returns a non-empty string (even during SSR).
 * - Only reads/writes localStorage when in a real browser.
 * - This ensures the backend always receives a session_id so it can
 *   maintain history, while still being safe for SSR.
 */
export function getOrCreateSessionId(): string {
    const inBrowser = isBrowser();

    if (inBrowser) {
        const existing = getStoredSessionId();
        if (existing) {
            // eslint-disable-next-line no-console
            console.debug('[session] getOrCreateSessionId(): using existing browser session_id =', existing);
            return existing;
        }
    }

    // Generate new session ID (works in both browser and SSR)
    const newId = createRandomId();
    // eslint-disable-next-line no-console
    console.debug(
        '[session] getOrCreateSessionId(): generated new session_id =',
        newId,
        ' (inBrowser =',
        inBrowser,
        ')',
    );

    // Persist only if we are in the browser
    if (inBrowser) {
        storeSessionId(newId);
    }

    return newId;
}

/**
 * Clear the stored session ID (e.g., for logout or new session)
 */
export function clearSessionId(): void {
    if (!isBrowser()) return;
    try {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
        console.warn('Failed to clear session_id from localStorage');
    }
}
