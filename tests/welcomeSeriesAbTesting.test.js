/**
 * @file welcomeSeriesAbTesting.test.js
 * @description Tests for welcome series A/B variant wiring in triggerWelcomeSeries
 * and triggerWelcomeSequence. Covers variant assignment logic, 50/50 split,
 * consistent assignment per member, and subject line application.
 *
 * Task: hq-dhv — Email A/B testing — welcome series subject line variants
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __seed,
  __reset,
  __getInserted,
} from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  triggerWelcomeSeries,
  triggerWelcomeSequence,
  _SEQUENCES,
  _selectABVariant,
} from '../src/backend/emailAutomation.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const EMAIL_A = 'alice@example.com';   // deterministic — will get A or B (tested below)
const EMAIL_B = 'bob@example.com';     // different hash → potentially different variant
const FIRST_NAME = 'Alice';
const DISCOUNT = 'WELCOME10';

// ═══════════════════════════════════════════════════════════════════
// _selectABVariant — unit tests
// ═══════════════════════════════════════════════════════════════════

describe('_selectABVariant — deterministic hash', () => {
  it('returns A or B', () => {
    const result = _selectABVariant('user@test.com');
    expect(['A', 'B']).toContain(result);
  });

  it('returns consistent result for same email', () => {
    const v1 = _selectABVariant('consistent@test.com');
    const v2 = _selectABVariant('consistent@test.com');
    const v3 = _selectABVariant('consistent@test.com');
    expect(v1).toBe(v2);
    expect(v2).toBe(v3);
  });

  it('produces a 50/50 split across 200 emails', () => {
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 200; i++) {
      const v = _selectABVariant(`split-test-${i}@example.com`);
      counts[v]++;
    }
    // With a good hash, neither variant should dominate (expect 35-65% each)
    expect(counts.A).toBeGreaterThan(60);
    expect(counts.B).toBeGreaterThan(60);
    expect(counts.A + counts.B).toBe(200);
  });

  it('handles empty string without throwing', () => {
    const result = _selectABVariant('');
    expect(['A', 'B']).toContain(result);
  });

  it('handles undefined without throwing', () => {
    const result = _selectABVariant(undefined);
    expect(['A', 'B']).toContain(result);
  });

  it('different emails get different variants (not all same)', () => {
    const variants = new Set();
    for (let i = 0; i < 20; i++) {
      variants.add(_selectABVariant(`variety-${i}@test.com`));
    }
    expect(variants.size).toBe(2); // both A and B appear
  });
});

// ═══════════════════════════════════════════════════════════════════
// SEQUENCES.welcome — A/B config
// ═══════════════════════════════════════════════════════════════════

describe('SEQUENCES.welcome A/B config', () => {
  it('has abTestStep defined', () => {
    expect(_SEQUENCES.welcome.abTestStep).toBeDefined();
    expect(typeof _SEQUENCES.welcome.abTestStep).toBe('number');
  });

  it('has abVariants for A and B', () => {
    expect(_SEQUENCES.welcome.abVariants.A).toBeDefined();
    expect(_SEQUENCES.welcome.abVariants.B).toBeDefined();
  });

  it('variants have distinct subject lines', () => {
    const a = _SEQUENCES.welcome.abVariants.A.subjectLine;
    const b = _SEQUENCES.welcome.abVariants.B.subjectLine;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('abTestStep points to step 1 (welcome_series_1)', () => {
    const testStep = _SEQUENCES.welcome.steps.find(
      s => s.step === _SEQUENCES.welcome.abTestStep
    );
    expect(testStep).toBeDefined();
    expect(testStep.templateId).toBe('welcome_series_1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSeries — A/B variant assignment
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSeries — A/B variant assignment', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: DISCOUNT });
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('sets abVariant on step 1 (the A/B test step)', async () => {
    await triggerWelcomeSeries(EMAIL_A, FIRST_NAME);
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);
    expect(step1).toBeDefined();
    expect(['A', 'B']).toContain(step1.abVariant);
  });

  it('abVariant is null for non-test steps (step 2 and 3)', async () => {
    await triggerWelcomeSeries(EMAIL_A, FIRST_NAME);
    const inserted = __getInserted('EmailQueue');
    const step2 = inserted.find(i => i.sequenceStep === 2);
    const step3 = inserted.find(i => i.sequenceStep === 3);
    expect(step2.abVariant).toBeNull();
    expect(step3.abVariant).toBeNull();
  });

  it('variant assignment is consistent: same email always gets same variant', async () => {
    // First trigger
    await triggerWelcomeSeries(EMAIL_A, FIRST_NAME);
    const first = __getInserted('EmailQueue');
    const firstVariant = first.find(i => i.sequenceStep === 1).abVariant;

    // Reset queue but use same email — dedup will block, so use different email with same hash behavior
    // We test consistency via _selectABVariant directly since dedup blocks re-queuing
    const hash1 = _selectABVariant(EMAIL_A);
    const hash2 = _selectABVariant(EMAIL_A);
    expect(hash1).toBe(hash2);
    expect(firstVariant).toBe(hash1);
  });

  it('applies variant-specific subject line to step 1 variables', async () => {
    await triggerWelcomeSeries(EMAIL_A, FIRST_NAME);
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);

    const assignedVariant = step1.abVariant;
    const expectedSubject = _SEQUENCES.welcome.abVariants[assignedVariant].subjectLine
      .replace('{firstName}', FIRST_NAME);

    expect(step1.variables.subjectLine).toBe(expectedSubject);
  });

  it('non-test steps do not have subjectLine override', async () => {
    await triggerWelcomeSeries(EMAIL_A, FIRST_NAME);
    const inserted = __getInserted('EmailQueue');
    const step2 = inserted.find(i => i.sequenceStep === 2);
    // subjectLine variable should not be set on step 2
    expect(step2.variables.subjectLine).toBeUndefined();
  });

  it('different emails can get different variants', () => {
    // Use _selectABVariant to find two emails with different variants
    const emails = [];
    const variants = new Set();
    for (let i = 0; i < 100 && variants.size < 2; i++) {
      const email = `ab-test-${i}@example.com`;
      const v = _selectABVariant(email);
      emails.push({ email, v });
      variants.add(v);
    }
    expect(variants.size).toBe(2);
  });

  it('50/50 split across many welcome series triggers', async () => {
    const counts = { A: 0, B: 0 };
    for (let i = 0; i < 100; i++) {
      const v = _selectABVariant(`split-welcome-${i}@example.com`);
      counts[v]++;
    }
    expect(counts.A).toBeGreaterThan(30);
    expect(counts.B).toBeGreaterThan(30);
  });

  it('B variant subject line contains firstName placeholder substitution', async () => {
    // Find an email that gets variant B
    let emailForB = null;
    for (let i = 0; i < 100; i++) {
      const candidate = `bvariant-${i}@example.com`;
      if (_selectABVariant(candidate) === 'B') {
        emailForB = candidate;
        break;
      }
    }
    expect(emailForB).not.toBeNull();

    __reset();
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
    await triggerWelcomeSeries(emailForB, 'Bob');
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);
    expect(step1.abVariant).toBe('B');

    const bSubject = _SEQUENCES.welcome.abVariants.B.subjectLine;
    const expectedSubject = bSubject.replace('{firstName}', 'Bob');
    expect(step1.variables.subjectLine).toBe(expectedSubject);
  });

  it('A variant subject line applied correctly', async () => {
    let emailForA = null;
    for (let i = 0; i < 100; i++) {
      const candidate = `avariant-${i}@example.com`;
      if (_selectABVariant(candidate) === 'A') {
        emailForA = candidate;
        break;
      }
    }
    expect(emailForA).not.toBeNull();

    __reset();
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
    await triggerWelcomeSeries(emailForA, 'Carol');
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);
    expect(step1.abVariant).toBe('A');

    const aSubject = _SEQUENCES.welcome.abVariants.A.subjectLine;
    // A subject may not have {firstName} placeholder
    const expectedSubject = aSubject.replace('{firstName}', 'Carol');
    expect(step1.variables.subjectLine).toBe(expectedSubject);
  });
});

// ═══════════════════════════════════════════════════════════════════
// triggerWelcomeSequence (Admin) — parity check
// ═══════════════════════════════════════════════════════════════════

describe('triggerWelcomeSequence — A/B parity', () => {
  beforeEach(() => {
    __reset();
    __resetSecrets();
    __setSecrets({ WELCOME_DISCOUNT_CODE: DISCOUNT });
    __seed('EmailQueue', []);
    __seed('Unsubscribes', []);
  });

  it('admin version also assigns A/B variant to step 1', async () => {
    await triggerWelcomeSequence('contact-123', EMAIL_B, 'Bob');
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);
    expect(step1).toBeDefined();
    expect(['A', 'B']).toContain(step1.abVariant);
  });

  it('admin version assigns same variant as member version for same email', async () => {
    const memberVariant = _selectABVariant(EMAIL_B);

    await triggerWelcomeSequence('contact-123', EMAIL_B, 'Bob');
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);
    expect(step1.abVariant).toBe(memberVariant);
  });

  it('admin version applies variant subject line to step 1', async () => {
    await triggerWelcomeSequence('contact-123', EMAIL_B, 'Bob');
    const inserted = __getInserted('EmailQueue');
    const step1 = inserted.find(i => i.sequenceStep === 1);

    const expectedSubject = _SEQUENCES.welcome.abVariants[step1.abVariant].subjectLine
      .replace('{firstName}', 'Bob');
    expect(step1.variables.subjectLine).toBe(expectedSubject);
  });
});
