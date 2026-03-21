/**
 * @module birthdayRewardService
 * @description Daily cron handlers for birthday and anniversary milestone rewards.
 * Birthday: runs daily, queries members whose birthday month+day matches today,
 * calls createBirthdayCoupon(), sends birthday_reward email, deduplicates via BirthdayRewards CMS.
 * Anniversary: runs daily, queries all members, filters for 1yr/3yr/5yr join anniversaries,
 * calls createTierUpgradeCoupon(), sends tier-specific email, deduplicates via BirthdayRewards CMS.
 *
 * CMS collections:
 * - MemberProfiles (read) — member birthday/joinDate/contactId data
 * - BirthdayRewards (read/write) — dedup ledger (memberId + rewardType + year)
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 * @requires wix-data
 * @requires backend/couponsService.web
 */
import { webMethod, Permissions } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import wixData from 'wix-data';
import { createBirthdayCoupon, createTierUpgradeCoupon } from 'backend/couponsService.web';

const ANNIVERSARY_MILESTONES = {
  1: { rewardType: 'anniversary_1yr', discountPercent: 10, emailTemplate: 'anniversary_1yr' },
  3: { rewardType: 'anniversary_3yr', discountPercent: 15, emailTemplate: 'anniversary_3yr' },
  5: { rewardType: 'anniversary_5yr', discountPercent: 20, emailTemplate: 'anniversary_5yr', vipBadge: true },
};

async function isAlreadySent(memberId, rewardType, year) {
  const result = await wixData
    .query('BirthdayRewards')
    .eq('memberId', memberId)
    .eq('rewardType', rewardType)
    .eq('year', year)
    .limit(1)
    .find();
  return result.items.length > 0;
}

/**
 * Check and send birthday rewards for members whose birthday is today.
 * Intended to run daily via Wix scheduled job.
 *
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
export const checkAndSendBirthdayRewards = webMethod(
  Permissions.Admin,
  async () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear();

    const profilesResult = await wixData
      .query('MemberProfiles')
      .eq('birthdayMonth', month)
      .eq('birthdayDay', day)
      .find();

    let sent = 0, skipped = 0, failed = 0;

    for (const profile of profilesResult.items) {
      const already = await isAlreadySent(profile.memberId, 'birthday', year);
      if (already) { skipped++; continue; }

      const couponResult = await createBirthdayCoupon(profile.email, profile.memberName);
      if (!couponResult.success) { failed++; continue; }

      try {
        await triggeredEmails.emailContact('birthday_reward', profile.contactId, {
          variables: { couponCode: couponResult.code },
        });
      } catch (e) {
        console.error('[birthdayRewardService] Birthday email failed for member', profile.memberId, ':', e);
      }

      await wixData.insert('BirthdayRewards', {
        memberId: profile.memberId,
        rewardType: 'birthday',
        year,
      });

      sent++;
    }

    return { sent, skipped, failed };
  }
);

/**
 * Check and send anniversary rewards for members at 1yr, 3yr, or 5yr join milestones.
 * Intended to run daily via Wix scheduled job.
 *
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
export const checkAndSendAnniversaryRewards = webMethod(
  Permissions.Admin,
  async () => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const year = today.getFullYear();

    const profilesResult = await wixData.query('MemberProfiles').find();

    let sent = 0, skipped = 0, failed = 0;

    for (const profile of profilesResult.items) {
      const joinDate = new Date(profile.joinDate);
      if (joinDate.getMonth() + 1 !== todayMonth || joinDate.getDate() !== todayDay) continue;

      const yearsElapsed = year - joinDate.getFullYear();
      const milestone = ANNIVERSARY_MILESTONES[yearsElapsed];
      if (!milestone) { skipped++; continue; }

      const already = await isAlreadySent(profile.memberId, milestone.rewardType, year);
      if (already) { skipped++; continue; }

      const couponResult = await createTierUpgradeCoupon(profile.email, profile.memberName, milestone.discountPercent);
      if (!couponResult.success) { failed++; continue; }

      try {
        const variables = { couponCode: couponResult.code };
        if (milestone.vipBadge) variables.vipBadge = true;
        await triggeredEmails.emailContact(milestone.emailTemplate, profile.contactId, { variables });
      } catch (e) {
        console.error('[birthdayRewardService] Anniversary email failed for member', profile.memberId, ':', e);
      }

      await wixData.insert('BirthdayRewards', {
        memberId: profile.memberId,
        rewardType: milestone.rewardType,
        year,
        discountPercent: milestone.discountPercent,
      });

      sent++;
    }

    return { sent, skipped, failed };
  }
);
