import { logError } from 'backend/utils/errorHandler';

// CORS allowlist + helpers for Velo HTTP Functions (/_functions/*).
//
// The carolina-futons-web Next.js app (and its Vercel preview URLs) needs to
// call these endpoints cross-origin. Browsers enforce the CORS protocol, so
// every response must carry Access-Control-Allow-Origin (ACAO) and the handful
// of related headers — and preflight OPTIONS requests must return 204 with
// those headers set.
//
// Allowed origins:
//   - Production Vercel domain:     https://carolina-futons-web.vercel.app
//   - Project-scoped Vercel domain: https://carolina-futons-web-dreadpiraterobertzs-projects.vercel.app
//   - Per-branch preview URLs:      https://carolina-futons-web-git-<branch>-dreadpiraterobertzs-projects.vercel.app
//   - Local dev:                    http://localhost:3000
//
// Usage in a Velo HTTP function:
//   import { ok, response } from 'wix-http-functions';
//   import { corsHeaders, corsPreflight } from 'backend/utils/cors';
//
//   export function get_health(request) {
//     return ok({
//       body: JSON.stringify({ status: 'ok' }),
//       headers: corsHeaders(request, { 'Content-Type': 'application/json' }),
//     });
//   }
//
//   export function options_health(request) {
//     return corsPreflight(request);
//   }

const EXACT_ORIGINS = [
  'https://carolina-futons-web.vercel.app',
  'https://carolina-futons-web-dreadpiraterobertzs-projects.vercel.app',
  'http://localhost:3000',
];

const WILDCARD_ORIGIN_PATTERN =
  /^https:\/\/carolina-futons-web-git-[a-z0-9-]+-dreadpiraterobertzs-projects\.vercel\.app$/;

/**
 * Returns the origin to echo back in Access-Control-Allow-Origin if the
 * request's Origin header matches the allowlist. Returns null otherwise.
 *
 * @param {import('wix-http-functions').WixHttpFunctionRequest | { headers?: Record<string, string> }} request
 * @returns {string | null}
 */
export function allowOrigin(request) {
  const origin = request?.headers?.origin || request?.headers?.Origin;
  if (!origin) return null;
  if (EXACT_ORIGINS.includes(origin)) return origin;
  if (WILDCARD_ORIGIN_PATTERN.test(origin)) return origin;
  return null;
}

// Distinguishes a request with no Origin header (same-origin / server-to-server)
// from one whose Origin was present but not allowlisted. Only the latter is
// an observability signal — emit a log so rejected cross-origin traffic shows
// up in the Velo console without polluting normal same-origin traffic.
function _checkOrigin(request, scope) {
  const raw = request?.headers?.origin || request?.headers?.Origin || null;
  const allowed = allowOrigin(request);
  if (!allowed && raw) {
    logError(`cors.originRejected.${scope}`, `Origin not in allowlist: ${raw}`);
  }
  return allowed;
}

/**
 * Returns a headers object with CORS fields populated if the request's origin
 * is allowed. Merges with any extra headers (e.g., Content-Type).
 *
 * If the origin isn't allowed, CORS headers are omitted — same-origin and
 * server-to-server callers still get a valid response, they just don't get
 * ACAO set (which is correct — echoing back a disallowed origin would defeat
 * the allowlist).
 *
 * @param {{ headers?: Record<string, string> }} request
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Record<string, string>}
 */
export function corsHeaders(request, extraHeaders = {}) {
  const origin = _checkOrigin(request, 'headers');
  if (!origin) return { ...extraHeaders };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Content-Type, X-Request-Id',
    Vary: 'Origin',
    ...extraHeaders,
  };
}

/**
 * Returns a preflight response for an OPTIONS request. Returns 204 with the
 * CORS headers if the origin is allowed, or 403 otherwise.
 *
 * @param {{ headers?: Record<string, string> }} request
 * @returns {{ status: number, headers: Record<string, string> }}
 */
export function corsPreflight(request) {
  const origin = _checkOrigin(request, 'preflight');
  if (!origin) {
    return { status: 403, headers: { 'Content-Type': 'text/plain' }, body: 'Origin not allowed' };
  }
  return {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

export const __TEST__ = { EXACT_ORIGINS, WILDCARD_ORIGIN_PATTERN };
