/**
 * HookupPanel — main panel UI for the CF Hookup Assistant editor add-on.
 *
 * S1 scope: renders app name, version, and a placeholder state indicating
 * that the PAGES data bundle (S2) and element detection (S3) are pending.
 */

import React from 'react';

const APP_VERSION = '0.1.0';

export function HookupPanel() {
  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <span style={styles.icon}>🔗</span>
        <div>
          <div style={styles.appName}>CF Hookup Assistant</div>
          <div style={styles.version}>v{APP_VERSION}</div>
        </div>
      </header>

      <div style={styles.divider} />

      <main style={styles.body}>
        <div style={styles.placeholder}>
          <div style={styles.placeholderIcon}>🔧</div>
          <p style={styles.placeholderTitle}>Setting up…</p>
          <p style={styles.placeholderText}>
            Select an element on the canvas to get started.
          </p>
          <div style={styles.statusChips}>
            <StatusChip label="PAGES data" status="pending" />
            <StatusChip label="Element detection" status="pending" />
            <StatusChip label="Manual mode" status="pending" />
          </div>
        </div>
      </main>

      <footer style={styles.footer}>
        <span style={styles.footerText}>Carolina Futons · Private Add-on</span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

type ChipStatus = 'ready' | 'pending' | 'error';

function StatusChip({ label, status }: { label: string; status: ChipStatus }) {
  const colors: Record<ChipStatus, { bg: string; text: string }> = {
    ready:   { bg: '#e6f4ea', text: '#1e7e34' },
    pending: { bg: '#fff3cd', text: '#856404' },
    error:   { bg: '#f8d7da', text: '#721c24' },
  };
  const emoji: Record<ChipStatus, string> = {
    ready: '✓', pending: '…', error: '✕',
  };
  const { bg, text } = colors[status];
  return (
    <div style={{ ...styles.chip, backgroundColor: bg, color: text }}>
      {emoji[status]} {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (panel is 288px wide × 480px tall per spec)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '288px',
    height: '480px',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: '13px',
    color: '#32536a',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px 10px',
    backgroundColor: '#f0f4f7',
  },
  icon: {
    fontSize: '22px',
    lineHeight: 1,
  },
  appName: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#162d3d',
  },
  version: {
    fontSize: '11px',
    color: '#7a92a5',
    marginTop: '1px',
  },
  divider: {
    height: '1px',
    backgroundColor: '#dfe5eb',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
  },
  placeholder: {
    textAlign: 'center',
    padding: '30px 10px',
  },
  placeholderIcon: {
    fontSize: '36px',
    marginBottom: '12px',
  },
  placeholderTitle: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#162d3d',
    margin: '0 0 8px',
  },
  placeholderText: {
    color: '#7a92a5',
    lineHeight: 1.5,
    margin: '0 0 20px',
  },
  statusChips: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
    textAlign: 'left',
  },
  chip: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
  },
  footer: {
    padding: '8px 16px',
    borderTop: '1px solid #dfe5eb',
    backgroundColor: '#f0f4f7',
  },
  footerText: {
    fontSize: '11px',
    color: '#7a92a5',
  },
};
