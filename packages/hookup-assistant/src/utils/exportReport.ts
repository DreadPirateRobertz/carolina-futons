/**
 * Export utilities for CF Hookup Assistant — S15.
 *
 * Collects all-page progress from localStorage and produces:
 *   - A structured JSON payload (downloadable as .json)
 *   - A human-readable text summary (downloadable as .txt)
 */

import { PAGES, getAllElements } from '../data/pages.js';
import { loadIds } from './storage.js';

export interface PageProgressEntry {
  pageName: string;
  hookedIds: string[];
  skippedIds: string[];
  totalElements: number;
}

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  pages: PageProgressEntry[];
}

/** Collect current progress for all pages from localStorage. */
export function buildExportPayload(): ExportPayload {
  const pages: PageProgressEntry[] = PAGES.map((page) => ({
    pageName: page.name,
    hookedIds: loadIds(page.name, 'hooked'),
    skippedIds: loadIds(page.name, 'skipped'),
    totalElements: getAllElements(page.name).length,
  }));
  return { version: 1, exportedAt: new Date().toISOString(), pages };
}

/** Build human-readable text summary from an export payload. */
export function buildTextSummary(payload: ExportPayload): string {
  const lines: string[] = [
    'CF Hookup Assistant — Progress Report',
    `Exported: ${payload.exportedAt}`,
    '',
  ];

  let totalHooked = 0;
  let totalSkipped = 0;
  let totalElements = 0;

  for (const p of payload.pages) {
    const hooked = p.hookedIds.length;
    const skipped = p.skippedIds.length;
    const total = p.totalElements;
    if (hooked > 0 || skipped > 0) {
      lines.push(
        `${p.pageName}: ${hooked}/${total} hooked` +
          (skipped > 0 ? `, ${skipped} skipped` : ''),
      );
    }
    totalHooked += hooked;
    totalSkipped += skipped;
    totalElements += total;
  }

  lines.push('');
  lines.push(
    `Total: ${totalHooked}/${totalElements} elements hooked` +
      (totalSkipped > 0 ? `, ${totalSkipped} skipped` : ''),
  );

  return lines.join('\n');
}

/** Trigger a browser download of the JSON payload. */
export function triggerJsonDownload(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `cf-hookup-progress-${payload.exportedAt.slice(0, 10)}.json`);
}

/** Trigger a browser download of the text summary. */
export function triggerTextDownload(payload: ExportPayload): void {
  const blob = new Blob([buildTextSummary(payload)], { type: 'text/plain' });
  triggerDownload(blob, `cf-hookup-progress-${payload.exportedAt.slice(0, 10)}.txt`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
