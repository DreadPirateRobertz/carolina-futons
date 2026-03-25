/**
 * @module GamificationHub
 * @description Orchestrates all gamification widget initialisations on the
 * member dashboard page. Each widget is initialised in parallel; a failure in
 * one widget is isolated and does not prevent the others from loading.
 *
 * CF-zgmv
 */

import { initPointsBalanceWidget as _initPointsBalance }   from 'public/PointsBalanceWidget';
import { initLeaderboardWidget   as _initLeaderboard }     from 'public/LeaderboardWidget';
import { initSpinWheel           as _initSpinWheel }       from 'public/SpinWheelIntegration';
import { initOnboarding          as _initOnboarding }      from 'public/GamificationOnboarding';
import { initDailyChallengeWidget as _initDailyChallenge } from 'public/DailyChallengeWidget';
import { initBadgeDisplayWidget  as _initBadgeDisplay }    from 'public/BadgeDisplayWidget';

const WIDGETS = [
  { name: 'pointsBalance', key: 'initPointsBalanceWidget',  default: _initPointsBalance  },
  { name: 'leaderboard',   key: 'initLeaderboardWidget',    default: _initLeaderboard    },
  { name: 'spinWheel',     key: 'initSpinWheel',            default: _initSpinWheel      },
  { name: 'onboarding',    key: 'initOnboarding',           default: _initOnboarding     },
  { name: 'dailyChallenge',key: 'initDailyChallengeWidget', default: _initDailyChallenge },
  { name: 'badgeDisplay',  key: 'initBadgeDisplayWidget',   default: _initBadgeDisplay   },
];

/**
 * Initialise all gamification widgets in parallel.
 *
 * @param {string}   memberId
 * @param {Object}   [opts]    Injectable overrides (for testing)
 * @param {Function} [opts.$w]
 * @param {Function} [opts.initPointsBalanceWidget]
 * @param {Function} [opts.initLeaderboardWidget]
 * @param {Function} [opts.initSpinWheel]
 * @param {Function} [opts.initOnboarding]
 * @param {Function} [opts.initDailyChallengeWidget]
 * @param {Function} [opts.initBadgeDisplayWidget]
 * @returns {Promise<{ initialized: string[], failed: string[] }>}
 */
export async function initGamificationHub(memberId, opts = {}) {
  const $w = opts.$w ?? globalThis.$w;

  const results = await Promise.allSettled(
    WIDGETS.map(({ name, key, default: defaultFn }) => {
      const fn = opts[key] ?? defaultFn;
      return fn(memberId, { $w }).then(() => name);
    })
  );

  const initialized = [];
  const failed = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      initialized.push(result.value);
    } else {
      failed.push(WIDGETS[i].name);
    }
  });

  return { initialized, failed };
}
