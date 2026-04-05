# Changelog

All notable changes to the Carolina Futons Wix Velo codebase.

---

## [v1.4.0] — 2026-04-05

38,123 tests | 1,034 test files | Waves 33–34 — 60 PRs merged ([#916](https://github.com/DreadPirateRobertz/carolina-futons/pull/916)–[#979](https://github.com/DreadPirateRobertz/carolina-futons/pull/979))

### Video Reviews (CF-ou66 series)

- **Video review submission**: `uploadVideoReview` webMethod — SiteMember upload with mediaUrl validation, caption, sanitization ([#972](https://github.com/DreadPirateRobertz/carolina-futons/pull/972))
- **Video review grid**: Horizontal thumbnail row on PDP — approved reviews sorted newest-first ([#941](https://github.com/DreadPirateRobertz/carolina-futons/pull/941))
- **Video review reward**: `video_review_approved` event — 500 pts + exclusive badge on moderation approval ([#940](https://github.com/DreadPirateRobertz/carolina-futons/pull/940))
- **videoReviewService — Dallas mobile unblock**: `isWixMediaUrl` validation, full 5-method module, `VALID_VIDEO_URI_SCHEMES` allowlist ([#966](https://github.com/DreadPirateRobertz/carolina-futons/pull/966))
- **getProductVideoReviews + getVideoReviewCount**: PDP query methods for approved video reviews ([#976](https://github.com/DreadPirateRobertz/carolina-futons/pull/976))
- **Video review test hardening**: Edge cases, pagination, error paths ([#957](https://github.com/DreadPirateRobertz/carolina-futons/pull/957))

### Trail & Loyalty (CF-mcyh / CF-c6el series)

- **Trail Progress Widget**: 5-checkpoint visual trail UI — milestone markers, progress fill, completion state ([#958](https://github.com/DreadPirateRobertz/carolina-futons/pull/958))
- **Trail completion perk unlock**: Free delivery / early access / styling call — unlocked on trail completion ([#942](https://github.com/DreadPirateRobertz/carolina-futons/pull/942))
- **Tier perk definitions**: `TIER_PERK_CATALOG`, auto-delivery enrollment on tier promotion ([#951](https://github.com/DreadPirateRobertz/carolina-futons/pull/951))
- **Loyalty page — Your Perks section**: Tier perk display + next-tier teaser widget ([#959](https://github.com/DreadPirateRobertz/carolina-futons/pull/959))
- **PriceAlerts device token**: `subscriberDeviceToken` added to subscribe endpoint for mobile push ([#954](https://github.com/DreadPirateRobertz/carolina-futons/pull/954))
- **Loyalty portability + API hardening**: Mobile-facing loyalty endpoints hardened for dallas cross-rig ([#970](https://github.com/DreadPirateRobertz/carolina-futons/pull/970))

### Room Planner & Bundle Builder (CF-eqc5 series)

- **Room Planner canvas**: 2D drag-and-drop HtmlComponent — postMessage protocol, product placement, layout export ([#948](https://github.com/DreadPirateRobertz/carolina-futons/pull/948), [#949](https://github.com/DreadPirateRobertz/carolina-futons/pull/949))
- **BundleBuilder PDP widget**: Step picker with live price update, add bundle to cart, SiteMember permissions ([#955](https://github.com/DreadPirateRobertz/carolina-futons/pull/955))

### Email & Marketing Automation (CF-5io3 / CF-hwr1 series)

- **Email marketing queue**: `emailQueueService` — 5 lifecycle sequences (welcome, cart abandon, post-purchase, win-back, re-engagement) ([#971](https://github.com/DreadPirateRobertz/carolina-futons/pull/971))
- **Price drop email notifications**: `triggeredEmails.emailMember` on price drop event for PriceAlerts subscribers ([#973](https://github.com/DreadPirateRobertz/carolina-futons/pull/973), [#939](https://github.com/DreadPirateRobertz/carolina-futons/pull/939))
- **Weekly analytics digest**: Cron + data aggregation — revenue, orders, top products ([#956](https://github.com/DreadPirateRobertz/carolina-futons/pull/956), [#918](https://github.com/DreadPirateRobertz/carolina-futons/pull/918))

### Commerce & Checkout

- **CartSessions backend**: Session persistence for dallas mobile cart recovery ([#968](https://github.com/DreadPirateRobertz/carolina-futons/pull/968))
- **BNPL Calculator Widget**: Interactive Affirm/Klarna/Afterpay comparison on PDPs ([#978](https://github.com/DreadPirateRobertz/carolina-futons/pull/978), [#936](https://github.com/DreadPirateRobertz/carolina-futons/pull/936))
- **Trade-in / Trade-up program**: Backend + frontend for furniture trade-in credit flow ([#931](https://github.com/DreadPirateRobertz/carolina-futons/pull/931))
- **Swatch kit micro-product**: $5 refundable swatch kit, credit applied on $200+ purchase ([#927](https://github.com/DreadPirateRobertz/carolina-futons/pull/927))

### Analytics & Conversion

- **Conversion funnel analytics**: Full backend — `trackFunnelEvent`, `getFunnelReport`, `getABTestResults`, rate limiting, pagination ([#965](https://github.com/DreadPirateRobertz/carolina-futons/pull/965), [#967](https://github.com/DreadPirateRobertz/carolina-futons/pull/967))
- **A/B testing dashboard**: Frontend results dashboard wired to `abTestResults` backend ([#930](https://github.com/DreadPirateRobertz/carolina-futons/pull/930))
- **funnelTracker branch coverage**: Fixed 84.97% → 85%+ threshold ([#974](https://github.com/DreadPirateRobertz/carolina-futons/pull/974))

### SEO & Content

- **SEO content optimization**: `seoAutoMeta` structured data, `sitemapEnhancer` dynamic sitemap, Google Merchant Center feed enhancements ([#969](https://github.com/DreadPirateRobertz/carolina-futons/pull/969), [#979](https://github.com/DreadPirateRobertz/carolina-futons/pull/979))
- **Buying guide OG images**: Auto-generated OG card specs + SVG for all 8 buying guides ([#961](https://github.com/DreadPirateRobertz/carolina-futons/pull/961), [#928](https://github.com/DreadPirateRobertz/carolina-futons/pull/928))
- **12-week content calendar**: 8 SEO-optimized category buying guides ([#921](https://github.com/DreadPirateRobertz/carolina-futons/pull/921))
- **Buying guide SEO tests**: Schema + internal linking test coverage ([#960](https://github.com/DreadPirateRobertz/carolina-futons/pull/960))

### Customer Experience

- **NPS/CSAT survey system**: Post-purchase survey trigger, NPS analytics dashboard, response aggregation ([#963](https://github.com/DreadPirateRobertz/carolina-futons/pull/963), [#924](https://github.com/DreadPirateRobertz/carolina-futons/pull/924))
- **Warranty system**: Registration page + widget, email confirmation, member page integration, auto-expire ([#962](https://github.com/DreadPirateRobertz/carolina-futons/pull/962), [#923](https://github.com/DreadPirateRobertz/carolina-futons/pull/923))
- **Virtual consultation booking**: Booking page + frontend wire-up ([#929](https://github.com/DreadPirateRobertz/carolina-futons/pull/929), [#917](https://github.com/DreadPirateRobertz/carolina-futons/pull/917))
- **Futon Sommelier hookup**: Wired to StyleQuizResult page ([#919](https://github.com/DreadPirateRobertz/carolina-futons/pull/919))
- **Pre-sale chatbot**: Claude-powered backend for pre-sale Q&A ([#920](https://github.com/DreadPirateRobertz/carolina-futons/pull/920))
- **Daily content rotation**: Featured product / review / tip / promo rotation ([#926](https://github.com/DreadPirateRobertz/carolina-futons/pull/926), [#933](https://github.com/DreadPirateRobertz/carolina-futons/pull/933))
- **Share Your Room UGC**: CTA on PDP for UGC photo submit ([#938](https://github.com/DreadPirateRobertz/carolina-futons/pull/938))
- **White-glove delivery SMS**: SMS notifications for white-glove appointment scheduling ([#916](https://github.com/DreadPirateRobertz/carolina-futons/pull/916))

### Gamification

- **Bear Lottie avatar**: Lottie animation upload script + smoke tests ([#935](https://github.com/DreadPirateRobertz/carolina-futons/pull/935), [#953](https://github.com/DreadPirateRobertz/carolina-futons/pull/953))
- **BadgeDisplayWidget**: Inline SVG badges replacing broken PNG paths ([#943](https://github.com/DreadPirateRobertz/carolina-futons/pull/943), [#934](https://github.com/DreadPirateRobertz/carolina-futons/pull/934))

### Bug Fixes

- **HTML tag stripping**: Hardened against nested-tag bypass in sanitize layer ([#932](https://github.com/DreadPirateRobertz/carolina-futons/pull/932))
- **lifecycleCron lookback**: Fixed float boundary causing missed lifecycle events ([#937](https://github.com/DreadPirateRobertz/carolina-futons/pull/937))
- **announcementTrustBar**: Flush pending console logs in teardown to prevent test bleed ([#946](https://github.com/DreadPirateRobertz/carolina-futons/pull/946))
- **Mobile nav hamburger**: Hidden at 375px viewport — CSS specificity fix ([#952](https://github.com/DreadPirateRobertz/carolina-futons/pull/952))
- **getChallengeLeaderboard**: Corrected call signature in branch-coverage tests ([#975](https://github.com/DreadPirateRobertz/carolina-futons/pull/975))
- **ugcTaxonomy productId**: Inline regex allowlist `/^[a-zA-Z0-9_-]+$/` enforced in src (was test-only)
- **StyleQuizRegistrationGate**: Added `logError` to catch blocks — silent failures now surface ([#922](https://github.com/DreadPirateRobertz/carolina-futons/pull/922))

### Dependencies

- **@wix/cli**: 1.1.173 → 1.1.174 ([#945](https://github.com/DreadPirateRobertz/carolina-futons/pull/945))
- **lodash**: 4.17.23 → 4.18.1 ([#950](https://github.com/DreadPirateRobertz/carolina-futons/pull/950))

---

## [v1.3.0] — 2026-03-28

36,434 tests | 982 test files | Waves 30–33 — 57 PRs merged ([#863](https://github.com/DreadPirateRobertz/carolina-futons/pull/863)–[#922](https://github.com/DreadPirateRobertz/carolina-futons/pull/922))

### Email Automation

- **Post-purchase care sequence**: Day 3/7/30 personalized follow-up with delivery info, care tips, and reorder CTAs ([#897](https://github.com/DreadPirateRobertz/carolina-futons/pull/897))
- **Welcome series**: Day 0/2/5 emails — best-seller recommendations and buying guide ([#900](https://github.com/DreadPirateRobertz/carolina-futons/pull/900))
- **Cart abandonment sequence**: Personalized cartItems, urgency copy, free-shipping threshold, 5% coupon ([#899](https://github.com/DreadPirateRobertz/carolina-futons/pull/899))
- **Referral email Day 14**: Post-purchase referral prompt in care sequence ([#879](https://github.com/DreadPirateRobertz/carolina-futons/pull/879))
- **Swatch follow-up email**: Day 3 + Day 10 post-ship sequence with conversion tracking ([#905](https://github.com/DreadPirateRobertz/carolina-futons/pull/905))
- **Post-consultation follow-up**: Personalized product picks after showroom consultation ([#907](https://github.com/DreadPirateRobertz/carolina-futons/pull/907))
- **Weekly blog digest**: Automated weekly newsletter of recent blog posts ([#915](https://github.com/DreadPirateRobertz/carolina-futons/pull/915))
- **Tier milestone notifications**: Mountain Guide / Summit Master achievement emails ([#910](https://github.com/DreadPirateRobertz/carolina-futons/pull/910))
- **Monthly loyalty statement**: Points summary + tier status batch email + cron endpoint ([#913](https://github.com/DreadPirateRobertz/carolina-futons/pull/913))
- **Review request email**: Post-purchase Day 7 deep-link + conversion tracking ([#885](https://github.com/DreadPirateRobertz/carolina-futons/pull/885))

### Commerce & Checkout

- **Guest checkout flow**: Remove login wall, save guest sessions, soft account prompt post-purchase ([#902](https://github.com/DreadPirateRobertz/carolina-futons/pull/902))
- **P0 IDOR fix on guest checkout**: Security guard on `linkGuestOrdersToMember` + contactId false-positive fix ([#912](https://github.com/DreadPirateRobertz/carolina-futons/pull/912))
- **Bundle/coupon validation**: Mobile checkout endpoint for applying bundles and coupons ([#873](https://github.com/DreadPirateRobertz/carolina-futons/pull/873))
- **Consultation intake**: Pre-consultation form backend — `submitConsultationIntake` + `getConsultationIntake` webMethods ([#901](https://github.com/DreadPirateRobertz/carolina-futons/pull/901))
- **Swatch attribution tracking**: Wire swatch→purchase events + module hardening ([#910](https://github.com/DreadPirateRobertz/carolina-futons/pull/910))

### Gamification & Engagement

- **Futon Sommelier**: Conversational AI decision engine — preference quiz → curated product picks ([#876](https://github.com/DreadPirateRobertz/carolina-futons/pull/876))
- **Comfort Timeline**: Mattress break-in tracker with Day 3/7/30/90 milestone notifications ([#875](https://github.com/DreadPirateRobertz/carolina-futons/pull/875))
- **A/B testing framework**: 5 initial experiments + mobile API — hero CTA, urgency badge, product description, social proof timing, cart upsell ([#874](https://github.com/DreadPirateRobertz/carolina-futons/pull/874))
- **Assembly difficulty badge**: Easy/Medium/Expert badges on product cards and PDPs ([#863 area](https://github.com/DreadPirateRobertz/carolina-futons/pull/863))
- **White Glove Available badge**: Eligible product cards and PDPs get delivery-tier badge ([#911](https://github.com/DreadPirateRobertz/carolina-futons/pull/911))
- **Loyalty DOB collection**: `saveBirthday` webMethod + MemberProfiles sync for birthday rewards ([#891](https://github.com/DreadPirateRobertz/carolina-futons/pull/891))
- **Review moderation admin queue**: Admin UI for approving/rejecting submitted reviews ([#892](https://github.com/DreadPirateRobertz/carolina-futons/pull/892))
- **Referral deep links**: Canonical URL, app deep link, Instagram share, OG tags ([#898](https://github.com/DreadPirateRobertz/carolina-futons/pull/898))
- **Smart app download banner**: iOS Smart App Banner + Android sticky Play Store prompt ([#884](https://github.com/DreadPirateRobertz/carolina-futons/pull/884), [#886](https://github.com/DreadPirateRobertz/carolina-futons/pull/886))
- **Browse abandonment tracking**: Client-side product view events for recovery campaigns ([#863 area](https://github.com/DreadPirateRobertz/carolina-futons/pull/863))

### Analytics & Observability

- **GA4 custom event taxonomy**: Full funnel event set — `product_view`, `add_to_cart`, `checkout_*`, `purchase` with PII hashing ([#881](https://github.com/DreadPirateRobertz/carolina-futons/pull/881), [#883](https://github.com/DreadPirateRobertz/carolina-futons/pull/883))
- **Weekly analytics digest**: Cron job + data aggregation report for site performance KPIs ([#918](https://github.com/DreadPirateRobertz/carolina-futons/pull/918))
- **Cross-rig event expansion**: 5 new inbound events from mobile — `badge_earned`, `tier_changed`, `sommelier_completed`, `consultation_submitted`, `comfort_milestone` ([#889](https://github.com/DreadPirateRobertz/carolina-futons/pull/889), [#896](https://github.com/DreadPirateRobertz/carolina-futons/pull/896))
- **busEvent error contract + CartSessions audit**: Error handling hardening + E2E smoke coverage ([#882](https://github.com/DreadPirateRobertz/carolina-futons/pull/882))
- **Order tracking webhook**: Wix fulfillment → mobile push notification ([#872](https://github.com/DreadPirateRobertz/carolina-futons/pull/872))

### SEO & Content

- **Visual search batch export**: API for mobile ML image-embedding catalog generation ([#871](https://github.com/DreadPirateRobertz/carolina-futons/pull/871))

### Infrastructure & Security

- **Rate limiting**: `checkRateLimit` wired into 30 `Permissions.Anyone` mutation endpoints ([#868](https://github.com/DreadPirateRobertz/carolina-futons/pull/868))
- **Centralized audit logging**: All `Permissions.Anyone` write endpoints now emit structured audit events ([#869](https://github.com/DreadPirateRobertz/carolina-futons/pull/869))
- **Schema validation layer**: Input validation on 5 highest-risk endpoints ([#870](https://github.com/DreadPirateRobertz/carolina-futons/pull/870))
- **Pre-commit conflict-marker guard**: CI check prevents merging files with unresolved merge conflict markers ([#895](https://github.com/DreadPirateRobertz/carolina-futons/pull/895))

### Bug Fixes

- **P0 IDOR — guest checkout**: `linkGuestOrdersToMember` lacked membership verification, allowing cross-account order linkage ([#912](https://github.com/DreadPirateRobertz/carolina-futons/pull/912))
- **P1 — referral email contactId/memberId mismatch**: Wrong ID namespace caused referral emails to target wrong member ([#880](https://github.com/DreadPirateRobertz/carolina-futons/pull/880))
- **couponPercent correction**: Cart abandonment coupon used 5% instead of 10% per `createCartRecoveryCoupon` contract ([#899](https://github.com/DreadPirateRobertz/carolina-futons/pull/899))
- **deliveryOptions test**: Updated VA zip 24060 assertion — prefix 240 was added to `localZones` in `sharedTokens.js` ([#922](https://github.com/DreadPirateRobertz/carolina-futons/pull/922))
- **StyleQuizRegistrationGate observability**: Missing `logError` in catch blocks — silent failures now surface ([#922](https://github.com/DreadPirateRobertz/carolina-futons/pull/922))
- **Footer duplicate import**: Duplicate `buildFooterMountainSVG` import causing CI lint failure ([#903](https://github.com/DreadPirateRobertz/carolina-futons/pull/903))
- **Consultation memberId≠contactId**: Fixed namespace confusion causing incorrect data writes in consultation followup ([#909](https://github.com/DreadPirateRobertz/carolina-futons/pull/909))
- **LocalSEO FurnitureStore JSON-LD schema**: Fixed schema validation error in structured data output ([#895](https://github.com/DreadPirateRobertz/carolina-futons/pull/895))
- **Hookup guide merge conflicts**: Resolved 3 conflict blocks in `EDITOR_HOOKUP_GUIDE.html` from cf-ld8w merge

---

## [v1.2.0] — 2026-03-24

34,000+ tests | 900+ test files | Wave 26-29 — 21 PRs merged ([#841](https://github.com/DreadPirateRobertz/carolina-futons/pull/841)–[#862](https://github.com/DreadPirateRobertz/carolina-futons/pull/862))

### Gamification Platform (Waves 26-28)

- **PointsHistoryWidget**: Recent points transactions on member dashboard ([#841](https://github.com/DreadPirateRobertz/carolina-futons/pull/841))
- **GamificationHub**: Parallel orchestration of all gamification widgets ([#842](https://github.com/DreadPirateRobertz/carolina-futons/pull/842))
- **ReferralWidget**: Referral link, count, and bonus status ([#843](https://github.com/DreadPirateRobertz/carolina-futons/pull/843))
- **DailyQuestsWidget**: Quest list, progress, countdown timer ([#846](https://github.com/DreadPirateRobertz/carolina-futons/pull/846))
- **CMS Product Videos**: Wire CMS-driven catalog videos to Product Page ([#847](https://github.com/DreadPirateRobertz/carolina-futons/pull/847))
- **MilestoneRewardsWidget**: Progress bars and unlockable rewards ([#848](https://github.com/DreadPirateRobertz/carolina-futons/pull/848))
- **NotificationPrefsWidget**: Member notification settings panel ([#849](https://github.com/DreadPirateRobertz/carolina-futons/pull/849))
- **ShareProgressWidget**: Social sharing of achievements ([#850](https://github.com/DreadPirateRobertz/carolina-futons/pull/850))
- **RewardsStoreWidget**: Points redemption store — catalog, redemption, history ([#851](https://github.com/DreadPirateRobertz/carolina-futons/pull/851), [#852](https://github.com/DreadPirateRobertz/carolina-futons/pull/852))
- **Product Structured Data**: JSON-LD for rich search results ([#853](https://github.com/DreadPirateRobertz/carolina-futons/pull/853))
- **ChallengeOfTheWeekWidget**: Community collective challenge with shared progress bar ([#855](https://github.com/DreadPirateRobertz/carolina-futons/pull/855))
- **gamificationEventReceiver refactor**: 1504-line monolith → 3 focused modules ([#856](https://github.com/DreadPirateRobertz/carolina-futons/pull/856))

### Wave 29 — RPARTY Feature Synthesis (16 features shipped)

- **GamificationTourOverlay activation**: Mount on first member login ([#858](https://github.com/DreadPirateRobertz/carolina-futons/pull/858))
- **Style Quiz → Registration Gate**: Account creation prompt after quiz ([#859](https://github.com/DreadPirateRobertz/carolina-futons/pull/859))
- **Spend-to-Silver cart progress bar**: Tier progress in Side Cart ([#860](https://github.com/DreadPirateRobertz/carolina-futons/pull/860))
- **Day-14 post-delivery review prompt**: Points reward for reviews
- **Loyalty cart recovery**: Points context in abandonment emails
- **AR-to-Gamification bridge**: First AR session discovery bonus (25pts)
- **Challenge notification pipeline**: SMS + email for new weekly challenges
- **Referral post-purchase prompt**: Points + referral CTA on Thank You page
- **Will-It-Fit dimension tool**: Public cold-start furniture sizing helper
- **Spin-to-Win email capture gate**: Email required before spin
- **Onboarding quest chain**: Profile → Purchase → Review → Referral ([#861](https://github.com/DreadPirateRobertz/carolina-futons/pull/861))
- **ZIP social proof**: "X people in your area bought this week"
- **Day-7 streak milestone push**: Highest-ROI retention notification
- **CF+ Premium upsell**: Tier-gated membership upsell widget
- **Auto-delivery subscriptions**: Subscribe & Save on eligible products
- **crossRigEventBus activation**: badge_earned + streak_extended events ([#862](https://github.com/DreadPirateRobertz/carolina-futons/pull/862))
- **funnelTracker activation**: Conversion funnel analytics wired
- **Endowed progress**: 50 welcome points on member creation

### Bug Fixes

- **longestStreakDays**: Track historical max streak across breaks ([#857](https://github.com/DreadPirateRobertz/carolina-futons/pull/857))
- **homePageHero test**: Fix deferred section mocks
- **memberPageStreak test**: UTC date boundary fix
- **Import budget**: Cap bumped for structured data import
- **achievementBadgeService tests**: Pre-existing failures fixed
- **memberOwnershipGuard tests**: Ownership violations resolved
- **useSessionTimer**: console.warn in catch blocks

### Security

- **IDOR fixes**: NotificationPrefs + ShareProgress use currentMember server-side ([#849](https://github.com/DreadPirateRobertz/carolina-futons/pull/849), [#850](https://github.com/DreadPirateRobertz/carolina-futons/pull/850))
- **Double-spend fix**: RewardsStore nested onClick → single handler pattern ([#851](https://github.com/DreadPirateRobertz/carolina-futons/pull/851))
- **TOCTOU documentation**: RewardsStore concurrency limitation documented ([#852](https://github.com/DreadPirateRobertz/carolina-futons/pull/852))

### Infrastructure

- **Editor Hookup Guide v2.4**: 90+ new element nicknames from Waves 26-28
- **28 stale branches cleaned**
- **Vitest 4.1.1**: Dev dependency bump ([#844](https://github.com/DreadPirateRobertz/carolina-futons/pull/844))

## [v1.0.1] — 2026-03-21

29,403 tests | 714 test files | 89 src files synced | Sprint 4 — 20+ PRs merged ([#505](https://github.com/DreadPirateRobertz/carolina-futons/pull/505)–[#595](https://github.com/DreadPirateRobertz/carolina-futons/pull/595))

Production: [carolina-futons-stage3-velo v1.0.1](https://github.com/DreadPirateRobertz/carolina-futons-stage3-velo/releases/tag/v1.0.1)

### New Pages & Features

- **Room Planner** S1–S8: Canvas scaffolding, product picker, item controls, undo/history, save/share (localStorage + PNG + shareable URL), Product Page CTA, mobile touch/pinch, catalog integration ([[#520](https://github.com/DreadPirateRobertz/carolina-futons/pull/520)](https://github.com/DreadPirateRobertz/carolina-futons/pull/520)–[#527](https://github.com/DreadPirateRobertz/carolina-futons/pull/527), [#594](https://github.com/DreadPirateRobertz/carolina-futons/pull/594))
- **Style Quiz** S4+S6: Persistent state + result sharing, SEO entry points, email gate, sizeNeeds scoring ([[#517](https://github.com/DreadPirateRobertz/carolina-futons/pull/517)](https://github.com/DreadPirateRobertz/carolina-futons/pull/517), [#578](https://github.com/DreadPirateRobertz/carolina-futons/pull/578))
- **Gift Cards** S1: PDP 'Gift This Product' CTA, navigation + footer links, Gift Cards backend ([[#583](https://github.com/DreadPirateRobertz/carolina-futons/pull/583)](https://github.com/DreadPirateRobertz/carolina-futons/pull/583))
- **Gift Cards** S2: My Gift Cards member dashboard — IDOR-guarded, maskEmail PII protection ([[#595](https://github.com/DreadPirateRobertz/carolina-futons/pull/595)](https://github.com/DreadPirateRobertz/carolina-futons/pull/595))
- **Loyalty Tier Display**: Tier badge on member dashboard ([[#514](https://github.com/DreadPirateRobertz/carolina-futons/pull/514)](https://github.com/DreadPirateRobertz/carolina-futons/pull/514))
- **Local SEO** S2: Rich content, schema markup, FAQ section, LocalBusiness JSON-LD on /near/[city] ([[#509](https://github.com/DreadPirateRobertz/carolina-futons/pull/509)](https://github.com/DreadPirateRobertz/carolina-futons/pull/509), [#513](https://github.com/DreadPirateRobertz/carolina-futons/pull/513))
- **Klarna HTTP Functions**: POST /_functions/klarna/checkout + confirm with SSRF hardening ([[#588](https://github.com/DreadPirateRobertz/carolina-futons/pull/588)](https://github.com/DreadPirateRobertz/carolina-futons/pull/588))
- **Video Content** S1: YouTube iframe embed on PDP ([[#585](https://github.com/DreadPirateRobertz/carolina-futons/pull/585)](https://github.com/DreadPirateRobertz/carolina-futons/pull/585))
- **Fabric Sample Request**: Backend service — mailing form, rate limiting, Wix automation ([[#590](https://github.com/DreadPirateRobertz/carolina-futons/pull/590)](https://github.com/DreadPirateRobertz/carolina-futons/pull/590))
- **Cart Recovery**: per-cart coupons + sendRecoveryEmail + generateRecoveryCoupon idempotency ([[#508](https://github.com/DreadPirateRobertz/carolina-futons/pull/508)](https://github.com/DreadPirateRobertz/carolina-futons/pull/508), [#512](https://github.com/DreadPirateRobertz/carolina-futons/pull/512))
- **Referral Endpoints**: share link, anti-hijack guard, credit award ([[#515](https://github.com/DreadPirateRobertz/carolina-futons/pull/515)](https://github.com/DreadPirateRobertz/carolina-futons/pull/515))
- **Browse Abandonment + Exit Intent Capture**: email capture overlays ([[#510](https://github.com/DreadPirateRobertz/carolina-futons/pull/510)](https://github.com/DreadPirateRobertz/carolina-futons/pull/510))
- **Topic Clusters**: CMS + /guides/{slug} pages + HTTP endpoint ([[#509](https://github.com/DreadPirateRobertz/carolina-futons/pull/509)](https://github.com/DreadPirateRobertz/carolina-futons/pull/509), [#513](https://github.com/DreadPirateRobertz/carolina-futons/pull/513))
- **Social + Email Automation**: Facebook catalog cron ([[#511](https://github.com/DreadPirateRobertz/carolina-futons/pull/511)](https://github.com/DreadPirateRobertz/carolina-futons/pull/511)), TikTok/Pinterest pixels ([[#505](https://github.com/DreadPirateRobertz/carolina-futons/pull/505)](https://github.com/DreadPirateRobertz/carolina-futons/pull/505)), Social Story Cron ([[#507](https://github.com/DreadPirateRobertz/carolina-futons/pull/507)](https://github.com/DreadPirateRobertz/carolina-futons/pull/507))
- **Transactional Email Audit**: order confirmation, shipped, delivery — 62 tests ([[#518](https://github.com/DreadPirateRobertz/carolina-futons/pull/518)](https://github.com/DreadPirateRobertz/carolina-futons/pull/518))
- **UGC Photo Reviews**: full-stack (backend service, moderation, gallery, stats)

### Security Fixes

- **IDOR — couponsService** (CF-env4 P0): DB-level member scoping via `wixData.query('MemberCoupons').eq('memberEmail', email)` ([[#580](https://github.com/DreadPirateRobertz/carolina-futons/pull/580)](https://github.com/DreadPirateRobertz/carolina-futons/pull/580))
- **IDOR — customizationService** (CF-a68a P2): 3 SiteMember ownership checks
- **IDOR — referralService** (CF-7q7a P0): verifies refereeEmail matches session member ([[#515](https://github.com/DreadPirateRobertz/carolina-futons/pull/515)](https://github.com/DreadPirateRobertz/carolina-futons/pull/515))
- **XSS — JSON-LD injection** (CF-dzyl): `safeJsonLd()` escapes `</script>` sequences ([[#587](https://github.com/DreadPirateRobertz/carolina-futons/pull/587)](https://github.com/DreadPirateRobertz/carolina-futons/pull/587))
- **UGC upload hardening** (CF-rr8d): Wix media URL validation, UUID filenames, 50 security tests ([[#591](https://github.com/DreadPirateRobertz/carolina-futons/pull/591)](https://github.com/DreadPirateRobertz/carolina-futons/pull/591))
- **SSRF hardening — visualSearch** (CF-5s2o): expanded blocklist, decimal/hex/IPv6 bypass coverage, https-only ([[#592](https://github.com/DreadPirateRobertz/carolina-futons/pull/592)](https://github.com/DreadPirateRobertz/carolina-futons/pull/592))
- **Unbounded query audit** (CF-rza0): `.limit(1000)` on all cron queries

### Infrastructure

- **GitHub Bots** (CF-jyrq): Dependabot, CodeQL, Codecov, PR Labeler ([[#586](https://github.com/DreadPirateRobertz/carolina-futons/pull/586)](https://github.com/DreadPirateRobertz/carolina-futons/pull/586))

---

## [v1.0.0] — 2026-03-17

26,942 tests | 638 test files | 65 src files changed | 18 PRs merged ([#481](https://github.com/DreadPirateRobertz/carolina-futons/pull/481)–[#494](https://github.com/DreadPirateRobertz/carolina-futons/pull/494)) since v0.10.0

Source development repo: [DreadPirateRobertz/carolina-futons](https://github.com/DreadPirateRobertz/carolina-futons)
Production repo: [DreadPirateRobertz/carolina-futons-stage3-velo](https://github.com/DreadPirateRobertz/carolina-futons-stage3-velo)

### New Pages

- **Compare Page** `/compare` ([[#483](https://github.com/DreadPirateRobertz/carolina-futons/pull/483)](https://github.com/DreadPirateRobertz/carolina-futons/pull/483)): Full S1–S6 — URL param parsing, column rendering, attributes table, mobile swipe, SEO schema, reset/back-nav. Supports up to 4 products in parallel fetch.
- **Fabric Swatches** `/swatches` ([[#482](https://github.com/DreadPirateRobertz/carolina-futons/pull/482)](https://github.com/DreadPirateRobertz/carolina-futons/pull/482)): Full S1–S5 — swatch grid with filters (color/material/brand), selection system (max 5, sessionStorage tray), product page integration, request form + CRM submission, SEO schema.
- **Wishlist Share** `/wishlist-share` ([[#484](https://github.com/DreadPirateRobertz/carolina-futons/pull/484)](https://github.com/DreadPirateRobertz/carolina-futons/pull/484)–[#489](https://github.com/DreadPirateRobertz/carolina-futons/pull/489)): Full S1–S5 — token resolution, product card repeater, add-to-cart from shared view, URL-safe share token on Member Page, OG tags + noindex for private wishlists.

### Hookup Assistant (Wix Studio Add-on)

- **S1 App Scaffold** — React+Vite add-on, @wix/editor SDK, private app registration, Tools menu panel
- **S2 Pages Data Bundle** — `src/data/pages.ts`, TypeScript interfaces, 28 pages / 1,093 elements migrated from editor-hookup-guide.html
- **S3 Element Detection** — @wix/editor selection events, 17 component type mappings, current Velo ID read
- **S5 Type Validator** ([[#490](https://github.com/DreadPirateRobertz/carolina-futons/pull/490)](https://github.com/DreadPirateRobertz/carolina-futons/pull/490)) — wrong-type warning banner, Apply ID disabled on mismatch, Override link
- **S6 Default State Setter** ([[#490](https://github.com/DreadPirateRobertz/carolina-futons/pull/490)](https://github.com/DreadPirateRobertz/carolina-futons/pull/490)) — auto-set Hidden/Collapsed after ID apply, CSS-only element badge, `!cssOnly` guard per spec
- **S10 Manual Mode** — Copy ID button, manual mark-done baseline, Tab advances queue

### Features

- **Email A/B Testing + Campaign Analytics Dashboard** ([[#476](https://github.com/DreadPirateRobertz/carolina-futons/pull/476)](https://github.com/DreadPirateRobertz/carolina-futons/pull/476)): deepened A/B variant tracking, analytics dashboard endpoint
- **Blog → Newsletter Integration** ([[#479](https://github.com/DreadPirateRobertz/carolina-futons/pull/479)](https://github.com/DreadPirateRobertz/carolina-futons/pull/479)): blog post auto-generates newsletter, blog sitemap entries
- **Email Retry with Backoff** ([[#477](https://github.com/DreadPirateRobertz/carolina-futons/pull/477)](https://github.com/DreadPirateRobertz/carolina-futons/pull/477)): processEmailQueue exponential backoff — unblocked 33 previously skipped tests
- **Catalog-Driven Newsletter Templates** ([[#475](https://github.com/DreadPirateRobertz/carolina-futons/pull/475)](https://github.com/DreadPirateRobertz/carolina-futons/pull/475)): product catalog drives template generation
- **Social Story Automation Pipeline** ([[#473](https://github.com/DreadPirateRobertz/carolina-futons/pull/473)](https://github.com/DreadPirateRobertz/carolina-futons/pull/473)): scheduled social story posting
- **Content Orchestrator — Wix Events + Dry-Run** ([[#472](https://github.com/DreadPirateRobertz/carolina-futons/pull/472)](https://github.com/DreadPirateRobertz/carolina-futons/pull/472)): event-triggered content pipeline, safe dry-run mode

### Security

- **XSS fix — comparePageHelpers** ([[#491](https://github.com/DreadPirateRobertz/carolina-futons/pull/491)](https://github.com/DreadPirateRobertz/carolina-futons/pull/491)): `htmlEscape` sanitizes all attribute values rendered into DOM; `&` escaped first to prevent double-encoding

### CI / Infrastructure

- **Pre-commit hooks** ([[#494](https://github.com/DreadPirateRobertz/carolina-futons/pull/494)](https://github.com/DreadPirateRobertz/carolina-futons/pull/494)): husky + lint-staged — ESLint fix + vitest run on staged files
- **Coverage thresholds** ([[#493](https://github.com/DreadPirateRobertz/carolina-futons/pull/493)](https://github.com/DreadPirateRobertz/carolina-futons/pull/493)): vitest thresholds (statements 90%, branches 85%, functions 88%, lines 91%), hookup-assistant package thresholds (80/75/80/80), `.codecov.yml` target 91%
- **Codecov CI hardening** ([[#492](https://github.com/DreadPirateRobertz/carolina-futons/pull/492)](https://github.com/DreadPirateRobertz/carolina-futons/pull/492)): `fail_ci_if_error: true` on all Codecov steps, `cache-dependency-path: package-lock.json` on all setup-node steps

### Test Hardening (+1,500 new tests since v0.10.0)

- Account dashboard + member features: +115 tests ([[#481](https://github.com/DreadPirateRobertz/carolina-futons/pull/481)](https://github.com/DreadPirateRobertz/carolina-futons/pull/481))
- Social media + catalog sync: +119 tests ([[#480](https://github.com/DreadPirateRobertz/carolina-futons/pull/480)](https://github.com/DreadPirateRobertz/carolina-futons/pull/480))
- HTTP functions + dashboard + orchestrator: +102 tests
- Deep content pipeline integration tests ([[#471](https://github.com/DreadPirateRobertz/carolina-futons/pull/471)](https://github.com/DreadPirateRobertz/carolina-futons/pull/471))
- Blog→newsletter integration tests ([[#479](https://github.com/DreadPirateRobertz/carolina-futons/pull/479)](https://github.com/DreadPirateRobertz/carolina-futons/pull/479))
- Pre-commit hook config tests: 16 tests

### Synced Files (65 src files since v0.9.0)

**Backend (38 files):**
- New: `wishlistShare.web.js`, `swatchRequest.web.js`, `comparisonService.web.js`, `contentOrchestrator.web.js`, `contentScheduler.web.js`, `analyticsDashboard.web.js`, `blogNewsletter.web.js`, `blogRssFeed.web.js`, `blogContent.js`, `coreWebVitals.web.js`, `errorMonitoring.web.js`, `socialStoryScheduler.web.js`, `socialStoryService.web.js`, `emailTemplates.web.js`
- Modified: `emailAutomation.web.js`, `http-functions.js`, `seoHelpers.web.js`, `events.js`, `fulfillment.web.js`, `inventoryAlerts.web.js`, `inventoryService.web.js`, `notificationService.web.js`, `photoReviews.web.js`, `pinterestCatalogSync.web.js`, `pinterestRichPins.web.js`, `postPurchaseCare.web.js`, `productRecommendations.web.js`, `productReviews.web.js`, `reviewsService.web.js`, `sizeGuide.web.js`, `testimonialService.web.js`, `ugcService.web.js`, `wishlistAlerts.web.js`, `browseAbandonment.web.js`, `buyingGuides.web.js`, `facebookCatalog.web.js`, `googleMerchantFeed.web.js`, `blogService.web.js`

**Pages (10 files):**
- New: `Compare Page.js`, `Fabric Swatches.js`, `Wishlist Share.js`
- Modified: `Cart Page.js`, `Category Page.js`, `masterPage.js`, `Member Page.js`, `Product Page.js`, `Search Results.js`, `Side Cart.js`, `Home.js`

**Public (17 files):**
- New: `comparePageHelpers.js`, `wishlistShareHelpers.js`, `collectionCardBuilder.js`, `emptyStateBuilder.js`, `HomeBlogTeasers.js`, `ProductFinancing.js`, `ProductOptions.js`, `ProductReviews.js`, `ProductSizeGuide.js`, `promoBannerCarousel.js`, `SocialFeedEmbed.js`
- Modified: `metaPixel.js`, `product/productSchema.js`, `salePageHelpers.js`, `SaveForLater.js`, `socialStoryHelpers.js`, `WishlistCardButton.js`

---

## [v0.10.0] — 2026-03-16

25,200+ tests | 590+ test files | 25 PRs merged ([#435](https://github.com/DreadPirateRobertz/carolina-futons/pull/435)–[#459](https://github.com/DreadPirateRobertz/carolina-futons/pull/459))

### Features
- Content Pipeline (4 phases): content injection, scheduling, orchestration, QA
- Error Monitoring + Core Web Vitals ([[#463](https://github.com/DreadPirateRobertz/carolina-futons/pull/463)](https://github.com/DreadPirateRobertz/carolina-futons/pull/463))
- Blog RSS Feed + Sitemap ([[#465](https://github.com/DreadPirateRobertz/carolina-futons/pull/465)](https://github.com/DreadPirateRobertz/carolina-futons/pull/465))
- SEO Prep ([[#466](https://github.com/DreadPirateRobertz/carolina-futons/pull/466)](https://github.com/DreadPirateRobertz/carolina-futons/pull/466))
- Order Tracking ([[#460](https://github.com/DreadPirateRobertz/carolina-futons/pull/460)](https://github.com/DreadPirateRobertz/carolina-futons/pull/460)): 126 tests
- Email A/B Testing ([[#476](https://github.com/DreadPirateRobertz/carolina-futons/pull/476)](https://github.com/DreadPirateRobertz/carolina-futons/pull/476))

### Tests
- 23,178 total tests (4,654 new since v0.9.0)

*Note: v0.10.0 was held from stage3-velo sync — all changes included in v1.0.0 above.*

---

## [v0.9.0] — 2026-03-16

18,524 tests | 445 test files | 5 PRs merged since v0.8.0

### Features
- Social Story Helpers ([[#425](https://github.com/DreadPirateRobertz/carolina-futons/pull/425)](https://github.com/DreadPirateRobertz/carolina-futons/pull/425)): Instagram/TikTok/Pinterest story generation

### Tests (+321 new)
- SEO Helpers deep coverage, membership + delivery modules, illustration edge cases

---

## [v0.8.0] — 2026-03-16

18,203 tests | 438 test files | 47 src files changed | 70 PRs merged ([#354](https://github.com/DreadPirateRobertz/carolina-futons/pull/354)–[#423](https://github.com/DreadPirateRobertz/carolina-futons/pull/423))

### Features
- CF+ Premium Membership (monthly $14.99 / annual $119.99)
- Exit-Intent Email Capture with dedup protection
- Loyalty Bonus Points (review, referral, social share rewards)
- Back-in-Stock Dashboard
- 5 Automation Gaps Wired (events, restock alerts, review requests, scheduler)
- Product Variant Refactor (dropdown + visual swatches)
- Room Planner (Canvas2D interactive)
- Web SVG Illustrations (6 mountain/contact)
- CMS Provisioning (5 new collections + email templates)

---

## [v0.7.0] — 2026-03-14

13,692 tests. 7 src files synced.

---

## [v0.6.0] — 2026-03-14

CSS v7 warm palette. 815 element IDs mapped. Product Videos + Getting It Home pages. 533 new tests.

---

## [v0.5.0] — 2026-03-14

CSS v5 Wix selector fix. FAQ + About content pages. Call-for-price filter.

---

## [v0.4.1] — 2026-03-14

Security: cron secrets → X-Cron-Secret header. Rate limiting on return endpoints.

---

## [v0.4.0] — 2026-03-14

Brand identity CSS overhaul (blue/white). Product page remap JSON.

---

## [v0.3.0] — 2026-03-14

CI: Node 22. CSS heading font overrides.

---

## [v0.2.0] — 2026-03-09

Template migration. Full Velo codebase deployment. CI pipeline.

---

## [v0.1.0] — 2026-03-07

Initial release. Core commerce backend. 39 pages. 109 public utilities.
