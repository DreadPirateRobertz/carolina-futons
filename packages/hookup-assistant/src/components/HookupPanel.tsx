/**
 * HookupPanel — main panel UI for the CF Hookup Assistant editor add-on.
 *
 * Phase 1 scope (S1 + S2 + S3 + S10):
 *  - Renders app name + "Manual Mode" header indicator when active
 *  - Page selector to switch between all pages (see PAGES array for current count)
 *  - Element detection (S3) shows selected element's type
 *  - ManualModePanel (S10) shows target ID, Copy, Mark Done, Skip, Tab-advance
 *  - Manual mode toggle in settings
 *
 * S7: Page Navigator — priority optgroups, progress per page, auto-detection.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PAGES, getUnhookedElements, getAllElements, getRepeaterSection } from '../data/pages.js';
import { useElementDetection } from '../hooks/useElementDetection.js';
import { usePageProgress, readPageHookedCount } from '../hooks/usePageProgress.js';
import { usePageNavigator } from '../hooks/usePageNavigator.js';
import { useIdApply } from '../hooks/useIdApply.js';
import { useRepeaterGuard } from '../hooks/useRepeaterGuard.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { detectConflict, useConflictDetector } from '../hooks/useConflictDetector.js';
import { ManualModePanel } from './ManualModePanel.js';
import { HelpOverlay } from './HelpOverlay.js';
import { ProgressDashboard } from './ProgressDashboard.js';
import type { PageDef } from '../types/index.js';
import { buildExportPayload, triggerJsonDownload, triggerTextDownload } from '../utils/exportReport.js';
import { parseImportPayload, applyImportPayload } from '../utils/importReport.js';
import { useSessionTimer, formatElapsed, loadHistory } from '../hooks/useSessionTimer.js';
import type { SessionRecord } from '../hooks/useSessionTimer.js';

const APP_VERSION = '0.1.0';
const DEFAULT_PAGE = PAGES[0]?.name ?? '';

export function HookupPanel() {
  const [selectedPageName, setSelectedPageName] = useState(DEFAULT_PAGE);
  const [manualMode, setManualMode] = useState(true); // Default on for Phase 1
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  // S15: import status feedback ('idle' | 'success' | 'error')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { selected, editorAvailable } = useElementDetection();
  const { detectedPageName } = usePageNavigator();
  const { hookedIds, skippedIds, markHooked, markSkipped, undoLast, resetPage } = usePageProgress(selectedPageName);

  // S7: When the editor navigates to a new page, auto-switch the panel to match.
  useEffect(() => {
    if (detectedPageName && detectedPageName !== selectedPageName) {
      setSelectedPageName(detectedPageName);
    }
    // Run only when detection fires — not on every selectedPageName change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedPageName]);
<<<<<<< HEAD
  const { applyId, clearId, status: applyStatus, resetStatus: resetApplyStatus } = useIdApply(selectedPageName);
=======
  const { applyId, status: applyStatus, resetStatus: resetApplyStatus } = useIdApply(selectedPageName);
>>>>>>> origin/polecat/chrome/CF-267m
  const { isGuardActive, confirmEntered, resetAll: resetGuard } = useRepeaterGuard();
  const { elapsed, paused, pace, recordApply } = useSessionTimer();
  const { pendingConflict, openConflict, clearConflict } = useConflictDetector();

  // S14: Reset repeater guard whenever the user switches pages
  useEffect(() => {
    resetGuard();
  }, [selectedPageName, resetGuard]);

  const allElements = getAllElements(selectedPageName);
  const unhooked = getUnhookedElements(selectedPageName, hookedIds);
  const currentElement = unhooked[0] ?? null;
  const nextElement = unhooked[1] ?? null;

  // S14: Compute repeater guard for the current element
  const repeaterSection = currentElement
    ? getRepeaterSection(selectedPageName, currentElement.id)
    : null;
  const repeaterGuard =
    repeaterSection?.repeater && isGuardActive(repeaterSection.repeater)
      ? { repeaterId: repeaterSection.repeater, sectionName: repeaterSection.name }
      : null;

  const handleEnterRepeaterTemplate = useCallback(() => {
    if (repeaterSection?.repeater) {
      confirmEntered(repeaterSection.repeater);
    } else {
      console.warn(
        '[HookupPanel] handleEnterRepeaterTemplate called but repeaterSection has no repeater ID — ' +
        'data bug: getRepeaterSection returned a section without a repeater field.',
      );
    }
  }, [repeaterSection, confirmEntered]);

  const handleMarkDone = useCallback(() => {
    if (currentElement) {
      markHooked(currentElement.id);
      recordApply();
    }
    resetApplyStatus();
  }, [currentElement, markHooked, resetApplyStatus, recordApply]);

  const handleSkip = useCallback(() => {
    if (currentElement) markSkipped(currentElement.id);
    resetApplyStatus();
  }, [currentElement, markSkipped, resetApplyStatus]);

  // S4 + S11 + S12: apply the target ID via editor SDK, with conflict detection.
  // Checks the element's existing nickname before calling setNickname():
  //   'none'        → proceed directly (stores compRef in history for S12 undo)
  //   'already-set' → auto-advance (no SDK call needed)
  //   'conflict'    → open conflict banner; wait for override/cancel
  const handleApplyId = useCallback(async () => {
    if (!currentElement || !selected) {
      console.warn('[HookupPanel] handleApplyId called with no current element or selection — ignoring');
      return;
    }
    const conflict = detectConflict(selected.currentNickname, currentElement.id);
    if (conflict.type === 'already-set') {
      markHooked(currentElement.id);
      recordApply();
      return;
    }
    if (conflict.type === 'conflict') {
      openConflict(conflict.existingNickname!);
      return;
    }
    resetApplyStatus();
    const ok = await applyId(currentElement, selected.compRef);
    if (ok) {
      markHooked(currentElement.id);
      recordApply();
    }
  }, [currentElement, selected, applyId, markHooked, resetApplyStatus, openConflict, recordApply]);

  // S11: user chose to override — proceed with setNickname despite conflict
  const handleOverride = useCallback(async () => {
    if (!currentElement || !selected) {
      clearConflict(); // dismiss banner even if state went stale
      return;
    }
    resetApplyStatus();
    const ok = await applyId(currentElement, selected.compRef);
    if (ok) {
      clearConflict();
      markHooked(currentElement.id, selected.compRef);
      recordApply();
    }
    // if !ok: leave banner visible so user can retry or cancel
  }, [currentElement, selected, applyId, markHooked, resetApplyStatus, clearConflict, recordApply]);

  // S11: user cancelled — dismiss conflict banner without applying
  const handleCancelConflict = useCallback(() => {
    clearConflict();
  }, [clearConflict]);

  // S13: page navigation helpers
  const pageIndex = PAGES.findIndex((p) => p.name === selectedPageName);
  const goNextPage = useCallback(() => {
    setSelectedPageName(PAGES[(pageIndex + 1) % PAGES.length].name);
  }, [pageIndex]);
  const goPrevPage = useCallback(() => {
    setSelectedPageName(PAGES[(pageIndex - 1 + PAGES.length) % PAGES.length].name);
  }, [pageIndex]);

  // S13: keyboard shortcuts — each handler extracted to named variable (stable refs)
  const handleApplyOrDone = useCallback(() => {
    if (editorAvailable && selected && currentElement) {
      handleApplyId().catch((err: unknown) => {
        console.error('[HookupPanel] handleApplyId rejected unexpectedly:', err);
      });
    } else {
      handleMarkDone();
    }
  }, [editorAvailable, selected, currentElement, handleApplyId, handleMarkDone]);
  const handleToggleManual = useCallback(() => setManualMode((v) => !v), []);
  const handleToggleHelp = useCallback(() => setShowHelp((v) => !v), []);
  const handleToggleProgress = useCallback(() => setShowProgress((v) => !v), []);

  // S12: undo — reverses last progress action; if it was an auto-applied ID,
  // clears the editor nickname via postMessage (setNickname(compRef, '')).
  const handleUndo = useCallback(() => {
    const compRef = undoLast();
    if (compRef !== undefined) {
      clearId(compRef).catch((err: unknown) => {
        console.error('[HookupPanel] clearId rejected during undo:', err);
      });
    }
    resetApplyStatus();
  }, [undoLast, clearId, resetApplyStatus]);

  useKeyboardShortcuts({
    onApplyOrDone: handleApplyOrDone,
    onSkip: handleSkip,
    onDone: handleMarkDone,
    onNextPage: goNextPage,
    onPrevPage: goPrevPage,
    onToggleManual: handleToggleManual,
    onUndo: handleUndo,
    onToggleHelp: handleToggleHelp,
  });

  // S15: Export handlers
  const handleExportJson = useCallback(() => {
    triggerJsonDownload(buildExportPayload());
  }, []);

  const handleExportText = useCallback(() => {
    triggerTextDownload(buildExportPayload());
  }, []);

  // S15: Import handler — reads file, applies to localStorage, reloads to sync state
  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text !== 'string') {
          setImportStatus('error');
          return;
        }
        const payload = parseImportPayload(text);
        if (!payload) {
          setImportStatus('error');
          return;
        }
        applyImportPayload(payload);
        setImportStatus('success');
        // Reload to re-initialise all usePageProgress hooks from fresh localStorage
        window.location.reload();
      };
      reader.readAsText(file);
      // Reset the input so the same file can be re-imported if needed
      e.target.value = '';
    },
    [],
  );

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
            style={{ ...s.settingsBtn, ...(showProgress ? s.settingsBtnActive : {}) }}
            onClick={handleToggleProgress}
            aria-label="Toggle progress dashboard"
            title="Progress Dashboard"
          >
            📊
          </button>
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
          {/* S15: Export / Import */}
          <div style={s.exportRow}>
            <button style={s.exportBtn} onClick={handleExportJson} title="Export all page progress as JSON">
              📤 Export JSON
            </button>
            <button style={s.exportBtn} onClick={handleExportText} title="Export progress summary as text">
              📋 Export Text
            </button>
          </div>
          <div style={s.importRow}>
            <button
              style={s.importBtn}
              onClick={() => fileInputRef.current?.click()}
              title="Import a previously exported JSON file to restore progress"
            >
              📥 Import…
            </button>
            {importStatus === 'error' && (
              <span style={s.importError}>Invalid file</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
          {/* S9: Session history */}
          <SessionHistorySection />
        </div>
      )}

      {/* S7: Page selector — priority groups, progress per page */}
      <div style={s.pageSelector}>
        {detectedPageName && (
          <span
            style={s.autoDetectBadge}
            title={`Auto-detected: ${detectedPageName}`}
            aria-label={`Auto-detected page: ${detectedPageName}`}
          >
            ⬤
          </span>
        )}
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
                  const hooked =
                    p.name === selectedPageName
                      ? hookedIds.length
                      : readPageHookedCount(p.name);
                  return (
                    <option key={p.name} value={p.name}>
                      {p.name} ({hooked}/{total})
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

      {/* S11: Conflict banner — shown when existing nickname differs from target */}
      {pendingConflict !== null && currentElement && (
        <div style={s.conflictBanner}>
          <div style={s.conflictTitle}>⚠ ID Conflict</div>
          <div style={s.conflictText}>
            Element already has <code style={s.conflictCode}>#{pendingConflict}</code>.
            Override with <code style={s.conflictCode}>#{currentElement.id}</code>?
          </div>
          <div style={s.conflictActions}>
            <button style={s.overrideBtn} onClick={handleOverride}>
              Override
            </button>
            <button style={s.cancelConflictBtn} onClick={handleCancelConflict}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={s.body}>
        {showProgress ? (
          <ProgressDashboard
            currentPageName={selectedPageName}
            onCurrentPageReset={resetPage}
          />
        ) : manualMode ? (
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
            repeaterGuard={repeaterGuard}
            onEnterRepeaterTemplate={handleEnterRepeaterTemplate}
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

      {/* S13: Help overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {/* Footer */}
      <footer style={s.footer}>
        <span style={s.footerText}>
          Carolina Futons · {hookedIds.length + skippedIds.length}/{allElements.length} addressed
        </span>
        {elapsed > 0 && (
          <span style={s.timerText}>
            {paused ? '⏸' : '⏱'} {formatElapsed(elapsed)}
            {pace > 0 && <> · {pace.toFixed(1)}/hr</>}
          </span>
        )}
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// S9: Session history display (rendered inside the settings drawer)

function SessionHistorySection() {
  const history: SessionRecord[] = loadHistory();
  if (history.length === 0) return null;

  // Show most recent 5, newest first
  const recent = [...history].reverse().slice(0, 5);

  return (
    <div style={sh.root}>
      <div style={sh.heading}>Session history</div>
      {recent.map((rec, i) => (
        <div key={i} style={sh.row}>
          <span style={sh.date}>{new Date(rec.date).toLocaleDateString()}</span>
          <span style={sh.stats}>
            {formatElapsed(rec.elapsed)} · {rec.applyCount} applied
            {rec.pace > 0 && <> · {rec.pace.toFixed(1)}/hr</>}
          </span>
        </div>
      ))}
    </div>
  );
}

const sh: Record<string, React.CSSProperties> = {
  root: {
    borderTop: '1px solid #dfe5eb',
    paddingTop: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  heading: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#7a92a5',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: '2px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '4px',
  },
  date: {
    fontSize: '10px',
    color: '#7a92a5',
    flexShrink: 0,
  },
  stats: {
    fontSize: '10px',
    color: '#4e6579',
    textAlign: 'right' as const,
  },
};

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
    position: 'relative', // needed for HelpOverlay's position:absolute backdrop
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
  settingsBtnActive: {
    color: '#162d3d',
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
  autoDetectBadge: {
    fontSize: '8px',
    color: '#28a745',
    lineHeight: 1,
    flexShrink: 0,
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: '10px', color: '#7a92a5' },
  timerText: { fontSize: '10px', color: '#4e6579' },
  // S11: conflict banner
  conflictBanner: {
    backgroundColor: '#fff3cd',
    borderBottom: '1px solid #ffc107',
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '5px',
  },
  conflictTitle: {
    fontWeight: 700,
    fontSize: '12px',
    color: '#856404',
  },
  conflictText: {
    fontSize: '11px',
    color: '#4e6579',
    lineHeight: 1.4,
  },
  conflictCode: {
    fontFamily: 'monospace',
    fontSize: '11px',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: '3px',
    padding: '0 3px',
  },
  conflictActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '2px',
  },
  overrideBtn: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#e07b39',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 10px',
    cursor: 'pointer',
  },
  cancelConflictBtn: {
    fontSize: '11px',
    color: '#4e6579',
    backgroundColor: 'transparent',
    border: '1px solid #adb5bd',
    borderRadius: '4px',
    padding: '3px 10px',
    cursor: 'pointer',
  },
  // S15: export/import controls
  exportRow: {
    display: 'flex',
    gap: '6px',
  },
  exportBtn: {
    flex: 1,
    fontSize: '11px',
    color: '#0c5460',
    background: 'none',
    border: '1px solid #bee5eb',
    borderRadius: '4px',
    padding: '3px 6px',
    cursor: 'pointer',
  },
  importRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  importBtn: {
    fontSize: '11px',
    color: '#4e6579',
    background: 'none',
    border: '1px solid #dfe5eb',
    borderRadius: '4px',
    padding: '3px 8px',
    cursor: 'pointer',
  },
  importError: {
    fontSize: '11px',
    color: '#c94b4b',
  },
};
