/**
 * progressDashboardComponent.test.tsx — ProgressDashboard component tests.
 *
 * S8: global bar, per-page list, reset controls, session stats.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock useProgressDashboard ──────────────────────────────────────────────────

const mockResetPage = vi.fn();
const mockResetAll = vi.fn();
const mockRefresh = vi.fn();

const mockPages = [
  { name: 'Home', priority: 'P0' as const, total: 35, hooked: 14, skipped: 2 },
  { name: 'Product Page', priority: 'P0' as const, total: 87, hooked: 0, skipped: 0 },
  { name: 'Cart Page', priority: 'P1' as const, total: 42, hooked: 5, skipped: 1 },
];

vi.mock('../src/hooks/useProgressDashboard.js', () => ({
  useProgressDashboard: vi.fn(() => ({
    pages: mockPages,
    totalHooked: 19,
    totalElements: 164,
    sessionHooked: 7,
    resetPage: mockResetPage,
    resetAll: mockResetAll,
    refresh: mockRefresh,
  })),
}));

import { ProgressDashboard } from '../src/components/ProgressDashboard.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

// ── Global progress bar ───────────────────────────────────────────────────────

describe('ProgressDashboard — global progress bar', () => {
  it('renders "Overall Progress" heading', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByText('Overall Progress')).toBeInTheDocument();
  });

  it('shows percentage text (12% of 19/164)', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    // Math.round(19/164 * 100) = 12
    expect(screen.getByText('12%')).toBeInTheDocument();
  });

  it('shows element counts', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByText(/19 \/ 164 elements/)).toBeInTheDocument();
  });

  it('renders progressbar role with correct aria attrs', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '12');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});

// ── Session stats ─────────────────────────────────────────────────────────────

describe('ProgressDashboard — session stats', () => {
  it('shows session stat when sessionHooked > 0', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByText('+7 hooked this session')).toBeInTheDocument();
  });
});

// ── Per-page list ─────────────────────────────────────────────────────────────

describe('ProgressDashboard — per-page list', () => {
  it('renders all page names', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByTitle('Home')).toBeInTheDocument();
    expect(screen.getByTitle('Product Page')).toBeInTheDocument();
    expect(screen.getByTitle('Cart Page')).toBeInTheDocument();
  });

  it('renders per-page hooked/total counts', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByText('14/35')).toBeInTheDocument();
    expect(screen.getByText('0/87')).toBeInTheDocument();
    expect(screen.getByText('5/42')).toBeInTheDocument();
  });

  it('renders priority group headers', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByText(/P0.*Critical/i)).toBeInTheDocument();
    expect(screen.getByText(/P1.*High/i)).toBeInTheDocument();
  });
});

// ── Reset controls ────────────────────────────────────────────────────────────

describe('ProgressDashboard — Reset All', () => {
  it('renders Reset All button', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reset all pages/i })).toBeInTheDocument();
  });

  it('calls resetAll and onCurrentPageReset on confirm', () => {
    const onReset = vi.fn();
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /reset all pages/i }));
    expect(mockResetAll).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('does not call resetAll when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /reset all pages/i }));
    expect(mockResetAll).not.toHaveBeenCalled();
  });
});

describe('ProgressDashboard — per-page Reset buttons', () => {
  it('renders a Reset button for each page', () => {
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    // Each page has an aria-label="Reset <PageName>"
    expect(screen.getByRole('button', { name: /reset home/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset product page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset cart page/i })).toBeInTheDocument();
  });

  it('calls resetPage with page name on confirm', () => {
    render(<ProgressDashboard currentPageName="Product Page" onCurrentPageReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /reset product page/i }));
    expect(mockResetPage).toHaveBeenCalledWith('Product Page');
  });

  it('calls onCurrentPageReset when current page is reset', () => {
    const onReset = vi.fn();
    render(<ProgressDashboard currentPageName="Cart Page" onCurrentPageReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /reset cart page/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('does NOT call onCurrentPageReset when a different page is reset', () => {
    const onReset = vi.fn();
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /reset cart page/i }));
    expect(onReset).not.toHaveBeenCalled();
  });

  it('does not call resetPage when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ProgressDashboard currentPageName="Home" onCurrentPageReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /reset home/i }));
    expect(mockResetPage).not.toHaveBeenCalled();
  });
});
