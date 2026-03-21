/**
 * ManualModePanel — Manual Mode UI for element ID hookup.
 *
 * Covers S10 (baseline), S5 (type validator), S6 (default state setter),
 * S4 (ID auto-apply), and S14 (Repeater Guard).
 *
 * S10 — Fallback manual mode:
 *   - Shows target Velo ID in large monospace font
 *   - "Copy ID" button copies to clipboard
 *   - Instructions: open Properties & Events → paste the ID
 *   - "Mark Done" / Tab advances; "Skip" skips current element
 *   - Progress bar shows done / total
 *
 * S5 — Type validator:
 *   - Mark Done and Tab are disabled when selectedType mismatches element type
 *   - "Override type check" button bypasses the guard intentionally
 *
 * S6 — Default state setter:
 *   - Calls onApplyDefaultState(element) after Mark Done / Override
 *     when element has defaultHidden or defaultCollapsed set
 *   - cssOnly elements do not trigger onApplyDefaultState
 *
 * S4 — ID auto-apply:
 *   - "Apply ID ⚡" button triggers postMessage to P&E panel via editor SDK
 *   - Shows applying/success/error feedback
 *   - Auto-advances to next element on success
 *   - Hidden when editor is not available (falls back to manual copy-paste)
 *
 * S14 — Repeater Guard:
 *   - Detects when the current element is a repeater child (lives in a template)
 *   - Shows step-by-step "Enter Repeater Template" guidance before child IDs;
 *     this early-return suppresses all normal element UI until the guard is dismissed
 *   - "✓ I'm in the template" button (aria-label: "Confirm entered repeater template: <id>")
 *     unlocks child ID hookup for that repeater section
 *   - handleMarkDone also blocks on repeaterGuard to prevent Tab-key from advancing
 *     past the guard even though the Mark Done button is not rendered while guard is active
 *   - Guard resets when the user switches pages (parent resets via useRepeaterGuard.resetAll)
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { ElementDef, WixElementType } from '../types/index.js';
import type { ApplyStatus } from '../hooks/useIdApply.js';
import { useClipboard } from '../hooks/useClipboard.js';

/** S14: Repeater guard info — set when the current element is a repeater child. */
export interface RepeaterGuardInfo {
  /** The repeater element ID (e.g. "featuredRepeater") to instruct the user to enter. */
  repeaterId: string;
  /** The section name for display context. */
  sectionName: string;
}

interface ManualModePanelProps {
  pageName: string;
  currentElement: ElementDef | null;
  nextElement: ElementDef | null;
  hookedCount: number;
  totalCount: number;
  selectedType: WixElementType | null;
  onMarkDone: () => void;
  onSkip: () => void;
  onApplyDefaultState?: (element: ElementDef) => void;
  /** S4: undefined = editor unavailable (button hidden), fn = button shown */
  onApplyId?: () => void;
  /** S4: current apply status for feedback display */
  applyStatus?: ApplyStatus;
  /**
   * S14: When non-null, the current element is a repeater child and the guard
   * is active — show template-entry guidance instead of the element ID.
   */
  repeaterGuard?: RepeaterGuardInfo | null;
  /** S14: Called when the user confirms they have entered the repeater template. */
  onEnterRepeaterTemplate?: () => void;
}

// ---------------------------------------------------------------------------
// S14: Repeater Guard

interface RepeaterGuardProps {
  repeaterId: string;
  sectionName: string;
  onEnter: () => void;
}

function RepeaterGuard({ repeaterId, sectionName, onEnter }: RepeaterGuardProps) {
  return (
    <div style={s.root}>
      <div style={s.guardBanner}>
        <div style={s.guardIcon}>📦</div>
        <div style={s.guardTitle}>Repeater Template Required</div>
        <div style={s.guardSubtitle}>
          <strong>{sectionName}</strong> elements live inside{' '}
          <span style={s.guardCode}>#{repeaterId}</span>.
          You must enter the repeater template before assigning child IDs.
        </div>
      </div>

      <div style={s.instructions}>
        <div style={s.step}>1. Click <strong>#{repeaterId}</strong> on the canvas to select it</div>
        <div style={s.step}>2. Click <strong>Edit Repeater</strong> (or double-click to enter template)</div>
        <div style={s.step}>3. Work within the single template card shown</div>
      </div>

      <button
        style={{ ...s.btn, ...s.btnEnterTemplate }}
        onClick={onEnter}
        aria-label={`Confirm entered repeater template: ${repeaterId}`}
      >
        ✓ I'm in the template
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// S4: Apply ID button

interface ApplyIdButtonProps {
  onApplyId: () => void;
  status: ApplyStatus;
  elementId: string;
}

function ApplyIdButton({ onApplyId, status, elementId }: ApplyIdButtonProps) {
  const isApplying = status === 'applying';

  const label =
    status === 'applying' ? 'Applying…' :
    status === 'success'  ? '✓ Applied!' :
    status === 'error'    ? '✗ Retry Apply ID' :
                            '⚡ Apply ID';

  return (
    <button
      style={{
        ...s.btn,
        ...s.btnApply,
        ...(isApplying ? s.btnDisabled : {}),
        ...(status === 'success' ? s.btnApplySuccess : {}),
        ...(status === 'error' ? s.btnApplyError : {}),
      }}
      onClick={onApplyId}
      disabled={isApplying}
      aria-label={`Apply element ID: ${elementId}`}
      aria-busy={isApplying}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------

export function ManualModePanel({
  pageName,
  currentElement,
  nextElement: _nextElement,
  hookedCount,
  totalCount,
  selectedType,
  onMarkDone,
  onSkip,
  onApplyDefaultState,
  onApplyId,
  applyStatus = 'idle',
  repeaterGuard = null,
  onEnterRepeaterTemplate,
}: ManualModePanelProps) {
  const { copy, copied } = useClipboard();
  const markDoneRef = useRef<HTMLButtonElement>(null);

  const typeMismatch = selectedType !== null && currentElement !== null && selectedType !== currentElement.type;

  const applyDefaultStateIfNeeded = useCallback(() => {
    if (currentElement && !currentElement.cssOnly && (currentElement.defaultHidden || currentElement.defaultCollapsed)) {
      onApplyDefaultState?.(currentElement);
    }
  }, [currentElement, onApplyDefaultState]);

  const handleMarkDone = useCallback(() => {
    if (!currentElement) return; // completion state — no element to advance past
    if (typeMismatch) return;
    if (repeaterGuard) return; // S14: guard active — block Tab-key advance (Mark Done button not rendered)
    onMarkDone();
    applyDefaultStateIfNeeded();
  }, [currentElement, typeMismatch, repeaterGuard, onMarkDone, applyDefaultStateIfNeeded]);

  const handleOverride = useCallback(() => {
    onMarkDone();
    applyDefaultStateIfNeeded();
  }, [onMarkDone, applyDefaultStateIfNeeded]);

  // Tab key advances to next element (Mark Done) — disabled on type mismatch
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab' && !e.shiftKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        handleMarkDone();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMarkDone]);

  if (!currentElement) {
    return (
      <div style={s.root}>
        <CompletionState pageName={pageName} total={totalCount} />
      </div>
    );
  }

  // S14: Show repeater guard when the current element is a repeater child
  // and the user hasn't yet confirmed entering the template.
  // This early return suppresses all normal element UI (ID block, Copy, Mark Done, etc.)
  if (repeaterGuard) {
    if (!onEnterRepeaterTemplate) {
      console.warn(
        '[ManualModePanel] repeaterGuard is set but onEnterRepeaterTemplate is not provided — ' +
        '"I\'m in the template" button will be a no-op. Pass onEnterRepeaterTemplate alongside repeaterGuard.',
      );
    }
    return (
      <RepeaterGuard
        repeaterId={repeaterGuard.repeaterId}
        sectionName={repeaterGuard.sectionName}
        onEnter={onEnterRepeaterTemplate ?? (() => {})}
      />
    );
  }

  const pct = totalCount > 0 ? Math.round((hookedCount / totalCount) * 100) : 0;

  return (
    <div style={s.root}>
      {/* Progress row */}
      <div style={s.progressRow}>
        <span style={s.pageName}>{pageName}</span>
        <span style={s.progressCount}>{hookedCount}/{totalCount}</span>
      </div>
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${pct}%` }} />
      </div>

      {/* Section label */}
      <div style={s.sectionLabel}>Next element</div>

      {/* Target ID block */}
      <div style={s.idBlock}>
        <span style={s.idHash}>#</span>
        <span style={s.idText}>{currentElement.id}</span>
      </div>

      {/* Type + notes */}
      <div style={s.metaRow}>
        <TypeBadge type={currentElement.type} />
        <span style={s.notes}>{currentElement.notes}</span>
      </div>

      {/* Type mismatch warning */}
      {typeMismatch && (
        <div style={s.mismatch}>
          ⚠ Expected <strong>{currentElement.type}</strong>, you selected <strong>{selectedType}</strong>
        </div>
      )}

      {/* Instructions */}
      <div style={s.instructions}>
        <div style={s.step}>1. Click the element on canvas</div>
        <div style={s.step}>2. Open <strong>Properties &amp; Events</strong></div>
        <div style={s.step}>3. Paste the ID below in the Velo ID field</div>
      </div>

      {/* S4: Apply ID button — shown only when editor is available */}
      {onApplyId !== undefined && (
        <ApplyIdButton
          onApplyId={onApplyId}
          status={applyStatus}
          elementId={currentElement.id}
        />
      )}

      {/* Copy ID button */}
      <button
        style={{ ...s.btn, ...s.btnPrimary }}
        onClick={() => copy(currentElement.id)}
        aria-label={`Copy element ID: ${currentElement.id}`}
      >
        {copied ? '✓ Copied!' : '📋 Copy ID'}
      </button>

      {/* Mark Done + Skip */}
      <div style={s.actionRow}>
        <button
          ref={markDoneRef}
          style={{ ...s.btn, ...s.btnSuccess, ...(typeMismatch ? s.btnDisabled : {}) }}
          onClick={handleMarkDone}
          disabled={typeMismatch}
          aria-label="Mark Done — advance to next element"
        >
          Mark Done [Tab]
        </button>
        <button
          style={{ ...s.btn, ...s.btnSecondary }}
          onClick={onSkip}
          aria-label="Skip this element"
        >
          Skip
        </button>
      </div>

      {/* Override type check */}
      {typeMismatch && (
        <button
          style={s.overrideLink}
          onClick={handleOverride}
          aria-label="Override type check"
        >
          Override type check
        </button>
      )}

      {/* Flags */}
      {(currentElement.defaultHidden || currentElement.defaultCollapsed || currentElement.cssOnly) && (
        <div style={s.flagRow}>
          {currentElement.defaultHidden && <span style={s.flag}>Hidden on load</span>}
          {currentElement.defaultCollapsed && <span style={s.flag}>Collapsed on load</span>}
          {currentElement.cssOnly && <span style={{ ...s.flag, ...s.flagCss }}>CSS/Theme only</span>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CompletionState({ pageName, total }: { pageName: string; total: number }) {
  return (
    <div style={s.complete}>
      <div style={s.completeIcon}>✅</div>
      <div style={s.completeTitle}>{pageName} complete!</div>
      <div style={s.completeText}>{total} elements hooked. Switch to the next page.</div>
    </div>
  );
}

function TypeBadge({ type }: { type: ElementDef['type'] }) {
  return <span style={s.typeBadge}>{type}</span>;
}

// ---------------------------------------------------------------------------
// Styles

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px 16px',
    flex: 1,
    overflowY: 'auto',
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageName: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#162d3d',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '180px',
  },
  progressCount: {
    fontSize: '11px',
    color: '#7a92a5',
  },
  progressBar: {
    height: '4px',
    borderRadius: '2px',
    backgroundColor: '#dfe5eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3899ec',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  sectionLabel: {
    fontSize: '11px',
    color: '#7a92a5',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: '4px',
  },
  idBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
    backgroundColor: '#f0f4f7',
    border: '1px solid #dfe5eb',
    borderRadius: '6px',
    padding: '10px 14px',
  },
  idHash: {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#7a92a5',
    userSelect: 'none',
  },
  idText: {
    fontFamily: 'monospace',
    fontSize: '18px',
    fontWeight: 700,
    color: '#162d3d',
    wordBreak: 'break-all',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  typeBadge: {
    backgroundColor: '#e8f0fe',
    color: '#1a56db',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  notes: {
    fontSize: '12px',
    color: '#7a92a5',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mismatch: {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '4px',
    padding: '6px 10px',
    fontSize: '11px',
    color: '#856404',
  },
  instructions: {
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  step: {
    fontSize: '12px',
    color: '#4e6579',
    lineHeight: '1.4',
  },
  btn: {
    border: 'none',
    borderRadius: '6px',
    padding: '9px 0',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    backgroundColor: '#3899ec',
    color: '#fff',
  },
  btnSuccess: {
    backgroundColor: '#1e7e34',
    color: '#fff',
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: '#f0f4f7',
    color: '#4e6579',
    border: '1px solid #dfe5eb',
    flex: '0 0 70px',
    width: 'auto',
    padding: '9px 12px',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  flagRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  flag: {
    fontSize: '10px',
    fontWeight: 600,
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  flagCss: {
    backgroundColor: '#e6f4ea',
    color: '#1e7e34',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  // S4: Apply ID button states
  btnApply: {
    backgroundColor: '#6c5ce7',
    color: '#fff',
  },
  btnApplySuccess: {
    backgroundColor: '#1e7e34',
    color: '#fff',
  },
  btnApplyError: {
    backgroundColor: '#c94b4b',
    color: '#fff',
  },
  overrideLink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#856404',
    textDecoration: 'underline',
    padding: '0',
    alignSelf: 'center',
  },
  // S14: Repeater Guard styles
  guardBanner: {
    backgroundColor: '#eef2ff',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'center',
    textAlign: 'center',
  },
  guardIcon: {
    fontSize: '28px',
    lineHeight: 1,
    marginBottom: '2px',
  },
  guardTitle: {
    fontWeight: 700,
    fontSize: '13px',
    color: '#312e81',
  },
  guardSubtitle: {
    fontSize: '12px',
    color: '#4338ca',
    lineHeight: 1.5,
  },
  guardCode: {
    fontFamily: 'monospace',
    fontWeight: 700,
    backgroundColor: '#e0e7ff',
    padding: '1px 5px',
    borderRadius: '3px',
  },
  btnEnterTemplate: {
    backgroundColor: '#4338ca',
    color: '#fff',
  },
  complete: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  completeIcon: {
    fontSize: '40px',
    marginBottom: '12px',
  },
  completeTitle: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#162d3d',
    marginBottom: '8px',
  },
  completeText: {
    fontSize: '13px',
    color: '#7a92a5',
    lineHeight: 1.5,
  },
};
