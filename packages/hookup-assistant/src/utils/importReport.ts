/**
 * Import utilities for CF Hookup Assistant — S15.
 *
 * Parses an exported JSON payload and restores progress to localStorage,
 * enabling multi-machine sync via file transfer.
 */

import { saveIds } from './storage.js';
import type { ExportPayload } from './exportReport.js';

/**
 * Parse and validate an import file's text content.
 * Returns the payload if valid, null if the format is unrecognized or invalid.
 */
export function parseImportPayload(text: string): ExportPayload | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (
      typeof data !== 'object' ||
      data === null ||
      (data as Record<string, unknown>).version !== 1 ||
      !Array.isArray((data as Record<string, unknown>).pages)
    ) {
      return null;
    }
    return data as ExportPayload;
  } catch {
    return null;
  }
}

/**
 * Apply an import payload to localStorage.
 * Only writes entries where pageName is a string; skips malformed entries.
 * Returns the number of pages whose state was written.
 */
export function applyImportPayload(payload: ExportPayload): number {
  let count = 0;
  for (const entry of payload.pages) {
    if (typeof entry.pageName !== 'string') continue;
    const hookedIds = Array.isArray(entry.hookedIds)
      ? entry.hookedIds.filter((id) => typeof id === 'string')
      : [];
    const skippedIds = Array.isArray(entry.skippedIds)
      ? entry.skippedIds.filter((id) => typeof id === 'string')
      : [];
    saveIds(entry.pageName, 'hooked', hookedIds);
    saveIds(entry.pageName, 'skipped', skippedIds);
    count++;
  }
  return count;
}
