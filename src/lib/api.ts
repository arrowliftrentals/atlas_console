/**
 * Centralized ATLAS backend URL configuration.
 *
 * HTTP requests from client-side components should use **relative URLs**
 * (e.g. "/v1/classify/stats") so they route through the Next.js rewrite
 * proxy defined in next.config.js. This avoids CORS issues and keeps the
 * backend unexposed to the browser in production.
 *
 * WebSocket connections cannot be proxied by Next.js rewrites, so they
 * must connect directly to the backend using {@link getAtlasWsUrl}.
 */

/**
 * Absolute base URL for the ATLAS backend.
 *
 * - Used by server-side code and WebSocket connections.
 * - Client-side HTTP fetches should use relative URLs instead.
 * - Set NEXT_PUBLIC_ATLAS_API_URL in the environment to override.
 */
export const ATLAS_API_URL =
  import.meta.env.VITE_ATLAS_API_URL || "http://127.0.0.1:8000";

/**
 * Build a WebSocket URL for the given backend path.
 *
 * WebSocket connections now go through the Express proxy at localhost:3000
 * for security (no direct backend URL exposure to browser).
 *
 * @example
 * getAtlasWsUrl("/v1/telemetry/stream")
 * // → "ws://localhost:3000/v1/telemetry/stream" (dev)
 * // → "wss://console.example.com/v1/telemetry/stream" (prod)
 */
export function getAtlasWsUrl(path: string): string {
  // In production, use same host as current page
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path}`;
  }
  // Fallback for SSR (shouldn't happen with Vite)
  return `ws://localhost:3000${path}`;
}
