# Security Audit: Style Quiz Data Handling
**Bead**: CF-hpg0
**Audited by**: cfutons/crew/radahn
**Date**: 2026-03-21
**Files audited**:
- `src/backend/styleQuiz.web.js`
- `src/pages/Style Quiz.js`
- `src/public/engagementTracker.js` (supporting investigation)

---

## Executive Summary

**No critical or high severity findings. Style Quiz is safe to merge.**

The quiz is stateless and anonymous by design. No PII is stored server-side. No session IDs are used (IDOR is structurally impossible). The recommendation algorithm uses safe enum-key lookups with fallbacks. One functional bug found (`sizeNeeds` unused in scoring). One low-severity privacy note on client-side event storage.

---

## Findings by Category

---

### 1. Answer Storage — PII / CCPA / GDPR

**Severity: LOW (no blocking issue)**

**Backend**: `getQuizRecommendations` is completely stateless. There is no `wixData.insert()`, `wixData.save()`, or any CMS write in `styleQuiz.web.js`. Quiz answers enter the function and leave as product recommendations — nothing is persisted server-side.

**Client-side tracking**: The page calls:
```js
trackEvent('quiz_submit', { answers: state.answers });    // all 5 answers
trackEvent('quiz_answer', { step: key, answer: value });  // per-answer
```

Investigation of `engagementTracker.js` shows `quiz_submit` and `quiz_answer` event types are **not** handled by the backend switch in `flushEvents()`. They fall to the `default` branch: `_storeLocalEvent(event)` → `sessionStorage` only. No backend call is made with this data. No CMS storage.

**The answer values themselves are non-PII enum keys** (e.g., `'living-room'`, `'modern'`, `'500-1000'`). No name, email, phone, or government ID is collected.

**Residual concern (LOW)**: If the privacy policy does not disclose that quiz interaction data is stored in `sessionStorage` and used for funnel analytics, this may need a one-line addition to the privacy policy for CCPA/GDPR completeness. Not a code block.

---

### 2. Recommendation Leakage — IDOR on Session IDs

**Severity: NONE**

No IDOR is possible. The quiz has **no session IDs, no stored sessions, and no user-specific recommendation history**. Each call to `getQuizRecommendations(answers)` is independent and stateless. The backend reads only from `Stores/Products` (a public catalog) based on the answers passed in.

There is no data store that maps a session/user to past recommendations. An attacker cannot reference another user's quiz result because no such reference exists. The stateless design is the correct security approach here.

---

### 3. Rate Limiting — Bot Enumeration of Recommendation Algorithm

**Severity: LOW**

**Algorithm already public**: The recommendation logic (`ROOM_CATEGORY_MAP`, `USE_CATEGORY_MAP`, `STYLE_KEYWORDS`, `BUDGET_RANGES`, scoring weights) is delivered to the browser as Wix Velo public code. Any visitor can read the full algorithm. There is no server-side secret being protected by rate limiting.

**Enumeration surface**: 5 room types × 3 uses × 3 styles × 3 sizes × 4 budgets = 540 combinations. A bot could enumerate all in seconds. However, since the algorithm is already visible to the client, enumeration provides zero additional information an attacker couldn't get by reading the page source.

**DoS consideration**: Wix platform applies rate limiting to `wixData.query()` calls. Application-level rate limiting on `getQuizRecommendations` would be good hygiene if this endpoint sees high traffic, but is not a security requirement for this feature.

**Recommendation**: Not blocking. Consider Wix platform rate limiting if abuse is observed post-launch.

---

### 4. Answer Manipulation — Client-Side vs Server-Side Validation

**Severity: LOW**

The client enforces that each step has an answer before advancing, but this is UI-only enforcement. A user can call `getQuizRecommendations()` with any `answers` object via browser devtools or direct webMethod invocation.

**Backend behavior under manipulation**:

| Input | Backend handling |
|-------|-----------------|
| Unknown `roomType` | `ROOM_CATEGORY_MAP[value] \|\| ['futon-frames']` — safe fallback |
| Unknown `budgetRange` | `BUDGET_RANGES[value] \|\| BUDGET_RANGES['500-1000']` — safe fallback |
| Unknown `stylePreference` | `STYLE_KEYWORDS[value] \|\| []` — safe fallback, no style bonus |
| Null `answers` | `if (!answers) return []` — clean guard |

**No injection vector**: Answer values are used only as dictionary keys, never interpolated into queries, strings, or dynamic code. `wixData.query()` parameters are hardcoded collection names and numeric price values from the static `BUDGET_RANGES` object — never derived from raw user input.

**Security boundary analysis**: The recommendations are product browsing suggestions, not access control decisions. A user who manipulates answers to see premium products has gained nothing — those products are publicly visible in the store anyway. There is no privileged output gated by quiz answers.

**Functional bug found (not security)**: `answers.sizeNeeds` is collected by the quiz (5 steps shown to user) but **never read in the backend scoring logic**. The size field has zero effect on recommendations. This is a feature gap, not a security issue. Should be filed as a separate bead for CF-4qca.

---

### 5. Session Linking — Member ID Binding

**Severity: N/A (feature does not exist)**

`getQuizRecommendations` uses `Permissions.Anyone` with no member context. There is no `wixUsers` import, no `currentUser` reference, and no session token in the answers object. Quiz answers are never tied to a logged-in member ID.

This is appropriate for the feature as designed — the quiz is an anonymous product recommendation tool. No tamper-proofing is needed or applicable.

If a future requirement calls for saving quiz results to a member profile, that should be a new bead with a separate security review of the session binding.

---

## Summary Table

| # | Area | Severity | Status |
|---|------|----------|--------|
| 1 | Answer storage / PII | LOW | No server-side storage. Client sessionStorage only. Non-PII enum values. Privacy policy note recommended. |
| 2 | Recommendation leakage / IDOR | **NONE** | Stateless design. No sessions. No history. IDOR structurally impossible. |
| 3 | Rate limiting / enumeration | LOW | Algorithm already client-visible. No secret to protect. Platform rate limiting applies. |
| 4 | Answer manipulation | LOW | Safe enum-key lookups with fallbacks. No injection. No privileged output. |
| 4a | `sizeNeeds` unused | BUG | Functional gap — size has no effect on recommendations. File separate bead. |
| 5 | Session linking | **N/A** | Quiz is anonymous by design. No linking to audit. |

---

## Verdict

**CLEAR TO MERGE. No critical or high findings.**

The Style Quiz has a good security posture: stateless backend, no PII storage, safe input handling with enum fallbacks, no session-based attack surface. The main risk areas (IDOR, answer injection, member data leakage) are structurally prevented by the stateless anonymous design.

**Recommended follow-ups (non-blocking)**:
1. File bead for `sizeNeeds` unused in scoring — the size step collects user input that has no effect on results
2. One-line privacy policy update if quiz funnel analytics are tracked in sessionStorage
3. Monitor `getQuizRecommendations` call rate post-launch; add Wix rate limiting if bot traffic observed

---

*Audit complete. Dispatched by cfutons/crew/melania. Conducted by cfutons/crew/radahn.*
