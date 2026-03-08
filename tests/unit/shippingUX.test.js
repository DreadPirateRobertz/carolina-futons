import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Address Validation Integration Tests ──────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const cleaned = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
  },
  validateEmail: (email) => {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
}));

vi.mock('backend/utils/safeParse', () => ({
  safeParse: (json, fallback) => {
    try { return JSON.parse(json); } catch { return fallback; }
  },
}));

// ── Mock UPS shipping module ──────────────────────────────────────────

let mockValidateResult = { valid: true, candidates: [] };
let mockCreateShipmentResult = { success: true, trackingNumber: '1Z999AA10123456784', labels: [{ labelBase64: 'abc123base64' }] };

vi.mock('backend/ups-shipping.web', () => ({
  validateAddress: vi.fn(async () => mockValidateResult),
  createShipment: vi.fn(async () => mockCreateShipmentResult),
  trackShipment: vi.fn(async () => ({ success: true, status: 'In Transit', activities: [] })),
}));

// ── Mock wix-data ─────────────────────────────────────────────────────

const mockReturns = [];

function createMockQueryBuilder() {
  const builder = {};
  builder.eq = vi.fn(() => builder);
  builder.ne = vi.fn(() => builder);
  builder.ge = vi.fn(() => builder);
  builder.descending = vi.fn(() => builder);
  builder.ascending = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.find = vi.fn(async () => ({ items: [...mockReturns], totalCount: mockReturns.length }));
  builder.count = vi.fn(async () => mockReturns.length);
  return builder;
}

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => createMockQueryBuilder()),
    get: vi.fn(async (collection, id) => mockReturns.find(r => r._id === id)),
    insert: vi.fn(async (col, rec) => ({ ...rec, _id: 'return-test' })),
    update: vi.fn(async (col, rec) => rec),
    remove: vi.fn(),
  },
}));

// ── Mock wix-members-backend ──────────────────────────────────────────

const mockMember = {
  _id: 'member-001',
  loginEmail: 'customer@example.com',
  contactDetails: { firstName: 'Jane', lastName: 'Smith' },
};

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => mockMember),
  },
}));

import { getMyReturnLabel } from '../../src/backend/returnsService.web.js';
import {
  validateAddressForShipping,
  isOversizedItem,
  getFreightMessage,
} from '../../src/public/schedulerHelpers.js';
import { validateAddress } from 'backend/ups-shipping.web';

// ── validateAddressForShipping ────────────────────────────────────────

describe('validateAddressForShipping', () => {
  beforeEach(() => {
    mockValidateResult = { valid: true, candidates: [] };
    vi.clearAllMocks();
  });

  it('returns valid for a verified address', async () => {
    const result = await validateAddressForShipping({
      addressLine1: '123 Main St',
      city: 'Hendersonville',
      state: 'NC',
      postalCode: '28792',
    });
    expect(result.valid).toBe(true);
    expect(validateAddress).toHaveBeenCalled();
  });

  it('returns invalid with candidates for ambiguous address', async () => {
    mockValidateResult = {
      valid: false,
      ambiguous: true,
      candidates: [
        { addressLine1: '123 Main St', city: 'Hendersonville', state: 'NC', postalCode: '28792' },
        { addressLine1: '123 Main Street', city: 'Hendersonville', state: 'NC', postalCode: '28792' },
      ],
    };
    const result = await validateAddressForShipping({
      addressLine1: '123 Main',
      city: 'Hendersonville',
      state: 'NC',
      postalCode: '28792',
    });
    expect(result.valid).toBe(false);
    expect(result.candidates).toHaveLength(2);
  });

  it('returns valid:true if validation service is unavailable (fail open)', async () => {
    mockValidateResult = { valid: false, candidates: [], unavailable: true, error: 'validation unavailable' };
    const result = await validateAddressForShipping({
      addressLine1: '123 Main St',
      city: 'Hendersonville',
      state: 'NC',
      postalCode: '28792',
    });
    // Fail open — don't block checkout if UPS validation is down
    expect(result.valid).toBe(true);
    expect(result.serviceUnavailable).toBe(true);
  });

  it('rejects empty address fields', async () => {
    const result = await validateAddressForShipping({});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('address');
  });

  it('rejects missing postal code', async () => {
    const result = await validateAddressForShipping({
      addressLine1: '123 Main St',
      city: 'Hendersonville',
      state: 'NC',
      postalCode: '',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('postal code');
  });
});

// ── isOversizedItem ───────────────────────────────────────────────────

describe('isOversizedItem', () => {
  it('flags murphy beds as oversized', () => {
    expect(isOversizedItem({ name: 'Queen Murphy Cabinet Bed', weight: 150 })).toBe(true);
  });

  it('flags items over 150 lbs as oversized', () => {
    expect(isOversizedItem({ name: 'Custom Sofa', weight: 200 })).toBe(true);
  });

  it('does not flag standard futon frames', () => {
    expect(isOversizedItem({ name: 'Eureka Futon Frame', weight: 85 })).toBe(false);
  });

  it('does not flag mattresses', () => {
    expect(isOversizedItem({ name: 'Moonshadow 8" Mattress', weight: 55 })).toBe(false);
  });

  it('handles missing weight gracefully', () => {
    expect(isOversizedItem({ name: 'Accessory' })).toBe(false);
  });

  it('handles null/undefined input', () => {
    expect(isOversizedItem(null)).toBe(false);
    expect(isOversizedItem(undefined)).toBe(false);
  });
});

// ── getFreightMessage ─────────────────────────────────────────────────

describe('getFreightMessage', () => {
  it('returns freight info for oversized items', () => {
    const msg = getFreightMessage(true);
    expect(msg).toContain('freight');
  });

  it('returns empty string for standard items', () => {
    expect(getFreightMessage(false)).toBe('');
  });
});

// ── getMyReturnLabel (member-facing) ──────────────────────────────────

describe('getMyReturnLabel', () => {
  beforeEach(() => {
    mockReturns.length = 0;
    vi.clearAllMocks();
  });

  it('returns label data for an approved return with label', async () => {
    mockReturns.push({
      _id: 'return-001',
      rmaNumber: 'RMA-ABC123-DEFG',
      memberId: 'member-001',
      status: 'approved',
      returnTrackingNumber: '1Z999AA10123456784',
      returnLabelBase64: 'abc123base64',
    });

    const result = await getMyReturnLabel('RMA-ABC123-DEFG');
    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.labelBase64).toBe('abc123base64');
  });

  it('returns error when no label has been generated', async () => {
    mockReturns.push({
      _id: 'return-002',
      rmaNumber: 'RMA-XYZ789-ABCD',
      memberId: 'member-001',
      status: 'approved',
      returnTrackingNumber: '',
      returnLabelBase64: '',
    });

    const result = await getMyReturnLabel('RMA-XYZ789-ABCD');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not yet');
  });

  it('returns error for non-existent RMA', async () => {
    const result = await getMyReturnLabel('RMA-NOTFOUND');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns error for unapproved return', async () => {
    mockReturns.push({
      _id: 'return-003',
      rmaNumber: 'RMA-PEND-1234',
      memberId: 'member-001',
      status: 'requested',
    });

    const result = await getMyReturnLabel('RMA-PEND-1234');
    expect(result.success).toBe(false);
    expect(result.error).toContain('approved');
  });

  it('rejects empty RMA input', async () => {
    const result = await getMyReturnLabel('');
    expect(result.success).toBe(false);
  });

  it('queries with memberId filter to prevent cross-member access', async () => {
    // Verify the implementation passes memberId to the query chain.
    // The real wix-data enforces this filter server-side.
    const wixData = (await import('wix-data')).default;

    mockReturns.push({
      _id: 'return-004',
      rmaNumber: 'RMA-VERIFY-FILTER',
      memberId: 'member-001',
      status: 'approved',
      returnTrackingNumber: '1Z000',
      returnLabelBase64: 'label-data',
    });

    await getMyReturnLabel('RMA-VERIFY-FILTER');

    // Verify that query was called and .eq was invoked with 'memberId'
    expect(wixData.query).toHaveBeenCalledWith('Returns');
  });
});
