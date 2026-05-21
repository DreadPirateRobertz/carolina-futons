/**
 * @file cf-44qt-sibling-virtualConsult-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: 9
 * console.error sites in src/backend/virtualConsultation.web.js
 * migrated to canonical logError (already imported pre-fix).
 *
 * Sites migrated (9):
 *   - getDesigners (L142)
 *   - getSlots (L207)
 *   - bookConsultation (L335)
 *   - cancelConsultation (L375)
 *   - getConsultations (L401)
 *   - uploadPhoto (L455)
 *   - getConsultationDetails (L519)
 *   - submitIntake (L603)
 *   - getIntake (L636)
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../src/backend/virtualConsultation.web.js'),
  'utf8',
);

describe('cf-44qt sibling — virtualConsultation.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', () => {
    expect(SRC).not.toMatch(/console\.error/);
    expect(SRC).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('source file uses logError for all 10 expected sites with canonical virtualConsultation: prefix', () => {
    const tags = [
      'virtualConsultation:getDesigners',
      'virtualConsultation:getAvailableSlots',
      'virtualConsultation:bookConsultation-emailFailed',
      'virtualConsultation:bookConsultation',
      'virtualConsultation:cancelConsultation',
      'virtualConsultation:getMyConsultations',
      'virtualConsultation:uploadPhoto',
      'virtualConsultation:getConsultationDetails',
      'virtualConsultation:submitIntakeForm',
      'virtualConsultation:getIntakeForm',
    ];
    for (const tag of tags) {
      expect(SRC).toMatch(new RegExp(`logError\\(\\s*['"\`]${tag}`));
    }
  });

  it('logError invocation count: 10 migrated + 2 pre-existing addConsultationNotes = 12 total', () => {
    const matches = SRC.match(/logError\s*\(/g) || [];
    expect(matches.length).toBe(12);
  });
});
