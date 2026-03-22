/**
 * usePageNavigator — S7: auto-detects the current Wix editor page.
 *
 * Tries to read the active page via the Wix editor runtime API, then
 * subscribes to page-change events so the panel tracks navigation.
 * Falls back gracefully when running outside the editor iframe.
 *
 * The `detectedPageName` is a name from PAGES, ready to use directly as
 * `selectedPageName` in HookupPanel. Returns null when detection is
 * unavailable (standalone/test mode) or when no matching page is found.
 */

import { useState, useEffect } from 'react';
import { PAGES } from '../data/pages.js';

// @wix/editor is loaded as an external in the iframe context.
// Imported lazily so the app compiles in standalone/test mode too.
async function getEditorModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — dynamic Wix SDK import
    return await import('@wix/editor');
  } catch {
    return null;
  }
}

/**
 * Match a Wix page title against the PAGES array.
 * Tries exact match first, then case-insensitive prefix.
 * Returns the matched PageDef.name, or null.
 */
export function matchPageName(title: string): string | null {
  if (!title) return null;
  const lower = title.toLowerCase().trim();
  // 1. Exact case-insensitive match
  const exact = PAGES.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact.name;
  // 2. PAGES name is a prefix of the title (e.g., "Product Page" matches "Product Page - Futon")
  const prefixed = PAGES.find((p) => lower.startsWith(p.name.toLowerCase()));
  if (prefixed) return prefixed.name;
  return null;
}

export function usePageNavigator() {
  const [detectedPageName, setDetectedPageName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const editor = await getEditorModule();
      if (!editor || cancelled) return;

      // Try to read the current page title immediately on mount.
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — runtime Wix editor API (not in published types)
        const page = await editor.pages?.getCurrent?.();
        if (page?.title && !cancelled) {
          const matched = matchPageName(page.title as string);
          if (matched) setDetectedPageName(matched);
        }
      } catch (err) {
        // API unavailable — fall through to event listener only
        console.warn('[usePageNavigator] pages.getCurrent failed:', err);
      }

      // Subscribe to page navigation events so the panel auto-switches
      // when the user navigates between pages in the editor.
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — runtime Wix editor event (not in published types)
        const off = await editor.events?.addEventListener?.('pageNavigated', async () => {
          if (cancelled) return;
          try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const page = await editor.pages?.getCurrent?.();
            if (page?.title && !cancelled) {
              const matched = matchPageName(page.title as string);
              if (matched) setDetectedPageName(matched);
            }
          } catch (err) {
            console.warn('[usePageNavigator] pageNavigated getCurrent failed:', err);
          }
        });
        if (typeof off === 'function') unsubscribe = off;
      } catch (err) {
        // Event API unavailable — no page-change tracking
        console.warn('[usePageNavigator] events.addEventListener failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { detectedPageName };
}
