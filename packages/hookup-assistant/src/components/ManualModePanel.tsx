/**
 * ManualModePanel — S10: Fallback Manual Mode UI.
 *
 * The guaranteed-always-works baseline for element ID hookup.
 * When in manual mode:
 *   - Shows the target Velo ID in large monospace font
 *   - "Copy ID" button copies it to clipboard
 *   - Instructions: open Properties & Events → paste the ID
 *   - "Mark Done" advances to next element
 *   - "Skip" skips current element
 *   - Tab key advances to next element
 *   - Progress bar shows done / total
 */

import React, { useEffect, useRef } from 'react';
import type { ElementDef, WixElementType } from '../types/index.js';
import { useClipboard } from '../hooks/useClipboard.js';

interface ManualModePanelProps {
  pageName: string;
  currentElement: ElementDef | null;
  nextElement: ElementDef | null;
  hookedCount: number;
  totalCount: number;
  selectedType: WixElementType | null;
  onMarkDone: () => void;
  onSkip: () => void;
}

export function ManualModePanel({
  pageName,
  currentElement,
  nextElement: _nextElement,
  hookedCount,
  totalCount,
  selectedType,
  onMarkDone,
  onSkip,
}: ManualModePanelProps) {
  const { copy, copied } = useClipboard();
  const markDoneRef = useRef<HTMLButtonElement>(null);

  // Tab key advances to next element (Mark Done)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab' && !e.shiftKey && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        onMarkDone();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onMarkDone]);

  if (!currentElement) {
    return (
      <div style={s.root}>
        <CompletionState pageName={pageName} total={totalCount} />
      </div>
    );
  }

  const pct = totalCount > 0 ? Math.round((hookedCount / totalCount) * 100) : 0;
  const typeMismatch = selectedType !== null && selectedType !== currentElement.type;

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
          style={{ ...s.btn, ...s.btnSuccess }}
          onClick={onMarkDone}
          aria-label="Mark this element as done and advance to next"
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
