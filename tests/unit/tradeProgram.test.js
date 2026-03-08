import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setMember, __reset as resetMembers } from '../__mocks__/wix-members-backend.js';

// ── Test Helpers ─────────────────────────────────────────────────────

function makeMember(id = 'member-1') {
  return { _id: id, loginEmail: `${id}@example.com`, contactDetails: { firstName: 'Test', lastName: 'User' } };
}

function makeTradeAccount(overrides = {}) {
  return {
    _id: 'ta-1',
    memberId: 'member-1',
    businessName: 'Acme Hotels',
    contactName: 'Jane Doe',
    contactEmail: 'jane@acmehotels.com',
    phone: '555-123-4567',
    taxId: '12-3456789',
    taxExemptVerified: false,
    status: 'approved',
    tier: 'bronze',
    accountManagerName: 'Sam Wilson',
    accountManagerEmail: 'sam@carolinafutons.com',
    creditLimit: 50000,
    paymentTerms: 30,
    approvedAt: '2026-01-15T00:00:00Z',
    _createdDate: '2026-01-10T00:00:00Z',
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    _id: 'inv-1',
    tradeAccountId: 'ta-1',
    orderId: 'order-1',
    invoiceNumber: 'CF-INV-001',
    subtotal: 5000,
    tax: 0,
    total: 5000,
    dueDate: '2026-02-15T00:00:00Z',
    status: 'pending',
    issuedAt: '2026-01-15T00:00:00Z',
    paidAt: null,
    ...overrides,
  };
}

// ── Import SUT (after mocks are in scope) ────────────────────────────

let mod;
beforeEach(async () => {
  resetData();
  resetMembers();
  mod = await import('../../src/backend/tradeProgram.web.js');
});

// ══════════════════════════════════════════════════════════════════════
// applyForTradeAccount
// ══════════════════════════════════════════════════════════════════════

describe('applyForTradeAccount', () => {
  it('creates a pending trade application with valid input', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    const result = await mod.applyForTradeAccount({
      businessName: 'Acme Hotels',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acmehotels.com',
      phone: '555-123-4567',
      taxId: '12-3456789',
      businessType: 'hospitality',
      estimatedAnnualUnits: 50,
    });

    expect(result.success).toBe(true);
    expect(inserted).toBeTruthy();
    expect(inserted.status).toBe('pending');
    expect(inserted.businessName).toBe('Acme Hotels');
    expect(inserted.contactEmail).toBe('jane@acmehotels.com');
  });

  it('rejects application missing businessName', async () => {
    const result = await mod.applyForTradeAccount({
      contactName: 'Jane Doe',
      contactEmail: 'jane@acmehotels.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/business\s*name/i);
  });

  it('rejects application missing contactEmail', async () => {
    const result = await mod.applyForTradeAccount({
      businessName: 'Acme Hotels',
      contactName: 'Jane Doe',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects application with invalid email format', async () => {
    const result = await mod.applyForTradeAccount({
      businessName: 'Acme Hotels',
      contactName: 'Jane Doe',
      contactEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects application missing contactName', async () => {
    const result = await mod.applyForTradeAccount({
      businessName: 'Acme Hotels',
      contactEmail: 'jane@acmehotels.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/contact\s*name/i);
  });

  it('sanitizes all text inputs to prevent XSS', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeAccounts') inserted = item; });

    await mod.applyForTradeAccount({
      businessName: '<script>alert("xss")</script>Acme Hotels',
      contactName: '<b>Jane</b> Doe',
      contactEmail: 'jane@acmehotels.com',
      phone: '555-123-4567',
      taxId: '12-3456789',
    });

    expect(inserted.businessName).not.toContain('<script>');
    expect(inserted.contactName).not.toContain('<b>');
  });

  it('prevents duplicate application for same email', async () => {
    __seed('TradeAccounts', [
      makeTradeAccount({ contactEmail: 'jane@acmehotels.com', status: 'pending' }),
    ]);

    const result = await mod.applyForTradeAccount({
      businessName: 'Another Hotel',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acmehotels.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already|exists|duplicate/i);
  });

  it('handles wixData insert failure gracefully', async () => {
    // Seed existing accounts so the duplicate check passes but mock insert to fail
    __onInsert(() => { throw new Error('DB error'); });

    const result = await mod.applyForTradeAccount({
      businessName: 'Acme Hotels',
      contactName: 'Jane Doe',
      contactEmail: 'unique@acmehotels.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed|error/i);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getTradeAccountStatus
// ══════════════════════════════════════════════════════════════════════

describe('getTradeAccountStatus', () => {
  it('returns account status for existing application', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ contactEmail: 'jane@acmehotels.com', status: 'approved' })]);

    const result = await mod.getTradeAccountStatus('jane@acmehotels.com');
    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');
  });

  it('returns not-found for unknown email', async () => {
    const result = await mod.getTradeAccountStatus('nobody@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects empty email', async () => {
    const result = await mod.getTradeAccountStatus('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await mod.getTradeAccountStatus('not-an-email');
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getMyTradeAccount
// ══════════════════════════════════════════════════════════════════════

describe('getMyTradeAccount', () => {
  it('returns trade account for authenticated member', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1' })]);

    const result = await mod.getMyTradeAccount();
    expect(result.success).toBe(true);
    expect(result.account.businessName).toBe('Acme Hotels');
    expect(result.account.tier).toBe('bronze');
    expect(result.account.accountManagerName).toBe('Sam Wilson');
  });

  it('returns not-found when member has no trade account', async () => {
    __setMember(makeMember('member-2'));

    const result = await mod.getMyTradeAccount();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no trade account/i);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);

    const result = await mod.getMyTradeAccount();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not authenticated/i);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getMyTradePricing
// ══════════════════════════════════════════════════════════════════════

describe('getMyTradePricing', () => {
  it('applies Bronze tier 10% discount', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', tier: 'bronze', status: 'approved' })]);

    const result = await mod.getMyTradePricing(500, 5);
    expect(result.success).toBe(true);
    expect(result.originalPrice).toBe(500);
    expect(result.discountPercent).toBe(10);
    expect(result.discountedPrice).toBe(450);
    expect(result.lineTotal).toBe(2250);
  });

  it('applies Silver tier 15% discount', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', tier: 'silver', status: 'approved' })]);

    const result = await mod.getMyTradePricing(1000, 10);
    expect(result.success).toBe(true);
    expect(result.discountPercent).toBe(15);
    expect(result.discountedPrice).toBe(850);
    expect(result.lineTotal).toBe(8500);
  });

  it('applies Gold tier 20% discount', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', tier: 'gold', status: 'approved' })]);

    const result = await mod.getMyTradePricing(2000, 1);
    expect(result.success).toBe(true);
    expect(result.discountPercent).toBe(20);
    expect(result.discountedPrice).toBe(1600);
  });

  it('applies Platinum tier 25% discount', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', tier: 'platinum', status: 'approved' })]);

    const result = await mod.getMyTradePricing(800, 3);
    expect(result.success).toBe(true);
    expect(result.discountPercent).toBe(25);
    expect(result.discountedPrice).toBe(600);
    expect(result.lineTotal).toBe(1800);
  });

  it('rejects pricing for non-approved account', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', status: 'pending' })]);

    const result = await mod.getMyTradePricing(500, 5);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not approved/i);
  });

  it('rejects invalid price (zero)', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', status: 'approved' })]);

    const result = await mod.getMyTradePricing(0, 5);
    expect(result.success).toBe(false);
  });

  it('rejects negative price', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', status: 'approved' })]);

    const result = await mod.getMyTradePricing(-100, 5);
    expect(result.success).toBe(false);
  });

  it('rejects zero quantity', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', status: 'approved' })]);

    const result = await mod.getMyTradePricing(500, 0);
    expect(result.success).toBe(false);
  });

  it('clamps quantity to max 9999', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', tier: 'bronze', status: 'approved' })]);

    const result = await mod.getMyTradePricing(100, 99999);
    expect(result.success).toBe(true);
    expect(result.quantity).toBeLessThanOrEqual(9999);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await mod.getMyTradePricing(500, 5);
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getMyTradeInvoices
// ══════════════════════════════════════════════════════════════════════

describe('getMyTradeInvoices', () => {
  it('returns paginated invoices for trade member', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1' })]);
    __seed('TradeInvoices', [
      makeInvoice({ _id: 'inv-1', tradeAccountId: 'ta-1' }),
      makeInvoice({ _id: 'inv-2', tradeAccountId: 'ta-1', invoiceNumber: 'CF-INV-002' }),
    ]);

    const result = await mod.getMyTradeInvoices();
    expect(result.success).toBe(true);
    expect(result.invoices).toHaveLength(2);
  });

  it('does not return invoices from other accounts', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', memberId: 'member-1' })]);
    __seed('TradeInvoices', [
      makeInvoice({ tradeAccountId: 'ta-1' }),
      makeInvoice({ _id: 'inv-other', tradeAccountId: 'ta-other' }),
    ]);

    const result = await mod.getMyTradeInvoices();
    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0].tradeAccountId).toBe('ta-1');
  });

  it('respects page size limit', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1' })]);
    const invoices = Array.from({ length: 25 }, (_, i) =>
      makeInvoice({ _id: `inv-${i}`, tradeAccountId: 'ta-1', invoiceNumber: `CF-INV-${i}` })
    );
    __seed('TradeInvoices', invoices);

    const result = await mod.getMyTradeInvoices({ pageSize: 10 });
    expect(result.invoices.length).toBeLessThanOrEqual(10);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await mod.getMyTradeInvoices();
    expect(result.success).toBe(false);
  });

  it('returns error when no trade account exists', async () => {
    __setMember(makeMember('member-2'));
    const result = await mod.getMyTradeInvoices();
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// checkTaxExemptStatus
// ══════════════════════════════════════════════════════════════════════

describe('checkTaxExemptStatus', () => {
  it('returns verified for tax-exempt account', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', taxExemptVerified: true })]);

    const result = await mod.checkTaxExemptStatus();
    expect(result.success).toBe(true);
    expect(result.taxExempt).toBe(true);
  });

  it('returns not-verified for non-exempt account', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', taxExemptVerified: false })]);

    const result = await mod.checkTaxExemptStatus();
    expect(result.success).toBe(true);
    expect(result.taxExempt).toBe(false);
  });

  it('returns false when no trade account', async () => {
    __setMember(makeMember('member-2'));
    const result = await mod.checkTaxExemptStatus();
    expect(result.success).toBe(true);
    expect(result.taxExempt).toBe(false);
  });

  it('returns error when not authenticated', async () => {
    __setMember(null);
    const result = await mod.checkTaxExemptStatus();
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// submitTaxExemptCert
// ══════════════════════════════════════════════════════════════════════

describe('submitTaxExemptCert', () => {
  it('updates trade account with certificate URL', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeAccounts') updated = item; });

    const result = await mod.submitTaxExemptCert({ certUrl: 'https://storage.example.com/cert.pdf', taxId: '12-3456789' });
    expect(result.success).toBe(true);
    expect(updated).toBeTruthy();
    expect(updated.taxExemptCertUrl).toBe('https://storage.example.com/cert.pdf');
  });

  it('rejects missing cert URL', async () => {
    __setMember(makeMember('member-1'));
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1' })]);

    const result = await mod.submitTaxExemptCert({});
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/certificate/i);
  });

  it('rejects when no trade account', async () => {
    __setMember(makeMember('member-2'));
    const result = await mod.submitTaxExemptCert({ certUrl: 'https://storage.example.com/cert.pdf' });
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Admin: approveTradeAccount
// ══════════════════════════════════════════════════════════════════════

describe('approveTradeAccount', () => {
  it('approves a pending application', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', status: 'pending', memberId: 'member-1' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeAccounts') updated = item; });

    const result = await mod.approveTradeAccount('member-1', {
      tier: 'silver',
      creditLimit: 75000,
      accountManagerName: 'Sam Wilson',
      accountManagerEmail: 'sam@carolinafutons.com',
    });

    expect(result.success).toBe(true);
    expect(updated.status).toBe('approved');
    expect(updated.tier).toBe('silver');
    expect(updated.creditLimit).toBe(75000);
  });

  it('rejects approval of non-existent account', async () => {
    const result = await mod.approveTradeAccount('nonexistent', { tier: 'bronze' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid tier', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ status: 'pending', memberId: 'member-1' })]);

    const result = await mod.approveTradeAccount('member-1', { tier: 'diamond' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tier/i);
  });

  it('defaults to bronze tier if none specified', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ status: 'pending', memberId: 'member-1' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeAccounts') updated = item; });

    const result = await mod.approveTradeAccount('member-1', {});
    expect(result.success).toBe(true);
    expect(updated.tier).toBe('bronze');
  });
});

// ══════════════════════════════════════════════════════════════════════
// Admin: rejectTradeAccount
// ══════════════════════════════════════════════════════════════════════

describe('rejectTradeAccount', () => {
  it('rejects a pending application with reason', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ status: 'pending', memberId: 'member-1' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeAccounts') updated = item; });

    const result = await mod.rejectTradeAccount('member-1', 'Insufficient volume');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('rejected');
    expect(updated.rejectionReason).toBe('Insufficient volume');
  });

  it('rejects when account not found', async () => {
    const result = await mod.rejectTradeAccount('nonexistent', 'reason');
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Admin: createTradeInvoice
// ══════════════════════════════════════════════════════════════════════

describe('createTradeInvoice', () => {
  it('creates a net-30 invoice', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', status: 'approved' })]);
    let inserted = null;
    __onInsert((col, item) => { if (col === 'TradeInvoices') inserted = item; });

    const result = await mod.createTradeInvoice({
      tradeAccountId: 'ta-1',
      orderId: 'order-123',
      subtotal: 5000,
      tax: 0,
    });

    expect(result.success).toBe(true);
    expect(inserted).toBeTruthy();
    expect(inserted.status).toBe('pending');
    expect(inserted.total).toBe(5000);
    expect(inserted.invoiceNumber).toMatch(/^CF-INV-/);
    // Due date should be ~30 days from now
    const dueDate = new Date(inserted.dueDate);
    const now = new Date();
    const daysDiff = (dueDate - now) / (1000 * 60 * 60 * 24);
    expect(daysDiff).toBeGreaterThan(28);
    expect(daysDiff).toBeLessThan(32);
  });

  it('rejects invoice for non-approved account', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', status: 'pending' })]);

    const result = await mod.createTradeInvoice({
      tradeAccountId: 'ta-1',
      orderId: 'order-123',
      subtotal: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not approved/i);
  });

  it('rejects invoice with non-positive subtotal', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', status: 'approved' })]);

    const result = await mod.createTradeInvoice({
      tradeAccountId: 'ta-1',
      orderId: 'order-123',
      subtotal: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invoice exceeding credit limit', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', status: 'approved', creditLimit: 1000 })]);

    const result = await mod.createTradeInvoice({
      tradeAccountId: 'ta-1',
      orderId: 'order-123',
      subtotal: 1500,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/credit limit/i);
  });

  it('rejects invoice with missing orderId', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ _id: 'ta-1', status: 'approved' })]);

    const result = await mod.createTradeInvoice({
      tradeAccountId: 'ta-1',
      subtotal: 5000,
    });

    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Admin: updateInvoiceStatus
// ══════════════════════════════════════════════════════════════════════

describe('updateInvoiceStatus', () => {
  it('marks invoice as paid', async () => {
    __seed('TradeInvoices', [makeInvoice({ _id: 'inv-1', status: 'pending' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeInvoices') updated = item; });

    const result = await mod.updateInvoiceStatus('inv-1', 'paid');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('paid');
    expect(updated.paidAt).toBeTruthy();
  });

  it('marks invoice as overdue', async () => {
    __seed('TradeInvoices', [makeInvoice({ _id: 'inv-1', status: 'pending' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeInvoices') updated = item; });

    const result = await mod.updateInvoiceStatus('inv-1', 'overdue');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('overdue');
  });

  it('marks invoice as void', async () => {
    __seed('TradeInvoices', [makeInvoice({ _id: 'inv-1', status: 'pending' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeInvoices') updated = item; });

    const result = await mod.updateInvoiceStatus('inv-1', 'void');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('void');
  });

  it('rejects invalid status', async () => {
    __seed('TradeInvoices', [makeInvoice({ _id: 'inv-1' })]);

    const result = await mod.updateInvoiceStatus('inv-1', 'cancelled');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/status/i);
  });

  it('rejects non-existent invoice', async () => {
    const result = await mod.updateInvoiceStatus('inv-999', 'paid');
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Admin: verifyTaxExempt
// ══════════════════════════════════════════════════════════════════════

describe('verifyTaxExempt', () => {
  it('sets tax-exempt to true', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', taxExemptVerified: false })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeAccounts') updated = item; });

    const result = await mod.verifyTaxExempt('member-1', true);
    expect(result.success).toBe(true);
    expect(updated.taxExemptVerified).toBe(true);
  });

  it('sets tax-exempt to false (revoke)', async () => {
    __seed('TradeAccounts', [makeTradeAccount({ memberId: 'member-1', taxExemptVerified: true })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === 'TradeAccounts') updated = item; });

    const result = await mod.verifyTaxExempt('member-1', false);
    expect(result.success).toBe(true);
    expect(updated.taxExemptVerified).toBe(false);
  });

  it('rejects non-existent member', async () => {
    const result = await mod.verifyTaxExempt('nonexistent', true);
    expect(result.success).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getTradePricingTiers (public informational)
// ══════════════════════════════════════════════════════════════════════

describe('getTradePricingTiers', () => {
  it('returns all four pricing tiers', async () => {
    const result = await mod.getTradePricingTiers();
    expect(result.success).toBe(true);
    expect(result.tiers).toHaveLength(4);
  });

  it('tiers are ordered bronze → silver → gold → platinum', async () => {
    const result = await mod.getTradePricingTiers();
    const names = result.tiers.map(t => t.name);
    expect(names).toEqual(['bronze', 'silver', 'gold', 'platinum']);
  });

  it('each tier has discount, minUnits, and description', async () => {
    const result = await mod.getTradePricingTiers();
    for (const tier of result.tiers) {
      expect(tier).toHaveProperty('discount');
      expect(tier).toHaveProperty('minUnits');
      expect(tier).toHaveProperty('description');
      expect(tier.discount).toBeGreaterThan(0);
    }
  });
});
