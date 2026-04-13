# Carolina Futons Deep Link URL Specification

**Canonical scheme**: `carolinafutons://`
**Maintained by**: melania (cfutons) + dallas (cfutons_mobile)
**Last updated**: 2026-04-12

---

## Scheme

All deep links use the `carolinafutons://` scheme. This is the **production-registered scheme** in the mobile app's `app.json`. Do not introduce alternative schemes.

Web fallback URLs use `https://www.carolinafutons.com/` as the base.

---

## Route Table

| Route | Mobile Screen | Web Fallback | Status | Notes |
|-------|--------------|-------------|--------|-------|
| `carolinafutons://challenges` | ChallengesScreen | `/gamification/challenges` | missing — cm-dkl | |
| `carolinafutons://challenges/{challengeId}` | ChallengesScreen (deep) | `/gamification/challenges` | missing — cm-dkl | |
| `carolinafutons://trails` | TrailsScreen | `/gamification/trails` | **new screen** — cm-dkl | See Trails note below |
| `carolinafutons://trails/{trailId}` | TrailsScreen (detail) | `/gamification/trails` | **new screen** — cm-dkl | |
| `carolinafutons://leaderboard` | LeaderboardScreen | `/gamification/leaderboard` | missing — cm-dkl | |
| `carolinafutons://badges` | AchievementBadgesScreen | `/gamification/badges` | missing — cm-dkl | |
| `carolinafutons://badges/{badgeId}` | AchievementBadgesScreen (detail) | `/gamification/badges` | missing — cm-dkl | |
| `carolinafutons://loyalty` | LoyaltyScreen | `/gamification` | **existing** | |
| `carolinafutons://avatar` | AvatarEquipScreen | `/gamification` | **existing** | |
| `carolinafutons://referral/{code}` | ReferralLandingScreen | `/referral/{code}` | **existing** | |
| `carolinafutons://products/{productId}` | ProductScreen | `/product-page/{slug}` | TBD | productId→slug lookup needed |
| `carolinafutons://rooms` | RealRoomsGallery | `/rooms` | TBD | UGC gallery |

---

## Trails Note

Trails are **distinct** from ad-hoc challenges. The Blue Ridge Trail system has 3 seasonal trails (spring / summer / fall), each containing 5 ordered challenges. Trail progress is tracked separately in the `MemberTrailProgress` CMS collection.

- `carolinafutons://trails` → list of all 3 trails with per-trail completion state
- `carolinafutons://trails/{trailId}` → detail view: trail name, season, challenge list, perk preview

**TrailIds** (from `TRAIL_REGISTRY` in `src/backend/challengeService.web.js`):
- `trail-spring`
- `trail-summer`  
- `trail-fall`

---

## Web-Side Implementation

`src/backend/deepLinkService.web.js` builds deep links. Update `APP_SCHEME` constant if scheme ever changes (single source of truth).

```js
// Always use this constant — never hardcode the scheme
export const APP_SCHEME = 'carolinafutons://';
```

---

## Mobile-Side Implementation

- Scheme registered in `app.json`
- Add missing routes via cm-dkl (dallas)
- TrailsScreen is a new screen (not an alias for ChallengesScreen)

---

## Cross-Rig Event → Push Payload Deep Link Mapping

When cfutons web fires a push notification via `pushNotificationService.web.js`, include the deep link in the notification `data` payload so the mobile OS can route on tap:

| Push Event | Deep Link |
|-----------|-----------|
| `badge_earned` | `carolinafutons://badges/{badgeId}` |
| `tier_changed` | `carolinafutons://loyalty` |
| `challenge_complete` | `carolinafutons://challenges/{challengeId}` |
| `streak_milestone` | `carolinafutons://loyalty` |
| `price_drop` | `carolinafutons://products/{productId}` |
