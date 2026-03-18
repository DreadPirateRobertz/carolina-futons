/**
 * manualMode.test.tsx — S10: ManualModePanel component tests.
 *
 * Tests Copy ID, Mark Done, Skip, Tab navigation, type mismatch,
 * flags display, and completion state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualModePanel } from '../src/components/ManualModePanel.js';
import type { ElementDef } from '../src/types/index.js';

// Mock clipboard
const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(global.navigator, 'clipboard', {
  value: { writeText },
  writable: true,
  configurable: true,
});

const heroTitle: ElementDef = {
  id: 'heroTitle',
  type: 'Text',
  notes: 'H1, code sets text',
  defaultHidden: true,
};

const heroCTA: ElementDef = {
  id: 'heroCTA',
  type: 'Button',
  notes: 'Shop Now button',
};

const baseProps = {
  pageName: 'Home',
  currentElement: heroTitle,
  nextElement: heroCTA,
  hookedCount: 5,
  totalCount: 75,
  selectedType: null as ElementDef['type'] | null,
  onMarkDone: vi.fn(),
  onSkip: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
});

// ── Display ────────────────────────────────────────────────────────────────

describe('ManualModePanel — display', () => {
  it('shows the element ID in the id block', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText('heroTitle')).toBeInTheDocument();
  });

  it('shows the page name', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('shows progress count', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText('5/75')).toBeInTheDocument();
  });

  it('shows element type badge', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('shows element notes', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText('H1, code sets text')).toBeInTheDocument();
  });

  it('shows Copy ID button', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText(/Copy ID/i)).toBeInTheDocument();
  });

  it('shows Mark Done button', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText(/Mark Done/i)).toBeInTheDocument();
  });

  it('shows Skip button', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText(/Skip/i)).toBeInTheDocument();
  });

  it('shows 3-step instruction text', () => {
    render(<ManualModePanel {...baseProps} />);
    expect(screen.getByText(/Properties & Events/i)).toBeInTheDocument();
  });

  it('shows "Hidden on load" flag for defaultHidden element', () => {
    render(<ManualModePanel {...baseProps} currentElement={heroTitle} />);
    expect(screen.getByText(/Hidden on load/i)).toBeInTheDocument();
  });

  it('does not show flags for element with no flags', () => {
    render(<ManualModePanel {...baseProps} currentElement={heroCTA} />);
    expect(screen.queryByText(/Hidden on load/i)).toBeNull();
    expect(screen.queryByText(/Collapsed/i)).toBeNull();
  });

  it('shows "Collapsed on load" flag for defaultCollapsed element', () => {
    const el: ElementDef = { id: 'saleSection', type: 'Section', notes: 'sale section', defaultCollapsed: true };
    render(<ManualModePanel {...baseProps} currentElement={el} />);
    expect(screen.getByText(/Collapsed on load/i)).toBeInTheDocument();
  });

  it('shows CSS/Theme flag for cssOnly element', () => {
    const el: ElementDef = { id: 'themeBox', type: 'Box', notes: 'theme', cssOnly: true };
    render(<ManualModePanel {...baseProps} currentElement={el} />);
    expect(screen.getByText(/CSS\/Theme/i)).toBeInTheDocument();
  });
});

// ── Type mismatch ──────────────────────────────────────────────────────────

describe('ManualModePanel — type mismatch', () => {
  it('shows no warning when selectedType is null', () => {
    render(<ManualModePanel {...baseProps} selectedType={null} />);
    expect(screen.queryByText(/Expected/i)).toBeNull();
  });

  it('shows no warning when selectedType matches element type', () => {
    render(<ManualModePanel {...baseProps} selectedType="Text" />);
    expect(screen.queryByText(/Expected/i)).toBeNull();
  });

  it('shows warning when selectedType mismatches element type', () => {
    render(<ManualModePanel {...baseProps} selectedType="Button" />);
    // Warning div contains both expected and selected types
    const warning = screen.getByText(/Expected/i);
    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toContain('Text');
    expect(warning.textContent).toContain('Button');
  });
});

// ── Actions ────────────────────────────────────────────────────────────────

describe('ManualModePanel — actions', () => {
  it('calls onMarkDone when Mark Done is clicked', () => {
    const onMarkDone = vi.fn();
    render(<ManualModePanel {...baseProps} onMarkDone={onMarkDone} />);
    fireEvent.click(screen.getByText(/Mark Done/i));
    expect(onMarkDone).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when Skip is clicked', () => {
    const onSkip = vi.fn();
    render(<ManualModePanel {...baseProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByText(/Skip/i));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('copies element ID to clipboard when Copy ID is clicked', async () => {
    render(<ManualModePanel {...baseProps} />);
    await userEvent.click(screen.getByText(/Copy ID/i));
    expect(writeText).toHaveBeenCalledWith('heroTitle');
  });

  it('shows "Copied!" feedback after copy', async () => {
    render(<ManualModePanel {...baseProps} />);
    await userEvent.click(screen.getByText(/Copy ID/i));
    expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
  });
});

// ── Tab key ────────────────────────────────────────────────────────────────

describe('ManualModePanel — Tab key navigation', () => {
  it('calls onMarkDone when Tab is pressed', () => {
    const onMarkDone = vi.fn();
    render(<ManualModePanel {...baseProps} onMarkDone={onMarkDone} />);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(onMarkDone).toHaveBeenCalledTimes(1);
  });

  it('does not call onMarkDone on Shift+Tab', () => {
    const onMarkDone = vi.fn();
    render(<ManualModePanel {...baseProps} onMarkDone={onMarkDone} />);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(onMarkDone).not.toHaveBeenCalled();
  });
});

// ── Completion state ───────────────────────────────────────────────────────

describe('ManualModePanel — completion state', () => {
  it('shows completion message when currentElement is null', () => {
    render(<ManualModePanel {...baseProps} currentElement={null} />);
    expect(screen.getByText(/complete/i)).toBeInTheDocument();
  });

  it('does not show Copy ID button in completion state', () => {
    render(<ManualModePanel {...baseProps} currentElement={null} />);
    expect(screen.queryByText(/Copy ID/i)).toBeNull();
  });
});
