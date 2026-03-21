/**
 * repeaterGuard.test.tsx — S14: Repeater Guard tests.
 *
 * Tests for:
 *   - useRepeaterGuard hook: isGuardActive, confirmEntered, resetAll
 *   - ManualModePanel repeaterGuard prop: guard UI rendering and interaction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { ManualModePanel } from '../src/components/ManualModePanel.js';
import { useRepeaterGuard } from '../src/hooks/useRepeaterGuard.js';
import type { ElementDef } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// useRepeaterGuard hook tests

describe('useRepeaterGuard', () => {
  it('guard is active for a repeater ID by default', () => {
    const { result } = renderHook(() => useRepeaterGuard());
    expect(result.current.isGuardActive('featuredRepeater')).toBe(true);
  });

  it('guard is inactive after confirmEntered', () => {
    const { result } = renderHook(() => useRepeaterGuard());
    act(() => {
      result.current.confirmEntered('featuredRepeater');
    });
    expect(result.current.isGuardActive('featuredRepeater')).toBe(false);
  });

  it('guard remains active for other repeater IDs after confirmEntered', () => {
    const { result } = renderHook(() => useRepeaterGuard());
    act(() => {
      result.current.confirmEntered('featuredRepeater');
    });
    expect(result.current.isGuardActive('saleRepeater')).toBe(true);
  });

  it('can confirm multiple repeaters independently', () => {
    const { result } = renderHook(() => useRepeaterGuard());
    act(() => {
      result.current.confirmEntered('featuredRepeater');
      result.current.confirmEntered('saleRepeater');
    });
    expect(result.current.isGuardActive('featuredRepeater')).toBe(false);
    expect(result.current.isGuardActive('saleRepeater')).toBe(false);
    expect(result.current.isGuardActive('categoryRepeater')).toBe(true);
  });

  it('resetAll makes all previously confirmed repeaters active again', () => {
    const { result } = renderHook(() => useRepeaterGuard());
    act(() => {
      result.current.confirmEntered('featuredRepeater');
      result.current.confirmEntered('saleRepeater');
    });
    act(() => {
      result.current.resetAll();
    });
    expect(result.current.isGuardActive('featuredRepeater')).toBe(true);
    expect(result.current.isGuardActive('saleRepeater')).toBe(true);
  });

  it('confirmEntered is idempotent — calling twice does not error', () => {
    const { result } = renderHook(() => useRepeaterGuard());
    act(() => {
      result.current.confirmEntered('featuredRepeater');
      result.current.confirmEntered('featuredRepeater');
    });
    expect(result.current.isGuardActive('featuredRepeater')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ManualModePanel repeater guard prop tests

const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(global.navigator, 'clipboard', {
  value: { writeText: clipboardWriteText },
  writable: true,
  configurable: true,
});

const featuredCard: ElementDef = {
  id: 'featuredCard',
  type: 'Box',
  notes: 'Card container',
};

const baseProps = {
  pageName: 'Home',
  currentElement: featuredCard,
  nextElement: null,
  hookedCount: 10,
  totalCount: 75,
  selectedType: null as ElementDef['type'] | null,
  onMarkDone: vi.fn(),
  onSkip: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Guard display ──────────────────────────────────────────────────────────

describe('ManualModePanel — S14 repeater guard display', () => {
  it('does NOT show guard when repeaterGuard is null', () => {
    render(<ManualModePanel {...baseProps} repeaterGuard={null} />);
    expect(screen.queryByText(/Repeater Template Required/i)).toBeNull();
    // Normal element ID should be shown
    expect(screen.getByText('featuredCard')).toBeInTheDocument();
  });

  it('does NOT show guard when repeaterGuard is undefined', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.queryByText(/Repeater Template Required/i)).toBeNull();
    expect(screen.getByText('featuredCard')).toBeInTheDocument();
  });

  it('shows guard title when repeaterGuard is set', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.getByText(/Repeater Template Required/i)).toBeInTheDocument();
  });

  it('shows the repeater ID in the guard', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    // The repeater ID appears in multiple places — just verify at least one match exists
    const matches = screen.getAllByText(/#featuredRepeater/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows the section name in the guard', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.getByText(/Featured Products/i)).toBeInTheDocument();
  });

  it('shows the "I\'m in the template" button when guard is active', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Confirm entered repeater template: featuredRepeater/i }))
      .toBeInTheDocument();
  });

  it('shows step-by-step instruction to enter the repeater', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.getByText(/Edit Repeater/i)).toBeInTheDocument();
  });

  it('hides the element ID when guard is active', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    // featuredCard ID should NOT be shown (guard is blocking)
    expect(screen.queryByText('featuredCard')).toBeNull();
  });

  it('hides Copy ID button when guard is active', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.queryByText(/Copy ID/i)).toBeNull();
  });

  it('hides Mark Done button when guard is active', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /Mark Done/i })).toBeNull();
  });
});

// ── Guard interaction ──────────────────────────────────────────────────────

describe('ManualModePanel — S14 repeater guard interaction', () => {
  it('calls onEnterRepeaterTemplate when "I\'m in the template" is clicked', () => {
    const onEnterRepeaterTemplate = vi.fn();
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={onEnterRepeaterTemplate}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Confirm entered repeater template: featuredRepeater/i })
    );
    expect(onEnterRepeaterTemplate).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onEnterRepeaterTemplate is not provided', () => {
    render(
      <ManualModePanel
        {...baseProps}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
      />
    );
    expect(() =>
      fireEvent.click(
        screen.getByRole('button', { name: /Confirm entered repeater template: featuredRepeater/i })
      )
    ).not.toThrow();
  });

  it('guard is NOT shown when currentElement is null (completion state takes priority)', () => {
    render(
      <ManualModePanel
        {...baseProps}
        currentElement={null}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    expect(screen.queryByText(/Repeater Template Required/i)).toBeNull();
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('Tab key does NOT call onMarkDone while guard is active', () => {
    const onMarkDone = vi.fn();
    render(
      <ManualModePanel
        {...baseProps}
        onMarkDone={onMarkDone}
        repeaterGuard={{ repeaterId: 'featuredRepeater', sectionName: 'Featured Products' }}
        onEnterRepeaterTemplate={vi.fn()}
      />
    );
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(onMarkDone).not.toHaveBeenCalled();
  });
});
