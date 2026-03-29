import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HookupPanel } from '../components/HookupPanel.js';

// Mock @wix/design-system — not available in jsdom test env
vi.mock('@wix/design-system', () => ({
  WixDesignSystemProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('HookupPanel', () => {
  it('renders app name', () => {
    render(<HookupPanel />);
    expect(screen.getByText('CF Hookup Assistant')).toBeTruthy();
  });

  it('renders version', () => {
    render(<HookupPanel />);
    expect(screen.getByText(/v0\.\d+\.\d+/)).toBeTruthy();
  });

  it('renders placeholder status chips', () => {
    render(<HookupPanel />);
    expect(screen.getByText(/PAGES data/)).toBeTruthy();
    expect(screen.getByText(/Element detection/)).toBeTruthy();
    expect(screen.getByText(/Manual mode/)).toBeTruthy();
  });

  it('renders footer branding', () => {
    render(<HookupPanel />);
    expect(screen.getByText(/Carolina Futons/)).toBeTruthy();
  });
});
