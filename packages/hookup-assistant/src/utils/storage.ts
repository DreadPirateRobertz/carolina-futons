/**
 * Shared localStorage helpers for hookup progress state — S15.
 *
 * Extracted from usePageProgress so exportReport and importReport can share
 * the same key format without duplication.
 */

const TAG = '[progressStorage]';

export function storageKey(pageName: string, kind: 'hooked' | 'skipped'): string {
  return `cf-hookup-${pageName.replace(/\s+/g, '-').toLowerCase()}-${kind}`;
}

export function loadIds(pageName: string, kind: 'hooked' | 'skipped'): string[] {
  const key = storageKey(pageName, kind);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`${TAG} Unexpected data at key "${key}" — resetting. Was: ${raw}`);
      return [];
    }
    return parsed as string[];
  } catch (err) {
    console.warn(`${TAG} Failed to read "${key}" from localStorage:`, err);
    return [];
  }
}

export function saveIds(pageName: string, kind: 'hooked' | 'skipped', ids: string[]): void {
  const key = storageKey(pageName, kind);
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch (err) {
    console.warn(`${TAG} Could not persist "${key}" (storage unavailable or quota exceeded):`, err);
  }
}
