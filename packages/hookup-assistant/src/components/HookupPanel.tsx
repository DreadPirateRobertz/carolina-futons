/**
 * HookupPanel — main panel UI for the CF Hookup Assistant editor add-on.
 *
 * Phase 1 scope (S1 + S2 + S3 + S10):
 *  - Renders app name + "Manual Mode" header indicator when active
 *  - Page selector to switch between the 28 pages
 *  - Element detection (S3) shows selected element's type
 *  - ManualModePanel (S10) shows target ID, Copy, Mark Done, Skip, Tab-advance
 *  - Manual mode toggle in settings
 */

import React, { useState, useCallback } from 'react';
import { PAGES, getUnhookedElements, getAllElements } from '../data/pages.js';
import { useElementDetection } from '../hooks/useElementDetection.js';
import { usePageProgress } from '../hooks/usePageProgress.js';
import { useIdApply } from '../hooks/useIdApply.js';
import { ManualModePanel } from './ManualModePanel.js';
import type { PageDef } from '../types/index.js';

const APP_VERSION = '0.1.0';
const DEFAULT_PAGE = PAGES[0]?.name ?? '';

export function HookupPanel() {
  const [selectedPageName, setSelectedPageName] = useState(DEFAULT_PAGE);
  const [manualMode, setManualMode] = useState(true); // Default on for Phase 1
  const [showSettings, setShowSettings] = useState(false);

  const { selected, editorAvailable } = useElementDetection();
  const { hookedIds, skippedIds, markHooked, markSkipped, resetPage } = usePageProgress(selectedPageName);
  const { applyId, status: applyStatus, resetStatus: resetApplyStatus } = useIdApply(selectedPageName);

  const allElements = getAllElements(selectedPageName);
  const unhooked = getUnhookedElements(selectedPageName, hookedIds);
  const currentElement = unhooked[0] ?? null;
  const nextElement = unhooked[1] ?? null;

  const handleMarkDone = useCallback(() => {
    if (currentElement) markHooked(currentElement.id);
    resetApplyStatus();
  }, [currentElement, markHooked, resetApplyStatus]);

  const handleSkip = useCallback(() => {
    if (currentElement) markSkipped(currentElement.id);
    resetApplyStatus();
  }, [currentElement, markSkipped, resetApplyStatus]);

  // S4: apply the target ID directly via the editor SDK (postMessage to P&E panel)
  const handleApplyId = useCallback(async () => {
    if (!currentElement || !selected) return;
    resetApplyStatus(); // ensure clean state before each apply attempt
    const ok = await applyId(currentElement, selected.compRef);
    if (ok) {
      markHooked(currentElement.id);
    }
  }, [currentElement, selected, applyId, markHooked, resetApplyStatus]);

  const page = PAGES.find((p) => p.name === selectedPageName);

  return (
    <div style={s.root}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.icon}>🔗</span>
          <div>
            <div style={s.appName}>CF Hookup Assistant</div>
            <div style={s.version}>v{APP_VERSION}</div>
          </div>
        </div>
        <div style={s.headerRight}>
          {manualMode && <span style={s.manualBadge}>Manual Mode</span>}
          <button
            style={s.settingsBtn}
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Toggle settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <div style={s.divider} />

      {/* Settings drawer */}
      {showSettings && (
        <div style={s.settings}>
          <label style={s.settingsLabel}>
            <input
              type="checkbox"
              checked={manualMode}
              onChange={(e) => setManualMode(e.target.checked)}
            />
            {' '}Manual Mode (Phase 1)
          </label>
          <button style={s.resetBtn} onClick={() => {
            if (confirm(`Reset all progress for "${selectedPageName}"?`)) resetPage();
          }}>
            Reset page progress
          </button>
        </div>
      )}

      {/* Page selector */}
      <div style={s.pageSelector}>
        <select
          style={s.pageSelect}
          value={selectedPageName}
          onChange={(e) => setSelectedPageName(e.target.value)}
          aria-label="Select page"
        >
          {(['P0', 'P1', 'P2', 'P3'] as const).map((pri) => {
            const group = PAGES.filter((p) => p.priority === pri);
            if (!group.length) return null;
            return (
              <optgroup key={pri} label={`${pri} — ${priorityLabel(pri)}`}>
                {group.map((p: PageDef) => {
                  const total = getAllElements(p.name).length;
                  return (
                    <option key={p.name} value={p.name}>
                      {p.name} ({total})
                    </option>
                  );
                })}
              </optgroup>
            );
          })}
        </select>
        <PageBadge priority={page?.priority ?? 'P3'} />
      </div>

      <div style={s.divider} />

      {/* Editor status */}
      {!editorAvailable && (
        <div style={s.noEditor}>
          ℹ Editor not detected — running in standalone mode
        </div>
      )}

      {/* Element detection status (S3) */}
      {editorAvailable && (
        <div style={s.detectionRow}>
          {selected
            ? <span style={s.detected}>Selected: <strong>{selected.elementType ?? selected.internalType}</strong>
                {selected.currentNickname && <> · #{selected.currentNickname}</>}
              </span>
            : <span style={s.noSelection}>Select an element on the canvas</span>
          }
        </div>
      )}

      {/* Main content */}
      <main style={s.body}>
        {manualMode ? (
          <ManualModePanel
            pageName={selectedPageName}
            currentElement={currentElement}
            nextElement={nextElement}
            hookedCount={hookedIds.length}
            totalCount={allElements.length}
            selectedType={selected?.elementType ?? null}
            onMarkDone={handleMarkDone}
            onSkip={handleSkip}
            onApplyId={editorAvailable && selected ? handleApplyId : undefined}
            applyStatus={applyStatus}
          />
        ) : (
          <div style={s.autoPlaceholder}>
            <div style={s.placeholderIcon}>🚀</div>
            <p style={s.placeholderTitle}>Auto-apply coming in Phase 2</p>
            <p style={s.placeholderText}>
              Enable Manual Mode in settings to use the panel now.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={s.footer}>
        <span style={s.footerText}>
          Carolina Futons · {hookedIds.length + skippedIds.length}/{allElements.length} addressed
        </span>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PageBadge({ priority }: { priority: 'P0' | 'P1' | 'P2' | 'P3' }) {
  const colors: Record<string, { bg: string; text: string }> = {
    P0: { bg: '#f8d7da', text: '#721c24' },
    P1: { bg: '#fff3cd', text: '#856404' },
    P2: { bg: '#d1ecf1', text: '#0c5460' },
    P3: { bg: '#e2e3e5', text: '#383d41' },
  };
  const { bg, text } = colors[priority] ?? colors.P3;
  return (
    <span style={{ ...s.priorityBadge, backgroundColor: bg, color: text }}>
      {priority}
    </span>
  );
}

function priorityLabel(p: string): string {
  return { P0: 'Critical', P1: 'High', P2: 'Medium', P3: 'Low' }[p] ?? p;
}

// ---------------------------------------------------------------------------
// Styles (panel: 288px × 480px per spec)

const s: Record<string, React.CSSProperties> = {
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
    justifyContent: 'space-between',
    padding: '10px 12px 8px',
    backgroundColor: '#f0f4f7',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  icon: { fontSize: '18px', lineHeight: 1 },
  appName: { fontWeight: 700, fontSize: '13px', color: '#162d3d' },
  version: { fontSize: '10px', color: '#7a92a5' },
  manualBadge: {
    fontSize: '9px',
    fontWeight: 700,
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '2px 6px',
    borderRadius: '8px',
    border: '1px solid #ffc107',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  settingsBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 2px',
    color: '#7a92a5',
    lineHeight: 1,
  },
  divider: { height: '1px', backgroundColor: '#dfe5eb' },
  settings: {
    backgroundColor: '#fafbfc',
    padding: '10px 14px',
    borderBottom: '1px solid #dfe5eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  settingsLabel: {
    fontSize: '12px',
    color: '#4e6579',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  resetBtn: {
    fontSize: '11px',
    color: '#c94b4b',
    background: 'none',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    padding: '3px 8px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  pageSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
  },
  pageSelect: {
    flex: 1,
    fontSize: '12px',
    border: '1px solid #dfe5eb',
    borderRadius: '4px',
    padding: '4px 6px',
    color: '#162d3d',
    backgroundColor: '#fff',
  },
  priorityBadge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  noEditor: {
    fontSize: '11px',
    color: '#856404',
    backgroundColor: '#fff3cd',
    padding: '5px 12px',
    borderBottom: '1px solid #dfe5eb',
  },
  detectionRow: {
    padding: '5px 12px',
    borderBottom: '1px solid #dfe5eb',
    minHeight: '26px',
    display: 'flex',
    alignItems: 'center',
  },
  detected: { fontSize: '12px', color: '#4e6579' },
  noSelection: { fontSize: '12px', color: '#adb5bd', fontStyle: 'italic' },
  body: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  autoPlaceholder: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  placeholderIcon: { fontSize: '36px', marginBottom: '12px' },
  placeholderTitle: { fontWeight: 600, fontSize: '14px', color: '#162d3d', margin: '0 0 8px' },
  placeholderText: { color: '#7a92a5', lineHeight: 1.5, margin: 0, fontSize: '12px' },
  footer: {
    padding: '6px 12px',
    borderTop: '1px solid #dfe5eb',
    backgroundColor: '#f0f4f7',
  },
  footerText: { fontSize: '10px', color: '#7a92a5' },
};
