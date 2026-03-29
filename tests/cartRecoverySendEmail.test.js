/**
 * cartRecoverySendEmail.test.js — Unit tests for sendRecoveryEmail.
 *
 * Tests the step-1 recovery email send path: coupon generation,
 * triggered email dispatch, cart status update, and error handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGenerateRecoveryCoupon = vi.hoisted(() => vi.fn());
const mockFindMemberRecord = vi.hoisted(() => vi.fn());
const mockComputeTierInfo = vi.hoisted(() => vi.fn());

vi.mock('backend/couponsService.web', () => ({
  generateRecoveryCoupon: mockGenerateRecoveryCoupon,
}));

vi.mock('backend/gamificationCore.web', () => ({
  findMemberRecord: mockFindMemberRecord,
  computeTierInfo: mockComputeTierInfo,
}));

import { sendRecoveryEmail } from '../src/backend/cartRecovery.web.js';
import wixData, { __reset, __seed, __onUpdate } from './__mocks__/wix-data.js';
import { __reset as crmReset, __getEmailLog, __failNextEmail, __seedContacts } from './__mocks__/wix-crm-backend.js';

const CART_ID = 'cart-doc-abc';
const CART_RECORD = {
  _id: CART_ID,
  checkoutId: 'checkout-123',
  buyerEmail: 'shopper@example.com',
  buyerName: 'Alex',
  cartTotal: 149.99,
  lineItems: '[]',
  status: 'abandoned',
  recoveryEmailSent: false,
};

beforeEach(() => {
  __reset();
  crmReset();
  mockGenerateRecoveryCoupon.mockResolvedValue({
    success: true,
    code: 'RECOVER-TEST11',
    discountPercent: 10,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
  __seed('AbandonedCarts', [{ ...CART_RECORD }]);
  // Loyalty mocks: member exists with 750 points
  mockFindMemberRecord.mockResolvedValue({ memberId: 'mem-loyalty-1', totalPoints: 750 });
  mockComputeTierInfo.mockReturnValue({
    tierName: 'Silver',
    nextTierName: 'Gold',
    pointsToNextTier: 250,
    pointsInTier: 250,
    currentTier: 'silver',
    benefits: [],
    nextTierBenefits: [],
  });
  // Seed CRM contact with known ID, then seed Members with matching ID
  __seedContacts([{ _id: 'loyalty-contact-1', primaryInfo: { email: 'shopper@example.com' } }]);
  __seed('Members/PrivateMembersData', [{ _id: 'loyalty-contact-1' }]);
});

// ── Happy path ───────────────────────────────────────────────────────────────

describe('sendRecoveryEmail — success', () => {
  it('returns success: true', async () => {
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.success).toBe(true);
  });

  it('returns discountCode from coupon result', async () => {
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.discountCode).toBe('RECOVER-TEST11');
  });

  it('calls generateRecoveryCoupon with checkoutId and email', async () => {
    await sendRecoveryEmail(CART_ID);
    expect(mockGenerateRecoveryCoupon).toHaveBeenCalledWith({
      cartId: 'checkout-123',
      email: 'shopper@example.com',
    });
  });

  it('sends triggered email with cart_recovery_1 template', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log.length).toBe(1);
    expect(log[0].templateId).toBe('cart_recovery_1');
  });

  it('sends triggered email to resolved contactId (not raw email)', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].contactId).toBeDefined();
    expect(log[0].contactId).not.toBe('shopper@example.com');
    expect(typeof log[0].contactId).toBe('string');
  });

  it('includes discountCode in email variables', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.discountCode).toBe('RECOVER-TEST11');
  });

  it('marks recoveryEmailSent: true on the cart', async () => {
    let updated = null;
    __onUpdate((col, item) => { if (col === 'AbandonedCarts') updated = item; });
    await sendRecoveryEmail(CART_ID);
    expect(updated).not.toBeNull();
    expect(updated.recoveryEmailSent).toBe(true);
  });

  it('stores recoveryEmailSentAt on the cart', async () => {
    let updated = null;
    __onUpdate((col, item) => { if (col === 'AbandonedCarts') updated = item; });
    await sendRecoveryEmail(CART_ID);
    expect(updated.recoveryEmailSentAt).toBeDefined();
  });
});

// ── Coupon failure graceful degradation ──────────────────────────────────────

describe('sendRecoveryEmail — coupon failure degrades gracefully', () => {
  it('still sends email when generateRecoveryCoupon fails', async () => {
    mockGenerateRecoveryCoupon.mockResolvedValueOnce({ success: false, message: 'API down' });
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.success).toBe(true);
    const log = __getEmailLog();
    expect(log.length).toBe(1);
  });

  it('sends empty discountCode when coupon unavailable', async () => {
    mockGenerateRecoveryCoupon.mockResolvedValueOnce({ success: false, message: 'API down' });
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.discountCode).toBe('');
    expect(log[0].options.variables.discountAvailable).toBe('false');
  });
});

// ── Validation ───────────────────────────────────────────────────────────────

describe('sendRecoveryEmail — validation', () => {
  it('returns error when cartId is missing', async () => {
    const result = await sendRecoveryEmail(null);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/cart id/i);
  });

  it('returns error when cart not found', async () => {
    __reset();
    const result = await sendRecoveryEmail('nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('returns error when cart has no email', async () => {
    __reset();
    __seed('AbandonedCarts', [{ ...CART_RECORD, buyerEmail: '' }]);
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no email/i);
  });
});

// ── Email send failure ───────────────────────────────────────────────────────

describe('sendRecoveryEmail — email service failure', () => {
  it('returns failure when triggeredEmails throws', async () => {
    __failNextEmail();
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/failed/i);
  });

  it('logs error with cartId on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __failNextEmail();
    await sendRecoveryEmail(CART_ID);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[cartRecovery]'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    spy.mockRestore();
  });
});

// ── CRM contact resolution failure ───────────────────────────────────────────

describe('sendRecoveryEmail — CRM contact resolution failure', () => {
  it('returns failure when appendOrCreateContact throws', async () => {
    const { contacts } = await import('./__mocks__/wix-crm-backend.js');
    vi.spyOn(contacts, 'appendOrCreateContact').mockRejectedValueOnce(new Error('CRM unavailable'));
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/CRM contact/i);
    vi.restoreAllMocks();
  });

  it('does not send email when appendOrCreateContact throws', async () => {
    const { contacts } = await import('./__mocks__/wix-crm-backend.js');
    vi.spyOn(contacts, 'appendOrCreateContact').mockRejectedValueOnce(new Error('CRM unavailable'));
    await sendRecoveryEmail(CART_ID);
    expect(__getEmailLog().length).toBe(0);
    vi.restoreAllMocks();
  });
});

// ── Cart update failure ──────────────────────────────────────────────────────

describe('sendRecoveryEmail — cart status update failure', () => {
  it('returns failure when wixData.update throws, even though email was already sent', async () => {
    // The email is sent before the update. If update fails, success: false is returned
    // and the caller may retry — which would re-send the email. Callers should
    // check recoveryEmailSent before invoking to prevent duplicates.
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('Update conflict'));
    const result = await sendRecoveryEmail(CART_ID);
    expect(result.success).toBe(false);
    // Email was already sent before the failure
    const log = __getEmailLog();
    expect(log.length).toBe(1);
  });
});

// ── CF-hamh: Loyalty context in recovery email ───────────────────────────────

describe('sendRecoveryEmail — loyalty context (CF-hamh)', () => {
  it('includes pointsBalance in email variables for loyalty members', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.pointsBalance).toBe('750');
  });

  it('includes pointsDiscount calculated from balance', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.pointsDiscount).toBe('$7'); // 750/100 = 7
  });

  it('includes projected pointsToEarn from cart total', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.pointsToEarn).toBe('149'); // floor(149.99)
  });

  it('includes tier progress info', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.nextTierName).toBe('Gold');
    expect(log[0].options.variables.pointsToNextTier).toBe('250');
  });

  it('sets hasLoyalty to true for loyalty members', async () => {
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.hasLoyalty).toBe('true');
  });

  it('sends empty loyalty context when member not found', async () => {
    __seed('Members/PrivateMembersData', []); // no member record
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.hasLoyalty).toBe('false');
    expect(log[0].options.variables.pointsBalance).toBe('0');
  });

  it('sends empty loyalty context when findMemberRecord returns null', async () => {
    mockFindMemberRecord.mockResolvedValue(null);
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log[0].options.variables.hasLoyalty).toBe('false');
  });

  it('still sends email when loyalty lookup fails', async () => {
    mockFindMemberRecord.mockRejectedValue(new Error('DB down'));
    await sendRecoveryEmail(CART_ID);
    const log = __getEmailLog();
    expect(log.length).toBe(1);
    expect(log[0].options.variables.hasLoyalty).toBe('false');
  });
});
