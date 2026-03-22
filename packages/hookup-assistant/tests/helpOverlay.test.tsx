/**
 * helpOverlay.test.tsx — HelpOverlay component render tests.
 *
 * Covers:
 *  - renders keyboard shortcuts dialog
 *  - close button calls onClose
 *  - clicking the backdrop calls onClose
 *  - clicking the card does NOT propagate to backdrop
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HelpOverlay } from '../src/components/HelpOverlay.js';

describe('HelpOverlay', () => {
  it('renders the keyboard shortcuts dialog', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });

  it('renders shortcut entries', () => {
    render(<HelpOverlay onClose={vi.fn()} />);
    expect(screen.getByText('Mark Done')).toBeInTheDocument();
    expect(screen.getByText('Skip element')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close help/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking content inside the card', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    // 'D' is the key-cap label for the Mark Done shortcut, inside the card content area.
    // Clicking it must not bubble up to the backdrop handler.
    fireEvent.click(screen.getByText('D'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
