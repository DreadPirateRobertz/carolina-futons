# Wix Velo MCP Server — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a custom MCP server that wraps the Wix CLI for Velo code deployment, set up the production repo, and configure both official and custom MCP servers.

**Architecture:** Three repos — carolina-futons (dev), carolina_futons_velO (prod, release-only), wix-velo-mcp (MCP server). Custom MCP exposes 5 tools via stdio transport. Official Wix MCP used as-is for site data.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, zod, execa, vitest

**Design doc:** `docs/plans/2026-03-07-velo-mcp-design.md`

---

## Task 1: Scaffold wix-velo-mcp repo

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/index.ts`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Create repo locally and initialize**

```bash
cd /Users/hal/gt/cfutons
mkdir wix-velo-mcp && cd wix-velo-mcp
git init
```

**Step 2: Create package.json**

```json
{
  "name": "wix-velo-mcp",
  "version": "0.0.0",
  "description": "MCP server for Wix Velo code deployment via Wix CLI",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "wix-velo-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "execa": "^9.5.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
*.log
.DS_Store
```

**Step 6: Create minimal src/index.ts (placeholder)**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'wix-velo-mcp',
  version: '0.0.0',
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('wix-velo-mcp running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Step 7: Install dependencies and build**

```bash
npm install
npx tsc
```

**Step 8: Create README.md**

```markdown
# wix-velo-mcp

MCP server for Wix Velo code deployment. Wraps the Wix CLI to enable AI agents to sync, preview, and publish Velo code.

## Tools

| Tool | Description |
|------|-------------|
| velo_status | Check Wix CLI auth and deployment state |
| velo_sync | Copy tagged release from dev repo to production repo |
| velo_diff | Preview what would change on sync |
| velo_preview | Generate shareable preview URL |
| velo_publish | Publish code to production |

## Configuration

Set environment variables:
- `VELO_DEV_REPO` — Path to carolina-futons dev repo
- `VELO_PROD_REPO` — Path to carolina_futons_velO production repo

## Usage with Claude Code

Add to your MCP settings:
```json
{
  "mcpServers": {
    "wix-velo": {
      "command": "node",
      "args": ["/path/to/wix-velo-mcp/dist/index.js"],
      "env": {
        "VELO_DEV_REPO": "/path/to/carolina-futons",
        "VELO_PROD_REPO": "/path/to/carolina_futons_velO"
      }
    }
  }
}
```
```

**Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold wix-velo-mcp project"
```

**Step 10: Connect to GitHub**

```bash
gh repo create DreadPirateRobertz/wix-velo-mcp --private --source=. --push
```

---

## Task 2: Create lib/exec.ts — shell execution helper

**Files:**
- Create: `src/lib/exec.ts`
- Create: `tests/exec.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/exec.test.ts
import { describe, it, expect } from 'vitest';
import { run, runInDir } from '../src/lib/exec.js';

describe('exec', () => {
  it('runs a command and returns stdout', async () => {
    const result = await run('echo', ['hello']);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('returns exit code on failure', async () => {
    const result = await run('false', []);
    expect(result.exitCode).not.toBe(0);
  });

  it('runs in specified directory', async () => {
    const result = await runInDir('/tmp', 'pwd', []);
    expect(result.stdout.trim()).toMatch(/\/tmp/);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/exec.test.ts
```
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/lib/exec.ts
import { execa, type Result } from 'execa';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a command, capturing output. Never throws — returns exit code.
 */
export async function run(cmd: string, args: string[]): Promise<ExecResult> {
  try {
    const result = await execa(cmd, args, { reject: false });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { stdout: '', stderr: msg, exitCode: 1 };
  }
}

/**
 * Run a command in a specific directory.
 */
export async function runInDir(
  cwd: string,
  cmd: string,
  args: string[],
): Promise<ExecResult> {
  try {
    const result = await execa(cmd, args, { cwd, reject: false });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode ?? 0,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { stdout: '', stderr: msg, exitCode: 1 };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/exec.test.ts
```
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/lib/exec.ts tests/exec.test.ts
git commit -m "feat: add shell execution helper with tests"
```

---

## Task 3: Create lib/config.ts — environment configuration

**Files:**
- Create: `src/lib/config.ts`
- Create: `tests/config.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/config.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../src/lib/config.js';

describe('config', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('reads VELO_DEV_REPO and VELO_PROD_REPO from env', () => {
    process.env.VELO_DEV_REPO = '/path/to/dev';
    process.env.VELO_PROD_REPO = '/path/to/prod';
    const config = getConfig();
    expect(config.devRepo).toBe('/path/to/dev');
    expect(config.prodRepo).toBe('/path/to/prod');
  });

  it('throws if VELO_DEV_REPO is missing', () => {
    delete process.env.VELO_DEV_REPO;
    process.env.VELO_PROD_REPO = '/path/to/prod';
    expect(() => getConfig()).toThrow('VELO_DEV_REPO');
  });

  it('throws if VELO_PROD_REPO is missing', () => {
    process.env.VELO_DEV_REPO = '/path/to/dev';
    delete process.env.VELO_PROD_REPO;
    expect(() => getConfig()).toThrow('VELO_PROD_REPO');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/config.test.ts
```

**Step 3: Write implementation**

```typescript
// src/lib/config.ts
export interface VeloConfig {
  devRepo: string;
  prodRepo: string;
}

/**
 * Read configuration from environment variables.
 * @throws if required env vars are missing
 */
export function getConfig(): VeloConfig {
  const devRepo = process.env.VELO_DEV_REPO;
  const prodRepo = process.env.VELO_PROD_REPO;

  if (!devRepo) {
    throw new Error('VELO_DEV_REPO environment variable is required');
  }
  if (!prodRepo) {
    throw new Error('VELO_PROD_REPO environment variable is required');
  }

  return { devRepo, prodRepo };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/config.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/config.ts tests/config.test.ts
git commit -m "feat: add environment configuration with validation"
```

---

## Task 4: Implement velo_status tool

**Files:**
- Create: `src/tools/veloStatus.ts`
- Create: `tests/veloStatus.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/veloStatus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { veloStatus } from '../src/tools/veloStatus.js';

// Mock exec module
vi.mock('../src/lib/exec.js', () => ({
  run: vi.fn().mockResolvedValue({
    stdout: 'Logged in as test@example.com',
    stderr: '',
    exitCode: 0,
  }),
  runInDir: vi.fn().mockImplementation((_cwd, cmd, args) => {
    if (cmd === 'git' && args[0] === 'status') {
      return { stdout: 'nothing to commit, working tree clean', stderr: '', exitCode: 0 };
    }
    if (cmd === 'git' && args[0] === 'describe') {
      return { stdout: 'v0.0.0', stderr: '', exitCode: 0 };
    }
    if (cmd === 'git' && args[0] === 'log') {
      return { stdout: 'abc1234 release: v0.0.0', stderr: '', exitCode: 0 };
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  }),
}));

describe('velo_status', () => {
  it('returns auth email, repo status, and current tag', async () => {
    const result = await veloStatus({
      devRepo: '/fake/dev',
      prodRepo: '/fake/prod',
    });
    expect(result).toContain('test@example.com');
    expect(result).toContain('clean');
    expect(result).toContain('v0.0.0');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/veloStatus.test.ts
```

**Step 3: Write implementation**

```typescript
// src/tools/veloStatus.ts
import { run, runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

/**
 * Check Wix CLI auth status, prod repo git state, and last deployed tag.
 */
export async function veloStatus(config: VeloConfig): Promise<string> {
  const [whoami, gitStatus, gitTag, gitLog] = await Promise.all([
    run('npx', ['wix', 'whoami']),
    runInDir(config.prodRepo, 'git', ['status', '--porcelain']),
    runInDir(config.prodRepo, 'git', ['describe', '--tags', '--abbrev=0']),
    runInDir(config.prodRepo, 'git', ['log', '-1', '--oneline']),
  ]);

  const authLine = whoami.exitCode === 0
    ? `Auth: ${whoami.stdout.trim()}`
    : `Auth: NOT LOGGED IN (run wix login)`;

  const repoState = gitStatus.stdout.trim() === ''
    ? 'Repo: clean'
    : `Repo: dirty\n${gitStatus.stdout.trim()}`;

  const currentTag = gitTag.exitCode === 0
    ? `Deployed tag: ${gitTag.stdout.trim()}`
    : 'Deployed tag: none';

  const lastCommit = `Last commit: ${gitLog.stdout.trim()}`;

  return [authLine, repoState, currentTag, lastCommit].join('\n');
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/veloStatus.test.ts
```

**Step 5: Commit**

```bash
git add src/tools/veloStatus.ts tests/veloStatus.test.ts
git commit -m "feat: add velo_status tool"
```

---

## Task 5: Implement velo_sync tool

**Files:**
- Create: `src/tools/veloSync.ts`
- Create: `tests/veloSync.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/veloSync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloSync, isValidTag } from '../src/tools/veloSync.js';

describe('isValidTag', () => {
  it('accepts semver tags', () => {
    expect(isValidTag('v0.0.0')).toBe(true);
    expect(isValidTag('v1.2.3')).toBe(true);
  });

  it('rejects non-tag refs', () => {
    expect(isValidTag('main')).toBe(false);
    expect(isValidTag('abc1234')).toBe(false);
    expect(isValidTag('feature/foo')).toBe(false);
    expect(isValidTag('')).toBe(false);
  });
});

vi.mock('../src/lib/exec.js', () => ({
  run: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
  runInDir: vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
}));

describe('veloSync', () => {
  it('rejects untagged refs', async () => {
    const result = await veloSync(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'main' },
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('tag');
  });

  it('rejects empty tag', async () => {
    const result = await veloSync(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: '' },
    );
    expect(result).toContain('ERROR');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/veloSync.test.ts
```

**Step 3: Write implementation**

```typescript
// src/tools/veloSync.ts
import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

/**
 * Validate that a ref looks like a semver release tag.
 */
export function isValidTag(tag: string): boolean {
  return TAG_PATTERN.test(tag);
}

/** Files/dirs to copy from dev to prod */
const SYNC_INCLUDES = ['src/', 'tests/', 'package.json', 'vitest.config.js'];

/** Patterns to exclude */
const SYNC_EXCLUDES = [
  '.beads/', '.git/', 'docs/', 'node_modules/', '.wix/',
  '.firecrawl/', '*.md', '.playwright-mcp/',
];

/**
 * Sync a tagged release from dev repo to production repo.
 * Only accepts semver release tags (v0.0.0, v1.2.3, etc).
 */
export async function veloSync(
  config: VeloConfig,
  input: { tag: string },
): Promise<string> {
  const { tag } = input;

  if (!isValidTag(tag)) {
    return `ERROR: "${tag}" is not a valid release tag. Must match v{major}.{minor}.{patch} (e.g., v0.0.0, v1.2.3). Only tagged releases can be synced to production.`;
  }

  // Verify tag exists in dev repo
  const tagCheck = await runInDir(config.devRepo, 'git', ['tag', '-l', tag]);
  if (tagCheck.stdout.trim() !== tag) {
    return `ERROR: Tag "${tag}" not found in dev repo at ${config.devRepo}`;
  }

  // Create a temporary worktree to checkout the tag
  const tmpDir = `/tmp/velo-sync-${tag}-${Date.now()}`;
  const worktree = await runInDir(config.devRepo, 'git', [
    'worktree', 'add', '--detach', tmpDir, tag,
  ]);
  if (worktree.exitCode !== 0) {
    return `ERROR: Failed to checkout tag ${tag}: ${worktree.stderr}`;
  }

  try {
    // Clean prod repo src/ and tests/ (keep wix.config.json, .git, node_modules)
    await runInDir(config.prodRepo, 'rm', ['-rf', 'src/', 'tests/']);

    // Copy each included path
    for (const item of SYNC_INCLUDES) {
      const srcPath = `${tmpDir}/${item}`;
      if (item.endsWith('/')) {
        await runInDir(tmpDir, 'cp', ['-r', item, `${config.prodRepo}/${item}`]);
      } else {
        await runInDir(tmpDir, 'cp', [item, `${config.prodRepo}/${item}`]);
      }
    }

    // Stage, diff, commit
    await runInDir(config.prodRepo, 'git', ['add', '-A']);
    const diff = await runInDir(config.prodRepo, 'git', ['diff', '--cached', '--stat']);

    if (diff.stdout.trim() === '') {
      return `No changes to sync — production repo already matches ${tag}`;
    }

    const commit = await runInDir(config.prodRepo, 'git', [
      'commit', '-m', `release: ${tag}`,
    ]);

    if (commit.exitCode !== 0) {
      return `ERROR: Failed to commit: ${commit.stderr}`;
    }

    // Push to remote
    const push = await runInDir(config.prodRepo, 'git', ['push']);
    const pushStatus = push.exitCode === 0
      ? 'Pushed to remote.'
      : `WARNING: Push failed: ${push.stderr}`;

    return `Synced ${tag} to production repo.\n\n${diff.stdout.trim()}\n\n${pushStatus}`;
  } finally {
    // Clean up worktree
    await runInDir(config.devRepo, 'git', ['worktree', 'remove', '--force', tmpDir]);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/veloSync.test.ts
```

**Step 5: Commit**

```bash
git add src/tools/veloSync.ts tests/veloSync.test.ts
git commit -m "feat: add velo_sync tool — tagged releases only"
```

---

## Task 6: Implement velo_diff tool

**Files:**
- Create: `src/tools/veloDiff.ts`
- Create: `tests/veloDiff.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/veloDiff.test.ts
import { describe, it, expect, vi } from 'vitest';
import { veloDiff } from '../src/tools/veloDiff.js';

vi.mock('../src/lib/exec.js', () => ({
  runInDir: vi.fn().mockImplementation((_cwd, cmd, args) => {
    if (cmd === 'git' && args[0] === 'tag') {
      return { stdout: 'v0.0.0\nv0.1.0', stderr: '', exitCode: 0 };
    }
    if (cmd === 'git' && args[0] === 'describe') {
      return { stdout: 'v0.1.0', stderr: '', exitCode: 0 };
    }
    return { stdout: '3 files changed', stderr: '', exitCode: 0 };
  }),
}));

describe('velo_diff', () => {
  it('rejects invalid tag', async () => {
    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'main' },
    );
    expect(result).toContain('ERROR');
  });

  it('shows diff for valid tag', async () => {
    const result = await veloDiff(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { tag: 'v0.1.0' },
    );
    expect(result).toBeDefined();
  });
});
```

**Step 2: Run test, verify failure, implement**

```typescript
// src/tools/veloDiff.ts
import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';
import { isValidTag } from './veloSync.js';

/**
 * Show what would change in prod repo if synced to a given tag.
 * Defaults to latest tag in dev repo if no tag specified.
 */
export async function veloDiff(
  config: VeloConfig,
  input: { tag?: string },
): Promise<string> {
  let tag = input.tag;

  if (!tag) {
    const latest = await runInDir(config.devRepo, 'git', [
      'describe', '--tags', '--abbrev=0',
    ]);
    if (latest.exitCode !== 0) {
      return 'ERROR: No tags found in dev repo';
    }
    tag = latest.stdout.trim();
  }

  if (!isValidTag(tag)) {
    return `ERROR: "${tag}" is not a valid release tag.`;
  }

  const tagCheck = await runInDir(config.devRepo, 'git', ['tag', '-l', tag]);
  if (tagCheck.stdout.trim() !== tag) {
    return `ERROR: Tag "${tag}" not found in dev repo`;
  }

  // Use git diff between the tag and current prod HEAD for relevant paths
  // Since they're separate repos, we diff by creating a temp worktree and using rsync --dry-run
  const tmpDir = `/tmp/velo-diff-${tag}-${Date.now()}`;
  const worktree = await runInDir(config.devRepo, 'git', [
    'worktree', 'add', '--detach', tmpDir, tag,
  ]);
  if (worktree.exitCode !== 0) {
    return `ERROR: Failed to checkout tag ${tag}: ${worktree.stderr}`;
  }

  try {
    // Use rsync dry-run to show what would change
    const diff = await runInDir(tmpDir, 'rsync', [
      '-rn', '--delete', '--itemize-changes',
      '--include=src/***', '--include=tests/***',
      '--include=package.json', '--include=vitest.config.js',
      '--exclude=*',
      './', `${config.prodRepo}/`,
    ]);

    if (diff.stdout.trim() === '') {
      return `No differences — production repo already matches ${tag}`;
    }

    return `Changes if synced to ${tag}:\n\n${diff.stdout.trim()}`;
  } finally {
    await runInDir(config.devRepo, 'git', ['worktree', 'remove', '--force', tmpDir]);
  }
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run tests/veloDiff.test.ts
git add src/tools/veloDiff.ts tests/veloDiff.test.ts
git commit -m "feat: add velo_diff tool — preview changes before sync"
```

---

## Task 7: Implement velo_preview tool

**Files:**
- Create: `src/tools/veloPreview.ts`
- Create: `tests/veloPreview.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/veloPreview.test.ts
import { describe, it, expect, vi } from 'vitest';
import { veloPreview } from '../src/tools/veloPreview.js';

vi.mock('../src/lib/exec.js', () => ({
  runInDir: vi.fn().mockResolvedValue({
    stdout: 'Preview is ready at https://preview.wixsite.com/my-site-1',
    stderr: '',
    exitCode: 0,
  }),
}));

describe('velo_preview', () => {
  it('returns preview URL on success', async () => {
    const result = await veloPreview({ devRepo: '/fake/dev', prodRepo: '/fake/prod' });
    expect(result).toContain('https://');
    expect(result).toContain('preview');
  });
});
```

**Step 2: Implement**

```typescript
// src/tools/veloPreview.ts
import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

/**
 * Generate a shareable preview URL using wix preview.
 */
export async function veloPreview(config: VeloConfig): Promise<string> {
  const result = await runInDir(config.prodRepo, 'npx', [
    'wix', 'preview', '--source', 'local',
  ]);

  if (result.exitCode !== 0) {
    return `ERROR: Preview failed.\n${result.stderr}\n${result.stdout}`;
  }

  return result.stdout.trim();
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run tests/veloPreview.test.ts
git add src/tools/veloPreview.ts tests/veloPreview.test.ts
git commit -m "feat: add velo_preview tool"
```

---

## Task 8: Implement velo_publish tool

**Files:**
- Create: `src/tools/veloPublish.ts`
- Create: `tests/veloPublish.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/veloPublish.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { veloPublish } from '../src/tools/veloPublish.js';

const mockRunInDir = vi.fn();

vi.mock('../src/lib/exec.js', () => ({
  runInDir: (...args: unknown[]) => mockRunInDir(...args),
}));

describe('velo_publish', () => {
  beforeEach(() => {
    mockRunInDir.mockReset();
  });

  it('rejects dirty worktree', async () => {
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'M src/pages/Home.js',
      stderr: '',
      exitCode: 0,
    });

    const result = await veloPublish(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { force: false },
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('uncommitted');
  });

  it('aborts if tests fail', async () => {
    // Clean worktree
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // Tests fail
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'FAIL tests/foo.test.js',
      stderr: '',
      exitCode: 1,
    });

    const result = await veloPublish(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { force: false },
    );
    expect(result).toContain('ERROR');
    expect(result).toContain('test');
  });

  it('publishes when clean and tests pass', async () => {
    // Clean worktree
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // Tests pass
    mockRunInDir.mockResolvedValueOnce({ stdout: '100 passed', stderr: '', exitCode: 0 });
    // Publish succeeds
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Site published successfully',
      stderr: '',
      exitCode: 0,
    });

    const result = await veloPublish(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { force: false },
    );
    expect(result).toContain('published');
  });

  it('skips tests when force=true', async () => {
    // Clean worktree
    mockRunInDir.mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 });
    // Publish succeeds (no test step)
    mockRunInDir.mockResolvedValueOnce({
      stdout: 'Site published successfully',
      stderr: '',
      exitCode: 0,
    });

    const result = await veloPublish(
      { devRepo: '/fake/dev', prodRepo: '/fake/prod' },
      { force: true },
    );
    expect(result).toContain('published');
    expect(mockRunInDir).toHaveBeenCalledTimes(2); // git status + publish only
  });
});
```

**Step 2: Implement**

```typescript
// src/tools/veloPublish.ts
import { runInDir } from '../lib/exec.js';
import type { VeloConfig } from '../lib/config.js';

/**
 * Publish production repo to live Wix site.
 * Checks worktree is clean, runs tests (unless force), then publishes.
 */
export async function veloPublish(
  config: VeloConfig,
  input: { force?: boolean },
): Promise<string> {
  // Check for dirty worktree
  const status = await runInDir(config.prodRepo, 'git', ['status', '--porcelain']);
  if (status.stdout.trim() !== '') {
    return `ERROR: Production repo has uncommitted changes. Commit or stash before publishing.\n${status.stdout.trim()}`;
  }

  // Run tests (unless force)
  if (!input.force) {
    const tests = await runInDir(config.prodRepo, 'npx', ['vitest', 'run']);
    if (tests.exitCode !== 0) {
      return `ERROR: Tests failed — publish aborted.\n${tests.stdout}\n${tests.stderr}`;
    }
  }

  // Publish
  const publish = await runInDir(config.prodRepo, 'npx', [
    'wix', 'publish', '--source', 'local', '-y',
  ]);

  if (publish.exitCode !== 0) {
    return `ERROR: Publish failed.\n${publish.stderr}\n${publish.stdout}`;
  }

  return `Site published successfully.\n${publish.stdout.trim()}`;
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run tests/veloPublish.test.ts
git add src/tools/veloPublish.ts tests/veloPublish.test.ts
git commit -m "feat: add velo_publish tool — tests-first, clean worktree required"
```

---

## Task 9: Wire all tools into MCP server

**Files:**
- Modify: `src/index.ts`

**Step 1: Update src/index.ts to register all 5 tools**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getConfig } from './lib/config.js';
import { veloStatus } from './tools/veloStatus.js';
import { veloSync } from './tools/veloSync.js';
import { veloDiff } from './tools/veloDiff.js';
import { veloPreview } from './tools/veloPreview.js';
import { veloPublish } from './tools/veloPublish.js';

const server = new McpServer({
  name: 'wix-velo-mcp',
  version: '0.0.0',
});

const config = getConfig();

server.registerTool(
  'velo_status',
  {
    description: 'Check Wix CLI auth status, production repo state, and current deployed tag',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloStatus(config);
    return { content: [{ type: 'text', text: result }] };
  },
);

server.registerTool(
  'velo_sync',
  {
    description: 'Sync a tagged release from dev repo to production repo. Only accepts semver release tags (v0.0.0, v1.2.3). Copies src/, tests/, package.json, vitest.config.js.',
    inputSchema: z.object({
      tag: z.string().describe('Release tag to sync (e.g., v0.0.0, v1.2.3)'),
    }),
  },
  async ({ tag }) => {
    const result = await veloSync(config, { tag });
    return { content: [{ type: 'text', text: result }] };
  },
);

server.registerTool(
  'velo_diff',
  {
    description: 'Show what would change in production repo if synced to a given tag. Defaults to latest tag.',
    inputSchema: z.object({
      tag: z.string().optional().describe('Release tag to diff against (defaults to latest)'),
    }),
  },
  async ({ tag }) => {
    const result = await veloDiff(config, { tag });
    return { content: [{ type: 'text', text: result }] };
  },
);

server.registerTool(
  'velo_preview',
  {
    description: 'Generate a shareable preview URL for the production site using wix preview',
    inputSchema: z.object({}),
  },
  async () => {
    const result = await veloPreview(config);
    return { content: [{ type: 'text', text: result }] };
  },
);

server.registerTool(
  'velo_publish',
  {
    description: 'Publish production repo code to live Wix site. Checks for clean worktree, runs tests first (unless force=true), then publishes.',
    inputSchema: z.object({
      force: z.boolean().optional().default(false).describe('Skip test run before publishing'),
    }),
  },
  async ({ force }) => {
    const result = await veloPublish(config, { force });
    return { content: [{ type: 'text', text: result }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('wix-velo-mcp running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Step 2: Build and verify**

```bash
npx tsc
npx vitest run
```
Expected: All tests pass, build succeeds

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: wire all 5 tools into MCP server entry point"
```

---

## Task 10: Set up carolina_futons_velO with v0.0.0 code

**Step 1: Clone the empty prod repo**

```bash
cd /Users/hal/gt/cfutons
gh repo clone DreadPirateRobertz/carolina_futons_velO
cd carolina_futons_velO
```

**Step 2: Copy v0.0.0 release code from dev repo**

The dev repo is at `/Users/hal/gt/cfutons/refinery/rig` and v0.0.0 is tagged.

```bash
DEV_REPO=/Users/hal/gt/cfutons/refinery/rig

# Checkout v0.0.0 in a temp worktree
cd $DEV_REPO
git worktree add --detach /tmp/velo-v000 v0.0.0

# Copy release files to velO
cd /Users/hal/gt/cfutons/carolina_futons_velO
cp -r /tmp/velo-v000/src .
cp -r /tmp/velo-v000/tests .
cp /tmp/velo-v000/package.json .
cp /tmp/velo-v000/vitest.config.js .

# Clean up worktree
cd $DEV_REPO
git worktree remove --force /tmp/velo-v000
```

**Step 3: Create .gitignore**

```
node_modules/
.wix/
.beads/
.firecrawl/
*.log
.DS_Store
dist/
```

**Step 4: Verify wix.config.json exists**

The overseer said the repo is already hooked up to the Wix site. Check if `wix.config.json` exists. If not, it will be generated when Wix GitHub integration syncs.

```bash
ls wix.config.json  # Should exist if Wix integration is connected
```

If it doesn't exist, run `npx wix dev` briefly to generate it, then stop.

**Step 5: Install dependencies and run tests**

```bash
npm install
npx vitest run
```
Expected: All 11,067 tests pass

**Step 6: Commit and push**

```bash
git add -A
git commit -m "release: v0.0.0 — initial production deployment from carolina-futons"
git push
```

**Step 7: Tag**

```bash
git tag v0.0.0
git push --tags
```

---

## Task 11: Configure MCP servers in Claude Code

**Step 1: Add official Wix MCP + custom Velo MCP to settings**

Edit the appropriate Claude Code MCP settings file (check `~/.claude/settings.json` or project-level `.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "wix-mcp": {
      "command": "npx",
      "args": ["-y", "@wix/mcp-remote@latest", "https://mcp.wix.com/mcp"]
    },
    "wix-velo": {
      "command": "node",
      "args": ["/Users/hal/gt/cfutons/wix-velo-mcp/dist/index.js"],
      "env": {
        "VELO_DEV_REPO": "/Users/hal/gt/cfutons/refinery/rig",
        "VELO_PROD_REPO": "/Users/hal/gt/cfutons/carolina_futons_velO"
      }
    }
  }
}
```

**Step 2: Restart Claude Code to pick up MCP changes**

**Step 3: Verify tools appear**

In a new Claude Code session, the following tools should be available:
- Official: ListWixSites, CallWixSiteAPI, ManageWixSite, etc.
- Custom: velo_status, velo_sync, velo_diff, velo_preview, velo_publish

---

## Task 12: End-to-end verification

**Step 1: Run velo_status**

Verify: shows logged-in email, clean repo, v0.0.0 tag

**Step 2: Run velo_diff with tag v0.0.0**

Verify: "No differences — production repo already matches v0.0.0"

**Step 3: Run velo_preview**

Verify: returns a preview URL

**Step 4: Run velo_publish**

Verify: tests pass, publish succeeds, site is live

**Step 5: Test official Wix MCP**

Run ListWixSites — verify "My Site 2" appears
Run GetBusinessDetails — verify site info returns

**Step 6: Tag wix-velo-mcp v0.0.0**

```bash
cd /Users/hal/gt/cfutons/wix-velo-mcp
gh release create v0.0.0 --title "v0.0.0 — Initial release" --notes "5 tools: velo_status, velo_sync, velo_diff, velo_preview, velo_publish"
```

**Step 7: Commit**

All repos should be clean with v0.0.0 tags:
- carolina-futons: v0.0.0 (already tagged)
- carolina_futons_velO: v0.0.0
- wix-velo-mcp: v0.0.0
