/**
 * @file cf-44qt-batch9-logError.test.js
 * @description TDD red → green for cf-44qt batch9: 5 backend modules
 * migrated to canonical logError.
 *
 * Modules + sites:
 *   - lifecycleCron.web.js (3 sites: scanLifecycleMilestones,
 *     challengeReminderPush per-member with `${record.memberId}` template,
 *     runDailyChallengeReminders)
 *   - promotions.web.js (2 sites: getActivePromotion, getFlashSales —
 *     [promotions] prefix added; pre-fix sites had bare 'Error X')
 *   - rewardEngine.web.js (1 site: local logError wrapper now routes
 *     through canonical errorHandler via 'logError as _logErrorCanonical'
 *     alias — preserves the (msg, err) 1-arg-prefixed call-site shape)
 *   - lifecycleEmailSender.web.js (1 site: sendLifecycleEmails)
 *   - contacts/contactResolver.web.js (1 site: appendOrCreateContact
 *     with `${cleanEmail}` template)
 *
 * Total: 8 console.error sites across 5 files.
 *
 * cf-44qt batch9 — radahn (Stilgar pace-alert dispatch).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FILES_NO_CONSOLE = [
  { path: 'src/backend/lifecycleCron.web.js' },
  { path: 'src/backend/promotions.web.js' },
  { path: 'src/backend/rewardEngine.web.js' },
  { path: 'src/backend/lifecycleEmailSender.web.js' },
  { path: 'src/backend/contacts/contactResolver.web.js' },
];

describe('cf-44qt batch9 — 5-module logError migration', () => {
  it.each(FILES_NO_CONSOLE)('$path has NO remaining bare console.error', ({ path }) => {
    expect(read(path)).not.toMatch(/console\.error/);
  });

  it('lifecycleCron.web.js: 3 expected labels with canonical [lifecycleCron] prefix', () => {
    const src = read('src/backend/lifecycleCron.web.js');
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
    expect(src).toMatch(/logError\(\s*['"]\[lifecycleCron\] scanLifecycleMilestones['"]/);
    expect(src).toMatch(/logError\(\s*['"]\[lifecycleCron\] runDailyChallengeReminders['"]/);
    expect(src).toMatch(/logError\(\s*`\[lifecycleCron\] challengeReminderPush \$\{record\.memberId\}`/);
  });

  it('promotions.web.js: 2 expected labels with canonical [promotions] prefix (added)', () => {
    const src = read('src/backend/promotions.web.js');
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
    expect(src).toMatch(/logError\(\s*['"]\[promotions\] getActivePromotion['"]/);
    expect(src).toMatch(/logError\(\s*['"]\[promotions\] getFlashSales['"]/);
  });

  it('rewardEngine.web.js: local logError wrapper routes through canonical via _logErrorCanonical alias', () => {
    const src = read('src/backend/rewardEngine.web.js');
    expect(src).toMatch(
      /import\s*{\s*logError\s+as\s+_logErrorCanonical\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
    expect(src).toMatch(/_logErrorCanonical\(\s*`\[rewardEngine\]/);
    expect(src).not.toMatch(/console\.error/);
  });

  it('lifecycleEmailSender.web.js: sendLifecycleEmails label', () => {
    const src = read('src/backend/lifecycleEmailSender.web.js');
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
    expect(src).toMatch(
      /logError\(\s*['"]\[lifecycleEmailSender\] sendLifecycleEmails['"]/,
    );
  });

  it('contacts/contactResolver.web.js: appendOrCreateContact template label with cleanEmail interp', () => {
    const src = read('src/backend/contacts/contactResolver.web.js');
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
    expect(src).toMatch(
      /logError\(\s*`\[contactResolver\] appendOrCreateContact \$\{cleanEmail\}`/,
    );
  });
});
