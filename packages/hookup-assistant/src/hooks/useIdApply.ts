/**
 * useIdApply — S4: auto-apply a Velo ID to a selected editor element.
 *
 * Calls editor.components.setNickname() (postMessage to P&E panel under the
 * hood) with a 300ms timeout. On success, persists the element ID to
 * localStorage under cf-hookup-{page}-applied and returns true so the caller
 * can advance to the next element.
 *
 * Status machine: idle → applying → success | error
 */

import { useState, useCallback } from 'react';
import type { ElementDef } from '../types/index.js';

export type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

const APPLY_TIMEOUT_MS = 300;

function appliedKey(pageName: string) {
  return `cf-hookup-${pageName.replace(/\s+/g, '-').toLowerCase()}-applied`;
}

function loadAppliedIds(pageName: string): string[] {
  try {
    const raw = localStorage.getItem(appliedKey(pageName));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveAppliedId(pageName: string, elementId: string) {
  try {
    const prev = loadAppliedIds(pageName);
    if (!prev.includes(elementId)) {
      localStorage.setItem(appliedKey(pageName), JSON.stringify([...prev, elementId]));
    }
  } catch {
    // localStorage not available (tests / sandboxed frame) — ignore
  }
}

async function getEditorModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — dynamic Wix SDK import, not available in standalone/test mode
    return await import('@wix/editor');
  } catch {
    return null;
  }
}

export function useIdApply(pageName: string) {
  const [status, setStatus] = useState<ApplyStatus>('idle');

  const applyId = useCallback(async (element: ElementDef, compRef: unknown): Promise<boolean> => {
    setStatus('applying');
    try {
      const editor = await getEditorModule();
      if (!editor) throw new Error('Editor not available');

      // postMessage to Properties & Events panel via the Wix editor SDK.
      // Race against 300ms timeout to ensure a fast response guarantee.
      // The timer is cleared on the success path to prevent a dangling
      // rejection from firing after the race has already settled.
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
    } catch {
      setStatus('error');
      return false;
    }
  }, [pageName]);

  const resetStatus = useCallback(() => setStatus('idle'), []);

  return { applyId, status, resetStatus };
}
