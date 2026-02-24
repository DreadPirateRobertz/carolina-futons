/**
 * @module safeParse
 * @description Shared utility for safe JSON parsing with fallback and
 * optional error logging to errorMonitoring.
 */

/**
 * Safely parse a JSON string with fallback value and contextual logging.
 * @param {string} str - JSON string to parse
 * @param {*} fallback - Value returned on parse failure (default: null)
 * @param {string} [context] - Source context for error logging (e.g. "returnsService/formatReturn")
 * @returns {*} Parsed value or fallback
 */
export function safeParse(str, fallback = null, context) {
  if (str == null || str === '') return fallback;
  try {
    return JSON.parse(str);
  } catch (err) {
    if (context) {
      console.error(`[safeParse] Parse failure in ${context}:`, err.message);
      try {
        import('backend/errorMonitoring.web').then(({ logError }) => {
          logError({
            message: `JSON parse failure in ${context}`,
            stack: err.stack || String(err),
            page: '',
            context,
            severity: 'warning',
          });
        }).catch((logErr) => {
          console.warn(`[safeParse] Error monitoring unavailable:`, logErr?.message || logErr);
        });
      } catch (importErr) {
        console.warn(`[safeParse] Failed to import errorMonitoring:`, importErr?.message || importErr);
      }
    }
    return fallback;
  }
}
