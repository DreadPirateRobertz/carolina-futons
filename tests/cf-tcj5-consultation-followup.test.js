/**
 * @file cf-tcj5-consultation-followup.test.js
 * @description CF-tcj5: Tests for post-consultation follow-up email sequence.
 *
 * Covers:
 *  - consultation_followup step spec: 1 step at 120h (2h after end time modeled as delay)
 *  - addConsultationNotes: stores productIds + notes on ConsultationBookings record
 *  - addConsultationNotes: marks booking status 'completed'
 *  - addConsultationNotes: triggers follow-up email (fire-and-forget)
 *  - triggerConsultationFollowup: includes firstName, designerName, productIds, discountCode
 *  - triggerConsultationFollowup: discountCode = 'CONSULT10'
 *  - triggerConsultationFollowup: roomType/budget from quizAnswers passed as variables
 *  - triggerConsultationFollowup: fallback when quizAnswers missing
 *  - addConsultationNotes: not-found returns success: false
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __onUpdate, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  vi.clearAllMocks();
});

import {
  triggerConsultationFollowup,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

import { addConsultationNotes } from '../src/backend/virtualConsultation.web.js';

// ── Step definitions ──────────────────────────────────────────────────

describe('consultation_followup sequence step spec (CF-tcj5)', () => {
  it('has exactly 1 step', () => {
    expect(_SEQUENCES.consultation_followup.steps).toHaveLength(1);
  });

  it('step 1 is 2h delay (scheduled 2h after consultation end)', () => {
    const step1 = _SEQUENCES.consultation_followup.steps.find(s => s.step === 1);
    expect(step1.delayHours).toBe(2);
  });

  it('step 1 description mentions follow-up or recommendations', () => {
    const step1 = _SEQUENCES.consultation_followup.steps.find(s => s.step === 1);
    expect(step1.description).toMatch(/follow.?up|recommendation|picks/i);
  });
});

// ── triggerConsultationFollowup variables ─────────────────────────────

describe('triggerConsultationFollowup variables', () => {
  it('includes firstName and designerName', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerConsultationFollowup('c-1', 'buyer@test.com', 'Alex', {
      designerName: 'Brenda',
      productIds: ['pid-1', 'pid-2'],
      notes: 'Looking for a queen futon',
    });

    const step1 = items.find(i => i.sequenceType === 'consultation_followup');
    expect(step1.variables.firstName).toBe('Alex');
    expect(step1.variables.designerName).toBe('Brenda');
  });

  it('includes productIds in variables', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerConsultationFollowup('c-1', 'buyer@test.com', 'Alex', {
      designerName: 'Brenda',
      productIds: ['pid-1', 'pid-2', 'pid-3'],
    });

    const step1 = items.find(i => i.sequenceType === 'consultation_followup');
    expect(step1.variables.productIds).toEqual(['pid-1', 'pid-2', 'pid-3']);
  });

  it('includes discountCode = "CONSULT10"', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerConsultationFollowup('c-1', 'buyer@test.com', 'Alex', {
      designerName: 'Brenda',
      productIds: ['pid-1'],
    });

    const step1 = items.find(i => i.sequenceType === 'consultation_followup');
    expect(step1.variables.discountCode).toBe('CONSULT10');
  });

  it('includes roomType and budget from quizAnswers', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerConsultationFollowup('c-1', 'buyer@test.com', 'Alex', {
      designerName: 'Brenda',
      productIds: ['pid-1'],
      quizAnswers: { roomType: 'living-room', budget: '500-1000' },
    });

    const step1 = items.find(i => i.sequenceType === 'consultation_followup');
    expect(step1.variables.roomType).toBe('living-room');
    expect(step1.variables.budget).toBe('500-1000');
  });

  it('omits roomType/budget when quizAnswers missing', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerConsultationFollowup('c-1', 'buyer@test.com', 'Alex', {
      designerName: 'Brenda',
      productIds: ['pid-1'],
    });

    const step1 = items.find(i => i.sequenceType === 'consultation_followup');
    expect(step1.variables.roomType).toBeUndefined();
    expect(step1.variables.budget).toBeUndefined();
  });

  it('uses sequenceType = "consultation_followup"', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerConsultationFollowup('c-1', 'buyer@test.com', 'Alex', {
      designerName: 'Brenda',
      productIds: [],
    });

    expect(items[0].sequenceType).toBe('consultation_followup');
  });
});

// ── addConsultationNotes ──────────────────────────────────────────────

describe('addConsultationNotes', () => {
  const BOOKING = {
    _id: 'bk-1',
    memberId: 'm-1',
    designerId: 'd-1',
    recipientEmail: 'buyer@test.com',
    contactName: 'Alex Smith',
    status: 'confirmed',
    quizAnswers: JSON.stringify({ roomType: 'living-room', budget: '500-1000' }),
  };

  const DESIGNER = {
    _id: 'd-1',
    name: 'Brenda',
  };

  it('updates booking status to "completed"', async () => {
    __seed('ConsultationBookings', [BOOKING]);
    __seed('Designers', [DESIGNER]);
    const updates = [];
    __onUpdate((col, item) => { if (col === 'ConsultationBookings') updates.push(item); });

    await addConsultationNotes('bk-1', ['pid-1'], 'Great chat!');

    expect(updates.some(u => u._id === 'bk-1' && u.status === 'completed')).toBe(true);
  });

  it('saves productIds to booking record', async () => {
    __seed('ConsultationBookings', [BOOKING]);
    __seed('Designers', [DESIGNER]);
    const updates = [];
    __onUpdate((col, item) => { if (col === 'ConsultationBookings') updates.push(item); });

    await addConsultationNotes('bk-1', ['pid-1', 'pid-2'], 'Recommended frames');

    const update = updates.find(u => u._id === 'bk-1');
    const savedIds = JSON.parse(update.recommendedProductIds);
    expect(savedIds).toEqual(['pid-1', 'pid-2']);
  });

  it('queues follow-up email after addConsultationNotes', async () => {
    __seed('ConsultationBookings', [BOOKING]);
    __seed('Designers', [DESIGNER]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await addConsultationNotes('bk-1', ['pid-1'], 'Notes here');
    await new Promise(r => setTimeout(r, 100));

    expect(items.filter(i => i.sequenceType === 'consultation_followup')).toHaveLength(1);
  });

  it('returns success: false when booking not found', async () => {
    __seed('ConsultationBookings', []);
    const result = await addConsultationNotes('bk-missing', ['pid-1'], 'Notes');
    expect(result.success).toBe(false);
  });
});
