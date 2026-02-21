# Story Management Quality Gates

**Owner:** melania (Story Manager)
**Scope:** All rigs — cfutons, cfutons_mobile, tradingbot, gastown

---

## Definition of Ready (DoR)

A story MUST pass every item before a polecat or crew member picks it up:

- [ ] **Problem/goal clear** — one sentence: what is broken or missing
- [ ] **Acceptance criteria written** — 3+ testable conditions (see AC format below)
- [ ] **Files/areas identified** — specific paths or modules, not "somewhere in backend"
- [ ] **Sized** — S (<2h, 1-2 files), M (2-6h, 2-4 files), L (6-16h, 5+ files)
- [ ] **Priority set** — P0 (blocks epic), P1 (this sprint), P2 (backlog), P3 (wishlist)
- [ ] **Dependencies declared** — `bd dep add` for all blockers
- [ ] **No open questions** — if there's a question mark, it's not ready
- [ ] **Fits one session** — if >L, split first

**Stories that fail DoR go back to author.** No exceptions.

---

## Definition of Done (DoD)

A story is NOT done until:

- [ ] **All AC met** — every criterion passed
- [ ] **Tests written and passing** — new tests for new behavior
- [ ] **No regressions** — existing test suite green
- [ ] **Committed** — descriptive message referencing bead ID
- [ ] **Pushed to main** — (crew) or submitted to refinery (polecats)
- [ ] **Bead closed** — `bd close <id>` with reason

**NOT required** (avoid gold-plating):
- Perfect code style
- Documentation beyond the bead
- Performance optimization (unless AC specifies it)

---

## AC Format Guide

| Format | When to Use | Example |
|--------|-------------|---------|
| **Checklist** | Simple changes, UI fixes, single behavior | "1. Button renders in blue. 2. Click triggers handler." |
| **Given/When/Then** | Conditional logic, multiple paths | "Given user is Gold tier, When coupon applied, Then both discounts stack" |
| **Scenario walkthrough** | Cross-page/service flows | "1. Land on Home. 2. Click product. 3. Add to cart. 4. Checkout." |

**AC rules:**
- Each item independently verifiable (pass/fail)
- No subjective language ("looks good", "works correctly")
- At least one edge case or negative test
- Quantifiable where possible (>55% accuracy, <200ms latency)

---

## Story Sizing

| Size | Hours | Files | Split Signal |
|------|-------|-------|-------------|
| S | <2h | 1-2 | — |
| M | 2-6h | 2-4 | — |
| L | 6-16h | 5+ | Consider splitting |
| XL | >16h | — | **MUST split** |

**Split when:** multiple features in one story, >8 AC items, >6 files, word "weeks" appears, two people would work on different parts.

---

## Hill Chart Progress

| Position | Meaning | Risk Level |
|----------|---------|------------|
| 1 — Started | Read story, looked at files | HIGH |
| 2 — Approach found | Know how to solve, unknowns identified | HIGH |
| 3 — Validated | Proof/spike done, no unknowns | MEDIUM |
| 4 — Building | Implementation + tests in progress | LOW |
| 5 — Done | All AC met, pushed, reviewed | NONE |

**Rule:** Story stuck at position 1-2 for more than one session = escalate immediately.

---

## Bug Report Standard

All bugs MUST include:

1. **Steps to reproduce** — numbered, specific
2. **Expected behavior** — what should happen
3. **Actual behavior** — what actually happens
4. **Severity** — P0 (crash/data loss), P1 (broken feature), P2 (cosmetic/workaround exists)
5. **Environment** — browser, OS, node version as relevant
6. **Evidence** — error message, stack trace, or screenshot

---

## Quality Gate: Merge Checklist

Before any polecat merge (refinery MR):

- [ ] Tests cover the changed code paths
- [ ] No new lint warnings introduced
- [ ] AC checklist in bead is fully checked
- [ ] Story Manager (melania) has approved the AC before work started

---

## Brainstorm Triage Protocol

brainstorm files ideas across rigs. Story Manager triages:

| Decision | Criteria |
|----------|----------|
| **APPROVE** | Clear problem, actionable, fits a sprint, has rough AC |
| **REFINE** | Good idea but needs AC, sizing, or dependency mapping |
| **DEFER** | Valid but lower priority than current sprint work |
| **REJECT** | Duplicate, out of scope, or premature optimization |

Brainstorm beads stay P3 until triaged. Story Manager promotes to P1/P2 if approved.

*Last updated: 2026-02-20 by melania*
