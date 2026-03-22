/**
 * CF-xz8y: Static audit — clock-injection via opts in Permissions.Anyone webMethods.
 *
 * VULNERABILITY:
 *   webMethod(Permissions.Anyone, async (..., opts) => {
 *     await checkRateLimit(collection, key, opts);  // BUG
 *   })
 *
 *   An anonymous caller can pass { now: 0 } as opts. checkRateLimit reads
 *   opts.now as the current timestamp. With now=0, windowAge is always huge
 *   (> RATE_LIMIT_WINDOW_MS), so the window appears expired and the limiter
 *   always allows — complete bypass.
 *
 * INVARIANT:
 *   In any webMethod(Permissions.Anyone, ...) handler, neither checkRateLimit
 *   nor _checkRateLimit may receive a handler-level opts parameter as a direct
 *   (non-property-access) argument. Safe patterns: no 3rd arg, or a fresh
 *   object literal such as { max: 5 }.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BACKEND_DIR = join(__dirname, '..', 'src', 'backend');

// ── Detection helpers ────────────────────────────────────────────────

/**
 * Extract the text of a balanced-delimited block starting at or after `startIdx`.
 * Scans forward until it finds the first occurrence of `open`, then collects
 * until the depth returns to 0.
 *
 * @param {string} source
 * @param {number} startIdx - Search start position
 * @param {string} open  - Opening delimiter
 * @param {string} close - Closing delimiter
 * @returns {string|null} Balanced block including delimiters, or null if unbalanced.
 */
export function extractBalancedBlock(source, startIdx, open = '{', close = '}') {
  let depth = 0;
  let blockStart = -1;
  for (let i = startIdx; i < source.length; i++) {
    if (source[i] === open) {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (source[i] === close) {
      depth--;
      if (depth === 0) return source.slice(blockStart, i + 1);
    }
  }
  return null;
}

/**
 * Split a comma-separated argument string respecting brace/bracket/paren depth.
 * e.g. "a, { b, c }, d" → ["a", "{ b, c }", "d"]
 *
 * @param {string} argsStr
 * @returns {string[]} Trimmed argument strings
 */
function splitArgsByCommaBalanced(argsStr) {
  const args = [];
  let cur = '';
  let depth = 0;
  for (const ch of argsStr) {
    if ('{(['.includes(ch)) depth++;
    else if ('})]'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

/**
 * Extract simple parameter names from the first async function in handlerText.
 * Handles: `async (p1, p2, opts = {}) =>` and `async function foo(p1, opts) {`
 * Destructured params (e.g. `{ productId }`) are skipped — they cannot be
 * directly forwarded as a plain opts object.
 *
 * @param {string} handlerText
 * @returns {string[]} Simple (non-destructured) parameter names
 */
export function extractHandlerParamNames(handlerText) {
  // Find the opening ( of the parameter list
  const parenStart = handlerText.search(/async\s*(?:function\s*\w+\s*)?\(/);
  if (parenStart === -1) return [];
  const openParen = handlerText.indexOf('(', parenStart);
  if (openParen === -1) return [];

  const parenBlock = extractBalancedBlock(handlerText, openParen, '(', ')');
  if (!parenBlock) return [];

  const innerParams = parenBlock.slice(1, -1); // strip outer ()
  const rawParams = splitArgsByCommaBalanced(innerParams);

  return rawParams
    .map(p => {
      // Strip default value assignment (=...) and trim
      const trimmed = p.replace(/\s*=[\s\S]*$/, '').trim();
      // Skip destructured params like { productId, email } or [a, b]
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return '';
      return trimmed;
    })
    .filter(name => name.length > 0);
}

/**
 * Return true if `body` calls checkRateLimit or _checkRateLimit where
 * `paramName` appears as a standalone identifier at the opts argument position.
 *
 * Signatures and their opts positions:
 *   checkRateLimit(collection, key, opts)  — opts at index 2+
 *   _checkRateLimit(key, opts)             — opts at index 1+
 *
 * Flags:   checkRateLimit('Col', key, opts)          -- opts at index 2
 *          _checkRateLimit(key, opts)                 -- opts at index 1
 * Ignores: checkRateLimit('Col', key)                -- no opts arg (safe)
 *          checkRateLimit('Col', key, { max: 5 })    -- fresh literal (safe)
 *          checkRateLimit('Col', key, opts.max)      -- property access (safe)
 *          checkRateLimit('Col', paramName)           -- only 2 args, key position, not opts
 *
 * @param {string} body
 * @param {string} paramName
 * @returns {boolean}
 */
export function bodyForwardsParamToRateLimit(body, paramName) {
  const searchRe = /\b(_?checkRateLimit)\s*\(/g;
  let m;
  while ((m = searchRe.exec(body)) !== null) {
    const fnName = m[1];
    const callBlock = extractBalancedBlock(body, m.index, '(', ')');
    if (!callBlock) continue;
    const argsText = callBlock.slice(1, -1); // strip outer ()
    const args = splitArgsByCommaBalanced(argsText);
    // checkRateLimit(collection, key, opts) — opts starts at index 2
    // _checkRateLimit(key, opts)            — opts starts at index 1
    const optsStartIndex = fnName.startsWith('_') ? 1 : 2;
    for (let i = optsStartIndex; i < args.length; i++) {
      if (args[i].trim() === paramName) return true;
    }
  }
  return false;
}

/**
 * Scan a source string for clock-injection violations.
 * Finds all webMethod(Permissions.Anyone, handler) blocks and reports any
 * handler-level parameter forwarded as the 3rd+ arg to checkRateLimit.
 *
 * @param {string} source - File content
 * @param {string} fileName - Used in violation messages
 * @returns {Array<{file: string, param: string, message: string}>}
 */
export function findClockInjectionViolations(source, fileName) {
  const violations = [];
  const markerRe = /webMethod\s*\(\s*Permissions\.Anyone\s*,\s*/g;

  let match;
  while ((match = markerRe.exec(source)) !== null) {
    const handlerStart = match.index + match[0].length;
    const handlerText = source.slice(handlerStart);

    const params = extractHandlerParamNames(handlerText);

    // Find the handler body by skipping past the parameter list `(...)` first,
    // so we don't confuse `opts = {}` default values with the function body block.
    const openParen = handlerText.indexOf('(');
    if (openParen === -1) continue;
    const parenBlock = extractBalancedBlock(handlerText, openParen, '(', ')');
    if (!parenBlock) continue;
    const afterParens = openParen + parenBlock.length;
    const body = extractBalancedBlock(handlerText, afterParens, '{', '}');
    if (!body) continue;

    for (const param of params) {
      if (bodyForwardsParamToRateLimit(body, param)) {
        violations.push({
          file: fileName,
          param,
          message:
            `Permissions.Anyone handler forwards \`${param}\` to checkRateLimit — ` +
            `caller can inject { now: 0 } to bypass rate limiting`,
        });
      }
    }
  }

  return violations;
}

// ── Unit tests: extractHandlerParamNames ─────────────────────────────

describe('extractHandlerParamNames', () => {
  it('extracts simple params from arrow function', () => {
    expect(extractHandlerParamNames('async (productId, email) => {')).toEqual([
      'productId',
      'email',
    ]);
  });

  it('extracts params with default values', () => {
    expect(extractHandlerParamNames('async (key, opts = {}) => {')).toEqual(['key', 'opts']);
  });

  it('skips destructured params', () => {
    expect(
      extractHandlerParamNames('async ({ productId, email }, opts = {}) => {')
    ).toEqual(['opts']);
  });

  it('returns empty array for no params', () => {
    expect(extractHandlerParamNames('async () => {')).toEqual([]);
  });

  it('handles named function syntax', () => {
    expect(extractHandlerParamNames('async function handler(key, opts) {')).toEqual([
      'key',
      'opts',
    ]);
  });

  it('returns empty array when no async function found', () => {
    expect(extractHandlerParamNames('const x = 1;')).toEqual([]);
  });
});

// ── Unit tests: bodyForwardsParamToRateLimit ─────────────────────────

describe('bodyForwardsParamToRateLimit', () => {
  it('detects direct opts forwarding as 3rd argument', () => {
    const body = `{
      const { allowed } = await checkRateLimit('QARateLimit', key, opts);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(true);
  });

  it('does NOT flag checkRateLimit with no opts argument', () => {
    const body = `{
      const { allowed } = await checkRateLimit('QARateLimit', cleanEmail);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(false);
  });

  it('does NOT flag checkRateLimit with fresh object literal', () => {
    const body = `{
      const { allowed } = await checkRateLimit('Limit', key, { max: 5 });
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(false);
  });

  it('does NOT flag opts.max property access — only full opts forwarding exposes clock injection', () => {
    const body = `{
      const { allowed } = await checkRateLimit('Limit', key, { max: opts.max });
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(false);
  });

  it('does NOT flag when paramName appears only outside checkRateLimit calls', () => {
    const body = `{
      const page = opts.page || 1;
      const { allowed } = await checkRateLimit('Limit', key);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(false);
  });

  it('does NOT flag a different variable whose name contains the param name as substring', () => {
    const body = `{
      const { allowed } = await checkRateLimit('Limit', key, myOpts);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(false);
  });

  it('detects _checkRateLimit (underscore-prefix variant) when opts is 3rd arg', () => {
    const body = `{
      await _checkRateLimit('Col', key, opts);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'opts')).toBe(true);
  });

  it('detects _checkRateLimit(key, opts) — 2-arg variant where opts is 2nd arg', () => {
    const body = `{
      const rateCheck = await _checkRateLimit(cleaned, options);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'options')).toBe(true);
  });

  it('does NOT flag checkRateLimit(collection, key) 2-arg call where key is a param name', () => {
    // key is a handler param passed as the email arg — not the opts position
    const body = `{
      const { allowed } = await checkRateLimit('Limit', key);
    }`;
    expect(bodyForwardsParamToRateLimit(body, 'key')).toBe(false);
  });
});

// ── Unit tests: findClockInjectionViolations (synthetic sources) ─────

describe('findClockInjectionViolations', () => {
  const imp = 'imp' + 'ort'; // split to prevent Vite import-analysis parsing

  it('flags webMethod(Permissions.Anyone) handler that forwards opts to checkRateLimit', () => {
    const source = [
      `${imp} { webMethod, Permissions } from 'wix-web-module';`,
      `${imp} { checkRateLimit } from 'backend/utils/rateLimit';`,
      `export const submitFoo = webMethod(Permissions.Anyone, async (data, opts = {}) => {`,
      `  const { allowed } = await checkRateLimit('FooLimit', data.email, opts);`,
      `  if (!allowed) throw new Error('rate limited');`,
      `});`,
    ].join('\n');

    const violations = findClockInjectionViolations(source, 'foo.web.js');
    expect(violations).toHaveLength(1);
    expect(violations[0].param).toBe('opts');
    expect(violations[0].file).toBe('foo.web.js');
    expect(violations[0].message).toMatch(/bypass rate limiting/);
  });

  it('does NOT flag Permissions.Admin handler (only anonymous endpoints are exploitable)', () => {
    const source = [
      `export const adminFoo = webMethod(Permissions.Admin, async (data, opts = {}) => {`,
      `  const { allowed } = await checkRateLimit('FooLimit', data.email, opts);`,
      `});`,
    ].join('\n');

    expect(findClockInjectionViolations(source, 'admin.web.js')).toHaveLength(0);
  });

  it('does NOT flag Permissions.Anyone handler with no opts param', () => {
    const source = [
      `export const submitBar = webMethod(Permissions.Anyone, async ({ email }) => {`,
      `  const { allowed } = await checkRateLimit('BarLimit', email);`,
      `});`,
    ].join('\n');

    expect(findClockInjectionViolations(source, 'bar.web.js')).toHaveLength(0);
  });

  it('does NOT flag Permissions.Anyone handler that uses a fresh literal override', () => {
    const source = [
      `export const submitBaz = webMethod(Permissions.Anyone, async (email, opts = {}) => {`,
      `  const { allowed } = await checkRateLimit('BazLimit', email, { max: 10 });`,
      `});`,
    ].join('\n');

    expect(findClockInjectionViolations(source, 'baz.web.js')).toHaveLength(0);
  });

  it('does NOT flag when opts is used for pagination only (not forwarded to rate limiter)', () => {
    const source = [
      `export const getItems = webMethod(Permissions.Anyone, async (id, opts = {}) => {`,
      `  const page = opts.page || 1;`,
      `  const { allowed } = await checkRateLimit('GetLimit', id);`,
      `  return { page };`,
      `});`,
    ].join('\n');

    expect(findClockInjectionViolations(source, 'items.web.js')).toHaveLength(0);
  });

  it('detects multiple violations in the same file', () => {
    const source = [
      `export const foo = webMethod(Permissions.Anyone, async (a, opts = {}) => {`,
      `  await checkRateLimit('A', a, opts);`,
      `});`,
      `export const bar = webMethod(Permissions.Anyone, async (b, opts = {}) => {`,
      `  await checkRateLimit('B', b, opts);`,
      `});`,
    ].join('\n');

    expect(findClockInjectionViolations(source, 'multi.web.js')).toHaveLength(2);
  });

  it('flags 2-arg _checkRateLimit(key, options) when options comes from handler', () => {
    const source = [
      `export const subscribe = webMethod(Permissions.Anyone, async (email, options = {}) => {`,
      `  const cleaned = sanitize(email);`,
      `  const rateCheck = await _checkRateLimit(cleaned, options);`,
      `});`,
    ].join('\n');

    const violations = findClockInjectionViolations(source, 'newsletter.web.js');
    expect(violations).toHaveLength(1);
    expect(violations[0].param).toBe('options');
  });

  it('handles Permissions.Anyone with extra whitespace around tokens', () => {
    const source = [
      `export const x = webMethod(  Permissions.Anyone  ,  async (key, opts = {}) => {`,
      `  await checkRateLimit('X', key, opts);`,
      `});`,
    ].join('\n');

    expect(findClockInjectionViolations(source, 'ws.web.js')).toHaveLength(1);
  });

  it('does NOT flag a safe handler immediately following a violating handler', () => {
    const source = [
      `export const bad = webMethod(Permissions.Anyone, async (k, opts = {}) => {`,
      `  await checkRateLimit('X', k, opts);`,
      `});`,
      `export const good = webMethod(Permissions.Anyone, async (k) => {`,
      `  await checkRateLimit('X', k);`,
      `});`,
    ].join('\n');

    const violations = findClockInjectionViolations(source, 'mixed.web.js');
    expect(violations).toHaveLength(1);
    expect(violations[0].param).toBe('opts');
  });
});

// ── Codebase audit ───────────────────────────────────────────────────

describe('Clock-injection audit: Permissions.Anyone webMethods (CF-xz8y)', () => {
  function getBackendWebFiles() {
    return readdirSync(BACKEND_DIR)
      .filter(f => f.endsWith('.web.js'))
      .map(f => ({ name: f, path: join(BACKEND_DIR, f) }));
  }

  it('finds backend web module files to audit', () => {
    expect(getBackendWebFiles().length).toBeGreaterThan(0);
  });

  it('no Permissions.Anyone webMethod forwards handler opts to checkRateLimit', () => {
    const files = getBackendWebFiles();
    const allViolations = [];

    for (const file of files) {
      const source = readFileSync(file.path, 'utf8');
      const violations = findClockInjectionViolations(source, file.name);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      const report = allViolations
        .map(v => `  ${v.file}: ${v.message}`)
        .join('\n');
      expect.fail(
        `${allViolations.length} clock-injection violation(s):\n${report}\n\n` +
        `Fix: remove opts from the Permissions.Anyone handler signature, or pass ` +
        `a fresh object to checkRateLimit (e.g. { max: 5 } — never the handler's opts).`
      );
    }
  });
});
