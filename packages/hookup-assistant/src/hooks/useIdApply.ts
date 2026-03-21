/**
 * useIdApply — S4/S12: auto-apply and clear Velo IDs on selected editor elements.
 *
 * applyId: calls editor.components.setNickname(compRef, elementId) — postMessage
 * to P&E panel under the hood — with a 300ms timeout. On success, persists the
 * element ID to localStorage under cf-hookup-{page}-applied and returns true.
 *
 * clearId (S12): calls editor.components.setNickname(compRef, '') to remove a
 * previously applied ID from the editor (undo support). Returns true on success.
 *
 * Status machine: idle → applying → success | error
 *
 * All failures are logged to console.error before transitioning to 'error'
 * so callers have diagnostic context (editor unavailable vs. SDK rejection
 * vs. timeout are clearly distinguishable in devtools / error monitoring).
 */

import { useState, useCallback } from 'react';
import type { ElementDef } from '../types/index.js';

export type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

const APPLY_TIMEOUT_MS = 300;
const TAG = '[useIdApply]';

function appliedKey(pageName: string) {
  return `cf-hookup-${pageName.replace(/\s+/g, '-').toLowerCase()}-applied`;
}

function loadAppliedIds(pageName: string): string[] {
  try {
    const raw = localStorage.getItem(appliedKey(pageName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`${TAG} Unexpected data in localStorage key ${appliedKey(pageName)} — resetting. Was: ${raw}`);
      return [];
    }
    return parsed as string[];
  } catch (err) {
    console.warn(`${TAG} Failed to parse applied IDs from localStorage for page "${pageName}":`, err);
    return [];
  }
}

function saveAppliedId(pageName: string, elementId: string) {
  try {
    const prev = loadAppliedIds(pageName);
    if (!prev.includes(elementId)) {
      localStorage.setItem(appliedKey(pageName), JSON.stringify([...prev, elementId]));
    }
  } catch (err) {
    // Expected in test/sandboxed environments; logged so QuotaExceededError is visible.
    console.warn(`${TAG} Could not persist applied ID "${elementId}" for page "${pageName}":`, err);
  }
}

async function getEditorModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — dynamic Wix SDK import, not available in standalone/test mode
    return await import('@wix/editor');
  } catch (err) {
    // Expected in standalone/test mode; warn so production failures are distinguishable.
    console.warn(`${TAG} @wix/editor unavailable:`, err);
    return null;
  }
}

export function useIdApply(pageName: string) {
  const [status, setStatus] = useState<ApplyStatus>('idle');

  const applyId = useCallback(async (element: ElementDef, compRef: unknown): Promise<boolean> => {
    setStatus('applying');
    try {
      const editor = await getEditorModule();
      if (!editor) {
        throw new Error(`${TAG} @wix/editor module unavailable — cannot apply ID "${element.id}"`);
      }

      // postMessage to Properties & Events panel via the Wix editor SDK.
      // Race against 300ms timeout to ensure a fast response guarantee.
      // The timer is always cleared in the finally block to prevent a dangling
      // rejection from firing after the race has already settled on the success path.
      let timeoutId: ReturnType<typeof setTimeout>;
      try {
        await Promise.race([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor.components as any).setNickname(compRef, element.id),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error('setNickname timeout')),
              APPLY_TIMEOUT_MS
            );
          }),
        ]);
      } finally {
        clearTimeout(timeoutId!);
      }

      saveAppliedId(pageName, element.id);
      setStatus('success');
      return true;
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'setNickname timeout';
      console.error(
        `${TAG} ${isTimeout ? `setNickname timed out after ${APPLY_TIMEOUT_MS}ms` : 'setNickname rejected'} for element "${element.id}" (page: "${pageName}"):`,
        err,
      );
      setStatus('error');
      return false;
    }
  }, [pageName]);

  // S12: clear a previously-applied ID from the editor by calling setNickname with ''.
  const clearId = useCallback(async (compRef: unknown): Promise<boolean> => {
    try {
      const editor = await getEditorModule();
      if (!editor) {
        throw new Error(`${TAG} @wix/editor module unavailable — cannot clear ID`);
      }

      let timeoutId: ReturnType<typeof setTimeout>;
      try {
        await Promise.race([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor.components as any).setNickname(compRef, ''),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error('setNickname timeout')),
              APPLY_TIMEOUT_MS
            );
          }),
        ]);
      } finally {
        clearTimeout(timeoutId!);
      }

      return true;
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'setNickname timeout';
      console.error(
        `${TAG} ${isTimeout ? `clearId timed out after ${APPLY_TIMEOUT_MS}ms` : 'clearId rejected'} for compRef:`,
        err,
      );
      return false;
    }
  }, []);

  const resetStatus = useCallback(() => setStatus('idle'), []);

  return { applyId, clearId, status, resetStatus };
}
