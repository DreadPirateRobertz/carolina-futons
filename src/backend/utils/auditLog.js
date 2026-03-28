/**
 * @file auditLog.js
 * @description Centralized audit logging for anonymous CMS writes.
 *
 * Records who wrote what, when, to which collection — providing an audit trail
 * for all Permissions.Anyone endpoints. Fire-and-forget: failures are logged
 * but never block the caller.
 *
 * @setup
 * Create `AuditLog` CMS collection in Wix Dashboard with fields:
 *   collection (Text, indexed) - Target CMS collection written to
 *   action (Text, indexed) - Operation type (e.g. 'insert', 'submit', 'track')
 *   key (Text, indexed) - Identifier (email, sessionId, productId)
 *   metadata (Text) - JSON string of additional context
 *   timestamp (DateTime, indexed) - When the action occurred
 *
 * Permissions: Anyone can insert (called from public endpoints); Admin read only.
 * Retention: 90 days — set up a cron to purge records older than 90 days.
 */

import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const AUDIT_COLLECTION = 'AuditLog';

/**
 * Log an audit event. Fire-and-forget — never throws, never blocks the caller.
 *
 * @param {string} collection - CMS collection being written to
 * @param {string} action - Operation type ('insert', 'submit', 'update', 'track', etc.)
 * @param {string} key - Identifying key (email, sessionId, productId)
 * @param {Object} [metadata] - Additional context (truncated to 2000 chars as JSON)
 */
export async function logAuditEvent(collection, action, key, metadata) {
  try {
    const cleanKey = sanitize(String(key || ''), 254).toLowerCase();
    const cleanCollection = sanitize(String(collection || ''), 100);
    const cleanAction = sanitize(String(action || ''), 50);
    let metaStr = '';
    if (metadata) {
      try {
        metaStr = sanitize(typeof metadata === 'string' ? metadata : JSON.stringify(metadata), 2000);
      } catch {
        metaStr = '[unserializable]';
      }
    }

    await wixData.insert(AUDIT_COLLECTION, {
      collection: cleanCollection,
      action: cleanAction,
      key: cleanKey,
      metadata: metaStr,
      timestamp: new Date(),
    }, { suppressAuth: true });
  } catch (err) {
    logError('auditLog.logAuditEvent', err);
    // Fire-and-forget — never block the caller
  }
}
