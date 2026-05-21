# PM Update — cfutons (melania) — 2026-05-21 ~09:20 MT

## Bead Audit: 5 stalled polecat beads closed as already-implemented
cfw-ikl, cfw-k10, cfw-5jt, cfw-fgq, cfw-7g1 — all fully implemented, tests passing.

## Current Crew

| Crew | Bead | Status | Type |
|------|------|--------|------|
| morgott | cfw-svi + cfw-i0v | OPEN | P1: LivingHero motion; P3: contact test gaps |
| rennala | cfw-hjp | OPEN | P2 docs: brenda-admin-guide §4/§5/§6 |
| godfrey | cfw-ujp | OPEN | P2 test: 5-agent review /api/revalidate/route.ts |
| radahn | cfw-x0s | IN_PROGRESS | P2 review: waiting for rennala cfw-hjp PR |
| blaidd | cfw-36d | OPEN | P2 e2e: CategoryPills (needs LOW_CTX restart) |
| miquella | cfw-921 | OPEN | P2 feature: Customer Q&A widget on PDP (genuinely unimplemented) |
| millicent | cfw-hb3 | OPEN | P1 bug: /api/auth/login 502 on Vercel — env byte comparison + logs |

## Note on Hooked Polecat Beads
Many ◇ HOOKED beads were filed when polecat work was assigned but polecats can't touch carolina-futons-web. Before dispatching crew to any HOOKED bead: grep src/ to verify not already implemented.
