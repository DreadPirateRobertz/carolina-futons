/**
 * HelpOverlay — S13: keyboard shortcut reference modal.
 *
 * Rendered on top of the panel when `?` is pressed.
 * Dismissed by pressing `?` again or clicking the backdrop.
 */

import React from 'react';

interface HelpOverlayProps {
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Enter / Space', action: 'Apply ID ⚡ (or Mark Done)' },
  { keys: 'D', action: 'Mark Done' },
  { keys: 'S', action: 'Skip element' },
  { keys: 'N', action: 'Next page' },
  { keys: 'P', action: 'Previous page' },
  { keys: 'M', action: 'Toggle Manual Mode' },
  { keys: '⌘Z / Ctrl+Z', action: 'Undo last action' },
  { keys: '?', action: 'Toggle this help' },
];

export function HelpOverlay({ onClose }: HelpOverlayProps) {
  return (
    <div style={s.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>Keyboard Shortcuts</span>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close help">✕</button>
        </div>
        <table style={s.table}>
          <tbody>
            {SHORTCUTS.map(({ keys, action }) => (
              <tr key={keys}>
                <td style={s.keysCell}>
                  <kbd style={s.kbd}>{keys}</kbd>
                </td>
                <td style={s.actionCell}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(22,45,61,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    padding: '14px 16px',
    width: '240px',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: '12px',
    color: '#32536a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  title: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#162d3d',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#7a92a5',
    padding: '0 2px',
    lineHeight: 1,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  keysCell: {
    paddingBottom: '6px',
    paddingRight: '10px',
    whiteSpace: 'nowrap',
    verticalAlign: 'top',
  },
  actionCell: {
    paddingBottom: '6px',
    color: '#4e6579',
    verticalAlign: 'top',
  },
  kbd: {
    display: 'inline-block',
    backgroundColor: '#f0f4f7',
    border: '1px solid #dfe5eb',
    borderRadius: '3px',
    padding: '1px 5px',
    fontSize: '11px',
    fontFamily: 'monospace',
    color: '#162d3d',
  },
};
