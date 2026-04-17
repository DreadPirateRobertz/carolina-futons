# cf-3qt.6.1 Per-Page Sign-off Survey

Three questions, one page, one sign-off. Stilgar answers each with
`yes` / `no` / `note:<text>`. Any `no` files a sub-bead under cf-3qt.6.1
and blocks that page from Phase 8 cutover until resolved.

Copy this block once per page into a per-page file under
`docs/cf-3qt/sign-offs/<page-id>.md` (created by the harness on first run).

---

## Page: `<page-id>` — signed off <YYYY-MM-DD>

**Intent** (pulled from DESIGN-INTENT-MATRIX.md):
> _one-sentence summary of the page's brand goal_

### Q1. Does the Next.js version meet the *intent* of the page?
Brand voice, tone, audience framing — does it land the way the design
vision wants it to land?

Answer: ___

### Q2. Does the Next.js version meet the *design goal* of the page?
Visual hierarchy, rhythm, density, use of the brand type + color system,
responsive behaviour at mobile / tablet / desktop.

Answer: ___

### Q3. Does the Next.js version meet the *functional goal* of the page?
Does the user flow work — forms submit, CTAs route, state persists,
errors are readable, accessibility is preserved?

Answer: ___

---

### Follow-ups

- Sub-beads filed: `<id>`, `<id>` (leave blank if none)
- Re-review after: `<PR #>` (leave blank if accepted as-is)
- Notes (optional): _free form — surprises, opinions, risks worth logging_
