# PM Update — cfutons (melania) — 2026-05-24 ~18:45 MT

## Session Summary
Full PR sweep complete. 16 PRs reviewed. 1 approved. 15 need author fixes (recurring: bead IDs in describe/it labels, multi-line comments).

## PR Status — cfw (carolina-futons-web)

### APPROVED — ready for next merge batch
- **#1018** (godfrey, cf-h37b): VariantPicker grid 3+2 for 5-chip finish groups ✅

### REQUEST_CHANGES — waiting on author fixes
- **#1039** (cf-5dph): MEGA_MENU_DATA must re-key `/shop/mattresses-sale` → `/shop/sale`; Header.test.tsx:112 not updated
- **#1043** (cf-ogzg): 5× bead IDs in it() labels, 1× in describe(); unchecked boxes; SALE_END_DATE time-bomb; mixed-scope (cf-djsh og:url pages conflict with #1029)
- **#1040** (cf-2ymq): multi-line JSX comment (8 lines), describe bead ID, dep conflict with #1011
- **#1034** (cf-f5e5): describe bead ID `cf-f5e5:` in nested describe
- **#1029** (cf-djsh): shop/page.tsx still has `url: "/shop"` (4th attempt) — needs `SITE_URL` import + template literal
- **#1028** (cf-jgo7): 3× bead IDs in describe labels, unchecked boxes
- **#1027** (cf-q5cy): 1× bead ID in test label, unchecked boxes, swipe tests may be wrong scope
- **#1021** (cf-ataj): /registry still in STATIC_PATHS (it's noindex), bead ID comment block
- **#1017** (cf-kxij): bead ID in it() label + 4-line JSX comment block → 1 line
- **#1016** (cf-kuc9): 2-line comment block → 1 line
- **#1013** (cfw-pqt7): 4× multi-line comment blocks in e2e spec
- **#1012** (cf-k2zm): 15-line TSDoc → 1-line brief
- **#1011** (cfw-mny.2): describe bead ID, dep conflict with #1040
- **#1010** (cfw-uc7l): 2× describe bead IDs
- **#1008** (cf-7ofg): describe bead ID + PR number in it() label
- **#1007** (cfw-04if): 2× describe bead IDs

### COMMENTS / FLAGGED
- **#1041** (cf-v275 remove sofa-beds): code clean, 3 unchecked test-plan boxes — needs author to check after verify

### NEEDS REBASE
- **#1032** (cf-r8z1, obsidian): CONFLICTING — obsidian nudged to rebase
- **#1033** (cf-ei7c, onyx): UNKNOWN merge state — onyx nudged

## Blocking Issues

### cf-xymh (P0 — Wix payment provider)
NO payment provider on staging Wix Stores → "We can't accept online payments" at checkout.
**Requires Stilgar/Brenda admin action**: Wix Studio → Stores → Settings → Accept Payments → connect provider.
Mayor nudged. CANNOT be code-fixed.

### cf-djsh / PR #1029 vs #1043 conflict
PR #1043 (cf-ogzg) includes 20+ og:url page fixes that overlap with PR #1029 (cf-djsh).
These two PRs will conflict. Resolution needed: either drop og:url hunks from #1043, or close #1029 as superseded.
Godfrey is now assignee for cf-djsh; godfrey nudged to fix /shop/page.tsx.

## Crew Status
- **radahn**: cf-djsh PR #1029 → REQUEST_CHANGES (4th time, same /shop URL issue)
- **godfrey**: cf-djsh (in_progress, now assignee); cf-3qt.8.31 (blocked); PR #1018 approved
- **obsidian**: cf-r8z1 needs rebase; cf-k2zm needs TSDoc trim
- **onyx**: cf-ei7c rebase needed; cf-kxij needs label fixes
- **miquella**: cf-ogzg PR #1043 needs fixes; cf-5dph PR #1039 needs MEGA_MENU_DATA fix
- **quartz**: cf-ataj PR #1021 needs /registry removal
- **opal**: cf-2ymq PR #1040 needs multi-line comment trim + dep conflict
- **jasper**: cf-6zba (Charleston price) — Linux, status unknown
- **miquella** (alt): cf-oi01 (E2E payments test) — blocked on cf-xymh

## Recurring Pattern Alert
**Every PR this session**: bead IDs in describe/it test labels. Need CONTRIBUTING.md rule added.

## Stilgar Action Items
1. **cf-xymh**: Connect payment provider in Wix admin (P0 blocker)
2. Design direction on cf-2ymq: literal `#3a2518` approved for QuizCtaSection? (PR #1040 uses it)

## Next Merge Batch (waiting on fixes)
When crew fixes arrive, merge in groups of 3-5 per Vercel build conservation rule (cf-ukc6).
Candidates when ready: #1018 (approved), + 2-3 others once REQUEST_CHANGES resolved.
