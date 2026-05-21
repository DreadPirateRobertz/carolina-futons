/**
 * @file cf-44qt-sibling-cartRecovery-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 6
 * console.error sites in src/backend/cartRecovery.web.js migrated
 * to canonical logError. Pre-fix sites lacked the [module] prefix
 * (5 of 6) — migration adds canonical cartRecovery: colon-namespace prefix.
 *
 * Sites migrated (6):
 *   - wixEcom_onAbandonedCheckoutCreated → recordAbandonedCart .catch (L48)
 *   - wixEcom_onAbandonedCheckoutRecovered → markCartRecovered .catch (L61)
 *   - getAbandonedCartStats → getCartStats (L98)
 *   - getRecoverableCarts (L133)
 *   - markRecoveryEmailSent (L164)
 *   - exposeCartAbandonPayload (L362)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/cartRecovery.web.js'),
  'utf8',
);

describe('cf-44qt sibling — cartRecovery.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 6 expected sites with colon-namespace prefix', () => {
    const labels = [
      'recordAbandonedCart',
      'markCartRecovered',
      'getCartStats',
      'getRecoverableCarts',
      'markRecoveryEmailSent',
      'exposeCartAbandonPayload',
    ];
    for (const label of labels) {
      const re = new RegExp(
        `logError\\(\\s*['"]cartRecovery:${label}['"]`,
      );
      expect(SRC).toMatch(re);
    }
  });

  it('logError invocation count matches the 7 migrated sites (no over-migration drift)', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(7);
  });
});
