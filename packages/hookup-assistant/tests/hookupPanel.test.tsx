/**
 * hookupPanel.test.tsx — HookupPanel component render tests.
 *
 * Covers:
 *  - renders app header (name, version)
 *  - manual mode badge shows by default, hides when toggled off
 *  - settings drawer toggles on settings button click
 *  - "Editor not detected" banner shows when editorAvailable false
 *  - detection row shows when editorAvailable true
 *  - conflict banner shown when pendingConflict is set
 *  - auto-page-switch: when detectedPageName changes, the page selector reflects the new value
 *  - footer progress counter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Hook mock factories ──────────────────────────────────────────────────────

const {
  mockUseElementDetection,
  mockUsePageNavigator,
  mockUsePageProgress,
  mockUseIdApply,
  mockUseRepeaterGuard,
  mockUseConflictDetector,
  mockDetectConflict,
  mockUseSessionTimer,
} = vi.hoisted(() => ({
  mockUseElementDetection: vi.fn(),
  mockUsePageNavigator: vi.fn(),
  mockUsePageProgress: vi.fn(),
  mockUseIdApply: vi.fn(),
  mockUseRepeaterGuard: vi.fn(),
  mockUseConflictDetector: vi.fn(),
  mockDetectConflict: vi.fn(),
  mockUseSessionTimer: vi.fn(),
}));

vi.mock('../src/hooks/useElementDetection.js', () => ({
  useElementDetection: mockUseElementDetection,
}));
vi.mock('../src/hooks/usePageNavigator.js', () => ({
  usePageNavigator: mockUsePageNavigator,
}));
vi.mock('../src/hooks/usePageProgress.js', () => ({
  usePageProgress: mockUsePageProgress,
  readPageHookedCount: vi.fn(() => 0),
}));
vi.mock('../src/hooks/useIdApply.js', () => ({
  useIdApply: mockUseIdApply,
}));
vi.mock('../src/hooks/useRepeaterGuard.js', () => ({
  useRepeaterGuard: mockUseRepeaterGuard,
}));
vi.mock('../src/hooks/useKeyboardShortcuts.js', () => ({
  useKeyboardShortcuts: vi.fn(),
}));
vi.mock('../src/hooks/useConflictDetector.js', () => ({
  useConflictDetector: mockUseConflictDetector,
  detectConflict: mockDetectConflict,
}));
vi.mock('../src/hooks/useSessionTimer.js', () => ({
  useSessionTimer: mockUseSessionTimer,
  formatElapsed: (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`,
  loadHistory: () => [],
}));
vi.mock('../src/hooks/useProgressDashboard.js', () => ({
  useProgressDashboard: vi.fn(() => ({
    pages: [],
    totalHooked: 0,
    totalElements: 0,
    sessionHooked: 0,
    resetPage: vi.fn(),
    resetAll: vi.fn(),
    refresh: vi.fn(),
  })),
}));
// Stub ProgressDashboard so HookupPanel tests don't depend on its internals
vi.mock('../src/components/ProgressDashboard.js', () => ({
  ProgressDashboard: () => <div data-testid="progress-dashboard">Progress Dashboard</div>,
}));

import { HookupPanel } from '../src/components/HookupPanel.js';

// ── Default hook returns ─────────────────────────────────────────────────────

function setupDefaults({
  editorAvailable = false,
  selected = null,
  detectedPageName = null,
  pendingConflict = null,
} = {}) {
  mockUseElementDetection.mockReturnValue({ selected, editorAvailable });
  mockUsePageNavigator.mockReturnValue({ detectedPageName });
  mockUsePageProgress.mockReturnValue({
    hookedIds: [],
    skippedIds: [],
    markHooked: vi.fn(),
    markSkipped: vi.fn(),
    undoLast: vi.fn(),
    resetPage: vi.fn(),
  });
  mockUseIdApply.mockReturnValue({
    applyId: vi.fn(),
    status: 'idle',
    resetStatus: vi.fn(),
  });
  mockUseRepeaterGuard.mockReturnValue({
    isGuardActive: vi.fn(() => false),
    confirmEntered: vi.fn(),
    resetAll: vi.fn(),
  });
  mockUseConflictDetector.mockReturnValue({
    pendingConflict,
    openConflict: vi.fn(),
    clearConflict: vi.fn(),
  });
  mockDetectConflict.mockReturnValue({ type: 'none' });
  mockUseSessionTimer.mockReturnValue({
    started: false,
    elapsed: 0,
    applyCount: 0,
    paused: false,
    pace: 0,
    recordApply: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// ── Header ───────────────────────────────────────────────────────────────────

describe('HookupPanel — header', () => {
  it('renders the app name', () => {
    render(<HookupPanel />);
    expect(screen.getByText('CF Hookup Assistant')).toBeInTheDocument();
  });

  it('renders a version string', () => {
    render(<HookupPanel />);
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument();
  });

  it('shows Manual Mode badge by default', () => {
    render(<HookupPanel />);
    expect(screen.getByText('Manual Mode')).toBeInTheDocument();
  });
});

// ── Settings drawer ───────────────────────────────────────────────────────────

describe('HookupPanel — settings drawer', () => {
  it('opens settings drawer on settings button click', () => {
    render(<HookupPanel />);
    const btn = screen.getByRole('button', { name: /toggle settings/i });
    fireEvent.click(btn);
    // "Reset page progress" button is rendered only inside the settings drawer; its presence confirms the drawer is open.
    expect(screen.getByRole('button', { name: /reset page progress/i })).toBeInTheDocument();
  });

  it('hides Manual Mode badge after unchecking in settings', () => {
    render(<HookupPanel />);
    // Open settings
    fireEvent.click(screen.getByRole('button', { name: /toggle settings/i }));
    // Uncheck Manual Mode checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(screen.queryByText('Manual Mode')).not.toBeInTheDocument();
  });

  it('shows Export JSON button in settings', () => {
    render(<HookupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /toggle settings/i }));
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
  });
});

// ── Editor detection status ───────────────────────────────────────────────────

describe('HookupPanel — editor status', () => {
  it('shows "Editor not detected" when editorAvailable is false', () => {
    setupDefaults({ editorAvailable: false });
    render(<HookupPanel />);
    expect(screen.getByText(/editor not detected/i)).toBeInTheDocument();
  });

  it('hides "Editor not detected" when editorAvailable is true', () => {
    setupDefaults({ editorAvailable: true });
    render(<HookupPanel />);
    expect(screen.queryByText(/editor not detected/i)).not.toBeInTheDocument();
  });

  it('shows "Select an element" prompt when editor available but nothing selected', () => {
    setupDefaults({ editorAvailable: true, selected: null });
    render(<HookupPanel />);
    expect(screen.getByText(/select an element/i)).toBeInTheDocument();
  });

  it('shows selected element type when editor available and element selected', () => {
    setupDefaults({
      editorAvailable: true,
      selected: { compRef: {}, internalType: 'wixui.Button', elementType: 'Button', currentNickname: null },
    });
    render(<HookupPanel />);
    expect(screen.getAllByText('Button', { selector: 'strong' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows element nickname when selected element has a nickname', () => {
    setupDefaults({
      editorAvailable: true,
      selected: { compRef: {}, internalType: 'wixui.Button', elementType: 'Button', currentNickname: 'shopBtn' },
    });
    render(<HookupPanel />);
    expect(screen.getByText(/#shopBtn/)).toBeInTheDocument();
  });
});

// ── Conflict banner ───────────────────────────────────────────────────────────

describe('HookupPanel — conflict banner', () => {
  it('shows conflict banner when pendingConflict is set', () => {
    setupDefaults({ pendingConflict: 'oldNickname' });
    // Default page 'Home' always has elements, so currentElement is non-null — banner renders.
    render(<HookupPanel />);
    expect(screen.getByText(/id conflict/i)).toBeInTheDocument();
  });

  it('does not show conflict banner when pendingConflict is null', () => {
    setupDefaults({ pendingConflict: null });
    render(<HookupPanel />);
    expect(screen.queryByText(/id conflict/i)).not.toBeInTheDocument();
  });
});

// ── Footer ────────────────────────────────────────────────────────────────────

describe('HookupPanel — footer', () => {
  it('shows Carolina Futons in the footer', () => {
    render(<HookupPanel />);
    expect(screen.getByText(/carolina futons/i)).toBeInTheDocument();
  });

  it('shows addressed count in footer', () => {
    render(<HookupPanel />);
    // 0 hookedIds + 0 skippedIds = 0 addressed
    expect(screen.getByText(/0\s*\/\s*\d+\s*addressed/i)).toBeInTheDocument();
  });
});

// ── Session timer display (S9) ────────────────────────────────────────────────

describe('HookupPanel — session timer (S9)', () => {
  it('shows no timer in footer when elapsed is 0', () => {
    render(<HookupPanel />);
    expect(screen.queryByText(/⏱|⏸/)).not.toBeInTheDocument();
  });

  it('shows elapsed time in footer when timer has started', () => {
    mockUseSessionTimer.mockReturnValue({
      started: true, elapsed: 90000, applyCount: 3, paused: false, pace: 0, recordApply: vi.fn(),
    });
    render(<HookupPanel />);
    expect(screen.getByText(/⏱/)).toBeInTheDocument();
    expect(screen.getByText(/1:30/)).toBeInTheDocument();
  });

  it('shows pause icon when paused', () => {
    mockUseSessionTimer.mockReturnValue({
      started: true, elapsed: 60000, applyCount: 1, paused: true, pace: 0, recordApply: vi.fn(),
    });
    render(<HookupPanel />);
    expect(screen.getByText(/⏸/)).toBeInTheDocument();
  });

  it('shows pace when pace > 0', () => {
    mockUseSessionTimer.mockReturnValue({
      started: true, elapsed: 60000, applyCount: 5, paused: false, pace: 12.5, recordApply: vi.fn(),
    });
    render(<HookupPanel />);
    expect(screen.getByText(/12\.5\/hr/)).toBeInTheDocument();
  });
});

// ── Auto-page-switch ──────────────────────────────────────────────────────────

describe('HookupPanel — auto page switch via detectedPageName', () => {
  it('page selector value reflects detectedPageName on render', () => {
    setupDefaults({ detectedPageName: 'Product Page' });
    render(<HookupPanel />);
    const select = screen.getByRole('combobox', { name: /select page/i });
    expect((select as HTMLSelectElement).value).toBe('Product Page');
  });
});

// ── S8: Progress Dashboard toggle ─────────────────────────────────────────────

describe('HookupPanel — progress dashboard toggle', () => {
  it('renders the Progress Dashboard button', () => {
    render(<HookupPanel />);
    expect(
      screen.getByRole('button', { name: /toggle progress dashboard/i }),
    ).toBeInTheDocument();
  });

  it('shows progress dashboard when Progress button is clicked', () => {
    render(<HookupPanel />);
    const btn = screen.getByRole('button', { name: /toggle progress dashboard/i });
    fireEvent.click(btn);
    expect(screen.getByTestId('progress-dashboard')).toBeInTheDocument();
  });

  it('hides progress dashboard when Progress button is clicked again', () => {
    render(<HookupPanel />);
    const btn = screen.getByRole('button', { name: /toggle progress dashboard/i });
    fireEvent.click(btn);
    expect(screen.getByTestId('progress-dashboard')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByTestId('progress-dashboard')).not.toBeInTheDocument();
  });

  it('dashboard is not shown by default', () => {
    render(<HookupPanel />);
    expect(screen.queryByTestId('progress-dashboard')).not.toBeInTheDocument();
  });
});
