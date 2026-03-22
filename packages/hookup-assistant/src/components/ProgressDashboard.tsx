/**
 * ProgressDashboard — S8: global progress bar, per-page list, reset controls,
 * and session stats.
 *
 * Rendered inside HookupPanel when the user opens the Progress view.
 * Reads all-page progress from localStorage via useProgressDashboard.
 */

import React from 'react';
import { useProgressDashboard } from '../hooks/useProgressDashboard.js';

const PRIORITY_LABELS: Record<string, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
};

interface ProgressDashboardProps {
  currentPageName: string;
  /** Called when the current page is reset so HookupPanel can sync usePageProgress state. */
  onCurrentPageReset: () => void;
}

export function ProgressDashboard({ currentPageName, onCurrentPageReset }: ProgressDashboardProps) {
  const { pages, totalHooked, totalElements, sessionHooked, resetPage, resetAll } =
    useProgressDashboard();

  const globalPct = totalElements > 0 ? Math.round((totalHooked / totalElements) * 100) : 0;

  function handleResetPage(pageName: string) {
    if (confirm(`Reset all progress for "${pageName}"?`)) {
      resetPage(pageName);
      if (pageName === currentPageName) onCurrentPageReset();
    }
  }

  function handleResetAll() {
    if (confirm('Reset ALL page progress? This cannot be undone.')) {
      resetAll();
      onCurrentPageReset();
    }
  }

  return (
    <div style={s.root}>
      {/* Global summary */}
      <div style={s.globalSection}>
        <div style={s.globalHeader}>
          <span style={s.globalTitle}>Overall Progress</span>
          <button
            style={s.resetAllBtn}
            onClick={handleResetAll}
            aria-label="Reset all pages"
          >
            Reset All
          </button>
        </div>
        <div
          style={s.barTrack}
          role="progressbar"
          aria-valuenow={globalPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall hookup progress"
        >
          <div style={{ ...s.barFill, width: `${globalPct}%` }} />
        </div>
        <div style={s.globalStats}>
          <span style={s.pct}>{globalPct}%</span>
          <span style={s.counts}>
            {totalHooked} / {totalElements} elements
          </span>
        </div>
        {sessionHooked > 0 && (
          <div style={s.sessionStat} aria-label="Session progress">
            +{sessionHooked} hooked this session
          </div>
        )}
      </div>

      <div style={s.divider} />

      {/* Per-page list grouped by priority */}
      <div style={s.pageList}>
        {(['P0', 'P1', 'P2', 'P3'] as const).map((pri) => {
          const group = pages.filter((p) => p.priority === pri);
          if (!group.length) return null;
          return (
            <div key={pri}>
              <div style={s.groupHeader}>
                {pri} — {PRIORITY_LABELS[pri]}
              </div>
              {group.map((page) => {
                const pct =
                  page.total > 0 ? Math.round((page.hooked / page.total) * 100) : 0;
                const isCurrent = page.name === currentPageName;
                return (
                  <div
                    key={page.name}
                    style={{ ...s.pageRow, ...(isCurrent ? s.currentPageRow : {}) }}
                  >
                    <div style={s.pageInfo}>
                      <span style={s.pageName} title={page.name}>
                        {isCurrent && (
                          <span style={s.currentDot} aria-hidden="true">
                            ⬤{' '}
                          </span>
                        )}
                        {page.name}
                      </span>
                      <div style={s.miniBarTrack}>
                        <div style={{ ...s.miniBarFill, width: `${pct}%` }} />
                      </div>
                      <span style={s.pageCounts}>
                        {page.hooked}/{page.total}
                      </span>
                    </div>
                    <button
                      style={s.resetPageBtn}
                      onClick={() => handleResetPage(page.name)}
                      aria-label={`Reset ${page.name}`}
                    >
                      Reset
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
  },
  globalSection: {
    padding: '10px 12px 8px',
    backgroundColor: '#f0f4f7',
    flexShrink: 0,
  },
  globalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  globalTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#162d3d',
  },
  resetAllBtn: {
    fontSize: '10px',
    color: '#c94b4b',
    background: 'none',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
    padding: '2px 7px',
    cursor: 'pointer',
  },
  barTrack: {
    height: '8px',
    backgroundColor: '#dfe5eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#3a9e5f',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  globalStats: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pct: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#162d3d',
  },
  counts: {
    fontSize: '10px',
    color: '#7a92a5',
  },
  sessionStat: {
    marginTop: '5px',
    fontSize: '10px',
    color: '#3a9e5f',
    fontWeight: 600,
  },
  divider: {
    height: '1px',
    backgroundColor: '#dfe5eb',
    flexShrink: 0,
  },
  pageList: {
    flex: 1,
    overflowY: 'auto',
  },
  groupHeader: {
    fontSize: '9px',
    fontWeight: 700,
    color: '#7a92a5',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    padding: '6px 12px 2px',
    backgroundColor: '#fafbfc',
  },
  pageRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px',
    gap: '6px',
    borderBottom: '1px solid #f0f4f7',
  },
  currentPageRow: {
    backgroundColor: '#f0f7ff',
  },
  pageInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  pageName: {
    fontSize: '11px',
    color: '#32536a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  currentDot: {
    fontSize: '6px',
    color: '#28a745',
    verticalAlign: 'middle',
  },
  miniBarTrack: {
    height: '4px',
    backgroundColor: '#dfe5eb',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: '#3a9e5f',
    borderRadius: '2px',
  },
  pageCounts: {
    fontSize: '10px',
    color: '#7a92a5',
  },
  resetPageBtn: {
    flexShrink: 0,
    fontSize: '9px',
    color: '#c94b4b',
    background: 'none',
    border: '1px solid #f5c6cb',
    borderRadius: '3px',
    padding: '1px 5px',
    cursor: 'pointer',
  },
};
