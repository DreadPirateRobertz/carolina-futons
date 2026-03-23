# Wix Velo IDOR Ownership Check Pattern

**Authors**: melania + miquella
**Date**: 2026-03-21
**Distribution**: predator/dutch, cfutons_mobile/dallas, gastown/zhora
**Status**: HOLD — distribute after D41 H1 report ID confirmed

---

## Background

Dutch's predator audit (D40–D43) identified a recurring IDOR pattern across cfutons Velo backend services. Functions accepting a `memberId` parameter validated the ID format (via `validateId`) but did **not** verify that the authenticated session member matches the requested `memberId`. Any authenticated member could pass another member's ID and access or mutate their data.

**Findings summary:**

| Finding | CVSS | Service | Affected Functions |
|---------|------|---------|-------------------|
| D40 | 8.1H | referralService | `completeReferral` |
| D41 | 7.1H | storeCreditService | `getMyStoreCredit`, `applyStoreCredit`, `getStoreCreditHistory`, `giftStoreCredit`, `getExpiringCredits` |
| D42 | 6.5M | flagReview | no-dedup on flag submission |
| D43 | 8.1H | couponsService | `getActiveCoupons` (all 6 rigs) |

---

## The Vulnerability Pattern

Any `Permissions.SiteMember` webMethod that accepts a `memberId` and queries data by it — without checking the session — is an IDOR:

```js
// ❌ VULNERABLE — memberId not verified against session
export const getMyStoreCredit = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    const cleanId = validateId(memberId);
    if (!cleanId) return [];
    // BUG: any logged-in member can pass any memberId here
    const result = await wixData.query('StoreCredits')
      .eq('memberId', cleanId)
      .find();
    return result.items;
  }
);
```

---

## The Fix Pattern

After validating the input ID, call `currentMember.getMember()` and assert the session member matches:

```js
import { currentMember } from 'wix-members-backend';
import { validateId } from 'backend/utils/sanitize';

// ✅ CORRECT — session ownership verified
export const getMyStoreCredit = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    const cleanId = validateId(memberId);
    if (!cleanId) return [];

    const member = await currentMember.getMember();
    if (!member || cleanId !== member._id) {
      return { success: false, message: 'Unauthorized' };
    }

    const result = await wixData.query('StoreCredits')
      .eq('memberId', cleanId)
      .find();
    return result.items;
  }
);
```

**Key rules:**
1. `validateId()` alone is not sufficient — it only sanitizes format, not identity.
2. `currentMember.getMember()` returns the **session-authenticated** member. If `null`, the session is invalid — reject.
3. Compare `cleanId !== member._id` (strict equality on validated IDs).
4. Return a generic `'Unauthorized'` message — do not leak whether the memberId exists.
5. For functions with a "from" party (e.g. `giftStoreCredit`), check `fromId !== member._id`, not the recipient.

---

## Audit Checklist

Any `Permissions.SiteMember` webMethod that does **any** of the following needs this check:

- Accepts a `memberId`, `fromMemberId`, or `toMemberId` parameter
- Queries a collection filtered by `memberId`
- Writes/updates a record scoped to a member
- Returns financial, personal, or behavioural data

**Exempt** (no check needed):
- `Permissions.Admin` webMethods — server-to-server only, no user session
- `Permissions.Anyone` webMethods — unauthenticated, no session to verify (apply rate limiting instead)

---

## Test Pattern

Every fixed function needs at minimum these two test cases:

```js
it('rejects request when memberId does not match session', async () => {
  __setMember({ _id: 'attacker-id' });
  const result = await getMyStoreCredit('victim-id');
  expect(result).toEqual({ success: false, message: 'Unauthorized' });
});

it('allows request when memberId matches session', async () => {
  __setMember({ _id: 'member-1' });
  // seed data for member-1...
  const result = await getMyStoreCredit('member-1');
  expect(Array.isArray(result)).toBe(true);
});
```

Mock setup (vitest alias config auto-resolves `wix-members-backend`):

```js
import { __reset as __resetMember, __setMember } from './__mocks__/wix-members-backend.js';

beforeEach(() => {
  __resetMember();
  __setMember({ _id: 'default-member' });
});
```

---

## Files Patched (cfutons dev repo)

- `src/backend/storeCreditService.web.js` — commit `978cc2d2`
- `src/backend/referralService.web.js` — commit `60a9e49a`
- `src/backend/couponsService.web.js` — commit `f6de44a9`
- `src/backend/flagReviewService.web.js` — see D42

**Note**: `978cc2d2` (storeCreditService) is NOT yet in stage3-velo / production. Emergency patch release pending Stilgar approval + H1 submission timing.
