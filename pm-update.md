# PM Update — cfutons (melania) — 2026-05-25 ~10:35 MT

## SESSION UPDATE ~10:00-10:35 MT

### MERGED (wave)
- **#1148** (cfw-w8ee, design-a-room mobile overflow, obsidian): MERGED ✅ — overflow-x-auto touch-pan-x fix
- **#1149** (cf-c4lh0.7 follow-up, CMS-resilient 1991 locator): MERGED ✅ — p[hasText/1991].first()
- **#1145** (cf-c4lh0.12+11, mobile nav labels + lightbox partial): MERGED ✅ — "Futons"/"Murphy Beds" labels
- **#1147** (cfw-38ij+cfw-2qp+cfw-75e+cfw-epn, auth-UX convoy): MERGED ✅ — welcome trigger, reset banner, form clear. Rebased to resolve about-page conflict.

### BEADS CLOSED
- cfw-w8ee, cfw-2qp, cfw-75e, cfw-epn — all closed post-merge

### POST-MERGE REGRESSION — FIXED
- #1147 rebase re-introduced old hamburger labels ("Futon Frames"/"Murphy Cabinet Beds") over #1145's new labels ("Futons"/"Murphy Beds")
- **PR #1152** (cf-c4lh0.12 follow-up, label sync): CI running — merge on lint✅ seed✅

### NEW PRs — pending CI
- **#1150** (cf-c4lh0.11, hydration-safe lightbox + networkidle): CI pending
- **#1151** (cf-c4lh0.11, lightbox strict mode minimal fix): CI pending — PREFERRED over #1150 (targeted 5-line fix)
- **#1152** (cf-c4lh0.12 follow-up, label mismatch): CI pending — CRITICAL MERGE

### PLAN
- Merge #1152 when lint✅ seed✅ — regression fix
- Merge #1151 when lint✅ seed✅ — cf-c4lh0.11 strict mode
- Close #1150 after #1151 merges (superseded)

---

## SESSION UPDATE ~09:35-09:51 MT

### MERGED (wave flush)
- **#1138** (cf-c4lh0.5, --cf-muted contrast): MERGED ✅
- **#1139** (cf-c4lh0.7, /1991/ strict mode): MERGED ✅
- **#1140** (cf-c4lh0.9, ReviewFilter role=img): MERGED ✅
- **#1141** (cfw-5kdt, malformed-email 422): MERGED ✅
- **#1142** (cfw-j064, cart wix:image→CDN): MERGED ✅
- **#1144** (cf-c4lh0.10, FAQ accordion): MERGED ✅ ~09:44 MT
- **#1136** (cf-2nyjm, og:url near pages): MERGED ✅ by Stilgar ~09:03 MT

### BEADS CLOSED
- cf-c4lh0.5, cf-c4lh0.7, cf-c4lh0.9, cfw-5kdt, cfw-j064, cf-c4lh0.10 — all closed post-merge

### RENNALA
- PR #1136 MERGED. cfw-voj9 (auth rate-limits) is active bead. Nudged to start.

---

## SESSION UPDATE ~09:30-10:00 MT

### REVIEWED (pending CI green → merge)
- **#1143** (cfw-yz7j, debug_hour): 90/100 APPROVED. Awaiting /ultrareview + e2e.
- **#1146** (cfw-7svm, Heron+drop LivingFooterBg): 92/100 APPROVED. CI queued. cfw-7svm CLOSED.
- **#1147** (cfw-38ij, 7 dropped cfw-mjre specs): 94/100 APPROVED. CI kicked via workflow_dispatch — queued.

### WILDLIFE RESOLUTION
- Bears were never missing — LivingFooterScene has them. Gap = Phase 7 birds (never implemented).
- PR #1146: Heron silhouette added to MascotFooterDivider night scene. LivingFooterBg dropped.
- cfw-si04 (full birds+hawk+vultures): radahn assigned, scope pending Stilgar confirmation.
- PR #1137 (dawn extension): HELD.

---

## OPEN PRs — awaiting merge
- **#1143** (cfw-yz7j, debug_hour): Awaiting mayor /ultrareview before merge.
- **#1146** (cfw-7svm, Heron): lint✅ seed✅ Vercel✅ — awaiting Stilgar visual QA.
- **#1118** (cf-cm5xq, /visit axe): CI partially showing Vercel✅ only — needs check.

## HOLDS
- **#1137** (cfw-fs7g, dawn): HOLD per Stilgar.
- **#1096** (cfw-2mr, CLS): BLOCKED (naive sum algorithm).
- **#954** (checkout E2E): BLOCKED credential.
- **#1003** (cart-image-scheme): Stilgar's branch — DO NOT TOUCH.
- **#958** (swatch e2e): obsidian draft — awaiting readiness.

## Stilgar Actions
- **PR #1003** (cart-image-scheme): ALL CI GREEN. Stilgar must merge.
- **PR #1143**: Needs /ultrareview before merge (mayor alerted).
- **PR #1146**: Heron night scene — awaiting Stilgar visual QA.
- **cf-xymh** (Wix payment): Requires Stilgar direct Wix dashboard action.
- Sedona + Asheville (Wix miscategorized): Recategorize from Wall Huggers → Mattresses.

## Crew Assignments
### CF Mac Crew
- **rennala**: cfw-voj9 (auth rate-limits, register+forgot-password) — in progress
- **blaidd**: cfw-ob6a (design-a-room desktop max-w) — in progress
- **radahn**: cf-7wug (AggregateRating+Review JSON-LD) — in progress; cfw-si04 (birds/wildlife Phase 7) queued pending Stilgar confirmation
- **morgott**: cfw-lygi (/shop/sofa-beds 0 products) — in progress
- **godfrey**: cfw-2qp/75e/epn CLOSED (convoy merged). Next: check bd ready for new assignment.
- **millicent**: cf-jvut (E2E gamification test) — in progress; PR #1118 CI kicked

### cfutons Polecats (Linux)
- **opal**: cf-0kbr (a11y axe-core audit) — in progress
- **jasper**: PR #1146 branch (cfw-7svm) submitted — await Stilgar QA merge
- **obsidian**: cfw-yz7j PR #1143 submitted — awaiting /ultrareview
- **quartz**: IDLE (cfw-j064 merged) — needs new assignment
- **onyx**: active on cfw beads — check bd ready
- **New polecats (cfw)**: dust/guzzle/nitro/radrat/rust/scavenger/shiny/thunder — branches pushed, no PRs yet

## Key Cascade Fixed
**TimeOfDayState**: PR #1077 hotfix on main. Rebase fix: `git rebase --skip` if duplicate time:0 commit.
