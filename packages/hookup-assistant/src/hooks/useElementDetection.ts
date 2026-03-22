/**
 * useElementDetection — S3: subscribes to @wix/editor selection events.
 *
 * Returns the currently selected element's type, compRef, and Velo nickname.
 * Falls back gracefully when running outside the Wix editor iframe (tests, dev).
 */

import { useState, useEffect } from 'react';
import type { SelectedElement } from '../types/index.js';
import { mapWixType } from '../types/index.js';

// @wix/editor is loaded as an external in the iframe context.
// We import it lazily so the app compiles in standalone/test mode too.
async function getEditorModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — dynamic Wix SDK import
    return await import('@wix/editor');
  } catch {
    return null;
  }
}

export function useElementDetection() {
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [editorAvailable, setEditorAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      const editor = await getEditorModule();
      if (!editor || cancelled) return;

      try {
        // Subscribe to component selection events via the official Elements API
        unsubscribe = editor.selection.onSelectionChanged(async (event: { componentRef: unknown }) => {
          if (!event.componentRef) {
            setSelected(null);
            return;
          }
          try {
            const compRef = event.componentRef;
            const typeInfo = await editor.components.getType(compRef);
            const internalType: string = typeInfo?.componentType ?? '';
            const elementType = mapWixType(internalType);
            const nickname = await editor.components.getNickname(compRef).catch(() => null);
            setSelected({ compRef, internalType, elementType, currentNickname: nickname ?? null });
          } catch (err) {
            console.warn('[useElementDetection] Failed to resolve element type:', err);
            setSelected(null);
          }
        });
        setEditorAvailable(true);
      } catch (err) {
        // Running outside the editor (dev/test): no selection events available
        console.warn('[useElementDetection] editor.selection.onSelectionChanged unavailable:', err);
        setEditorAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { selected, editorAvailable };
}
