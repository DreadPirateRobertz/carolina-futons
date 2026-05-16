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
