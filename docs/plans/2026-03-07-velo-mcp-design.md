# Wix Velo MCP Server — Design Document

**Date:** 2026-03-07
**Author:** melania (Production Manager)
**Status:** Approved by overseer

---

## Problem

We write Wix Velo code in carolina-futons but have no automated way to deploy it to a live Wix site. The official Wix MCP handles site data (collections, eCommerce, members) but has zero support for Velo code deployment. The Wix CLI can publish code but isn't exposed as MCP tools.

## Solution

Three-repo architecture with official + custom MCP servers:

1. **carolina-futons** (existing) — Dev repo, bleeding edge, active development
2. **carolina_futons_velO** (new, exists on GitHub, connected to "My Site 2") — Production repo, receives only tagged release code
3. **wix-velo-mcp** (new) — Custom MCP server wrapping Wix CLI for code deployment

## Release Flow

```
carolina-futons (dev) → tag release → velo_sync → carolina_futons_velO (prod)
                                                          ↓
                                                   Wix GitHub Integration
                                                          ↓
                                                   "My Site 2" (live)
                                                          ↓
                                                   velo_publish → production
```

1. Dev work on carolina-futons feature branches, merge to main
2. Tag a release (e.g., v0.1.0) on carolina-futons when stable
3. `velo_sync` copies ONLY tagged release code to carolina_futons_velO, commits
4. Wix GitHub integration auto-syncs velO main to Wix editor
5. `velo_publish` runs `wix publish` to push code live

**Critical rule:** Only tagged releases flow to velO. Main on carolina-futons is bleeding edge dev.

## Repository Architecture

```
DreadPirateRobertz/
├── carolina-futons          ← Dev (existing)
│   └── tags: v0.0.0, v0.1.0, ...
│
├── carolina_futons_velO     ← Production (exists, connected to "My Site 2")
│   ├── src/pages/
│   ├── src/public/
│   ├── src/backend/
│   ├── tests/
│   ├── wix.config.json      ← "My Site 2" siteId
│   ├── package.json
│   └── vitest.config.js
│
└── wix-velo-mcp             ← Custom MCP server (new)
    ├── src/
    │   ├── index.ts          ← stdio transport entry
    │   ├── tools/            ← 5 tool implementations
    │   └── lib/              ← CLI wrapper, git helpers
    ├── tests/
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

## What Gets Copied to velO

**Included:** src/, tests/, package.json, vitest.config.js, .gitignore
**Excluded:** .beads/, .git/, docs/, *.md (CLAUDE.md, hookup audits, memory, Gas Town artifacts), .wix/, node_modules/, .firecrawl/

## Custom MCP Server: wix-velo-mcp

**Transport:** stdio (spawned by Claude Code as local process)
**Language:** TypeScript
**Dependencies:** @modelcontextprotocol/sdk, execa

### Tools

| Tool | Input | Action | Output |
|------|-------|--------|--------|
| velo_status | none | `wix whoami` + git status of velO repo + last deployed tag | Auth email, repo state, deployed version |
| velo_sync | `{ tag: "v0.0.0" }` | Checkout tag from dev repo, copy src/tests/config to velO, commit as `release: <tag>` | Diff summary, commit hash |
| velo_diff | `{ tag?: "v0.1.0" }` | Show what would change in velO if synced (defaults to latest tag) | File-level diff stats |
| velo_preview | none | `wix preview --source local` from velO repo | Preview URL |
| velo_publish | `{ force?: false }` | Run tests, then `wix publish --source local -y` from velO repo | Success/failure, publish URL |

### Configuration

```
VELO_DEV_REPO=/path/to/carolina-futons
VELO_PROD_REPO=/path/to/carolina_futons_velO
```

### Safety Guardrails

- velo_sync rejects untagged commits — release tags only
- velo_publish rejects dirty worktree (uncommitted changes)
- velo_publish runs tests before publishing (fail = abort)
- velo_publish requires Wix CLI auth (detects expired sessions)
- All operations logged for audit trail

## Official Wix MCP (use as-is)

Connect the central Wix MCP for site data operations:

```json
{
  "mcpServers": {
    "wix-mcp": {
      "command": "npx",
      "args": ["-y", "@wix/mcp-remote@latest", "https://mcp.wix.com/mcp"]
    }
  }
}
```

**Official MCP provides:** ListWixSites, CallWixSiteAPI, ManageWixSite, SearchWixRESTDocumentation, SearchWixSDKDocumentation, SearchBuildAppsDocumentation, SearchWixHeadlessDocumentation, WixBusinessFlowsDocumentation, ReadFullDocsArticle, ReadFullDocsMethodSchema, SupportAndFeedback

**Per-site MCP** (`<site>/_api/mcp`): CallWixSiteAPI, GenerateVisitorToken, SearchSiteApiDocs, GetBusinessDetails, SearchInSite

## Responsibility Split

| Need | MCP | Tool |
|------|-----|------|
| List sites | Official | ListWixSites |
| CRUD collections/products/orders | Official | CallWixSiteAPI |
| Search Wix docs | Official | Search*Documentation |
| Read API schemas | Official | ReadFullDocsMethodSchema |
| Create/manage sites | Official | ManageWixSite |
| Business details | Per-site | GetBusinessDetails |
| Sync release to production | Custom | velo_sync |
| Preview before publish | Custom | velo_preview |
| Publish to live | Custom | velo_publish |
| Check deploy state | Custom | velo_status |
| Diff before sync | Custom | velo_diff |

## Testing (TDD)

| Test | Verifies |
|------|----------|
| velo_sync rejects untagged ref | main, commit hashes fail |
| velo_sync copies correct files | Only src/, tests/, config — no .md, .beads |
| velo_sync idempotent | Same tag twice = no diff |
| velo_publish rejects dirty worktree | Uncommitted changes abort |
| velo_publish runs tests first | Test failure aborts publish |
| velo_publish handles CLI errors | Auth expired, network down = clear errors |
| velo_preview returns URL | Captures preview URL from CLI |
| velo_status reports all state | Auth, repo, tag, last sync |
| velo_diff accurate | Matches what sync would change |

## What We Don't Build

- No custom REST API wrappers (official MCP)
- No CI/CD pipeline (agent-driven for now)
- No web UI
- No multi-site support (just "My Site 2")

## Implementation Sequence

1. Create wix-velo-mcp repo, scaffold TypeScript project, write tests
2. Implement 5 tools
3. Set up carolina_futons_velO with v0.0.0 release code
4. Configure both MCP servers in Claude Code
5. End-to-end test: sync → preview → publish
6. Tag v0.0.0 on both new repos
