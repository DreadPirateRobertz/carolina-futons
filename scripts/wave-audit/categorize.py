"""cf-6amf (cf-roadmap.3): wave-audit PR categorizer.

Pure function module — takes a PR record (mirrors `gh pr list --json files,
additions,deletions,number,title` output) and assigns a category for the
wave-audit ritual. Five categories are mutually exclusive; check precedence
is documented inline.

Rationale: cf-o5j5 (PR #1339) shipped a one-shot 26-PR wave audit; this
module factors the categorization rubric so future audits can run via
`scripts/wave-audit/wave-audit.sh` and produce consistent output.

Run tests: `python -m pytest scripts/wave-audit/test_categorize.py -v`
"""
from __future__ import annotations

import re

# A PR file path is "test-related" if it lives in any tests/ or __tests__/
# directory OR has a .test.<ext> / .spec.<ext> infix. The wave-audit ritual
# treats these uniformly — locks the contract via test_audit_v5.py-style
# negative-case pins for paths like tests/helpers.ts that live alongside
# tests but aren't themselves tests.
_TEST_PATH_RE = re.compile(
    r"(?:^|/)(?:tests|__tests__|e2e)/.*\.(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$"
)

# Top-level docs files outside docs/ tree (README, CHANGELOG, LICENSE, etc.)
_TOP_LEVEL_DOC_RE = re.compile(
    r"^(README|CHANGELOG|LICENSE|CONTRIBUTING|CODEOWNERS|AGENTS|CLAUDE|GEMINI)(\.md|\.MD)?$"
)

# Housekeeping/config file patterns. .runtime/ + .claude/ are agent state;
# .gitignore / .gitattributes are repo config; tsconfig.json etc. are
# build config without behavior implications.
_HOUSEKEEPING_PATH_RE = re.compile(
    r"^(?:"
    r"\.gitignore"
    r"|\.gitattributes"
    r"|\.runtime/.*"
    r"|\.claude/.*"
    r"|\.github/CODEOWNERS"
    r"|CLAUDE\.md"
    r"|AGENTS\.md"
    r"|GEMINI\.md"
    r")$"
)

# Threshold below which a non-lockfile PR is considered "trivial". The
# cf-o5j5 audit used 12 LOC as the cut; it captures the typical aria-hidden
# / one-line-fix / config-tweak shape that doesn't host meaningful gaps.
TRIVIAL_LOC_THRESHOLD = 12

# Lockfile / dep-manifest files. A diff containing ONLY these is trivial
# regardless of LOC count — npm regenerates lockfiles in bulk on every
# dep bump, and the diff is mechanical.
_LOCKFILE_PATHS = frozenset({
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "uv.lock",
    "poetry.lock",
})


def _is_doc(path: str) -> bool:
    """Pure-docs path: under docs/ OR top-level documentation file."""
    if path.startswith("docs/") and path.endswith(".md"):
        return True
    return bool(_TOP_LEVEL_DOC_RE.match(path))


def _is_test(path: str) -> bool:
    return bool(_TEST_PATH_RE.search(path))


def _is_housekeeping(path: str) -> bool:
    return bool(_HOUSEKEEPING_PATH_RE.match(path))


def _is_lockfile_or_manifest(path: str) -> bool:
    return path in _LOCKFILE_PATHS or path == "package.json"


def categorize(pr: dict) -> str:
    """Return the wave-audit category for a PR record.

    Precedence (checked top-down):
      1. pure-docs       — ALL files are docs/ or top-level .md
      2. test-only       — ALL files are test files
      3. housekeeping    — ALL files are .gitignore/.runtime/.claude/etc.
      4. trivial         — total LOC ≤ TRIVIAL_LOC_THRESHOLD,
                           OR ALL files are lockfile/dep-manifest
      5. substantive     — everything else (the deep-audit candidates)

    Categories are computed from the file paths and LOC totals; the
    function does NOT call out to git or gh.
    """
    files = [f["path"] for f in pr.get("files", [])]
    if not files:
        return "trivial"  # Empty PRs are vacuously trivial; defensive default.

    if all(_is_doc(p) for p in files):
        return "pure-docs"
    if all(_is_test(p) for p in files):
        return "test-only"
    if all(_is_housekeeping(p) for p in files):
        return "housekeeping"

    total_loc = pr.get("additions", 0) + pr.get("deletions", 0)
    if all(_is_lockfile_or_manifest(p) for p in files):
        return "trivial"
    if total_loc <= TRIVIAL_LOC_THRESHOLD and not any(_is_doc(p) for p in files):
        # Small code-touching PR: trivial. (Docs-mixed-with-source falls through
        # to substantive — a 5-LOC code-and-doc change still hosts surface.)
        return "trivial"

    return "substantive"


def deep_audit_candidates(prs: list[dict]) -> list[dict]:
    """Filter PRs to the substantive ones — the targets for JSDoc + TDD +
    CI deep-audit per the cf-o5j5 methodology."""
    return [pr for pr in prs if categorize(pr) == "substantive"]


# cf-6amf.1 (cf-6amf.fu1): sub-classify the substantive bucket by
# conventional-commit prefix so deep-audit can prioritize feat-touching-
# external-SDK PRs ahead of chore/refactor. Pilot wave (2026-05-15) had a
# 71% substantive ratio; a flat sub-bucket of 24 PRs is too coarse to
# guide attention.

# Conventional-commit prefix tokens we recognize. Anything else maps to
# "other" (e.g. WIP, Merge, free-form titles). The trailing `(scope)`,
# optional `!` for breaking change, and `:` are all stripped before the
# prefix token is read.
_CONVENTIONAL_PREFIXES = frozenset({
    "feat", "fix", "refactor", "chore", "test", "perf", "docs", "style",
})

# Match `prefix`, `prefix(scope)`, `prefix!`, or `prefix(scope)!` followed
# by `:` at the start of the title. Case-insensitive on the prefix token.
_COMMIT_PREFIX_RE = re.compile(
    r"^([A-Za-z]+)(?:\([^)]*\))?!?:\s",
)

# Paths whose new feat-prefixed PRs likely introduce external-SDK call
# sites — flagged for the radahn dimension-#4 spy-assertion check.
_HIGH_VALUE_PATH_RE = re.compile(
    r"^(?:"
    r"src/lib/wix(?:/|$)"
    r"|src/lib/stripe(?:/|$)"
    r"|src/api/[^/]+/route\.ts$"
    r")"
)


def commit_prefix(title: str) -> str:
    """Extract the conventional-commit prefix from a PR title.

    Returns the lowercased prefix token (feat/fix/refactor/chore/test/perf/
    docs/style) when the title matches `prefix(...)?!?: ...`. Returns
    "other" for unrecognized prefixes, freeform titles, merge commits,
    and empty strings.
    """
    if not title:
        return "other"
    m = _COMMIT_PREFIX_RE.match(title)
    if not m:
        return "other"
    token = m.group(1).lower()
    return token if token in _CONVENTIONAL_PREFIXES else "other"


def substantive_subhistogram(prs: list[dict]) -> dict[str, int]:
    """Return a dict with substantive-bucket counts keyed by commit prefix.

    Only PRs that categorize as "substantive" are counted; pure-docs/test-
    only/trivial/housekeeping PRs are excluded entirely (even if their
    title carries a conventional-commit prefix). The full key set always
    appears so downstream tables render with stable columns.
    """
    out = {p: 0 for p in _CONVENTIONAL_PREFIXES}
    out["other"] = 0
    for pr in prs:
        if categorize(pr) != "substantive":
            continue
        out[commit_prefix(pr.get("title", ""))] += 1
    return out


def is_high_value_audit_target(pr: dict) -> bool:
    """True when a substantive PR carries `feat:` AND touches a path that
    typically introduces an external-SDK call site (src/lib/wix, src/lib/
    stripe, src/api/<name>/route.ts).

    These are the deep-audit candidates that most likely need a spy-
    assertion per radahn obs#3 — a missing spy on a new Wix/Stripe
    callsite is the kind of gap cf-o5j5/cf-6amf was designed to surface.
    """
    if categorize(pr) != "substantive":
        return False
    if commit_prefix(pr.get("title", "")) != "feat":
        return False
    return any(
        _HIGH_VALUE_PATH_RE.match(f["path"])
        for f in pr.get("files", [])
    )


def summary_histogram(prs: list[dict]) -> dict[str, int]:
    """Return a dict with counts per category. Keys appear even for zero
    counts so downstream consumers can format a stable table."""
    out = {
        "pure-docs": 0,
        "test-only": 0,
        "trivial": 0,
        "housekeeping": 0,
        "substantive": 0,
    }
    for pr in prs:
        out[categorize(pr)] += 1
    return out
