/**
 * useClipboard — S10: clipboard copy helper with feedback state.
 */

import { useState, useCallback } from 'react';

export function useClipboard() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      let success = false;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else {
        // Fallback for environments without Clipboard API (older Wix iframes)
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
      return success;
    } catch (err) {
      console.warn('[useClipboard] copy failed:', err);
      return false;
    }
  }, []);

  return { copy, copied };
}
