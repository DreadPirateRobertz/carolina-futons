#!/usr/bin/env python3
"""Velo dead-route detector — Phase 1.

For each `export const NAME = webMethod(Permissions.X, ...)` in
src/backend/*.web.js, classify into:

  HTTP-EXPOSED  — http-functions.js imports OR calls NAME (cfw can reach it)
  EVENT-WIRED   — events.js or *.events.js references NAME
  FRONTEND      — src/public, src/pages, or any non-.web.js Velo source calls NAME
  INTERNAL      — called by another src/backend/*.web.js module OR by another
                  exported function in the SAME .web.js file (e.g. generatePinContent
                  is called by syncCatalogBatch in the same pinterestCatalogSync.web.js)
  DEAD          — no caller anywhere

Plus secondary flag SUSPICIOUS:
  - Permissions.Anyone, no HTTP wrapper / cfw caller
  - name starts with a public-verb (submit/track/register/...) → looks
    publicly callable but isn't reachable from cfw
"""
from __future__ import annotations
import json
import re
import sys
from collections import Counter
from pathlib import Path

# ROOT auto-detects from script location: scripts/cf-dead-routes/ → repo root.
# Override via CFUTONS_ROOT env var if running from a non-standard checkout.
ROOT = Path(__import__("os").environ.get("CFUTONS_ROOT") or Path(__file__).resolve().parents[2])
SRC = ROOT / "src"
BACKEND = SRC / "backend"
HTTP_FILE = BACKEND / "http-functions.js"
EVENTS_FILE = BACKEND / "events.js"

# cfw repo for cross-rig caller check (gap-finder per cf-hpwy).
# Override via CFW_SRC env var if cfw lives elsewhere.
CFW_SRC = Path(__import__("os").environ.get("CFW_SRC") or "/Users/hal/gt/carolina-futons-web/src")

# `export const NAME = webMethod(Permissions.X, ...`
WM_RE = re.compile(
    r"^export\s+const\s+(\w+)\s*=\s*webMethod\s*\(\s*Permissions\.(\w+)",
    re.MULTILINE,
)

# cf-5dto (v5): Non-webMethod function exports.
# Matches `export [async] function NAME(...)`. The trap that motivated this:
# cf-4x7e.B5 (PR #1333) initially planned to whole-file-delete
# comfortTimeline.web.js — all 4 webMethods were correctly DEAD, but the
# file also exported a non-webMethod `async function createTimeline(...)`
# that purchaseFlowSmoke.test.js dynamically imports. The v4 detector only
# sees webMethods, so this surface was invisible. v5 reports it as a
# separate inventory so the operator decides surgical-drop vs whole-file
# rather than discovering the survivor after the revert.
#
# We deliberately limit to function declarations (callable surface). Value
# const exports (`export const FOO = 5`) are out of scope — those have
# different deletion semantics and we'd rather not pollute the report
# with constants whose consumers are everywhere.
NON_WM_FN_RE = re.compile(
    r"^export\s+(async\s+)?function\s+(\w+)\s*\(",
    re.MULTILINE,
)

# cf-5dto.fu1: arrow + function-expression export shapes that the original
# v5 regex missed. `export const FOO = async (x) => {...}` is the modern
# refactor target — if anyone moves a webMethod-adjacent helper from
# `export async function` to `export const = async () =>`, the inventory
# must still catch it. Three separate patterns keep the kind labels
# accurate without backtracking.
#
# `export const NAME = [async] (args) =>` — arrow function
NON_WM_ARROW_RE = re.compile(
    r"^export\s+const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>",
    re.MULTILINE,
)
# `export const NAME = [async] function` — function expression assigned to const
NON_WM_FN_EXPR_RE = re.compile(
    r"^export\s+const\s+(\w+)\s*=\s*(async\s+)?function\b",
    re.MULTILINE,
)

PUBLIC_VERB_RE = re.compile(
    r"^(submit|create|track|register|capture|send|notify|subscribe|"
    r"unsubscribe|redeem|claim|generate|update|delete)",
)

# cf-quba (cf-hpwy detector v3): allowlist for known-intentional
# Permissions.Anyone webMethods that match the public-verb pattern. Phase B
# audit (PR #1190) identified three legitimate cases that the SUSPICIOUS
# heuristic flags as false positives — guest-cart entry points and a
# customer-facing tracking endpoint. Each entry should pin to <module>.<name>
# so a same-named method in a different module isn't accidentally allowlisted.
#
# Entries are deliberately specific (module + name) and gated on a comment
# anchor so future additions are deliberate rather than drive-by.
INTENTIONAL_ANYONE = frozenset({
    # cartSessionService — guest-cart entry points (cannot require auth by
    # definition; documented in eventBus.js).
    "cartSessionService.createSession",
    "cartSessionService.updateCartItems",
    # ups-shipping — customer self-service tracking endpoint. Cited author
    # note + 6 actual internal callers.
    "ups-shipping.trackShipment",
    # pinterestCatalogSync — declares Permissions.Anyone explicitly and is
    # called by syncCatalogBatch within the same module to compose pin
    # content from a Wix product. No http-functions.js wrapper, no cfw
    # caller — the only consumer is the same-file orchestrator. The
    # "generate" verb prefix trips SUSPICIOUS; allowlisted because the
    # function only formats caller-supplied product data into a string
    # (no DB writes, no privileged reads, no PII), so Wix auto-RPC
    # exposure is harmless. cf-quba.fu1.
    "pinterestCatalogSync.generatePinContent",
    # emailService.sendSwatchConfirmationEmail — Permissions.Anyone
    # because the customer-facing swatchRequest.submitSwatchRequest
    # (also Anyone, rate-limited) calls it directly to dispatch the
    # swatch confirmation email. Live internal caller at
    # swatchRequest.web.js:258. The "send" verb prefix trips SUSPICIOUS;
    # allowlisted because the function only consumes a sanitized
    # payload from the same-rig swatch flow. cf-0sdo (cf-ykmj #2).
    "emailService.sendSwatchConfirmationEmail",
})


def _module_qualified_name(file_rel: str, name: str) -> str:
    """Return `<module>.<name>` for INTENTIONAL_ANYONE lookup.

    `file_rel` is the path relative to repo root, e.g.
    `src/backend/cartSessionService.web.js`. We extract the basename minus
    the `.web.js` (or `.js`) suffix.
    """
    base = file_rel.rsplit("/", 1)[-1]
    for suffix in (".web.js", ".js"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    return f"{base}.{name}"


def all_source_files() -> list[Path]:
    out: list[Path] = []
    for p in SRC.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix in (".js", ".jsx", ".ts", ".tsx"):
            out.append(p)
    return out


# cf-sq0d.fu2 (v3.2): strip JSDoc/block + line comments before checking
# caller hits. Without this, a JSDoc `@param {Object} foo - data from
# getAffiliateDashboard` line is credited as a real caller of the backend
# `getAffiliateDashboard` webMethod.
#
# Two passes:
#   1. Strip `/* … */` block comments (covers JSDoc and inline blocks).
#   2. Strip `// …` line comments — but preserve URL schemes like `https://`
#      by requiring the `//` to NOT be preceded by a `:` character.
_BLOCK_COMMENT_RE = re.compile(r"/\*[\s\S]*?\*/")
_LINE_COMMENT_RE = re.compile(r"(^|[^:])//[^\n]*")


def strip_js_comments(text: str) -> str:
    text = _BLOCK_COMMENT_RE.sub("", text)
    # Replace match with the captured non-`:` prefix so URL `://` survives.
    return _LINE_COMMENT_RE.sub(lambda m: m.group(1), text)


def collect_non_webmethod_exports(backend_root: Path | None = None) -> dict[str, dict]:
    """cf-5dto (v5): Inventory non-webMethod function exports in backend .web.js.

    Returns a dict keyed by export name → {file, line, kind} where kind is
    'async function' or 'function'. Matches `export [async] function NAME(...)`
    only — value const exports are out of scope (see NON_WM_FN_RE comment).

    `backend_root` overrides the module-level BACKEND for tests; falls back
    to the production path when None.
    """
    root = backend_root if backend_root is not None else BACKEND
    out: dict[str, dict] = {}
    skipped: list[tuple[str, str]] = []
    for fp in root.rglob("*.web.js"):
        try:
            text = fp.read_text(errors="ignore")
        except OSError as err:
            # cf-5dto silent-failure-hunter CR: don't silently drop the file.
            # If we skip without logging, an operator running audit.py sees
            # 'no non-webMethod exports here' and walks back into the B-5
            # trap. Surface every skip + count them at the call site.
            try:
                skipped.append((str(fp.relative_to(ROOT)), str(err)))
            except ValueError:
                skipped.append((str(fp), str(err)))
            continue
        text = strip_js_comments(text)
        try:
            file_str = str(fp.relative_to(ROOT))
        except ValueError:
            file_str = str(fp)

        def _record(name: str, line: int, kind: str) -> None:
            # Function-declaration takes priority over later const-rebindings
            # (same module rebinding a function-declared name is rare and
            # the declaration is the load-bearing entry).
            if name not in out:
                out[name] = {"file": file_str, "line": line, "kind": kind}

        for m in NON_WM_FN_RE.finditer(text):
            is_async = m.group(1) is not None
            name = m.group(2)
            line = text[: m.start()].count("\n") + 1
            _record(name, line, "async function" if is_async else "function")
        # cf-5dto.fu1: arrow shape — modern refactor target
        for m in NON_WM_ARROW_RE.finditer(text):
            name = m.group(1)
            is_async = m.group(2) is not None
            line = text[: m.start()].count("\n") + 1
            _record(name, line, "async arrow" if is_async else "arrow")
        # cf-5dto.fu1: function-expression assigned to const
        for m in NON_WM_FN_EXPR_RE.finditer(text):
            name = m.group(1)
            is_async = m.group(2) is not None
            line = text[: m.start()].count("\n") + 1
            _record(
                name,
                line,
                "async function expression" if is_async else "function expression",
            )
    if skipped:
        # Surface via stderr — operator + CI both see the failure mode.
        print(
            f"⚠ collect_non_webmethod_exports: skipped {len(skipped)} file(s) due to read errors:",
            file=sys.stderr,
        )
        for path, err in skipped[:10]:
            print(f"  {path}: {err}", file=sys.stderr)
        if len(skipped) > 10:
            print(f"  ... and {len(skipped) - 10} more", file=sys.stderr)
    return out


def collect_web_methods() -> dict[str, dict]:
    methods: dict[str, dict] = {}
    for fp in BACKEND.rglob("*.web.js"):
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        for m in WM_RE.finditer(text):
            name, perm = m.group(1), m.group(2)
            line = text[: m.start()].count("\n") + 1
            methods[name] = {
                "file": str(fp.relative_to(ROOT)),
                "permission": perm,
                "line": line,
            }
    return methods


# cf-sq0d (cf-hpwy detector v3): filesystem-path reference detection.
#
# The v2 detector closed the same-file caller blind-spot. v3 closes the
# next layer up: a same-path-as-string caller. cf-4x7e Pass 2 chunk 3
# (PR #1217) tripped on this when catalogImport.web.js was deleted —
# all 5 of its webMethods were correctly DEAD per v2, but
# scripts/validate-catalog.js and tests/validateCatalog.test.js both
# read the file directly via fs.readFileSync as the canonical source for
# VALID_CATEGORIES. v2 only scans for `import`/`from 'backend/...'`
# patterns, so the filesystem-path reads slipped past.
#
# Patterns we now flag (any of these → file is FS-path-referenced):
#   1. fs.readFileSync('...src/backend/<module>.web.js'...)        — Node
#   2. path.resolve(__dirname, '...src/backend/<module>...')       — relative
#   3. import x from '...src/backend/<module>?raw'                  — Vite ?raw
#   4. quoted bare path in array/string: '...src/backend/<module>...' — generic
#
# All four collapse to the same shape: a quoted string literal containing
# the substring `src/backend/<module>` (with or without the `.web.js`
# suffix). One regex catches all four — we don't need to model each call
# shape because the path string itself is the signal.
#
# False positive risk: a comment or doc that happens to quote the path
# wouldn't be a real reference. Acceptable trade-off — comments referencing
# the file are themselves a load-bearing signal that someone cared about
# the file enough to write about it. Extreme false-positive cases (e.g.
# CHANGELOG entries naming all 802 files) can be filtered out later by
# adding a comment-stripping pass.
FS_PATH_REF_RE_TEMPLATE = (
    r"""['"`][^'"`]*src/backend/{module}(?:\.web)?\.js[^'"`]*['"`]"""
)


def _module_basename(file_rel: str) -> str:
    """Return module basename (no extension) for fs-path lookup.

    `src/backend/catalogImport.web.js` → `catalogImport`.
    `src/backend/sub/foo.js`           → `foo`.
    """
    base = file_rel.rsplit("/", 1)[-1]
    for suffix in (".web.js", ".js"):
        if base.endswith(suffix):
            return base[: -len(suffix)]
    return base


# cf-5dto (v5): Sub-classify filesystem-path consumers so the operator can
# distinguish file-as-test-target from file-as-data-source. The B-4 trap:
# loadCatalogMaster.web.js was read by BOTH validate-catalog.js (script,
# parses VALID_CATEGORIES from the file body — file-as-data-source) AND
# validateCatalog.test.js (test). Treating them uniformly as
# FILESYSTEM-PATH-REFERENCED hides the asymmetry — a test-import-only
# consumer is migrate-then-delete; a data-source consumer requires
# refactoring the tooling FIRST.
# cf-5dto.fu1: broadened test-path regex. Matches any path with a `tests/`
# or `__tests__/` directory segment + a test-file-extension at the leaf.
# Covers: top-level tests/, cfw-style src/__tests__/, monorepo
# packages/<x>/__tests__/, packages/<x>/tests/. Extensions cover
# js/ts/tsx/jsx/mjs/cjs.
_FS_PATH_TEST_RE = re.compile(
    r"(?:^|/)(?:tests|__tests__)/.*\.(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$"
)
_FS_PATH_SCRIPT_RE = re.compile(r"^scripts/.*\.(js|ts|mjs|cjs|py|sh)$")


def classify_fs_path_consumer(rel_path: str) -> str:
    """Classify a fs-path consumer path into a v5 sub-bucket.

    Returns:
      FS-PATH-TEST-IMPORT  — `tests/*.test.{js,ts}` consumer (test-target)
      FS-PATH-DATA-SOURCE  — `scripts/*.{js,ts,py,sh,...}` consumer (tooling)
      FS-PATH-OTHER        — any other path (operator inspects manually)
    """
    # cf-5dto.fu1: search (not match) so the `(?:^|/)tests|__tests__/`
    # pattern matches embedded test directories (cfw-style src/__tests__/,
    # monorepo packages/<x>/__tests__/). Script paths stay top-level-only
    # via .match — `scripts/` directories nested under packages/ aren't
    # the tooling-data-source convention.
    if _FS_PATH_TEST_RE.search(rel_path):
        return "FS-PATH-TEST-IMPORT"
    if _FS_PATH_SCRIPT_RE.match(rel_path):
        return "FS-PATH-DATA-SOURCE"
    return "FS-PATH-OTHER"


def collect_filesystem_path_refs(files: list[Path]) -> dict[str, list[str]]:
    """Scan all source files for filesystem-path references to backend modules.

    Returns a dict mapping module basename (e.g. 'catalogImport') → list of
    relative source paths that reference it via a quoted filesystem path.
    Self-references (the defining file referencing itself) are filtered —
    only cross-file references prove an external consumer.
    """
    backend_modules: set[str] = set()
    for fp in BACKEND.rglob("*.js"):
        if not fp.is_file():
            continue
        backend_modules.add(_module_basename(str(fp.relative_to(ROOT))))

    if not backend_modules:
        return {}

    # One compiled regex per backend module — anchored on a literal module
    # name so backtracking is bounded.
    patterns = {
        mod: re.compile(FS_PATH_REF_RE_TEMPLATE.format(module=re.escape(mod)))
        for mod in backend_modules
    }

    # Also scan files outside `src/` — scripts/, tests/ are the documented
    # cf-4x7e blast site. Build a lazy file list that includes both src/ and
    # the repo-root scripts/+tests/ trees if they exist.
    scan_files: list[Path] = list(files)
    for extra_root in ("scripts", "tests"):
        extra_path = ROOT / extra_root
        if not extra_path.exists():
            continue
        for p in extra_path.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"):
                scan_files.append(p)

    refs: dict[str, list[str]] = {mod: [] for mod in backend_modules}
    for fp in scan_files:
        try:
            rel = str(fp.relative_to(ROOT))
        except ValueError:
            continue
        rel_basename = _module_basename(rel)
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        for mod, pat in patterns.items():
            if mod == rel_basename:
                continue
            if pat.search(text):
                refs[mod].append(rel)
    return refs


# cf-0ziz (cf-hpwy detector v4): module-namespace dispatcher detection.
#
# v3 closes the fs-path blind-spot. v4 closes the namespace-dispatcher
# blind-spot — http-functions.js patterns of the shape:
#
#   import * as svcModule from 'backend/<file>.web';
#   const ALLOWLIST = new Set(['methodA','methodB',...]);
#   export async function post_svc(request) {
#     const method = request.path[0];
#     if (!ALLOWLIST.has(method)) return notFound(...);
#     await svcModule[method](...args);
#   }
#
# The `svcModule[method]()` call is dynamic — name-based grep can't tie
# 'methodA' (an export of <file>.web.js) to its caller. v3 sees these
# as WRAPPED-NO-CONSUMER (no direct cfw `/_functions/methodA` URL
# match) when they're actually alive via /_functions/svc/methodA.
#
# Detection: grep http-functions.js for `import * as <id> from
# 'backend/<file>.web'`, then for each detected id grep for
# `<id>[<key>](...)` to confirm dispatcher use. If detected, every
# export of <file>.web.js gets an OK-WIRED-VIA-DISPATCHER verdict.
#
# False-positive risk: a `import * as M` that just reads metadata
# (e.g. `M.SOME_CONSTANT`) without `M[key](...)` would not match the
# dispatcher pattern, so we only flag genuine dispatchers.
DISPATCHER_IMPORT_RE = re.compile(
    r"""import\s+\*\s+as\s+(\w+)\s+from\s+['"]backend/([^'"]+?)(?:\.web)?['"]"""
)


def collect_dispatcher_modules(http_text: str) -> dict[str, str]:
    """Detect module-namespace dispatcher patterns in http-functions.js.

    Returns a dict mapping defining-file basename → dispatcher alias name.
    Only entries where the alias is later used in `<alias>[<key>](...)`
    call shape are returned — bare metadata reads (`M.CONST`) are
    filtered out so a non-dispatcher namespace import doesn't bleed
    into the OK-WIRED-VIA-DISPATCHER bucket.

    Example match:
      import * as wishlistServiceModule from 'backend/wishlistService.web';
      ...
      await wishlistServiceModule[method](...args);
    Yields: { 'wishlistService': 'wishlistServiceModule' }
    """
    out: dict[str, str] = {}
    for m in DISPATCHER_IMPORT_RE.finditer(http_text):
        alias, path = m.group(1), m.group(2)
        # Confirm the alias is used in dynamic-key access shape somewhere.
        # The discriminator is bracket-access (`alias[...]`) vs dot-access
        # (`alias.SOMETHING`) — the former is a dispatcher, the latter is
        # a metadata read. We just need to know the alias is used with a
        # bracket — perfectly parsing nested brackets like
        # `alias[request.path[0]](` is unnecessary and brittle.
        call_pat = re.compile(rf"\b{re.escape(alias)}\s*\[")
        if call_pat.search(http_text):
            module_basename = path.rsplit("/", 1)[-1]
            out[module_basename] = alias
    return out


def collect_cfw_files() -> list[Path]:
    if not CFW_SRC.exists():
        return []
    out: list[Path] = []
    for p in CFW_SRC.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix in (".js", ".jsx", ".ts", ".tsx"):
            out.append(p)
    return out


def cfw_references(name: str, cfw_files: list[Path]) -> tuple[list[str], list[str]]:
    """Return (high_confidence, low_confidence) cfw paths.

    High confidence:
      - `/_functions/<NAME>` literal URL fragment (direct fetch)
      - `method: "<...>/<NAME>"` or `method: g("<NAME>")` etc. (callVelo pattern)
    Low confidence:
      - Bare `\\bNAME\\b` reference anywhere in cfw source (could be a name
        collision with a cfw-internal symbol).
    """
    pat_word = re.compile(rf"\b{re.escape(name)}\b")
    pat_url = re.compile(rf"/_functions/(?:[A-Za-z0-9_-]+/)?{re.escape(name)}\b")
    pat_method_str = re.compile(
        rf"""method\s*:\s*[`'"](?:[A-Za-z0-9_-]+/)?{re.escape(name)}\b"""
    )
    pat_method_helper = re.compile(rf"""[gmhl]\s*\(\s*[`'"]{re.escape(name)}\b""")
    high: list[str] = []
    low: list[str] = []
    for fp in cfw_files:
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        rel = str(fp.relative_to(CFW_SRC.parent))
        if (
            pat_url.search(text)
            or pat_method_str.search(text)
            or pat_method_helper.search(text)
        ):
            high.append(rel)
        elif pat_word.search(text):
            low.append(rel)
    return high, low


# cf-eov3 (cf-hpwy v4): module-namespace dispatcher detection.
#
# When http-functions.js wires a sub-path dispatcher like:
#
#   import * as wishlistServiceModule from 'backend/wishlistService.web';
#   export async function post_wishlistService(request) {
#     const method = request.path[0];
#     if (!ALLOWLIST.has(method)) return notFound(...);
#     await wishlistServiceModule[method](...args);
#   }
#
# every export of `wishlistService.web.js` is HTTP-reachable via the
# dispatcher (cfw calls `/_functions/wishlistService/<method>` and the
# dispatcher forwards). The v3 detector caught this for ALLOWLIST sets
# whose entries are visible string literals (their `\bNAME\b` matches
# the backend export name), but a future dispatcher that derives the
# allowlist from `Object.keys(module)` or an external constants file
# would slip past the name-grep. v4 closes that gap by treating the
# dispatch call site itself as the signal and crediting every export
# of the imported module as wrapped — independent of how the
# allowlist is expressed.
NAMESPACE_IMPORT_RE = re.compile(
    r"""^\s*import\s+\*\s+as\s+(\w+)\s+from\s+['"]backend/([\w./-]+?)(?:\.web)?['"]""",
    re.MULTILINE,
)


def collect_namespace_dispatchers(http_text: str) -> set[str]:
    """Return the set of backend module basenames that are HTTP-wrapped via
    a `import * as <ns> from 'backend/<module>.web'` + `<ns>[<expr>](...)`
    dispatcher pattern.

    The detector is conservative: a namespace import alone isn't enough —
    we also require a dispatch site (`<ns>[…]` syntax) to confirm the
    namespace is actually used to forward calls. A namespace that's only
    used for dot-notation field access (`<ns>.knownMethod`) does NOT count
    as a dispatcher; those individual methods are already caught by the
    name-grep that drives `in_http`.
    """
    wrapped: set[str] = set()
    for match in NAMESPACE_IMPORT_RE.finditer(http_text):
        ns_var, module_path = match.group(1), match.group(2)
        # Bracket dispatch: <ns>[<expr>] — the load-bearing pattern.
        bracket_pat = re.compile(rf"\b{re.escape(ns_var)}\s*\[", re.MULTILINE)
        if not bracket_pat.search(http_text):
            continue
        module_basename = module_path.rsplit("/", 1)[-1]
        wrapped.add(module_basename)
    return wrapped


def classify_method(
    name: str,
    info: dict,
    files: list[Path],
    cfw_files: list[Path],
    http_text: str,
    events_text: str,
    fs_path_refs: dict[str, list[str]] | None = None,
    dispatcher_modules: dict[str, str] | None = None,
) -> dict:
    """Return classification for this webMethod."""
    defining_file = info["file"]
    pat_call = re.compile(rf"\b{re.escape(name)}\s*\(")  # NAME(... call
    pat_import = re.compile(rf"\b{re.escape(name)}\b")  # any reference (for imports)
    # cf-sq0d.fu1 (v3.1): same-name-collision filter. Detect when a candidate
    # caller defines its own function / const / let / var with the same name
    # as the backend webMethod — those are local-symbol collisions, not
    # backend callers. Two regressions surfaced this:
    #   chunk 11: src/public/AddToCart.js declares `async function checkBackInStock(...)`
    #             and was being credited as a caller of the same-named backend method.
    #   chunk 12: src/public/bundleDiscountExperiment.js declares `export function
    #             calculateBundleDiscount(...)` and was credited similarly.
    # The filter only skips a file when it has a local definition AND no
    # explicit `'backend/<module>'` import string for the defining module —
    # so a legitimate caller that re-exports a backend symbol under the same
    # local name (rare but possible) still gets counted.
    pat_local_def = re.compile(
        rf"(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+{re.escape(name)}\b"
    )
    defining_module_basename = defining_file.rsplit("/", 1)[-1]
    for suffix in (".web.js", ".js"):
        if defining_module_basename.endswith(suffix):
            defining_module_basename = defining_module_basename[: -len(suffix)]
            break
    pat_backend_import_quoted = re.compile(
        rf"""['"`](?:[\w./-]*?){re.escape(defining_module_basename)}(?:\.web)?['"`]"""
    )

    in_http = bool(
        pat_call.search(http_text) or pat_import.search(http_text)
    )
    # cf-eov3 (v4): credit methods reachable via a module-namespace
    # dispatcher even if their name doesn't appear literally in
    # http-functions.js. The defining module's basename matching the
    # dispatcher set means cfw can reach the method via
    # `/_functions/<dispatcher>/<this method>`.
    in_http_via_dispatcher = bool(
        dispatcher_modules and defining_module_basename in dispatcher_modules
    )
    if in_http_via_dispatcher:
        in_http = True
    in_events = bool(
        pat_import.search(events_text)
    )
    in_public = False
    in_pages = False
    in_pdocs_backend = False  # other backend (not defining file, not http-functions, not events)
    in_same_file = False  # NAME( call inside the defining file (excluding the export decl)
    sample_callers: list[str] = []

    for fp in files:
        rel = str(fp.relative_to(ROOT))
        if rel == defining_file:
            # v2 fix: same-file detection. Scan the defining file for NAME(
            # call sites — `pat_call` requires `\bNAME\s*\(` which excludes the
            # export declaration `export const NAME = webMethod(` (no `(` directly
            # after NAME) and excludes JSDoc / log-string mentions.
            try:
                self_text = fp.read_text(errors="ignore")
            except OSError:
                continue
            # cf-sq0d.fu2: strip comments before the same-file call check so
            # a JSDoc `@example NAME()` snippet in the defining file's own
            # docstring isn't credited as a real same-file caller.
            self_text = strip_js_comments(self_text)
            if pat_call.search(self_text):
                in_same_file = True
                if len(sample_callers) < 5:
                    sample_callers.append(f"{rel} (same-file)")
            continue
        if rel == "src/backend/http-functions.js":
            continue  # handled
        if rel == "src/backend/events.js":
            continue  # handled
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        # cf-sq0d.fu2 (v3.2): comment-strip before checking caller hits so
        # JSDoc-only mentions ("@param … from getAffiliateDashboard") don't
        # masquerade as callers. The local-def + backend-import checks below
        # still run against the stripped view for the same reason.
        stripped = strip_js_comments(text)
        if not pat_import.search(stripped):
            continue
        # cf-sq0d.fu1: skip same-name-collision callers. If the file defines
        # its own function/const with this name AND has no explicit string
        # reference to the defining backend module, the name match is local —
        # not a backend caller.
        if pat_local_def.search(stripped) and not pat_backend_import_quoted.search(stripped):
            continue
        # any reference counts; don't require call form (could be re-export, type ref)
        if rel.startswith("src/public/"):
            in_public = True
        elif rel.startswith("src/pages/"):
            in_pages = True
        elif rel.startswith("src/backend/") and rel.endswith(".web.js"):
            in_pdocs_backend = True
        elif rel.startswith("src/backend/"):
            in_pdocs_backend = True
        if len(sample_callers) < 5:
            sample_callers.append(rel)

    # cf-sq0d (v3): a file referenced by filesystem path from another module
    # is NOT dead — deleting it would ENOENT the consumer. Surface these as a
    # distinct bucket so the operator sees WHY the demotion happened (and can
    # decide whether to refactor the consumer to use a proper import).
    fs_path_consumers: list[str] = []
    if fs_path_refs:
        module_basename = _module_basename(defining_file)
        fs_path_consumers = list(fs_path_refs.get(module_basename, []))
    in_fs_path = bool(fs_path_consumers)
    # cf-5dto (v5): sub-classify each consumer so the operator sees whether
    # the file is held by tests (migrate-then-delete) vs tooling
    # (refactor-tooling-first). Sorted+deduped for stable output.
    fs_path_consumer_kinds = sorted({
        classify_fs_path_consumer(c) for c in fs_path_consumers
    })

    # cf-5dto (v5): INTENTIONAL_ANYONE allowlist propagation. A method on
    # the allowlist is kept-by-design (out-of-tree consumer like cfutons_mobile
    # is invisible to the in-tree scan). v4 only gated the SUSPICIOUS flag on
    # the allowlist; v5 also adds an explicit bucket so the row doesn't fall
    # through to DEAD just because no in-tree caller exists. The B-4 trap:
    # cartSessionService.createSession/updateCartItems bucketed DEAD despite
    # the allowlist + the mobile-rig caller.
    #
    # CR-tightening (miquella + code-reviewer + silent-failure-hunter):
    # gate on BOTH `permission == 'Anyone'` AND allowlist membership. The
    # allowlist's semantic is "this Anyone-permission endpoint has an
    # out-of-tree consumer." If a method is later hardened to Admin, the
    # allowlist entry becomes inapplicable — without the permission check
    # we'd silently keep the OK-INTENTIONAL-ANYONE classification and mask
    # the WRAPPED-NO-CONSUMER / GAP-CFW-WANTS signal that the hardening
    # may have introduced.
    qualified_early = _module_qualified_name(defining_file, name)
    is_intentional_anyone = (
        info["permission"] == "Anyone"
        and qualified_early in INTENTIONAL_ANYONE
    )

    buckets: list[str] = []
    if in_http:
        buckets.append("HTTP-EXPOSED")
    if is_intentional_anyone:
        buckets.append("HTTP-EXPOSED-INTENTIONAL")
    if in_events:
        buckets.append("EVENT-WIRED")
    if in_public or in_pages:
        buckets.append("FRONTEND")
    if in_pdocs_backend or in_same_file:
        buckets.append("INTERNAL")
    if in_fs_path:
        buckets.append("FILESYSTEM-PATH-REFERENCED")
    # cf-eov3 (v4): tag dispatcher-wrapped methods so the operator sees
    # WHY a method is HTTP-EXPOSED even though its name doesn't appear in
    # http-functions.js literally.
    if in_http_via_dispatcher:
        buckets.append("DISPATCHER-WRAPPED")
    if not buckets:
        buckets = ["DEAD"]

    # cf-quba: allowlist filter — gate the SUSPICIOUS classification so
    # known-intentional Anyone endpoints stop generating noise.
    suspicious = (
        info["permission"] == "Anyone"
        and "HTTP-EXPOSED" not in buckets
        and "HTTP-EXPOSED-INTENTIONAL" not in buckets
        and "FRONTEND" not in buckets
        and PUBLIC_VERB_RE.match(name) is not None
        and not is_intentional_anyone
    )

    cfw_high, cfw_low = cfw_references(name, cfw_files)
    has_cfw_high = bool(cfw_high)
    has_cfw_low = bool(cfw_low)
    has_cfw_any = bool(cfw_high or cfw_low)

    # cf-0ziz (v4): module-namespace dispatcher detection. If this method's
    # defining-file is dispatched as a namespace import in http-functions.js
    # (e.g. `import * as svcModule + svcModule[method](...)`), the method is
    # reachable via the dispatcher route even without a direct cfw URL match.
    in_dispatcher = False
    dispatcher_alias = ""
    if dispatcher_modules:
        module_basename = _module_basename(defining_file)
        if module_basename in dispatcher_modules:
            in_dispatcher = True
            dispatcher_alias = dispatcher_modules[module_basename]

    # Gap-finder verdict (cf-hpwy core deliverable).
    # cf-5dto silent-failure-hunter CR: the allowlist must NOT short-circuit
    # the caller-graph determinations. An allowlisted-Anyone method WITH
    # callers (cfw_high, dispatcher, frontend) should keep its OK-WIRED /
    # OK-WIRED-VIA-DISPATCHER / GAP-CFW-WANTS verdict — those signals are
    # load-bearing. OK-INTENTIONAL-ANYONE only fires as a fallback when
    # the row would otherwise be UNUSED-CAN-DELETE — i.e., the out-of-tree
    # consumer is the ONLY thing keeping the method alive.
    if in_dispatcher and not has_cfw_high:
        # v4: dispatcher route is the WIRED path even without a direct cfw URL.
        # Distinct verdict (OK-WIRED-VIA-DISPATCHER) so the operator can see
        # the dispatch path is active and the method is alive.
        gap_verdict = "OK-WIRED-VIA-DISPATCHER"
    elif not in_http and has_cfw_high:
        gap_verdict = "GAP-CFW-WANTS"  # cfw calls it via /_functions or callVelo, no HTTP wrapper
    elif in_http and has_cfw_high:
        gap_verdict = "OK-WIRED"
    elif in_http and not has_cfw_high:
        gap_verdict = "WRAPPED-NO-CONSUMER"
    elif buckets == ["DEAD"] and not has_cfw_any:
        gap_verdict = "UNUSED-CAN-DELETE"
    elif is_intentional_anyone and buckets == ["HTTP-EXPOSED-INTENTIONAL"]:
        # cf-5dto fallback: the only thing keeping this method alive is the
        # allowlist (no callers anywhere). Surface as OK-INTENTIONAL-ANYONE
        # so the operator sees the out-of-tree-consumer reasoning instead of
        # UNUSED-CAN-DELETE.
        gap_verdict = "OK-INTENTIONAL-ANYONE"
    elif has_cfw_low:
        gap_verdict = "MAYBE-CFW-NAME-COLLISION"  # bare-word match only
    else:
        gap_verdict = "VELO-INTERNAL"  # used inside Velo; cfw isn't a consumer

    return {
        "name": name,
        "file": defining_file,
        "line": info["line"],
        "permission": info["permission"],
        "bucket": buckets,
        "suspicious": suspicious,
        "gap_verdict": gap_verdict,
        "in_http": in_http,
        "in_http_via_dispatcher": in_http_via_dispatcher,
        "in_events": in_events,
        "in_public": in_public,
        "in_pages": in_pages,
        "in_other_backend": in_pdocs_backend,
        "in_same_file": in_same_file,
        "in_filesystem_path": in_fs_path,
        "filesystem_path_consumers": fs_path_consumers[:6],
        # cf-5dto (v5): sub-classification of each fs-path consumer.
        "fs_path_consumer_kinds": fs_path_consumer_kinds,
        "in_dispatcher": in_dispatcher,
        "dispatcher_alias": dispatcher_alias,
        "sample_callers": sample_callers,
        "cfw_high_refs": cfw_high[:6],
        "cfw_low_refs": cfw_low[:6],
        "cfw_high_count": len(cfw_high),
        "cfw_low_count": len(cfw_low),
    }


def main() -> int:
    files = all_source_files()
    methods = collect_web_methods()
    print(f"scanning {len(files)} src files", file=sys.stderr)
    print(f"webMethods discovered: {len(methods)}", file=sys.stderr)

    # cf-sq0d.fu2: strip JSDoc/line comments from the http and events text up
    # front so a JSDoc-only mention (e.g. `// see also: post_someName`) in
    # those files doesn't count as a wiring of NAME.
    http_text = (
        strip_js_comments(HTTP_FILE.read_text(errors="ignore")) if HTTP_FILE.exists() else ""
    )
    events_text = (
        strip_js_comments(EVENTS_FILE.read_text(errors="ignore"))
        if EVENTS_FILE.exists()
        else ""
    )
    # Also fold any *.events.js into events_text
    for fp in BACKEND.rglob("*.events.js"):
        try:
            events_text += "\n" + strip_js_comments(fp.read_text(errors="ignore"))
        except OSError:
            continue

    cfw_files = collect_cfw_files()
    print(f"cfw src files: {len(cfw_files)}", file=sys.stderr)

    # cf-sq0d (v3): scan for filesystem-path references once up front; pass
    # the result into classify_method so each row can demote DEAD → INTERNAL
    # when its defining file is read by path from elsewhere.
    fs_path_refs = collect_filesystem_path_refs(files)
    fs_path_referenced_modules = sum(1 for v in fs_path_refs.values() if v)
    print(
        f"backend modules referenced by filesystem-path: {fs_path_referenced_modules}",
        file=sys.stderr,
    )

    # cf-0ziz + cf-eov3 (v4): detect module-namespace dispatchers. Run both
    # strategies and merge: cf-0ziz catches explicit-allowlist dispatchers
    # (with alias info), cf-eov3 catches runtime-derived allowlists
    # (Object.keys, external constants). Union both into dispatcher_modules.
    dispatcher_modules = collect_dispatcher_modules(http_text)
    eov3_dispatchers = collect_namespace_dispatchers(http_text)
    for mod in eov3_dispatchers:
        if mod not in dispatcher_modules:
            dispatcher_modules[mod] = '<namespace>'
    print(
        f"backend modules wired via namespace dispatcher: {len(dispatcher_modules)}",
        file=sys.stderr,
    )
    for module_name, alias in sorted(dispatcher_modules.items()):
        print(f"  {module_name} -> {alias}", file=sys.stderr)

    rows = [
        classify_method(
            name, info, files, cfw_files, http_text, events_text,
            fs_path_refs, dispatcher_modules,
        )
        for name, info in methods.items()
    ]

    # cf-5dto (v5): inventory non-webMethod function exports. The whole point
    # of this enhancement is that operators see this list BEFORE planning a
    # whole-file delete; defining the helper without wiring it into main()
    # would make this PR's headline claim (149 surfaced) load-bearing on a
    # one-off invocation rather than the production tool. CR by miquella's
    # code-reviewer sub-agent caught this.
    non_wm_exports = collect_non_webmethod_exports()
    print(
        f"\nNon-webMethod function exports in src/backend: {len(non_wm_exports)}",
        file=sys.stderr,
    )
    print(
        "  (operator action: cross-check before any whole-file delete; "
        "underscore-prefix exports are typically test seams)",
        file=sys.stderr,
    )

    Path("/tmp/cf-dead-routes/results.json").write_text(json.dumps(rows, indent=2))
    Path("/tmp/cf-dead-routes/non_webmethod_exports.json").write_text(
        json.dumps(non_wm_exports, indent=2)
    )

    # Single-bucket tally
    primary = Counter()
    for r in rows:
        primary[r["bucket"][0]] += 1
    print("\nPrimary bucket (first match):", file=sys.stderr)
    for b, c in primary.most_common():
        print(f"  {b}: {c}", file=sys.stderr)

    multi = Counter()
    for r in rows:
        for b in r["bucket"]:
            multi[b] += 1
    print("\nAny-match tally (rows can appear in multiple):", file=sys.stderr)
    for b, c in multi.most_common():
        print(f"  {b}: {c}", file=sys.stderr)

    sus = [r for r in rows if r["suspicious"]]
    print(f"\nSUSPICIOUS (Permissions.Anyone, public-verb name, not HTTP/frontend reachable): {len(sus)}", file=sys.stderr)

    dead = [r for r in rows if r["bucket"] == ["DEAD"]]
    print(f"DEAD (no caller anywhere): {len(dead)}", file=sys.stderr)

    print("\nGap-verdict tally (cf-hpwy core):", file=sys.stderr)
    gap = Counter(r["gap_verdict"] for r in rows)
    for v, c in gap.most_common():
        print(f"  {v}: {c}", file=sys.stderr)
    gaps = [r for r in rows if r["gap_verdict"] == "GAP-CFW-WANTS"]
    if gaps:
        print(f"\n🚨 GAP-CFW-WANTS — cfw URL/callVelo references but no HTTP wrapper ({len(gaps)}):", file=sys.stderr)
        for r in gaps:
            print(f"  {r['name']:35s} {r['file']}:{r['line']}  perm={r['permission']}  cfw_high={r['cfw_high_count']}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
