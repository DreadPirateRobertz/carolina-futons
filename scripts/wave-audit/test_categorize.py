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


# ── cf-6amf.1: substantive sub-classification by commit prefix ─────


def _pr_titled(number, title, files, additions=200, deletions=10):
    return {
        "number": number,
        "title": title,
        "additions": additions,
        "deletions": deletions,
        "files": [{"path": p} for p in files],
    }


def test_commit_prefix_feat_with_scope():
    cat = _import_cat()
    assert cat.commit_prefix("feat(cf-9fqc): observability dashboard GREEN") == "feat"


def test_commit_prefix_fix_no_scope():
    cat = _import_cat()
    assert cat.commit_prefix("fix: align UptimeRobot keyword to /api/health") == "fix"


def test_commit_prefix_chore_with_scope():
    cat = _import_cat()
    assert cat.commit_prefix("chore(cf-4x7e.B5): surgical drop dead modules") == "chore"


def test_commit_prefix_recognizes_refactor_test_perf_docs_style():
    cat = _import_cat()
    assert cat.commit_prefix("refactor(foo): extract helper") == "refactor"
    assert cat.commit_prefix("test(cf-5dto.2): combinatorial tests") == "test"
    assert cat.commit_prefix("perf(cf-gsca): React.cache wrap") == "perf"
    assert cat.commit_prefix("docs(cf-zn5b): parity audit") == "docs"
    assert cat.commit_prefix("style: prettier sweep") == "style"


def test_commit_prefix_breaking_change_marker():
    """`feat!: ...` and `feat(scope)!: ...` are conventional-commits BREAKING markers."""
    cat = _import_cat()
    assert cat.commit_prefix("feat!: drop legacy API") == "feat"
    assert cat.commit_prefix("feat(api)!: drop legacy v1") == "feat"


def test_commit_prefix_unknown_returns_other():
    cat = _import_cat()
    assert cat.commit_prefix("WIP: in-progress thing") == "other"
    assert cat.commit_prefix("Merge branch 'main'") == "other"
    assert cat.commit_prefix("just a sentence with no prefix") == "other"
    assert cat.commit_prefix("") == "other"


def test_commit_prefix_is_case_insensitive_on_prefix_token():
    """GitHub UI doesn't lowercase titles — accept FEAT/Fix gracefully."""
    cat = _import_cat()
    assert cat.commit_prefix("Fix(scope): something") == "fix"
    assert cat.commit_prefix("FEAT: big thing") == "feat"


def test_substantive_subhistogram_only_counts_substantive_prs():
    """Sub-classification applies ONLY to the substantive bucket.
    A docs-only PR with a `feat:` prefix is still pure-docs and should be excluded."""
    cat = _import_cat()
    prs = [
        # substantive
        _pr_titled(1, "feat(cf-9fqc): obs dashboard", ["src/lib/foo.ts"], additions=300),
        _pr_titled(2, "feat(cf-54st): track-order page", ["src/app/track-order/page.tsx"], additions=200),
        _pr_titled(3, "fix(cf-ewnw): redact emails", ["src/backend/util.js"], additions=80),
        _pr_titled(4, "chore(cf-4x7e): retire dead modules", ["src/backend/x.web.js"], additions=2, deletions=8054),
        _pr_titled(5, "test(cf-5dto.2): precedence tests", ["scripts/x.py", "scripts/y.py"], additions=167),
        _pr_titled(6, "refactor: extract helper", ["src/lib/foo.ts"], additions=90),
        _pr_titled(7, "WIP: experimental thing", ["src/lib/bar.ts"], additions=200),  # other
        # not substantive (excluded entirely)
        _pr_titled(8, "feat(cf-zn5b): parity audit", ["docs/audit.md"], additions=111),  # pure-docs
        _pr_titled(9, "test(cf-x): only tests", ["tests/x.test.js"], additions=60),       # test-only
    ]
    h = cat.substantive_subhistogram(prs)
    assert h == {
        "feat": 2,
        "fix": 1,
        "refactor": 1,
        "chore": 1,
        "test": 1,
        "perf": 0,
        "docs": 0,
        "style": 0,
        "other": 1,
    }


def test_substantive_subhistogram_keys_stable_with_all_zeros():
    """Empty PR list still returns the full key set for stable table rendering."""
    cat = _import_cat()
    h = cat.substantive_subhistogram([])
    assert set(h.keys()) == {"feat", "fix", "refactor", "chore", "test", "perf", "docs", "style", "other"}
    assert all(v == 0 for v in h.values())


# ── cf-6amf.1 + radahn obs#3: high-value audit target flag ─────────


def test_high_value_audit_target_feat_touching_wix_lib():
    cat = _import_cat()
    pr = _pr_titled(
        1, "feat(cf-gsca): wrap getCollectionBySlug",
        ["src/lib/wix/products.ts", "src/__tests__/get-collection-by-slug-cache.test.ts"],
        additions=120,
    )
    assert cat.is_high_value_audit_target(pr) is True


def test_high_value_audit_target_feat_touching_api_route():
    cat = _import_cat()
    pr = _pr_titled(
        2, "feat(cf-54st.1): post_lookupOrder HTTP wrapper",
        ["src/api/track-order/route.ts"],
        additions=179,
    )
    assert cat.is_high_value_audit_target(pr) is True


def test_high_value_audit_target_feat_touching_stripe_lib():
    cat = _import_cat()
    pr = _pr_titled(
        3, "feat(payments): stripe webhook handler",
        ["src/lib/stripe/webhook.ts"],
        additions=140,
    )
    assert cat.is_high_value_audit_target(pr) is True


def test_high_value_audit_target_false_for_feat_outside_sdk_paths():
    cat = _import_cat()
    pr = _pr_titled(
        4, "feat(ui): new button component",
        ["src/components/ui/Button.tsx"],
        additions=80,
    )
    assert cat.is_high_value_audit_target(pr) is False


def test_high_value_audit_target_false_for_non_feat_prefix_in_sdk_paths():
    """`chore` retiring dead Wix modules isn't a spy-assertion candidate
    (no new external SDK callsite); fix/refactor are also out per the
    bead — feat is the surface-introducing prefix."""
    cat = _import_cat()
    pr = _pr_titled(
        5, "chore(cf-4x7e): retire dead wix module",
        ["src/lib/wix/dead-module.ts"],
        additions=0, deletions=400,
    )
    assert cat.is_high_value_audit_target(pr) is False


def test_high_value_audit_target_false_for_non_substantive_pr():
    """A 5-LOC fix to src/lib/wix is trivial → not a deep-audit target,
    even though it touches a flagged path."""
    cat = _import_cat()
    pr = _pr_titled(
        6, "feat(cf-x): tiny wix tweak",
        ["src/lib/wix/products.ts"],
        additions=3, deletions=2,
    )
    # Trivial PR (≤12 LOC), so it shouldn't surface as a deep-audit target.
    assert cat.is_high_value_audit_target(pr) is False
