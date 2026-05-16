"""cf-4hys: tests for the pre-dispatch staleness checker.

PM workflow: before dispatching a crew member to an OPEN/HOOKED bead,
run this checker to detect "work already shipped under a different
bead ID / PR" — the dispatch-collision shape that fired 6+ times in
the 2026-05-16 session.

Pure-function design — `should_warn(bead, recent_prs)` is the testable
predicate. Tests pin keyword-match thresholds + edge cases.

Run: `python -m pytest scripts/test_check_stale_hooked_bead.py -v`
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _import_checker():
    for mod in list(sys.modules):
        if mod == "check_stale_hooked_bead":
            del sys.modules[mod]
    import check_stale_hooked_bead
    return check_stale_hooked_bead


def _pr(number, title):
    """Minimal PR record matching `gh pr list --json number,title` output."""
    return {"number": number, "title": title}


# ── Direct bead-ID match (highest confidence) ─────────────────────


def test_pr_title_contains_bead_id_exact_warns():
    """The canonical staleness case: a merged PR title contains the
    exact bead ID. cf-q8m2 was shipped via PR #1285 (title contained
    'cf-q8m2') 4+ days before the dispatch."""
    chk = _import_checker()
    bead = {"id": "cf-q8m2", "title": "Dead-code Pass 3 chunk A — SUPERSEDE emailTemplates"}
    prs = [
        _pr(1285, "fix(cf-4x7e.A): cf-q8m2 chunk A — SUPERSEDE emailTemplates.web.js"),
    ]
    result = chk.should_warn(bead, prs)
    assert result is not None
    assert result["match_kind"] == "bead-id-direct"
    assert result["pr_number"] == 1285


def test_pr_title_no_match_returns_none():
    """Negative pin: PR titles that share no overlap with the bead → no warn."""
    chk = _import_checker()
    bead = {"id": "cf-zzzz", "title": "Some new unrelated thing"}
    prs = [
        _pr(1, "fix(cf-other): unrelated change"),
        _pr(2, "feat(cf-something): different scope"),
    ]
    assert chk.should_warn(bead, prs) is None


def test_case_insensitive_bead_id_match():
    """Bead IDs are case-insensitive in matching."""
    chk = _import_checker()
    bead = {"id": "cf-q8m2", "title": "x"}
    prs = [_pr(99, "fix(CF-Q8M2): something")]
    result = chk.should_warn(bead, prs)
    assert result is not None
    assert result["match_kind"] == "bead-id-direct"


# ── Keyword-match shape (medium confidence) ───────────────────────


def test_pr_title_contains_strong_keyword_overlap_warns():
    """When the bead ID doesn't appear in any PR but the title shares
    2+ distinctive keywords with a merged PR, warn. cf-8r7v gift-cards
    case: shipped via PR #589 cf-gift-g1 — title contained 'gift card'
    + 'send as a gift' + 'recipient meta'."""
    chk = _import_checker()
    bead = {
        "id": "cf-8r7v",
        "title": "/gift-cards recipient-personalization — add gifting flow to GiftCardPicker",
    }
    prs = [
        _pr(589, "feat(cf-gift-g1): gift card 'send as a gift' — recipient meta via Wix customTextFields"),
    ]
    result = chk.should_warn(bead, prs)
    assert result is not None
    assert result["match_kind"] == "keyword-overlap"
    assert result["pr_number"] == 589
    # At least 2 distinctive keywords should overlap
    assert result["matched_keywords"] is not None
    assert len(result["matched_keywords"]) >= 2


def test_single_keyword_match_does_not_warn():
    """One shared keyword isn't enough — too noisy. Require 2+ distinctive
    overlapping tokens before raising a flag."""
    chk = _import_checker()
    bead = {"id": "cf-xxxx", "title": "Refactor checkout"}
    prs = [_pr(1, "fix(cf-other): clean up checkout button hover state")]
    # Only "checkout" overlaps — single token, not enough
    assert chk.should_warn(bead, prs) is None


def test_stopword_overlap_does_not_warn():
    """Common words ('the', 'a', 'and', 'for', 'fix', 'feat') don't count
    toward keyword overlap. Otherwise every PR with 'fix' would warn."""
    chk = _import_checker()
    bead = {"id": "cf-xxxx", "title": "fix the bug and update the docs"}
    prs = [_pr(1, "fix and update the API")]
    # "fix" + "and" + "the" + "update" all overlap but all are stopwords
    assert chk.should_warn(bead, prs) is None


# ── Multi-PR result ────────────────────────────────────────────────


def test_returns_highest_confidence_match_when_multiple_hit():
    """If both a direct bead-ID PR and a keyword-overlap PR exist,
    return the direct match (higher confidence). Operator gets a single
    actionable signal."""
    chk = _import_checker()
    bead = {"id": "cf-q8m2", "title": "SUPERSEDE emailTemplates dead code"}
    prs = [
        _pr(100, "feat(cf-other): SUPERSEDE emailTemplates work"),  # keyword match
        _pr(1285, "fix(cf-q8m2): chunk A — drop dead methods"),     # direct match
    ]
    result = chk.should_warn(bead, prs)
    assert result is not None
    assert result["match_kind"] == "bead-id-direct"
    assert result["pr_number"] == 1285


def test_returns_first_keyword_match_when_no_direct():
    """When no direct bead-ID match exists, return the strongest
    keyword-overlap match (highest count of overlapping distinctive
    tokens). Newer PRs (higher number) win on ties."""
    chk = _import_checker()
    bead = {"id": "cf-xxxx", "title": "Gift card recipient personalization with email"}
    prs = [
        _pr(100, "feat(a): gift card icon"),                          # 1 overlap (stopword filtered)
        _pr(200, "feat(b): gift card recipient email send personalization"),  # 4+ overlap
    ]
    result = chk.should_warn(bead, prs)
    assert result is not None
    assert result["pr_number"] == 200


# ── Edge cases ────────────────────────────────────────────────────


def test_empty_pr_list_returns_none():
    chk = _import_checker()
    bead = {"id": "cf-xxxx", "title": "Anything"}
    assert chk.should_warn(bead, []) is None


def test_empty_bead_title_falls_back_to_id_only():
    """If a bead has no title (data oddity), still check by ID."""
    chk = _import_checker()
    bead = {"id": "cf-q8m2", "title": ""}
    prs = [_pr(1285, "fix(cf-q8m2): something")]
    result = chk.should_warn(bead, prs)
    assert result is not None
    assert result["match_kind"] == "bead-id-direct"
