/**
 * @module onboardingQuest.web
 * @description Backend for the 4-step onboarding quest chain.
 * Tracks member progress through: Profile → First Purchase → Review → Referral.
 * Each step awards points and unlocks the next.
 *
 * Collection: OnboardingQuestProgress
 *   { memberId, completedSteps: string[], lastCompletedAt: Date }
 *
 * CF-ufn3
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const COLLECTION = 'OnboardingQuestProgress';

export const QUEST_STEPS = [
  { id: 'complete_profile', title: 'Complete Your Profile', description: 'Add your name and shipping address', points: 50, order: 0 },
  { id: 'first_purchase', title: 'Make Your First Purchase', description: 'Place your first order', points: 100, order: 1 },
  { id: 'write_review', title: 'Write a Review', description: 'Share your experience with a product review', points: 75, order: 2 },
  { id: 'refer_friend', title: 'Refer a Friend', description: 'Invite a friend and earn when they sign up', points: 200, order: 3 },
];

/**
 * Get onboarding quest progress for the authenticated member.
 *
 * @returns {Promise<{ steps: Array<{ id, title, description, points, order, completed }>, totalPoints: number, earnedPoints: number } | { error: string }>}
 */
export const getOnboardingProgress = webMethod(
  Permissions.SiteMember,
  async () => {
    let memberId;
    try {
      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      memberId = caller?._id;
    } catch (_) {}

    if (!memberId) return { error: 'auth_required' };

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      const completedSteps = result.items.length > 0
        ? (result.items[0].completedSteps || [])
        : [];

      const steps = QUEST_STEPS.map(s => ({
        ...s,
        completed: completedSteps.includes(s.id),
      }));

      const totalPoints = QUEST_STEPS.reduce((sum, s) => sum + s.points, 0);
      const earnedPoints = QUEST_STEPS
        .filter(s => completedSteps.includes(s.id))
        .reduce((sum, s) => sum + s.points, 0);

      return { steps, totalPoints, earnedPoints };
    } catch (err) {
      logError(`onboardingQuest.getOnboardingProgress — memberId=${memberId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);

/**
 * Mark an onboarding quest step as complete for the authenticated member.
 * Steps must be completed in order — earlier steps are auto-completed.
 *
 * @param {string} stepId
 * @returns {Promise<{ success: boolean, pointsAwarded: number } | { error: string }>}
 */
export const completeOnboardingStep = webMethod(
  Permissions.SiteMember,
  async (stepId) => {
    let memberId;
    try {
      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      memberId = caller?._id;
    } catch (_) {}

    if (!memberId) return { error: 'auth_required' };

    const step = QUEST_STEPS.find(s => s.id === stepId);
    if (!step) return { error: 'invalid_step' };

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      const existing = result.items.length > 0 ? result.items[0] : null;
      const completedSteps = existing ? [...(existing.completedSteps || [])] : [];

      if (completedSteps.includes(stepId)) {
        return { success: true, pointsAwarded: 0 }; // idempotent
      }

      // Auto-complete earlier steps
      let pointsAwarded = 0;
      for (const s of QUEST_STEPS) {
        if (s.order > step.order) break;
        if (!completedSteps.includes(s.id)) {
          completedSteps.push(s.id);
          pointsAwarded += s.points;
        }
      }

      if (existing) {
        await wixData.update(COLLECTION, {
          ...existing,
          completedSteps,
          lastCompletedAt: new Date(),
        }, { suppressAuth: true });
      } else {
        await wixData.insert(COLLECTION, {
          memberId,
          completedSteps,
          lastCompletedAt: new Date(),
        }, { suppressAuth: true });
      }

      return { success: true, pointsAwarded };
    } catch (err) {
      logError(`onboardingQuest.completeOnboardingStep — memberId=${memberId}, stepId=${stepId}`, err);
      return { error: 'service_unavailable' };
    }
  }
);
