/**
 * onboardingQuestBackend.test.js
 * CF-ufn3 — Backend tests for getOnboardingProgress + completeOnboardingStep
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
import {
  getOnboardingProgress,
  completeOnboardingStep,
  QUEST_STEPS,
} from '../src/backend/onboardingQuest.web.js';

const MEMBER_ID = 'mem-onboard-1';
const COLLECTION = 'OnboardingQuestProgress';

beforeEach(() => {
  __reset();
  resetMembers();
  vi.clearAllMocks();
});

// ── getOnboardingProgress ───────────────────────────────────────────────────

describe('getOnboardingProgress', () => {
  it('returns auth_required when not authenticated', async () => {
    const result = await getOnboardingProgress();
    expect(result).toEqual({ error: 'auth_required' });
  });

  it('returns all steps incomplete for new member', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await getOnboardingProgress();
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every(s => !s.completed)).toBe(true);
    expect(result.earnedPoints).toBe(0);
    expect(result.totalPoints).toBe(425);
  });

  it('marks completed steps correctly', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      completedSteps: ['complete_profile', 'first_purchase'],
    }]);
    const result = await getOnboardingProgress();
    expect(result.steps[0].completed).toBe(true);
    expect(result.steps[1].completed).toBe(true);
    expect(result.steps[2].completed).toBe(false);
    expect(result.earnedPoints).toBe(150);
  });

  it('returns error on DB failure', async () => {
    __setMember({ _id: MEMBER_ID });
    __setQueryError(COLLECTION, new Error('DB down'));
    const result = await getOnboardingProgress();
    expect(result).toEqual({ error: 'service_unavailable' });
  });
});

// ── completeOnboardingStep ──────────────────────────────────────────────────

describe('completeOnboardingStep', () => {
  it('returns auth_required when not authenticated', async () => {
    const result = await completeOnboardingStep('complete_profile');
    expect(result).toEqual({ error: 'auth_required' });
  });

  it('returns invalid_step for unknown step', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await completeOnboardingStep('nonexistent');
    expect(result).toEqual({ error: 'invalid_step' });
  });

  it('completes first step and awards points', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await completeOnboardingStep('complete_profile');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(50);
  });

  it('auto-completes earlier steps when completing later step', async () => {
    __setMember({ _id: MEMBER_ID });
    const result = await completeOnboardingStep('write_review');
    expect(result.success).toBe(true);
    // Should award: complete_profile (50) + first_purchase (100) + write_review (75) = 225
    expect(result.pointsAwarded).toBe(225);
  });

  it('is idempotent — re-completing awards 0 points', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      completedSteps: ['complete_profile'],
    }]);
    const result = await completeOnboardingStep('complete_profile');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(0);
  });

  it('only awards points for uncompleted steps when auto-completing', async () => {
    __setMember({ _id: MEMBER_ID });
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      completedSteps: ['complete_profile'],
    }]);
    const result = await completeOnboardingStep('write_review');
    // first_purchase (100) + write_review (75) = 175 (complete_profile already done)
    expect(result.pointsAwarded).toBe(175);
  });

  it('returns error on DB failure', async () => {
    __setMember({ _id: MEMBER_ID });
    __setQueryError(COLLECTION, new Error('DB down'));
    const result = await completeOnboardingStep('complete_profile');
    expect(result).toEqual({ error: 'service_unavailable' });
  });
});
