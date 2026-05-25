# PM Update — cfutons (melania) — 2026-05-25 ~10:00 MT

## SESSION UPDATE ~09:30-10:00 MT

### MERGED
- **#1578** (cf-y2wg, survey IDOR): MERGED ✅ — carolina-futons repo. cf-y2wg CLOSED.

### REVIEWED (pending CI green → merge)
- **#1143** (cfw-yz7j, debug_hour): 90/100 APPROVED. Awaiting /ultrareview + e2e.
- **#1146** (cfw-7svm, Heron+drop LivingFooterBg): 92/100 APPROVED. CI queued. cfw-7svm CLOSED.
- **#1147** (cfw-38ij, 7 dropped cfw-mjre specs): 94/100 APPROVED. CI queued.

### WILDLIFE RESOLUTION
- Bears were never missing — LivingFooterScene has them. Gap = Phase 7 birds (never implemented).
- PR #1146: Heron silhouette added to MascotFooterDivider night scene. LivingFooterBg dropped.
- cfw-si04 (full birds+hawk+vultures): radahn assigned, scope pending Stilgar confirmation.
- PR #1137 (dawn extension): HELD.

### CI WAVE — e2e IN PROGRESS (~50min elapsed)
- **#1138** (cf-c4lh0.5), **#1139** (cf-c4lh0.7), **#1140** (cf-c4lh0.9), **#1141** (cfw-5kdt): lint✅ seed✅ e2e⏳
- **#1143** (cfw-yz7j), **#1144** (cf-c4lh0.10): lint✅ seed✅ e2e⏳
- **#1145** (cf-c4lh0.12), **#1146** (cfw-7svm), **#1147** (cfw-38ij): CI queued
- **#1142** (cfw-j064): coverage FAIL — quartz fixing 4 missing test cases
- **#1118** (cf-cm5xq): merge conflict — millicent rebasing (38 commits behind)
- **#1003**: miquella pushed fixes to Stilgar's branch. CI running. DO NOT admin-merge.

### CREW DISPATCH (10:00 MT)
**Mac:** millicent→cf-jvut(gamification e2e), radahn→cf-7wug(queued), godfrey→cfw-75e(welcome email), blaidd→cfw-ob6a(queued), morgott→cfw-lygi(/shop/sofa-beds)
**Linux:** jasper=cfw-fkoh, obsidian=cfw-w8ee+PR#1143-standby, quartz=cfw-j064+coverage-fix, onyx=cfw-vma9

### HOLDS
- **#1096** (CLS): naive sum algorithm — blocked.
- **#1137** (dawn): per Stilgar.
- **#954** (checkout E2E): credential blocked.

---

# PM Update — cfutons (melania) — 2026-05-25 ~07:08 MT

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

## MERGED THIS WAVE (63 PRs total — session additions)
- **#1085** (cf-q7lm, sustainability images, radahn): MERGED ~09:28 MT ✅ — 5-agent 91/100.
- **#1086** (cf-x0fj, /near e2e, rennala): MERGED ~09:29 MT ✅ — 5-agent 93/100.
- **#1093** (cf-aqk3, footer mobile crop, blaidd): MERGED ✅ — 5-agent 74→fixes applied.
- **#1090** (cf-jtle, sustainability cert audit, radahn): MERGED ✅ — 5-agent 92/100. HIGH FTC escalated.
- **#1101** (cf-ousj, contact SMTP fallback, morgott): MERGED ~10:32 MT ✅ — 5-agent 90/100.
- **#1579** (cf-tusv, swatch suppressAuth, rennala): MERGED ~10:32 MT ✅ — carolina-futons repo (Velo). 92/100.
- **#1091** (cf-bfpw, og:image sweep, miquella): MERGED ~10:32 MT ✅ — 88/100. pre-existing productQA 500.
- **#1103** (cfw-yucw jasper, cfw-39wn child): MERGED ~10:41 MT ✅ — 91/100. pre-existing e2e.
- **#1106** (cfw-fuhd obsidian, cfw-39wn child): MERGED ~10:43 MT ✅ — 85/100. Stilgar-cancelled e2e.
- **#1102** (cfw-jy84 quartz, rating star aria): MERGED ~11:05 MT ✅ — Stilgar-cancelled e2e.
- **#1095** (cf-0kbr godfrey, axe routes): MERGED ~11:06 MT ✅
- **#1097** (cf-758q millicent, /warranty+/faq e2e): MERGED ~11:06 MT ✅
- **#1098** (cfw-b65n blaidd, Velo sibling): MERGED ~11:06 MT ✅ — pre-existing productQA 500.
- **#1105** (cfw-hgf2 opal, badge contrast): MERGED ~11:40 MT ✅ — 92/100. CSS comment bug fixed via GitHub API. cfw-39wn BATCH COMPLETE.
- **#1104** (coverage ratchet functions:80→81): MERGED ~11:41 MT ✅ — 97/100. All cfw-39wn children confirmed merged.
- **#1092** (cf-l8p3 radahn, edge-cases e2e): MERGED ~11:43 MT ✅ — 91/100. Both bugs fixed (heading selector + sale empty-state regex).
- **#1109** (cf-hw3g morgott, /contact e2e): MERGED ~11:48 MT ✅ — 91/100. Stilgar-cancelled.
- **#1110** (cf-faqu rennala, /swatch-request e2e): MERGED ~11:55 MT ✅ — 92/100. Stilgar-cancelled.
- **#1108** (cf-wm5u miquella, /blog+/press+/near og e2e): MERGED ~11:55 MT ✅ — 91/100. Stilgar-cancelled.
- **#1111** (cf-wguj blaidd, axe /contact+/swatch-request): MERGED ~05:39 MT ✅ — 91/100. e2e=PASS. Turnstile exclusions, form label loop, role=alert.
- **#1107** (cf-vn3u millicent, /returns+/financing+/shipping e2e): MERGED ~05:40 MT ✅ — 89/100. e2e=PASS. 24 tests, info-pages pattern.
- **#1112** (cf-usqt godfrey, Lighthouse baseline docs): MERGED ~05:41 MT ✅ — 93/100. SEO=69 flagged → cf-32me unblocked for radahn.
- **#1114** (cf-snyj miquella, /warranty axe-core): MERGED ~05:54 MT ✅ — 92/100. Lint✅ seed✅ e2e=6s quick-pass.
- **#1087** (ci coverage ratchet functions 80→81, auto): MERGED — included in count
- **#1113** (ci coverage ratchet statements:83→84, functions:80): MERGED ~06:12 MT ✅ — 97/100. 4th overshot fixed (903cdb1a). statements threshold finally landed.
- **#1115** (FaqBrowser li role="group" a11y, godfrey cf-0kbr follow-on): MERGED ~06:41 MT ✅ — 95/100. Stilgar-cancelled e2e. FaqBrowser /faq WCAG fix.
- **#1116** (cf-nj16, /reviews smoke, millicent): MERGED ~06:44 MT ✅ — 88/100. Stilgar-cancelled e2e. /reviews e2e coverage landed.
- **#1117** (cf-i1fq, /near/[city] JSON-LD + axe, rennala): MERGED ~07:05 MT ✅ — 90/100. Stilgar-cancelled. FurnitureStore JSON-LD assertions.
- **#1116** (cf-nj16, /reviews smoke, millicent): MERGED ~06:44 MT ✅ — 88/100. Stilgar-cancelled e2e.
- **#1117** (cf-i1fq, /near/[city] JSON-LD + axe, rennala): CI running — lint✅ seed✅ e2e IN_PROGRESS. 5-agent 90/100.

## CRITICAL HOTFIXES — merged direct to main
- **commit 5a9caece**: functions:81→80 — PR #1087 ratchet overshot actual coverage (80.92%). Unblocked #1092/#1095/#1096/#1098 (all needed rebase).
- **commit 03ebb9a3**: Footer brand text #5b8fa8→#6fa5bd — WCAG AA 4.1→4.77:1. cfw-39wn P1 a11y. Unblocked all pages failing axe-core.
- **commit 8670d0a6** (~11:50 MT): functions:81→80 AGAIN — PR #1104 ratchet overshot actual coverage (80.94%). Unblocked #1112 lint + all open PRs running against main.
- **commit cb808cbf** (~05:47 MT): functions:81→80 3rd overshot — PR #1113 ratchet branch fixed before merge. Pattern: bot rounds 80.94% → 81 (ceil), must keep floor=80.
- **commit 903cdb1a** (~06:05 MT): functions:81→80 4th overshot — ratchet bot fired again after #1114 merged, overwrote cb808cbf fix. PR #1113 CI re-running.
- **commit 20dae4bb** (~07:25 MT): REVERT of false-alarm fix — actual functions coverage is 81.02% (bot log confirmed). Ratchet PR #1124 functions:81 is CORRECT. No overshot this time. Floor advances to 81.

## OPEN PRs — CI status (~07:42 MT)
- **#1113**: MERGED ~06:12 MT ✅ — 97/100. ratchet statements:83→84, functions:80 confirmed.
- **#1115**: MERGED ~06:41 MT ✅ — 95/100. Stilgar-cancelled. FaqBrowser /faq WCAG fix.
- **#1116**: MERGED ~06:44 MT ✅ — 88/100. Stilgar-cancelled. /reviews smoke landed.
- **#1117** (cf-i1fq, /near/[city] JSON-LD + axe, rennala): MERGED ~07:05 MT ✅ — 90/100. Stilgar-cancelled.
- **#1118** (cf-cm5xq, /visit axe+title, millicent): lint✅ seed✅ e2e IN_PROGRESS (>45min). Awaiting timeout/cancel. 97/100.
- **#1119** (cf-nf96, robots.txt+sitemap, morgott): lint✅ seed✅ e2e IN_PROGRESS. BLOCKED — 2 fixes needed (noindex false-negative + kingston CI). Morgott nudged.
- **#1120** (cf-a5gjz, CI timeout 45→60, rennala): lint✅ seed✅ Vercel✅ e2e IN_PROGRESS (60min timeout). 97/100.
- **#1121** (cf-hcjq, /compare axe, blaidd): lint✅ seed✅ Vercel✅ e2e IN_PROGRESS. 91/100.
- **#1122** (rennala cf-mivdu dup): CLOSED. #1125 preferred.
- **#1123** (cf-32me, SEO noindex diagnosis + legal-pages e2e, radahn): ALL CI PENDING. 96/100.
- **#1124** (ratchet functions:81): CORRECT — actual 81.02%. CI running (new run on 20dae4bb). Ready to merge when green.
- **#1125** (cf-mivdu, PDP JSON-LD e2e, rennala): lint✅ seed✅ Vercel✅ e2e IN_PROGRESS. 94/100.
- **#1126** (cf-68j16, /about smoke, miquella): seed✅ Vercel✅ lint+e2e IN_PROGRESS. 93/100. (#1127 closed dup)
- **#1127** (miquella dup): CLOSED.
- **#1128** (cf-140z, /cart axe, jasper): lint✅ seed✅ Vercel✅ e2e IN_PROGRESS. 92/100.
- **#1129** (godfrey cf-2yipc dup): CLOSED. Legal-pages covered by #1123.
- **#1130** (cf-39gt, PLP+compare axe, quartz): ALL CI PENDING. 91/100.
- **#1131** (cf-xqj5, home WCAG 2.1 AA, opal): seed✅ Vercel✅ lint+e2e PENDING. 95/100.
- **#1132** (cfw-mjre, plp-fixture-smoke 11 failures fix): ALL CI PENDING. 94/100.
- **#1133** (cf-m2pas, /search axe parametric, godfrey): ALL CI PENDING. 99/100.
- **#1096** (cfw-2mr CLS): FAIL — OPAL's PR, Linux SSH down. DO NOT touch.
- **#958** (swatch-request e2e, obsidian): draft FAIL — needs rebase + ready.

## DRAFT — blocked (dependency resolved)
- **#958** (swatch-request e2e, obsidian): #930 merged 2026-05-22. Nudged obsidian to rebase + mark ready.

## NEEDS OWN FIX (DO NOT TOUCH)
- **#1003** (cart-image-scheme): lint FAIL — Stilgar's branch, DO NOT TOUCH.

## BLOCKED (credential prerequisite)
- **#954** (checkout E2E): unchecked Stilgar credential box. DO NOT admin-merge.

## Crew Assignments (~07:42 MT)
### CF Mac Crew
- **rennala**: cf-mivdu PR #1125 OPEN — lint✅ seed✅ e2e IN_PROGRESS. 94/100.
- **blaidd**: cf-hcjq PR #1121 OPEN — lint✅ seed✅ e2e IN_PROGRESS. 91/100.
- **radahn**: cf-32me PR #1123 OPEN — ALL CI PENDING. 96/100. SEO=69 diagnosed (Vercel preview noindex).
- **morgott**: cf-nf96 PR #1119 OPEN — BLOCKED: 2 fixes needed. Nudged.
- **miquella**: cf-68j16 PR #1126 OPEN (closed #1127 dup) — seed✅ lint+e2e PENDING. 93/100.
- **millicent**: cf-cm5xq PR #1118 OPEN — lint✅ seed✅ e2e IN_PROGRESS (>45min). 97/100.
- **godfrey**: cf-2yipc COMPLETE (via #1123). **Now: cf-m2pas** (/search axe parametric, dispatched ~07:30 MT) → PR #1133 OPEN, ALL CI PENDING. 99/100.

### cfutons Polecats (Linux)
- **jasper**: cf-140z PR #1128 OPEN — lint✅ seed✅ Vercel✅ e2e IN_PROGRESS. 92/100.
- **quartz**: cf-39gt PR #1130 OPEN — ALL CI PENDING. 91/100.
- **opal**: cf-xqj5 PR #1131 OPEN — seed✅ Vercel✅ lint+e2e PENDING. 95/100.
- **obsidian**: PR #958 (swatch-request e2e, draft) — nudged to rebase+ready.
- **onyx**: cfw-2mr (#1096) — OPAL's PR, Linux SSH down. DO NOT TOUCH.
- **guzzle**: cf-vjrw (futon frames audit) — Strata PDF blocker flagged to mayor.
- **shiny**: cf-soos (verify /getting-it-home #1083) — in progress.
- **vault**: cf-g05i (PDP axe-core WCAG 2.1 AA sweep) — in progress.
- **nitro**: cf-qwdf CLOSED (superseded by #1116). Idle.

### cfutons Polecats (Linux)
- **jasper**: cf-140z (cart a11y axe, P2) — Mayor dispatching.
- **obsidian**: PR #958 (swatch-request e2e, draft) — nudged to rebase+ready
- **quartz**: cf-39gt (PLP+compare a11y, P2) — Mayor dispatching.
- **onyx**: cfw-2mr (#1096) — OPAL's PR, Linux SSH down
- **opal**: cf-xqj5 (home a11y, P2) — Mayor dispatching.
- **guzzle**: cf-vjrw (futon frames audit) — Strata PDF blocker flagged to mayor
- **nitro**: cf-qwdf CLOSED (superseded by millicent cf-nj16 PR #1116 — same file). Mayor relayed stop.
- **shiny**: cf-soos (verify /getting-it-home #1083) — in progress
- **vault**: cf-g05i (PDP axe-core WCAG 2.1 AA sweep, P2) — in progress

## P1 Bugs
- **cf-ousj** (/contact form): FIXED — PR #1101 MERGED ✅
- **cf-tusv** (/swatch-request): FIXED — PR #1579 MERGED ✅
- **cfw-39wn** (footer contrast 4.1:1): FIXED on main (commit 03ebb9a3 — #6fa5bd = 4.77:1). cfw-yucw/cfw-fuhd/cfw-hgf2/cfw-jy84 P2 follow-on children → Linux crew.
- **FaqBrowser li role="group" a11y**: OPEN — PR #1115 (godfrey follow-on, cf-rdep), CI running

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
