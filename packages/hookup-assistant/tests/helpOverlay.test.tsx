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

  it('does not call onClose when the card itself is clicked', () => {
    const onClose = vi.fn();
    render(<HelpOverlay onClose={onClose} />);
    // Clicking the close button calls onClose, but click on a shortcut row should not
    fireEvent.click(screen.getByText('D'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
