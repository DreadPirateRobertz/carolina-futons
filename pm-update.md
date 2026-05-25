# PM Update — cfutons (melania) — 2026-05-25 ~10:30 MT

## MERGED THIS WAVE (33 PRs total)
- **#1062** (ISR+lint+test fix): MERGED ✅
- **#1064** (cf-lrm9, subcategoryMatches): MERGED ✅
- **#1043** (cf-ogzg, sale unification): MERGED ✅
- **#1028** (cf-jgo7, JSON-LD): MERGED ✅
- **#1032** (cf-r8z1, compare landmark a11y): MERGED ✅
- **#1017** (cf-kxij, h1→h2 fix): MERGED ✅
- **#1018** (cf-h37b, finish chip wrap): MERGED ✅
- **#1010** (cfw-uc7l, og:image): MERGED ✅
- **#1029** (cf-djsh, og:url, radahn): MERGED ✅
- **#1021** (cf-ataj, sitemap, quartz): MERGED ✅
- **#1066** (cf-qyq1, footer sky, godfrey): MERGED ✅ (Stilgar P0 — Option A)
- **#1070** (cf-hrwm+cfw-54au, LocalBusiness JSON-LD+portofino, blaidd): MERGED ✅
- **#1002** (cfw-tablet-header): MERGED ✅
- **#990** (cfw-tney, 404 title): MERGED ✅
- **#1008** (cf-7ofg, aria-hidden, godfrey): MERGED ✅
- **#1069** (cfw-y94q, lint fix): MERGED ✅
- **#1072** (ci coverage ratchet, auto): MERGED ✅
- **#1073** (ci coverage ratchet, auto): MERGED ✅
- **#1033** (cf-ei7c, cart Remove, opal): MERGED ✅
- **#1077** (LivingFooterScene time:0 hotfix): MERGED ✅ (unblocked #1071, #1075, #1076)
- **#1074** (cf-hrwm follow-on, /near index+JSON-LD+TrustBar, blaidd): MERGED ✅
- **#1075** (cf-tdq9, ThemeToggle mobile, godfrey): MERGED ✅
- **#1060** (cf-6vj1, CompareBar mobile clearance, morgott): MERGED ~01:03 MT ✅
- **#1078** (cfw-b65n, Velo success body inspect, crew): MERGED ~01:03 MT ✅
- **#1080** (cfw-mny, keyboard journey E2E, crew): MERGED ~01:07 MT ✅
- **#1081** (cf-qyq1 Option B open-sky footer): MERGED ~01:13 MT ✅ (Stilgar P0 directive)
- **#1082** (cf-j4ue, warranty data, rennala): MERGED ✅ — 5-agent 92/100. All 44 products mapped. Mesa 3000 = no warranty per Stilgar.
- **#1083** (cf-7mx5, getting-it-home four→five states): MERGED ✅ — 5-agent 98/100. 1-word copy fix.
- **#1027** (cf-q5cy, email-verify, morgott): MERGED ✅ — 5-agent 91/100 after 3 blocks. priceRange restored, PdpTrustSignals restored, max-h restored.
- **#1079** (cfw-d5gg, Q&A Velo POST body.success, jasper): MERGED ~02:24 MT ✅ — 5-agent 88/100.
- **#1071** (cfw-y2wg, survey NPS Bearer auth, quartz): MERGED ~02:43 MT ✅ — 5-agent 90/100. e2e=pre-existing email-triggers-blocked.spec.ts.
- **#1084** (cf-evt4, TurnstileWidget imperative API, godfrey): MERGED ~02:41 MT ✅ — 5-agent 88/100. Post-merge: visual QA /contact + /swatch-request.
- **#1087** (ci coverage ratchet functions 80→81, auto): MERGED ~09:00 MT ✅
- Session earlier: #987, #996, #997, #1007, #1016 ✅

## DOCS SHIPPED
- **CFutons Frontend Integration Guide**: LIVE ✅
  - https://github.com/DreadPirateRobertz/carolina-futons-web/blob/main/docs/cfutons-frontend-integration-guide.md
  - Sent to mayor for Stilgar. Stilgar directive complete.

## MERGED THIS WAVE (35 PRs total — additions)
- **#1085** (cf-q7lm, sustainability images, radahn): MERGED ~09:28 MT ✅ — 5-agent 91/100. 6 CDN imageUrls + next/image upgrade.
- **#1086** (cf-x0fj, /near e2e, rennala): MERGED ~09:29 MT ✅ — 5-agent 93/100. 20 assertions, 4 pages.

## CRITICAL HOTFIXES — merged direct to main (~10:00 MT)
- **commit 5a9caece**: functions:81→80 — PR #1087 ratchet overshot actual coverage (80.92%). Unblocked #1092/#1095/#1096/#1098 (all needed rebase).
- **commit 03ebb9a3**: Footer brand text #5b8fa8→#6fa5bd — WCAG AA 4.1→4.77:1. cfw-39wn P1 a11y. Unblocked all pages failing axe-core.

## OPEN PRs — CI running
- **#1101** (cf-ousj morgott, contact Turnstile hard-fail): CI running — P1, high priority
- **#1102** (cfw-jy84, rating star aria fix): CI running
- **#1097** (cf-758q millicent, /warranty+/faq e2e): CI running
- **#1091** (cf-bfpw miquella, og:image sweep): CI running  
- **#1090** (cf-jtle radahn, sustainability cert audit): CI running
- **#1093** (cf-aqk3 blaidd, footer mobile crop): lint✅ seed✅ e2e=running — BLOCKED: 5-agent review 74/100, 2 fixes requested (wing firefly x=240→340, add translate assertion)

## PRs — need rebase on main (coverage fix)
- **#1092** (cf-l8p3 radahn, edge-cases e2e): nudged radahn to rebase
- **#1095** (cf-0kbr godfrey, axe routes): nudged godfrey to rebase — also had 5-agent review
- **#1096** (cfw-2mr CLS): owner unclear (Linux?) — relayed to mayor
- **#1098** (cfw-b65n blaidd, Velo sibling): nudged blaidd to rebase

## DRAFT — blocked (dependency resolved)
- **#958** (swatch-request e2e, obsidian): #930 merged 2026-05-22. Nudged obsidian to rebase + mark ready.

## NEEDS OWN FIX (DO NOT TOUCH)
- **#1003** (cart-image-scheme): lint FAIL — Stilgar's branch, DO NOT TOUCH.

## BLOCKED (credential prerequisite)
- **#954** (checkout E2E): unchecked Stilgar credential box. DO NOT admin-merge.

## Crew Assignments
### CF Mac Crew
- **rennala**: cf-tusv PR #1579 (swatch-request suppressAuth) — needs 5-agent review
- **blaidd**: cf-aqk3 PR #1093 — BLOCKED 74/100, 2 fixes requested; cfw-b65n PR #1098 — needs rebase
- **radahn**: cf-jtle PR #1090 (sustainability cert audit) CI running; cf-l8p3 PR #1092 — needs rebase
- **morgott**: cf-ousj PR #1101 CI running — P1 contact form fix. DO NOT authorize #1003 fixes.
- **miquella**: cf-bfpw PR #1091 CI running (og:image sweep)
- **millicent**: cf-758q PR #1097 CI running (/warranty+/faq e2e)
- **godfrey**: cf-0kbr PR #1095 — needs rebase (coverage threshold same issue)

### cfutons Polecats (Linux)
- **jasper**: cfw-yucw assigned (unconfirmed — mayor relay pending)
- **obsidian**: PR #958 draft needs rebase + mark ready (cfw-fuhd pending)
- **quartz**: cfw-jy84 PR #1102 CI running
- **onyx**: cf-l8p3 / cfw-2mr (#1096 needs rebase — owner unclear)
- **opal**: cfw-hgf2 assigned (unconfirmed — mayor relay pending)
- **guzzle**: cf-vjrw (futon frames audit) — Strata PDF blocker flagged to mayor
- **nitro**: cf-qwdf (e2e /reviews smoke test) — in progress
- **shiny**: cf-soos (verify /getting-it-home #1083) — in progress
- **vault**: cf-jtle (/sustainability qa) — in progress

## P1 Bugs
- **cf-ousj** (/contact form "We couldn't send that"): Root cause = TURNSTILE_SECRET_KEY missing → hard-fail at server action line 84. PR #1101 by morgott — CI running.
- **cf-tusv** (/swatch-request "We couldn't submit that"): Same TURNSTILE_SECRET_KEY pattern in swatch-request.ts line 128. PR #1579 by rennala — needs 5-agent review.
- **cfw-39wn** (footer contrast 4.1:1): FIXED on main (commit 03ebb9a3 — #6fa5bd = 4.77:1). cfw-yucw/cfw-fuhd/cfw-hgf2/cfw-jy84 P2 follow-on children → Linux crew.

## Stilgar Action Items
- **Sedona + Asheville in Wix**: Both are Otis Bed mattress products miscategorized under Wall Huggers. Recategorize to Mattresses in Wix product manager, or remove from Wall Huggers. Images are mattress packaging (not frame photos). Price $0.00. Screenshots: cfw-live-sedona-wrong-image.png + cfw-live-asheville-wrong-image.png
- **Strata Furniture warranty duration**: Blocked by 2013 binary PDF — guzzle/morgott. Flagged to mayor.
- **Wix payment P0** (cf-xymh): Requires direct Wix dashboard action.

## Data Gaps
- **3 featured slugs** (kingston/sedona/asheville-futon-frame): mfr unconfirmed, need Wix product record
- Trelli Full=Queen=$773: intentional flat pricing?
- Venice King=$709 < Queen=$759: intentional?
- Rosemary/BlackPepper "Gray": no source images — remove or upload?

## P0 Status
- **cf-xymh** (Wix payment): Requires Stilgar direct Wix dashboard action. Flagged.

## Key Cascade Fixed
**TimeOfDayState**: PR #1077 hotfix on main. Rebase fix: `git rebase --skip` if duplicate time:0 commit.
