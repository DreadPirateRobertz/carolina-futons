/**
 * @file cf-44qt-sibling-deliveryNotifications-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: verify the
 * 6 console.error sites in src/backend/deliveryNotifications.web.js
 * are migrated to canonical logError from backend/utils/errorHandler.
 *
 * Source-grep drift guard + per-method invocation pins. Mirrors
 * sibling PRs #1396 / #1398 / #1399 / #1402 / #1412 / #1421.
 *
 * Sites migrated (6):
 *   - sendViaTwilio Twilio error (L65)
 *   - sendViaTwilio outer catch (L72)
 *   - logSms catch (L86)
 *   - sendDeliveryBookingConfirmationSms catch (L143)
 *   - processDelivery48hReminders catch (L212)
 *   - processDeliveryDayOfReminders catch (L279)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));
vi.mock('wix-secrets-backend', () => ({ getSecret: vi.fn() }));
vi.mock('wix-fetch', () => ({ fetch: vi.fn() }));
vi.mock('wix-data', () => ({
  default: { query: vi.fn(), insert: vi.fn(), update: vi.fn(), get: vi.fn() },
}));
vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validatePhone: vi.fn(() => true),
  formatPhoneE164: vi.fn((p) => p),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import { logError } from '../src/backend/utils/errorHandler.js';

beforeEach(() => {
  vi.mocked(logError).mockClear();
});

describe('cf-44qt sibling — deliveryNotifications.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/backend/deliveryNotifications.web.js'),
      'utf8',
    );
    expect(src).not.toMatch(/console\.error/);
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 6 expected sites with canonical [deliveryNotifications] prefix', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/backend/deliveryNotifications.web.js'),
      'utf8',
    );
    // Six known site labels (verbatim from the migration).
    const expected = [
      'Twilio error',
      'sendViaTwilio failed',
      'logSms failed',
      'sendDeliveryBookingConfirmationSms failed',
      'processDelivery48hReminders failed',
      'processDeliveryDayOfReminders failed',
    ];
    for (const label of expected) {
      const re = new RegExp(
        `logError\\(\\s*['"]\\[deliveryNotifications\\] ${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}['"]`,
      );
      expect(src).toMatch(re);
    }
  });

  it('logError invocation count matches the 6 migrated sites (no over-migration drift)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/backend/deliveryNotifications.web.js'),
      'utf8',
    );
    const matches = src.match(/logError\s*\(/g) || [];
    // 6 from the migration; locks against accidental copy-paste creating
    // a 7th logError call without a matching console.error removal.
    expect(matches.length).toBe(6);
  });
});
