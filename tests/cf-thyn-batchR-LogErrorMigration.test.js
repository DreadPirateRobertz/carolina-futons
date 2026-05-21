/**
 * cf-thyn (cf-44qt batch-R): 3-file console.warn sweep (10 sites).
 *
 * Files:
 *   - cartRecovery.web.js (1 site: getLoyaltyContext)
 *   - swatchKitService.web.js (2 sites: idempotency check + auth guard)
 *   - http-functions.js (7 sites: body parse failures + getMember failures + deliveryZone)
 *
 * All files already import logError from backend/utils/errorHandler.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(TEST_DIR, '../src/backend');

function read(rel) {
  return fs.readFileSync(path.resolve(SRC, rel), 'utf-8');
}

function tagPattern(tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `logError\\s*\\(\\s*['"\`]${escaped}(?:['"\`]|\\s|\\$\\{)`,
  );
}

describe('cf-thyn (cf-44qt batch-R): 3-file console.warn sweep', () => {
  describe('cartRecovery.web.js', () => {
    const src = read('cartRecovery.web.js');

    it('has no raw console.warn calls', () => {
      const calls = src.match(/console\.\w+\s*\(/g) || [];
      expect(calls).toHaveLength(0);
    });

    it('uses logError tag cartRecovery:getLoyaltyContext-failed', () => {
      expect(src).toMatch(tagPattern('cartRecovery:getLoyaltyContext-failed'));
    });
  });

  describe('swatchKitService.web.js', () => {
    const src = read('swatchKitService.web.js');

    it('has no raw console.warn calls', () => {
      const calls = src.match(/console\.\w+\s*\(/g) || [];
      expect(calls).toHaveLength(0);
    });

    it('uses logError tag swatchKitService:recordSwatchKitPurchase-idempotencyFailed', () => {
      expect(src).toMatch(tagPattern('swatchKitService:recordSwatchKitPurchase-idempotencyFailed'));
    });

    it('uses logError tag swatchKitService:getSwatchKitCreditStatus-noMember', () => {
      expect(src).toMatch(tagPattern('swatchKitService:getSwatchKitCreditStatus-noMember'));
    });
  });

  describe('http-functions.js', () => {
    const src = read('http-functions.js');

    it('has no raw console.warn calls', () => {
      const calls = src.match(/console\.\w+\s*\(/g) || [];
      expect(calls).toHaveLength(0);
    });

    it('uses logError tag http-functions:contactSubmissions-bodyParseFailed', () => {
      expect(src).toMatch(tagPattern('http-functions:contactSubmissions-bodyParseFailed'));
    });

    it('uses logError tag http-functions:mailingListSignups-bodyParseFailed', () => {
      expect(src).toMatch(tagPattern('http-functions:mailingListSignups-bodyParseFailed'));
    });

    it('uses logError tag http-functions:notifyMe-bodyParseFailed', () => {
      expect(src).toMatch(tagPattern('http-functions:notifyMe-bodyParseFailed'));
    });

    it('uses logError tag http-functions:deliveryZone-serviceError', () => {
      expect(src).toMatch(tagPattern('http-functions:deliveryZone-serviceError'));
    });

    it('uses logError tag http-functions:sampleRequests-bodyParseFailed', () => {
      expect(src).toMatch(tagPattern('http-functions:sampleRequests-bodyParseFailed'));
    });

    it('uses logError tag http-functions:recordSpinGrant-unauthenticated', () => {
      expect(src).toMatch(tagPattern('http-functions:recordSpinGrant-unauthenticated'));
    });

    it('uses logError tag http-functions:submitSurvey-unauthenticated', () => {
      expect(src).toMatch(tagPattern('http-functions:submitSurvey-unauthenticated'));
    });
  });
});
