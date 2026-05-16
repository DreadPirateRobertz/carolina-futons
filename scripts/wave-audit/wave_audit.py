"""cf-6amf (cf-roadmap.3): wave-audit report renderer.

Reads a JSON array of PR records (output of `gh pr list --json
number,title,additions,deletions,files,mergeCommit`) on argv[1] and emits
a markdown summary to stdout.

Tested via test_categorize.py for the underlying categorize() logic;
this script is the thin presentation layer.

Usage (called from wave-audit.sh, not directly):
  python3 wave-audit.py <reached.json>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from categorize import (
    categorize,
    summary_histogram,
    deep_audit_candidates,
    substantive_subclassify,
    deep_audit_priority_histogram,
    deep_audit_priority,
)


def render(prs: list[dict]) -> str:
    """Emit the markdown report body (called by the shell wrapper)."""
    lines: list[str] = []

    # Histogram table
    histogram = summary_histogram(prs)
    lines.append("## Histogram\n")
    lines.append("| Category | Count |")
    lines.append("|---|---:|")
    for cat in ["pure-docs", "test-only", "trivial", "housekeeping", "substantive"]:
        lines.append(f"| {cat} | {histogram[cat]} |")
    lines.append(f"| **Total** | **{len(prs)}** |")
    lines.append("")

    # Per-PR table
    lines.append("## All PRs (categorized)\n")
    lines.append("| # | Cat | Diff | Title |")
    lines.append("|---|---|---|---|")
    for pr in sorted(prs, key=lambda p: p["number"]):
        cat = categorize(pr)
        diff = f"+{pr.get('additions', 0)}/-{pr.get('deletions', 0)}"
        title = pr.get("title", "")[:70]
        lines.append(f"| #{pr['number']} | {cat} | {diff} | {title} |")
    lines.append("")

    # Deep-audit candidates
    candidates = deep_audit_candidates(prs)
    lines.append(f"## Deep-audit candidates ({len(candidates)} substantive)\n")
    if not candidates:
        lines.append("_No substantive PRs in this window — wave was pure-docs/test-only/trivial/housekeeping._")
    else:
        # cf-6amf.1: when substantive ratio is high (>60%), the deep-audit
        # queue is too long for a single sitting. Sub-classify by
        # conventional-commit prefix + emit a p1/p2/p3 priority histogram
        # so the auditor knows what to look at first.
        sub_hist = substantive_subclassify(prs)
        prio_hist = deep_audit_priority_histogram(prs)
        lines.append("### Substantive sub-histogram (by commit prefix)")
        lines.append("")
        lines.append("| Prefix | Count |")
        lines.append("|---|---:|")
        for k in ("feat", "fix", "refactor", "chore", "test", "perf", "docs", "style", "other"):
            if sub_hist[k] > 0:
                lines.append(f"| {k} | {sub_hist[k]} |")
        lines.append("")
        lines.append("### Deep-audit priority (radahn dim-#4 signal)")
        lines.append("")
        lines.append("| Tier | Count | What it means |")
        lines.append("|---|---:|---|")
        lines.append(f"| **p1** | {prio_hist['p1']} | `feat(...)` touching external SDK call site (Wix/Stripe/Twilio/API route) — highest spy-assertion leverage |")
        lines.append(f"| **p2** | {prio_hist['p2']} | `feat(...)` or `fix(...)` without external-SDK boundary |")
        lines.append(f"| **p3** | {prio_hist['p3']} | `refactor` / `chore` / `perf` / other — narrower surface, can batch |")
        lines.append("")
        lines.append("These PRs warrant per-file JSDoc + TDD + CI verification per the cf-o5j5 methodology:")
        lines.append("")
        for pr in sorted(candidates, key=lambda p: p["number"]):
            diff = f"+{pr.get('additions', 0)}/-{pr.get('deletions', 0)}"
            sha = (pr.get("mergeCommit") or {}).get("oid", "")[:8]
            sha_note = f" (merge `{sha}`)" if sha else ""
            # cf-6amf.1: annotate each row with its priority tier so the
            # operator can sort/filter the list directly.
            tier = deep_audit_priority(pr)
            lines.append(f"- **#{pr['number']}** [`{tier}`] {diff}{sha_note}: {pr.get('title', '')}")
        lines.append("")
        lines.append("### Audit dimensions per candidate")
        lines.append("")
        lines.append("1. **JSDoc/block-doc on new exports** — for each `export const NAME = ...` or `export [async] function NAME(...)`, is there a comment explaining intent?")
        lines.append("2. **Test coverage on new surface** — `it()` blocks per new code path; happy + boundary cases.")
        lines.append("3. **CI evidence at merge** — lint + typecheck + Vitest/Playwright + CodeQL green at the merge commit.")
        lines.append("4. **Spy-assertion on external SDK callsites** (radahn dimension) — for every new Server Action / async callsite wrapping an external SDK (Wix, Stripe, Twilio, etc.), is there a spy assertion in the corresponding `*.test.ts` pinning the call? cf-6amf.1: p1 candidates above are the priority-1 targets for this dimension.")
    return "\n".join(lines)


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: wave-audit.py <reached.json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"Input file not found: {path}", file=sys.stderr)
        return 2
    prs = json.loads(path.read_text())
    if not isinstance(prs, list):
        print("Expected JSON array of PR records", file=sys.stderr)
        return 2
    print(render(prs))
    return 0


if __name__ == "__main__":
    sys.exit(main())
