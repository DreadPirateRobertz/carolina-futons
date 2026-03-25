/**
 * @module MilestoneRewardsWidget
 * @description Displays milestone progress bars and unlockable rewards.
 *
 * Elements:
 *   #milestonesTitle    — Text: "Your Milestones"
 *   #milestonesRepeater — Repeater listing milestones
 *   #milestoneNextUp    — Text: highlights closest-to-completion milestone
 *   #milestonesError    — Shown on error
 *
 * Repeater item elements:
 *   #milestoneName   — Text: milestone title
 *   #milestoneDesc   — Text: milestone description
 *   #milestoneBar    — Progress bar (currentValue / targetValue)
 *   #milestoneReward — Text: reward description
 *   #milestoneLock   — Lock icon if locked, trophy if unlocked
 *
 * CF-lhrg
 */

import { getMilestones as _defaultGetMilestones } from 'backend/gamificationEventReceiver.web';

/**
 * Initialise the milestone rewards widget.
 *
 * @param {string}   memberId  Member whose milestones to display
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getMilestones]
 */
export async function initMilestoneRewardsWidget(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getMilestones = opts.getMilestones ?? ((id) => _defaultGetMilestones(id));

  let milestones;
  try {
    milestones = await getMilestones(memberId);
  } catch {
    milestones = null;
  }

  if (!milestones) {
    try { $w('#milestonesError').show(); } catch {}
    try { $w('#milestonesTitle').hide(); } catch {}
    try { $w('#milestonesRepeater').hide(); } catch {}
    try { $w('#milestoneNextUp').hide(); } catch {}
    return;
  }

  try { $w('#milestonesError').hide(); } catch {}
  try { $w('#milestonesTitle').text = 'Your Milestones'; } catch {}

  // Repeater data
  try {
    const items = milestones.map((m) => ({
      _id: m.milestoneId,
      title: m.title,
      description: m.description,
      currentValue: m.currentValue,
      targetValue: m.targetValue,
      reward: m.reward,
      isUnlocked: m.isUnlocked,
    }));

    $w('#milestonesRepeater').onItemReady(($item, itemData) => {
      try { $item('#milestoneName').text = itemData.title; } catch {}
      try { $item('#milestoneDesc').text = itemData.description; } catch {}
      try {
        const pct = itemData.targetValue > 0
          ? Math.round((itemData.currentValue / itemData.targetValue) * 100)
          : 0;
        $item('#milestoneBar').targetValue = pct;
      } catch {}
      try { $item('#milestoneReward').text = itemData.reward; } catch {}
      try {
        if (itemData.isUnlocked) {
          $item('#milestoneLock').src = 'trophy';
        } else {
          $item('#milestoneLock').src = 'lock';
        }
      } catch {}
    });

    $w('#milestonesRepeater').data = items;
    $w('#milestonesRepeater').show();
  } catch {}

  // Next up: closest-to-completion locked milestone
  try {
    const locked = milestones.filter((m) => !m.isUnlocked);
    if (locked.length > 0) {
      const closest = locked.reduce((best, m) => {
        const pct = m.targetValue > 0 ? m.currentValue / m.targetValue : 0;
        const bestPct = best.targetValue > 0 ? best.currentValue / best.targetValue : 0;
        return pct > bestPct ? m : best;
      });
      $w('#milestoneNextUp').text = `Next up: ${closest.title} (${closest.currentValue}/${closest.targetValue})`;
      $w('#milestoneNextUp').show();
    } else {
      $w('#milestoneNextUp').text = 'All milestones unlocked!';
      $w('#milestoneNextUp').show();
    }
  } catch {}
}
