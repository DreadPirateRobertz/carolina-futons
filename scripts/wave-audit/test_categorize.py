"""cf-6amf (cf-roadmap.3): tests for wave-audit categorizer.

Codifies the categorization rubric from cf-o5j5:
- pure-docs       — docs/ + .md files only
- test-only       — test files only (tests/, src/__tests__/, *.test.*, *.spec.*)
- trivial         — ≤12 LOC OR lockfile/dep-bump only
- housekeeping    — config / runtime / agent-state files only
- substantive     — anything else

Run: `python -m pytest scripts/wave-audit/test_categorize.py -v`
"""
from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _import_cat():
    for mod in list(sys.modules):
        if mod == "categorize":
            del sys.modules[mod]
    import categorize
    return categorize


def _pr(number, files, additions=20, deletions=5):
    """Build a minimal PR record mirroring `gh pr list --json files,additions,deletions,number,title`."""
    return {
        "number": number,
        "title": f"PR #{number}",
        "additions": additions,
        "deletions": deletions,
        "files": [{"path": p} for p in files],
    }


# ── Categorization ─────────────────────────────────────────────────


def test_pure_docs_only_md_files():
    cat = _import_cat()
    pr = _pr(101, ["docs/runbook.md", "docs/cutover-checklist.md"], additions=200)
    assert cat.categorize(pr) == "pure-docs"


def test_pure_docs_template_files():
    cat = _import_cat()
    pr = _pr(102, ["docs/cf-3qt-day1-stability-report-TEMPLATE.md"], additions=240)
    assert cat.categorize(pr) == "pure-docs"


def test_test_only_top_level_tests_dir():
    cat = _import_cat()
    pr = _pr(103, ["tests/foo.test.js"], additions=60)
    assert cat.categorize(pr) == "test-only"


def test_test_only_cfw_style_underscore_tests():
    cat = _import_cat()
    pr = _pr(104, ["src/__tests__/Header.test.tsx"], additions=40)
    assert cat.categorize(pr) == "test-only"


def test_test_only_spec_file():
    cat = _import_cat()
    pr = _pr(105, ["e2e/auth.spec.ts"], additions=80)
    assert cat.categorize(pr) == "test-only"


def test_trivial_small_diff():
    cat = _import_cat()
    pr = _pr(106, ["src/components/Foo.tsx"], additions=8, deletions=2)
    assert cat.categorize(pr) == "trivial"


def test_trivial_lockfile_bump():
    cat = _import_cat()
    pr = _pr(107, ["package.json", "package-lock.json"], additions=41, deletions=41)
    assert cat.categorize(pr) == "trivial"


def test_trivial_lockfile_only_large_diff():
    """package-lock.json can grow arbitrarily large but is still trivial — it's
    a dep-resolution snapshot, not human-written code."""
    cat = _import_cat()
    pr = _pr(108, ["package-lock.json"], additions=2000, deletions=1500)
    assert cat.categorize(pr) == "trivial"


def test_housekeeping_gitignore_runtime_state():
    cat = _import_cat()
    pr = _pr(109, [".gitignore", ".runtime/agent.lock", "CLAUDE.md"], additions=9, deletions=587)
    assert cat.categorize(pr) == "housekeeping"


def test_substantive_feature_change():
    cat = _import_cat()
    pr = _pr(110, ["src/components/Header.tsx", "src/__tests__/Header.test.tsx"], additions=85, deletions=81)
    assert cat.categorize(pr) == "substantive"


def test_substantive_when_mixed_with_tests():
    """A PR with both source AND test files is substantive, not test-only."""
    cat = _import_cat()
    pr = _pr(111, ["src/lib/seo/twitter-from-og.ts", "src/lib/seo/__tests__/twitter-from-og.test.ts"], additions=138, deletions=33)
    assert cat.categorize(pr) == "substantive"


def test_substantive_just_above_trivial_threshold():
    cat = _import_cat()
    pr = _pr(112, ["src/api/health/route.ts"], additions=13, deletions=0)
    assert cat.categorize(pr) == "substantive"


def test_pure_docs_with_runbook_in_top_level():
    """Docs files outside the docs/ tree (e.g. top-level CHANGELOG.md, README.md)."""
    cat = _import_cat()
    pr = _pr(113, ["CHANGELOG.md", "README.md"], additions=100)
    assert cat.categorize(pr) == "pure-docs"


def test_substantive_when_mixed_docs_and_source():
    """A PR with both docs and substantive code is substantive."""
    cat = _import_cat()
    pr = _pr(114, ["docs/api.md", "src/api/health/route.ts"], additions=80, deletions=10)
    assert cat.categorize(pr) == "substantive"


# ── Filter to substantive for deep audit ───────────────────────────


def test_deep_audit_candidates_returns_only_substantive():
    cat = _import_cat()
    prs = [
        _pr(1, ["docs/x.md"]),                              # pure-docs
        _pr(2, ["tests/x.test.js"]),                        # test-only
        _pr(3, ["package-lock.json"], additions=999),       # trivial
        _pr(4, [".gitignore"]),                             # housekeeping
        _pr(5, ["src/lib/foo.ts", "src/__tests__/foo.test.tsx"]),  # substantive
        _pr(6, ["src/api/bar.ts"], additions=200),          # substantive
    ]
    out = cat.deep_audit_candidates(prs)
    assert [p["number"] for p in out] == [5, 6]


# ── Histogram for report ───────────────────────────────────────────


def test_summary_histogram_counts_each_category():
    cat = _import_cat()
    prs = [
        _pr(1, ["docs/x.md"]),
        _pr(2, ["docs/y.md"]),
        _pr(3, ["tests/x.test.js"]),
        _pr(4, ["package-lock.json"], additions=999),
        _pr(5, [".gitignore"]),
        _pr(6, ["src/lib/foo.ts"], additions=200),
        _pr(7, ["src/api/bar.ts"], additions=300),
    ]
    h = cat.summary_histogram(prs)
    assert h == {
        "pure-docs": 2,
        "test-only": 1,
        "trivial": 1,
        "housekeeping": 1,
        "substantive": 2,
    }


# ── cf-6amf.1 (cf-6amf.fu1): substantive sub-classification ─────────────────


def _pr_with_title(number, title, files, additions=200, deletions=20):
    """Variant of _pr that lets the test pin a specific commit-prefix title."""
    return {
        "number": number,
        "title": title,
        "additions": additions,
        "deletions": deletions,
        "files": [{"path": p} for p in files],
    }


# ── commit_prefix ──────────────────────────────────────────────────


def test_commit_prefix_feat_no_scope():
    cat = _import_cat()
    assert cat.commit_prefix("feat: add gallery") == "feat"


def test_commit_prefix_feat_with_scope():
    cat = _import_cat()
    assert cat.commit_prefix("feat(cf-g640): warranty gate") == "feat"


def test_commit_prefix_fix_with_scope():
    cat = _import_cat()
    assert cat.commit_prefix("fix(cf-8xw2): Promise.allSettled migration") == "fix"


def test_commit_prefix_refactor():
    cat = _import_cat()
    assert cat.commit_prefix("refactor(plp): extract helper") == "refactor"


def test_commit_prefix_chore():
    cat = _import_cat()
    assert cat.commit_prefix("chore(cf-4x7e.B5): drop dead webMethods") == "chore"


def test_commit_prefix_test():
    cat = _import_cat()
    assert cat.commit_prefix("test(cf-o5j5.1): OG snapshot backfill") == "test"


def test_commit_prefix_perf():
    cat = _import_cat()
    assert cat.commit_prefix("perf(cf-gsca): wrap with React cache") == "perf"


def test_commit_prefix_docs_prefix():
    cat = _import_cat()
    assert cat.commit_prefix("docs(audits): wave-audit-2026-05-15") == "docs"


def test_commit_prefix_style():
    cat = _import_cat()
    assert cat.commit_prefix("style: prettier sweep") == "style"


def test_commit_prefix_case_insensitive():
    cat = _import_cat()
    # Conventional commits are lowercase but real titles drift.
    assert cat.commit_prefix("FEAT: shout case") == "feat"


def test_commit_prefix_unrecognized_returns_other():
    cat = _import_cat()
    # cf-x: doesn't open with a recognized prefix.
    assert cat.commit_prefix("cf-x: some adhoc work") == "other"


def test_commit_prefix_empty_returns_other():
    cat = _import_cat()
    assert cat.commit_prefix("") == "other"
    assert cat.commit_prefix(None) == "other"


def test_commit_prefix_whitespace_only_returns_other():
    cat = _import_cat()
    assert cat.commit_prefix("   \t  ") == "other"


# ── deep_audit_priority ────────────────────────────────────────────


def test_deep_audit_priority_feat_touching_sdk_is_p1():
    cat = _import_cat()
    pr = _pr_with_title(
        1, "feat(cf-foo): new checkout flow", ["src/lib/wix/cart.ts"],
    )
    assert cat.deep_audit_priority(pr) == "p1"


def test_deep_audit_priority_feat_touching_stripe_route_is_p1():
    cat = _import_cat()
    pr = _pr_with_title(
        2, "feat: stripe webhook", ["src/api/stripe/route.ts"],
    )
    assert cat.deep_audit_priority(pr) == "p1"


def test_deep_audit_priority_feat_not_touching_sdk_is_p2():
    cat = _import_cat()
    pr = _pr_with_title(
        3, "feat(plp): hero polish", ["src/components/site/Header.tsx"],
    )
    assert cat.deep_audit_priority(pr) == "p2"


def test_deep_audit_priority_fix_is_p2_regardless_of_sdk():
    cat = _import_cat()
    pr = _pr_with_title(
        4, "fix(cf-x): null guard", ["src/lib/wix/orders.ts"],
    )
    assert cat.deep_audit_priority(pr) == "p2"


def test_deep_audit_priority_refactor_is_p3():
    cat = _import_cat()
    pr = _pr_with_title(
        5, "refactor: extract helper", ["src/lib/wix/products.ts"],
    )
    assert cat.deep_audit_priority(pr) == "p3"


def test_deep_audit_priority_chore_is_p3():
    cat = _import_cat()
    pr = _pr_with_title(
        6, "chore(cf-4x7e): drop dead webMethod", ["src/lib/wix/foo.ts"],
    )
    assert cat.deep_audit_priority(pr) == "p3"


def test_deep_audit_priority_other_is_p3():
    cat = _import_cat()
    pr = _pr_with_title(
        7, "unclassified weirdness", ["src/lib/wix/products.ts"],
    )
    assert cat.deep_audit_priority(pr) == "p3"


# ── substantive_subclassify ────────────────────────────────────────


def test_substantive_subclassify_skips_non_substantive():
    cat = _import_cat()
    prs = [
        _pr_with_title(1, "docs(audit): wave note", ["docs/x.md"]),  # pure-docs
        _pr_with_title(2, "feat: meaningful", ["src/lib/foo.ts"]),  # substantive
        _pr_with_title(3, "fix: small one-liner", ["src/lib/foo.ts"], additions=3, deletions=1),  # trivial
    ]
    h = cat.substantive_subclassify(prs)
    assert h["feat"] == 1
    assert h["fix"] == 0
    assert h["docs"] == 0


def test_substantive_subclassify_categorizes_all_prefixes():
    cat = _import_cat()
    prs = [
        _pr_with_title(1, "feat: a", ["src/lib/a.ts"]),
        _pr_with_title(2, "fix: b", ["src/lib/b.ts"]),
        _pr_with_title(3, "refactor: c", ["src/lib/c.ts"]),
        _pr_with_title(4, "chore: d", ["src/lib/d.ts"]),
        _pr_with_title(5, "perf: e", ["src/lib/e.ts"]),
        _pr_with_title(6, "weird title", ["src/lib/f.ts"]),
    ]
    h = cat.substantive_subclassify(prs)
    assert h["feat"] == 1
    assert h["fix"] == 1
    assert h["refactor"] == 1
    assert h["chore"] == 1
    assert h["perf"] == 1
    assert h["other"] == 1


def test_substantive_subclassify_stable_keys_when_empty():
    cat = _import_cat()
    h = cat.substantive_subclassify([])
    # Keys appear even at zero so downstream consumers can format a stable table.
    for k in ("feat", "fix", "refactor", "chore", "test", "perf", "docs", "style", "other"):
        assert h[k] == 0


# ── deep_audit_priority_histogram ──────────────────────────────────


def test_deep_audit_priority_histogram_full_mix():
    cat = _import_cat()
    prs = [
        _pr_with_title(1, "feat: a", ["src/lib/wix/cart.ts"]),  # p1
        _pr_with_title(2, "feat: b", ["src/api/track/route.ts"]),  # p1
        _pr_with_title(3, "feat: c", ["src/components/x.tsx"]),  # p2
        _pr_with_title(4, "fix: d", ["src/lib/wix/orders.ts"]),  # p2
        _pr_with_title(5, "refactor: e", ["src/lib/wix/cart.ts"]),  # p3
        _pr_with_title(6, "chore: f", ["src/lib/wix/products.ts"]),  # p3
        _pr_with_title(7, "doc-only", ["docs/x.md"]),  # skipped (pure-docs)
    ]
    h = cat.deep_audit_priority_histogram(prs)
    assert h == {"p1": 2, "p2": 2, "p3": 2}


def test_deep_audit_priority_histogram_empty():
    cat = _import_cat()
    h = cat.deep_audit_priority_histogram([])
    assert h == {"p1": 0, "p2": 0, "p3": 0}
