import { describe, it, expect } from 'vitest';
import {
  getAdminStatusLabel,
  getNextStatuses,
  isValidTransition,
  getStatusFilterOptions,
  getAdminStatusColor,
  formatAdminReturnRow,
  formatReturnStats,
  validateRefund,
  canGenerateLabel,
  needsAction,
  sortAdminReturns,
} from '../../src/public/ReturnsAdmin.js';
import { colors } from '../../src/public/designTokens.js';

// ── getAdminStatusLabel ──────────────────────────────────────────

describe('getAdminStatusLabel', () => {
  it('returns correct label for each status', () => {
    expect(getAdminStatusLabel('requested')).toBe('Pending Review');
    expect(getAdminStatusLabel('approved')).toBe('Approved');
    expect(getAdminStatusLabel('shipped')).toBe('In Transit');
    expect(getAdminStatusLabel('received')).toBe('Received');
    expect(getAdminStatusLabel('refunded')).toBe('Refunded');
    expect(getAdminStatusLabel('denied')).toBe('Denied');
  });

  it('returns raw status for unknown values', () => {
    expect(getAdminStatusLabel('banana')).toBe('banana');
  });

  it('returns Unknown for empty/null', () => {
    expect(getAdminStatusLabel('')).toBe('Unknown');
    expect(getAdminStatusLabel(null)).toBe('Unknown');
    expect(getAdminStatusLabel(undefined)).toBe('Unknown');
  });
});

// ── getNextStatuses ──────────────────────────────────────────────

describe('getNextStatuses', () => {
  it('returns approve/deny for requested', () => {
    expect(getNextStatuses('requested')).toEqual(['approved', 'denied']);
  });

  it('returns shipped/deny for approved', () => {
    expect(getNextStatuses('approved')).toEqual(['shipped', 'denied']);
  });

  it('returns received for shipped', () => {
    expect(getNextStatuses('shipped')).toEqual(['received']);
  });

  it('returns refunded/deny for received', () => {
    expect(getNextStatuses('received')).toEqual(['refunded', 'denied']);
  });

  it('returns empty for terminal statuses', () => {
    expect(getNextStatuses('refunded')).toEqual([]);
    expect(getNextStatuses('denied')).toEqual([]);
  });

  it('returns empty for unknown status', () => {
    expect(getNextStatuses('nope')).toEqual([]);
  });
});

// ── isValidTransition ────────────────────────────────────────────

describe('isValidTransition', () => {
  it('allows requested → approved', () => {
    expect(isValidTransition('requested', 'approved')).toBe(true);
  });

  it('allows requested → denied', () => {
    expect(isValidTransition('requested', 'denied')).toBe(true);
  });

  it('blocks requested → shipped', () => {
    expect(isValidTransition('requested', 'shipped')).toBe(false);
  });

  it('blocks refunded → anything', () => {
    expect(isValidTransition('refunded', 'requested')).toBe(false);
    expect(isValidTransition('refunded', 'denied')).toBe(false);
  });

  it('blocks denied → anything', () => {
    expect(isValidTransition('denied', 'approved')).toBe(false);
  });

  it('allows shipped → received', () => {
    expect(isValidTransition('shipped', 'received')).toBe(true);
  });

  it('blocks shipped → refunded', () => {
    expect(isValidTransition('shipped', 'refunded')).toBe(false);
  });

  it('returns false for unknown from status', () => {
    expect(isValidTransition('banana', 'approved')).toBe(false);
  });
});

// ── getStatusFilterOptions ───────────────────────────────────────

describe('getStatusFilterOptions', () => {
  it('starts with "All Returns" option', () => {
    const options = getStatusFilterOptions();
    expect(options[0]).toEqual({ label: 'All Returns', value: '' });
  });

  it('includes all 6 statuses', () => {
    const options = getStatusFilterOptions();
    expect(options).toHaveLength(7); // All + 6 statuses
    expect(options.map(o => o.value)).toContain('requested');
    expect(options.map(o => o.value)).toContain('denied');
  });

  it('uses admin labels', () => {
    const options = getStatusFilterOptions();
    const requested = options.find(o => o.value === 'requested');
    expect(requested.label).toBe('Pending Review');
  });
});

// ── getAdminStatusColor ──────────────────────────────────────────

describe('getAdminStatusColor', () => {
  it('returns mountainBlue for requested/approved', () => {
    expect(getAdminStatusColor('requested')).toBe(colors.mountainBlue);
    expect(getAdminStatusColor('approved')).toBe(colors.mountainBlue);
  });

  it('returns sunsetCoral for shipped/received', () => {
    expect(getAdminStatusColor('shipped')).toBe(colors.sunsetCoral);
    expect(getAdminStatusColor('received')).toBe(colors.sunsetCoral);
  });

  it('returns success for refunded', () => {
    expect(getAdminStatusColor('refunded')).toBe(colors.success);
  });

  it('returns error for denied', () => {
    expect(getAdminStatusColor('denied')).toBe(colors.error);
  });

  it('returns textMuted for unknown', () => {
    expect(getAdminStatusColor('banana')).toBe(colors.textMuted);
  });
});

// ── formatAdminReturnRow ─────────────────────────────────────────

describe('formatAdminReturnRow', () => {
  const baseReturn = {
    _id: 'ret-001',
    rmaNumber: 'RMA-ABC-1234',
    orderNumber: '10042',
    memberName: 'John Doe',
    memberEmail: 'john@example.com',
    type: 'return',
    reason: 'Defective',
    details: 'Broken leg',
    status: 'requested',
    items: [{ lineItemId: 'item-1', quantity: 1 }],
    adminNotes: 'Check photos',
    returnTrackingNumber: '',
    refundAmount: null,
    date: 'February 22, 2026',
  };

  it('formats a return row with all fields', () => {
    const row = formatAdminReturnRow(baseReturn);
    expect(row._id).toBe('ret-001');
    expect(row.rmaNumber).toBe('RMA-ABC-1234');
    expect(row.memberName).toBe('John Doe');
    expect(row.type).toBe('Return');
    expect(row.statusLabel).toBe('Pending Review');
    expect(row.statusColor).toBe(colors.mountainBlue);
    expect(row.itemCount).toBe(1);
    expect(row.hasLabel).toBe(false);
  });

  it('formats exchange type', () => {
    const row = formatAdminReturnRow({ ...baseReturn, type: 'exchange' });
    expect(row.type).toBe('Exchange');
  });

  it('handles JSON string items', () => {
    const row = formatAdminReturnRow({
      ...baseReturn,
      items: JSON.stringify([{ lineItemId: 'a', quantity: 1 }, { lineItemId: 'b', quantity: 2 }]),
    });
    expect(row.itemCount).toBe(2);
  });

  it('handles invalid JSON items', () => {
    const row = formatAdminReturnRow({ ...baseReturn, items: 'not-json' });
    expect(row.itemCount).toBe(0);
  });

  it('defaults memberName to Guest', () => {
    const row = formatAdminReturnRow({ ...baseReturn, memberName: '' });
    expect(row.memberName).toBe('Guest');
  });

  it('detects label presence', () => {
    const row = formatAdminReturnRow({ ...baseReturn, returnTrackingNumber: '1Z999AA10123456784' });
    expect(row.hasLabel).toBe(true);
    expect(row.trackingNumber).toBe('1Z999AA10123456784');
  });

  it('returns null for null input', () => {
    expect(formatAdminReturnRow(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatAdminReturnRow(undefined)).toBeNull();
  });
});

// ── formatReturnStats ────────────────────────────────────────────

describe('formatReturnStats', () => {
  it('computes action required from requested + received', () => {
    const stats = formatReturnStats({ requested: 3, received: 2, approved: 1, shipped: 0, refunded: 5, denied: 1, total: 12 });
    expect(stats.actionRequired).toBe(5);
    expect(stats.inProgress).toBe(1);
    expect(stats.completed).toBe(6);
    expect(stats.total).toBe(12);
  });

  it('returns stat cards array', () => {
    const stats = formatReturnStats({ total: 10, requested: 2, received: 1, approved: 3, shipped: 0, refunded: 3, denied: 1 });
    expect(stats.cards).toHaveLength(4);
    expect(stats.cards[0].label).toBe('Total Returns');
    expect(stats.cards[1].label).toBe('Action Required');
    expect(stats.cards[2].label).toBe('In Progress');
    expect(stats.cards[3].label).toBe('Completed');
  });

  it('handles null stats', () => {
    const stats = formatReturnStats(null);
    expect(stats.total).toBe(0);
    expect(stats.actionRequired).toBe(0);
    expect(stats.cards).toHaveLength(0);
  });

  it('handles empty stats', () => {
    const stats = formatReturnStats({});
    expect(stats.total).toBe(0);
    expect(stats.actionRequired).toBe(0);
  });
});

// ── validateRefund ───────────────────────────────────────────────

describe('validateRefund', () => {
  const ret = { _id: 'ret-1', status: 'received' };

  it('passes with valid amount', () => {
    const result = validateRefund(ret, 49.99);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects zero amount', () => {
    const result = validateRefund(ret, 0);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('valid refund amount');
  });

  it('rejects negative amount', () => {
    const result = validateRefund(ret, -10);
    expect(result.valid).toBe(false);
  });

  it('rejects non-numeric amount', () => {
    const result = validateRefund(ret, 'abc');
    expect(result.valid).toBe(false);
  });

  it('rejects already refunded', () => {
    const result = validateRefund({ ...ret, status: 'refunded' }, 50);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('already been refunded');
  });

  it('rejects denied returns', () => {
    const result = validateRefund({ ...ret, status: 'denied' }, 50);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('denied');
  });

  it('rejects null return', () => {
    const result = validateRefund(null, 50);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('accepts string numeric amount', () => {
    const result = validateRefund(ret, '99.50');
    expect(result.valid).toBe(true);
  });
});

// ── canGenerateLabel ─────────────────────────────────────────────

describe('canGenerateLabel', () => {
  it('allows label gen for approved without tracking', () => {
    const result = canGenerateLabel({ status: 'approved', returnTrackingNumber: '', hasLabel: false });
    expect(result.canGenerate).toBe(true);
  });

  it('blocks label gen for non-approved status', () => {
    const result = canGenerateLabel({ status: 'requested' });
    expect(result.canGenerate).toBe(false);
    expect(result.reason).toContain('approved');
  });

  it('blocks label gen if already has tracking', () => {
    const result = canGenerateLabel({ status: 'approved', returnTrackingNumber: '1Z999', hasLabel: true });
    expect(result.canGenerate).toBe(false);
    expect(result.reason).toContain('already');
  });

  it('handles null return', () => {
    const result = canGenerateLabel(null);
    expect(result.canGenerate).toBe(false);
  });
});

// ── needsAction ──────────────────────────────────────────────────

describe('needsAction', () => {
  it('returns true for requested', () => {
    expect(needsAction('requested')).toBe(true);
  });

  it('returns true for received', () => {
    expect(needsAction('received')).toBe(true);
  });

  it('returns false for approved', () => {
    expect(needsAction('approved')).toBe(false);
  });

  it('returns false for shipped', () => {
    expect(needsAction('shipped')).toBe(false);
  });

  it('returns false for refunded', () => {
    expect(needsAction('refunded')).toBe(false);
  });

  it('returns false for denied', () => {
    expect(needsAction('denied')).toBe(false);
  });
});

// ── sortAdminReturns ─────────────────────────────────────────────

describe('sortAdminReturns', () => {
  it('puts action-required items first', () => {
    const returns = [
      { _id: '1', status: 'approved', date: 'February 22, 2026' },
      { _id: '2', status: 'requested', date: 'February 20, 2026' },
      { _id: '3', status: 'received', date: 'February 21, 2026' },
    ];
    const sorted = sortAdminReturns(returns);
    expect(sorted[0]._id).toBe('3'); // received (action needed, later date)
    expect(sorted[1]._id).toBe('2'); // requested (action needed, earlier date)
    expect(sorted[2]._id).toBe('1'); // approved (no action)
  });

  it('handles empty array', () => {
    expect(sortAdminReturns([])).toEqual([]);
  });

  it('handles non-array', () => {
    expect(sortAdminReturns(null)).toEqual([]);
    expect(sortAdminReturns(undefined)).toEqual([]);
  });

  it('does not mutate input', () => {
    const returns = [
      { _id: '1', status: 'approved', date: 'B' },
      { _id: '2', status: 'requested', date: 'A' },
    ];
    const sorted = sortAdminReturns(returns);
    expect(returns[0]._id).toBe('1'); // unchanged
    expect(sorted[0]._id).toBe('2');
  });
});
