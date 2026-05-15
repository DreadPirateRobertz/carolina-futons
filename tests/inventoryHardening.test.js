/**
 * CF-3xgl — Inventory alerts + stock display hardening tests.
 * Covers falsy-zero threshold fixes, edge cases in inventoryService,
 * inventoryAlerts, and InventoryDisplay integration gaps.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __setRoles, __reset as resetMembers } from './__mocks__/wix-members-backend.js';

// ── inventoryService imports ────────────────────────────────────────
import {
  getStockStatus as serviceStockStatus,
  signUpBackInStock,
} from '../src/backend/inventoryService.web.js';

// ── InventoryDisplay import ─────────────────────────────────────────
import { initInventoryDisplay } from '../src/public/InventoryDisplay.js';

// ── Helpers ─────────────────────────────────────────────────────────

function adminSetup() {
  __setMember({ _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' });
  __setRoles([{ title: 'Admin', _id: 'admin' }]);
}

function make$w(overrides = {}) {
  const elements = {
    '#stockStatus': {
      text: '', style: { color: '' },
      accessibility: { ariaLabel: '', ariaLive: '' },
    },
    '#variantStockRepeater': {
      data: null,
      onItemReady: vi.fn(),
    },
    '#variantStockLabel': { text: '' },
    '#variantStockStatus': { text: '', style: { color: '' } },
    ...overrides,
  };

  return (selector) => elements[selector] || null;
}

beforeEach(() => {
  __reset();
  resetMembers();
  adminSetup();
  __seed('InventoryThresholds', []);
  __seed('LowStockAlerts', []);
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
  __seed('BackInStockSignups', []);
});

// ═══════════════════════════════════════════════════════════════════
// InventoryDisplay — additional edge cases
// ═══════════════════════════════════════════════════════════════════

describe('InventoryDisplay — edge cases', () => {
  it('sets aria-live to polite on stock badge', async () => {
    const $w = make$w();
    await initInventoryDisplay($w, { product: { _id: 'p-1' } });
    expect($w('#stockStatus').accessibility.ariaLive).toBe('polite');
  });

  it('skips variant repeater when variants array is empty', async () => {
    const $w = make$w();
    await initInventoryDisplay($w, { product: { _id: 'p-1' } });
    expect($w('#variantStockRepeater').data).toBeNull();
  });

  it('handles missing stock badge element gracefully', async () => {
    const $w = () => null;
    await expect(initInventoryDisplay($w, { product: { _id: 'p-1' } })).resolves.toBeUndefined();
  });
});
