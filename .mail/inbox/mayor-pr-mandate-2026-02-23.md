# MAYOR DIRECTIVE — MANDATORY PR PROCESS
**Date:** 2026-02-23
**Priority:** MANDATORY — EFFECTIVE IMMEDIATELY

## NO direct pushes to main. Period.

All work MUST go through pull requests. This is not optional.

### New Workflow (every bead, every change):
1. **Create a feature branch**: `git checkout -b cf-<bead-id>-<short-desc>`
2. **Do your work on the branch**, commit as you go
3. **Push the branch**: `git push -u origin cf-<bead-id>-<short-desc>`
4. **Open a PR**: `gh pr create --title "cf-<bead-id>: <description>" --body "..."`
5. **Wait for review approval** from melania or another crew member
6. **Merge only after approval**

### What happens if you push to main directly:
- Your work will be reverted
- You will be reassigned

### PR Format:
```
Title: cf-<bead-id>: Short description
Body:
## Summary
- What changed and why

## Test plan
- How to verify

## Bead
cf-<bead-id>
```

This applies to ALL changes — features, fixes, tests, docs. No exceptions.
