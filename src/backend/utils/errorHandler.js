/**
 * Shared error handling utilities for backend web modules.
 * Provides structured error logging and async function wrapping
 * with consistent fallback behavior.
 */

/**
 * Log an error with structured context. Returns the error entry
 * for potential aggregation/monitoring.
 * @param {string} context - Where the error occurred (e.g., 'cartRecovery.recordAbandonedCart')
 * @param {Error|string} error - The error to log
 * @param {Object} [options]
 * @param {boolean} [options.silent=false] - If true, suppress console.error output
 * @returns {{ context: string, message: string, timestamp: string, stack?: string }}
 */
export function logError(context, error, { silent = false } = {}) {
  const entry = {
    context,
    message: error?.message || String(error),
    timestamp: new Date().toISOString(),
    stack: error?.stack || undefined,
  };
  if (!silent) console.error(`[${context}]`, entry.message);
  return entry;
}

/**
 * Wrap an async function with consistent error handling and fallback.
 * Use for backend webMethods where errors should return a safe default
 * rather than throwing.
 *
 * @param {Function} fn - The async function to wrap
 * @param {string} context - Error context label
 * @param {*} fallback - Value to return on error (or a function receiving the error)
 * @returns {Function} Wrapped async function
 *
 * @example
 * const safeGetBalance = withErrorBoundary(
 *   async (code) => { ... },
 *   'giftCards.checkBalance',
 *   { found: false }
 * );
 */
export function withErrorBoundary(fn, context, fallback) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      logError(context, err);
      return typeof fallback === 'function' ? fallback(err) : fallback;
    }
  };
}
