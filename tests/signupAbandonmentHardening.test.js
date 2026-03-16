/**
 * CF-8i3u — Hardening tests for browse abandonment, contact submissions,
 * and BrowseReminder. Covers the cutoff bug fix, uncovered branches,
 * and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  trackBrowseSession,
  captureRemindMeRequest,
  triggerBrowseRecovery,
  getBrowseAbandonmentStats,
  exportAbandonmentInsights,
  markSessionConverted,
  HIGH_INTENT_THRESHOLD_MS,
  RECOVERY_WINDOW_MS,
  MAX_PRODUCTS_TRACKED,
  RECOVERY_SEQUENCE,
} from '../src/backend/browseAbandonment.web.js';
import { submitContactForm } from '../src/backend/contactSubmissions.web.js';

beforeEach(() => {
  __seed('BrowseSessions', []);
  __seed('BrowseRecoveryEmails', []);
  __seed('Unsubscribes', []);
  __seed('ContactSubmissions', []);
});

// ── triggerBrowseRecovery — cutoff bug fix ───────────────────────

describe('triggerBrowseRecovery cutoff filter', () => {
  it('skips sessions older than the 48h recovery window', async () => {
    const oldDate = new Date(Date.now() - RECOVERY_WINDOW_MS - 60_000); // 48h + 1min ago
    __seed('BrowseSessions', [{
      sessionId: 'old-session',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'old@test.com',
      converted: false,
      recoveryStep: 0,
      recoveryTriggered: false,
      productsViewed: JSON.stringify([{ productId: 'p1', productName: 'Futon', price: 500 }]),
      createdAt: oldDate,
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(0);
  });

  it('processes sessions within the 48h recovery window', async () => {
    // Session created 3 hours ago — within window, past step 1 delay (2h)
    const recentDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      sessionId: 'recent-session',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'recent@test.com',
      visitorName: 'Recent',
      converted: false,
      recoveryStep: 0,
      recoveryTriggered: false,
      productsViewed: JSON.stringify([{ productId: 'p1', productName: 'Monterey', price: 549 }]),
      createdAt: recentDate,
    }]);

    let insertedEmail = null;
    __onInsert((col, item) => { if (col === 'BrowseRecoveryEmails') insertedEmail = item; });

    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(1);
    expect(insertedEmail).not.toBeNull();
    expect(insertedEmail.step).toBe(1);
    expect(insertedEmail.recipientEmail).toBe('recent@test.com');
  });

  it('skips step 2 if session is not old enough', async () => {
    // Session created 3 hours ago, step 1 done — step 2 needs 24h
    const recentDate = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      sessionId: 's1',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'user@test.com',
      converted: false,
      recoveryStep: 1,
      recoveryTriggered: true,
      productsViewed: '[]',
      createdAt: recentDate,
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('triggers step 2 when session is old enough', async () => {
    // Session 25 hours old, step 1 done — step 2 needs 24h
    const date = new Date(Date.now() - 25 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      sessionId: 's2',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'user@test.com',
      visitorName: '',
      converted: false,
      recoveryStep: 1,
      recoveryTriggered: true,
      productsViewed: JSON.stringify([{ productId: 'p1', productName: 'Sunrise', price: 779 }]),
      createdAt: date,
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.success).toBe(true);
    expect(result.triggered).toBe(1);
  });

  it('skips unsubscribed emails during recovery', async () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      sessionId: 's3',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'unsub@test.com',
      converted: false,
      recoveryStep: 0,
      recoveryTriggered: false,
      productsViewed: '[]',
      createdAt: date,
    }]);
    __seed('Unsubscribes', [{ email: 'unsub@test.com', sequenceType: 'browse_recovery' }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips globally unsubscribed emails', async () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      sessionId: 's4',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'global@test.com',
      converted: false,
      recoveryStep: 0,
      recoveryTriggered: false,
      productsViewed: '[]',
      createdAt: date,
    }]);
    __seed('Unsubscribes', [{ email: 'global@test.com', sequenceType: 'all' }]);

    const result = await triggerBrowseRecovery();
    expect(result.skipped).toBe(1);
    expect(result.triggered).toBe(0);
  });

  it('allows recovery when unsub is for a different sequence type', async () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      sessionId: 's5',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'partial@test.com',
      visitorName: '',
      converted: false,
      recoveryStep: 0,
      recoveryTriggered: false,
      productsViewed: JSON.stringify([{ productId: 'p1', productName: 'Dillon', price: 642 }]),
      createdAt: date,
    }]);
    __seed('Unsubscribes', [{ email: 'partial@test.com', sequenceType: 'promotional' }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(1);
  });
});

// ── trackBrowseSession — edge cases ─────────────────────────────

describe('trackBrowseSession hardening', () => {
  it('rejects null sessionData', async () => {
    const result = await trackBrowseSession(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty sessionId', async () => {
    const result = await trackBrowseSession({ sessionId: '' });
    expect(result.success).toBe(false);
  });

  it('caps products at MAX_PRODUCTS_TRACKED', async () => {
    const products = Array.from({ length: 30 }, (_, i) => ({
      productId: `prod-${i}`,
      productName: `Product ${i}`,
      price: 100 + i,
      viewDuration: 1000,
    }));

    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({
      sessionId: 'sess-cap',
      productsViewed: products,
      totalDuration: 300000,
    });

    const stored = JSON.parse(inserted.productsViewed);
    expect(stored.length).toBeLessThanOrEqual(MAX_PRODUCTS_TRACKED);
  });

  it('filters out products without valid productId', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({
      sessionId: 'sess-filter',
      productsViewed: [
        { productId: 'valid-1', productName: 'Good', price: 100 },
        { productId: '', productName: 'Bad', price: 50 },
        { productName: 'No ID', price: 25 },
      ],
      totalDuration: 5000,
    });

    const stored = JSON.parse(inserted.productsViewed);
    expect(stored.length).toBe(1);
    expect(stored[0].productId).toBe('valid-1');
  });

  it('handles non-numeric price and viewDuration gracefully', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({
      sessionId: 'sess-types',
      productsViewed: [{ productId: 'p1', price: 'abc', viewDuration: null }],
      totalDuration: 'not-a-number',
    });

    const stored = JSON.parse(inserted.productsViewed);
    expect(stored[0].price).toBe(0);
    expect(stored[0].viewDuration).toBe(0);
    expect(inserted.totalDuration).toBe(0);
  });

  it('marks session as high-intent when threshold met', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    const result = await trackBrowseSession({
      sessionId: 'sess-hi',
      productsViewed: [{ productId: 'p1', productName: 'Futon' }],
      totalDuration: HIGH_INTENT_THRESHOLD_MS + 1000,
    });

    expect(result.isHighIntent).toBe(true);
    expect(inserted.isHighIntent).toBe(true);
  });

  it('not high-intent when no products viewed', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-noprod',
      productsViewed: [],
      totalDuration: HIGH_INTENT_THRESHOLD_MS + 1000,
    });

    expect(result.isHighIntent).toBe(false);
  });

  it('updates existing session instead of creating new', async () => {
    __seed('BrowseSessions', [{
      _id: 'existing-1',
      sessionId: 'sess-existing',
      productsViewed: '[]',
      productCount: 0,
      totalDuration: 1000,
      isHighIntent: false,
      entryPage: '/home',
      exitPage: '/home',
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === 'BrowseSessions') updated = item; });

    await trackBrowseSession({
      sessionId: 'sess-existing',
      productsViewed: [{ productId: 'p1', productName: 'Monterey' }],
      totalDuration: 200000,
      exitPage: '/product-page/monterey',
    });

    expect(updated).not.toBeNull();
    expect(updated.totalDuration).toBe(200000);
    expect(updated.exitPage).toBe('/product-page/monterey');
  });

  it('clamps negative totalDuration to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await trackBrowseSession({
      sessionId: 'sess-neg',
      productsViewed: [],
      totalDuration: -5000,
    });

    expect(inserted.totalDuration).toBe(0);
  });
});

// ── captureRemindMeRequest — edge cases ─────────────────────────

describe('captureRemindMeRequest hardening', () => {
  it('rejects empty session ID', async () => {
    const result = await captureRemindMeRequest('', 'test@example.com');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const result = await captureRemindMeRequest('sess-1', 'not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('blocks unsubscribed email (browse_recovery type)', async () => {
    __seed('Unsubscribes', [{ email: 'unsub@test.com', sequenceType: 'browse_recovery' }]);

    const result = await captureRemindMeRequest('sess-1', 'unsub@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unsubscribed');
  });

  it('blocks globally unsubscribed email', async () => {
    __seed('Unsubscribes', [{ email: 'all-unsub@test.com', sequenceType: 'all' }]);

    const result = await captureRemindMeRequest('sess-1', 'all-unsub@test.com');
    expect(result.success).toBe(false);
  });

  it('allows email unsubscribed from different sequence', async () => {
    __seed('Unsubscribes', [{ email: 'promo-unsub@test.com', sequenceType: 'promotional' }]);

    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    const result = await captureRemindMeRequest('sess-new', 'promo-unsub@test.com', 'Test');
    expect(result.success).toBe(true);
  });

  it('creates new session record if session not tracked yet', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    const result = await captureRemindMeRequest('brand-new', 'new@test.com', 'New User');
    expect(result.success).toBe(true);
    expect(inserted.hasEmail).toBe(true);
    expect(inserted.visitorEmail).toBe('new@test.com');
    expect(inserted.visitorName).toBe('New User');
  });

  it('updates existing session with email', async () => {
    __seed('BrowseSessions', [{
      _id: 'rec-1',
      sessionId: 'existing-sess',
      hasEmail: false,
      visitorEmail: '',
      visitorName: '',
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === 'BrowseSessions') updated = item; });

    await captureRemindMeRequest('existing-sess', 'user@test.com', 'User');
    expect(updated.hasEmail).toBe(true);
    expect(updated.visitorEmail).toBe('user@test.com');
  });

  it('handles missing name parameter gracefully', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'BrowseSessions') inserted = item; });

    await captureRemindMeRequest('sess-noname', 'anon@test.com');
    expect(inserted.visitorName).toBe('');
  });
});

// ── markSessionConverted — edge cases ───────────────────────────

describe('markSessionConverted hardening', () => {
  it('returns false for empty session ID', async () => {
    expect(await markSessionConverted('')).toBe(false);
  });

  it('returns false for nonexistent session', async () => {
    expect(await markSessionConverted('nonexistent')).toBe(false);
  });

  it('marks session converted and cancels pending emails', async () => {
    __seed('BrowseSessions', [{
      _id: 'rec-conv',
      sessionId: 'sess-convert',
      converted: false,
    }]);
    __seed('BrowseRecoveryEmails', [
      { _id: 'email-1', sessionId: 'sess-convert', status: 'pending' },
      { _id: 'email-2', sessionId: 'sess-convert', status: 'sent' },
    ]);

    const updates = [];
    __onUpdate((col, item) => updates.push({ col, item }));

    const result = await markSessionConverted('sess-convert');
    expect(result).toBe(true);

    const sessionUpdate = updates.find(u => u.col === 'BrowseSessions');
    expect(sessionUpdate.item.converted).toBe(true);

    const emailUpdates = updates.filter(u => u.col === 'BrowseRecoveryEmails');
    // Only the pending one should be cancelled
    expect(emailUpdates.length).toBe(1);
    expect(emailUpdates[0].item.status).toBe('cancelled');
  });
});

// ── getBrowseAbandonmentStats — edge cases ──────────────────────

describe('getBrowseAbandonmentStats hardening', () => {
  it('clamps days to range 1-365', async () => {
    const result = await getBrowseAbandonmentStats(0);
    expect(result.success).toBe(true);
    expect(result.period).toBe('1 days');
  });

  it('clamps large days value', async () => {
    const result = await getBrowseAbandonmentStats(9999);
    expect(result.success).toBe(true);
    expect(result.period).toBe('365 days');
  });

  it('computes rates correctly with zero denominators', async () => {
    const result = await getBrowseAbandonmentStats(30);
    expect(result.highIntentRate).toBe(0);
    expect(result.emailCaptureRate).toBe(0);
    expect(result.conversionRate).toBe(0);
    expect(result.recoveryRate).toBe(0);
  });
});

// ── exportAbandonmentInsights — edge cases ──────────────────────

describe('exportAbandonmentInsights hardening', () => {
  it('clamps limit to 1-50 range', async () => {
    const result = await exportAbandonmentInsights(0);
    expect(result.success).toBe(true);
  });

  it('aggregates product views across sessions', async () => {
    __seed('BrowseSessions', [
      {
        isHighIntent: true,
        converted: false,
        createdAt: new Date(),
        productsViewed: JSON.stringify([
          { productId: 'p1', productName: 'Monterey', price: 549, viewDuration: 30000 },
          { productId: 'p2', productName: 'Sunrise', price: 779, viewDuration: 20000 },
        ]),
      },
      {
        isHighIntent: true,
        converted: false,
        createdAt: new Date(),
        productsViewed: JSON.stringify([
          { productId: 'p1', productName: 'Monterey', price: 549, viewDuration: 45000 },
        ]),
      },
    ]);

    const result = await exportAbandonmentInsights(10);
    expect(result.success).toBe(true);
    expect(result.insights.length).toBe(2);
    // p1 should be first (2 abandoned views)
    expect(result.insights[0].productId).toBe('p1');
    expect(result.insights[0].abandonedViews).toBe(2);
    expect(result.insights[0].avgViewDuration).toBe(37500); // (30000+45000)/2
  });

  it('handles invalid JSON in productsViewed gracefully', async () => {
    __seed('BrowseSessions', [{
      isHighIntent: true,
      converted: false,
      createdAt: new Date(),
      productsViewed: 'not-json',
    }]);

    const result = await exportAbandonmentInsights(10);
    expect(result.success).toBe(true);
    expect(result.insights.length).toBe(0);
  });
});

// ── contactSubmissions hardening ────────────────────────────────

describe('submitContactForm hardening', () => {
  it('rejects null data', async () => {
    const result = await submitContactForm(null);
    expect(result.success).toBe(false);
    expect(result.message).toContain('required');
  });

  it('rejects missing email', async () => {
    const result = await submitContactForm({ name: 'Test' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await submitContactForm({ email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid');
  });

  it('rate-limits duplicate submissions within 60 seconds', async () => {
    __seed('ContactSubmissions', [{
      email: 'rate@test.com',
      submittedAt: new Date(), // just now
    }]);

    const result = await submitContactForm({ email: 'rate@test.com', name: 'Rate Test' });
    // Should return silent success (no insert)
    expect(result.success).toBe(true);
  });

  it('allows submission after rate-limit window passes', async () => {
    __seed('ContactSubmissions', [{
      email: 'old@test.com',
      submittedAt: new Date(Date.now() - 120_000), // 2 min ago
    }]);

    let inserted = null;
    __onInsert((col, item) => { if (col === 'ContactSubmissions') inserted = item; });

    const result = await submitContactForm({
      email: 'old@test.com',
      name: 'Return User',
      source: 'exit_intent_popup',
      notes: 'Interested in futons',
      productId: 'prod-1',
      productName: 'Monterey Futon Frame',
    });

    expect(result.success).toBe(true);
    expect(inserted).not.toBeNull();
    expect(inserted.email).toBe('old@test.com');
    expect(inserted.source).toBe('exit_intent_popup');
    expect(inserted.productName).toBe('Monterey Futon Frame');
  });

  it('normalizes email to lowercase', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'ContactSubmissions') inserted = item; });

    await submitContactForm({ email: 'USER@TEST.COM' });
    expect(inserted.email).toBe('user@test.com');
  });

  it('handles missing optional fields with defaults', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'ContactSubmissions') inserted = item; });

    await submitContactForm({ email: 'minimal@test.com' });
    expect(inserted.name).toBe('');
    expect(inserted.phone).toBe('');
    expect(inserted.source).toBe('unknown');
    expect(inserted.productId).toBe('');
  });
});

// ── RECOVERY_SEQUENCE constants ─────────────────────────────────

describe('RECOVERY_SEQUENCE config', () => {
  it('has 3 steps', () => {
    expect(RECOVERY_SEQUENCE).toHaveLength(3);
  });

  it('steps are in ascending order', () => {
    const steps = RECOVERY_SEQUENCE.map(s => s.step);
    expect(steps).toEqual([1, 2, 3]);
  });

  it('delays are increasing', () => {
    const delays = RECOVERY_SEQUENCE.map(s => s.delayMs);
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    }
  });

  it('each step has required fields', () => {
    for (const step of RECOVERY_SEQUENCE) {
      expect(step.templateId).toBeTruthy();
      expect(step.subject).toBeTruthy();
      expect(step.delayMs).toBeGreaterThan(0);
    }
  });
});
