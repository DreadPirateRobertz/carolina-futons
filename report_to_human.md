# cfutons Rig Report — Carolina Futons (Web)

**Last Updated:** 2026-02-28 10:15 MST (melania)

---

## Session Update — 2026-02-28 10:15 MST

### PRs Merged This Session

| PR | Bead | Story | Author |
|----|------|-------|--------|
| #78 | CF-a1ps | offWhite token + bundleBuilder badge fix (palette cleanup) | rennala |
| #79 | CF-dgiy | Product card grid + color swatches + Quick View modal | miquella |
| #80 | CF-bbms | Homepage hero — full-bleed lifestyle photo + overlay | godfrey |
| #81 | CF-isru | Product page modernization — zip delivery estimate + swatch CTA | rennala |

**4 PRs merged, 4 beads closed.** All P0 frontend items complete.

### Created This Session

- **DESIGN-SYSTEM.md** — Formal cross-platform design system. Colors, typography, spacing, component specs, mobile mapping. Sent to dallas (mobile) for web/app alignment.
- Mailed dallas full token specs, product card pattern, and interaction mapping (web hover → mobile press).

### Crew Status Right Now

| Member | Status | Current/Next |
|--------|--------|-------------|
| **melania** | Active | PM — gap analysis, design system, crew coordination |
| **godfrey** | Handoff pending | CF-bbms merged → cycling session |
| **miquella** | Handoff pending | CF-dgiy merged → CF-ist financing next |
| **rennala** | Handoff pending | CF-isru merged → cycling session |
| **radahn** | Active | CF-murg email capture popup (brainstorming) |

---

## Competitive Gap Analysis — What We Still Need

### What We Shipped vs. What Competitors ALL Have

| Feature | Competitors | Us (after today's merges) | Gap? |
|---------|-------------|--------------------------|------|
| Announcement bar | 9/10 have it | YES (PR #75) | Closed |
| Full-bleed lifestyle hero | 10/10 | YES (PR #80) | Closed |
| Product cards with info | 10/10 | YES (PR #79) — swatches, badges, Quick View | Closed |
| Brand palette consistency | All | YES (PRs #73, #78) | Closed |
| Trust bar / icons | 6/10 | YES (PR #75) — 5 icons | Closed |
| Category showcase cards | 7/10 | YES (PR #77) | Closed |
| Delivery estimate on product page | 8/10 | YES (PR #81) — zip-based zones | Closed |
| Free swatch CTA | 4/10 (Joybird, Albany Park) | YES (PR #81) — coral CTA on product page | Closed |
| Email capture popup | 6/10 | IN PROGRESS (CF-murg — radahn) | Working |
| Newsletter footer | 8/10 | Partial (contact form exists) | Open |
| Financing display on product page | 5/10 | Queued (CF-ist — miquella next) | Open |
| Star ratings / reviews | 7/10 | Structure exists, needs content | Open |
| Live chat widget | 4/10 | Queued (CF-5ggk) | Open |
| AR / 3D visualization | 5/10 | Mobile only (cm-88d) | Mobile done, web TBD |
| Room planner / "Will it fit?" | 3/10 | Queued (CF-p03z) | Sprint 3+ |
| Free swatch ordering flow | 3/10 | Modal exists, needs backend flow | Sprint 3+ |

### Priority — What Moves the Needle Next

**P1 — Must have soon (this sprint):**
1. **CF-murg: Email capture popup** — radahn active. Exit-intent + 10% off. Every aspirational competitor has this.
2. **CF-ist: Financing calculator** — miquella next. "Starting at $42/mo with Affirm" on product pages.
3. **CF-vqya: Free swatch kit promotion** — site-wide CTA. Joybird and Albany Park's killer feature.

**P2 — Should have (next sprint):**
4. **CF-5ggk: Live chat** — Gorgias or Tidio. 4/10 competitors have it.
5. **CF-p03z: Room fit calculator** — "Will this futon fit?" with dimensions. Simpler than full room planner.
6. **Newsletter footer redesign** — proper 4-column footer with social icons, newsletter signup.

**P3 — Differentiators (sprint 3+):**
7. Illustrated empty states / error pages (nobody else has this)
8. Comfort story cards (illustrated version of Castlery's 1-5 scales)
9. AR "See in your room" for web (mobile already has it)
10. Modular configurator for sectionals

### The "Boutique Formula" — Where We're Differentiated

Our research found every competitor looks interchangeable — clean minimalism, neutral palettes, stock photography. CF is the **only** one with regional character: hand-drawn mountain illustrations, Blue Ridge aesthetic, two-tone coral + mountain blue accent system. This is the moat.

**Already shipped:** Brand palette enforced, illustrated category cards, mountain-themed section dividers.
**Next:** Illustrated empty states, comfort story cards, mountain delivery tracker.

---

## Overall Sprint Status

### P0 Frontend Sprint: COMPLETE (6/6 stories merged)

| Bead | Story | Status |
|------|-------|--------|
| CF-a1ps | Kill pink-lavender + offWhite | MERGED (#73, #78) |
| CF-c94m | Announcement bar + trust bar | MERGED (#75) |
| CF-b0sr | Category showcase | MERGED (#77) |
| CF-bbms | Hero overhaul | MERGED (#80) |
| CF-dgiy | Product card grid | MERGED (#79) |
| CF-isru | Product page modernization | MERGED (#81) |

### Active Work

| Bead | Story | Owner | Status |
|------|-------|-------|--------|
| CF-murg | Email capture popup | radahn | Brainstorming |
| CF-ist | Financing calculator | miquella | Queued (handoff pending) |
| cf-qnsf | Marketing launch prep | polecats/rust | In progress |

### Ready Queue (Frontend Priority)

| Bead | Priority | Story |
|------|----------|-------|
| CF-vqya | P1 | Free Swatch Kit CTA |
| CF-x8pd | P1 | Lifestyle product photography |
| CF-5ggk | P2 | Live chat widget |
| CF-y8je | P2 | Swatch kit + free swatches promo |
| CF-p03z | P2 | Room fit calculator |

---

## Mobile/Web Alignment

- **DESIGN-SYSTEM.md** created — formal cross-platform design system
- Dallas (cfutons_mobile) received full token specs + component patterns
- AR Camera (cm-88d) already uses brand palette — confirmed aligned
- Product card pattern (image+name+price+swatches+badge) documented for both platforms
- Interaction mapping: web hover → mobile press, modal → bottom sheet
- Shared file: `sharedTokens.js` is the single source of truth

---

## Brand Palette (enforced across all pages)

| Token | Color | Use |
|-------|-------|-----|
| Sand | #E8D5B7 | Backgrounds, secondary |
| Espresso | #3A2518 | Text, headers |
| Mountain Blue | #5B8FA8 | Accents, links |
| Coral | #E8845C | CTAs, highlights |
| offWhite | #FAF7F2 | Product areas, clean sections |

---

## Test Suite

| Checkpoint | Tests | Files |
|------------|-------|-------|
| Feb 21 start | 2,394 | 70 |
| Feb 28 current | **5,300+** | **137+** |

---

*PM: melania | cfutons GREEN | P0 sprint COMPLETE (6/6) | 4 PRs merged this session | Design system doc created | Gap analysis done | Next: email popup, financing, swatch kit*
