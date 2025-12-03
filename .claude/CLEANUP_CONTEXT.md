# Cleanup Context Memory - Repository Restructuring

**Created:** 2025-12-02
**Purpose:** This file serves as a context memory for Claude Code in case the conversation gets compacted. It documents all findings from the thorough analysis of the nested git repository structure.

---

## What Happened

The project had a confusing **nested git repository structure**:
- **Parent repo:** `/Users/cal/Documents/GitHub/Genthrust_Repairs_v.2/`
- **Nested repo:** `/Users/cal/Documents/GitHub/Genthrust_Repairs_v.2/genthrust-repairs-v2/`

Both had their own `.git` directories but shared the same GitHub remote. The parent was 26 commits behind and contained obsolete early phase work. The nested repo had all the real work (Phases 1-14+).

**Solution:** Promote the nested repo to the parent level, eliminating the confusing wrapper.

---

## Critical Findings Summary

### Breaking Changes Fixed

1. **Hardcoded Absolute Path** (FIXED)
   - File: `.claude/commands/new-worktree.md:5`
   - OLD: `cd /Users/cal/Documents/GitHub/Genthrust_Repairs_v.2/genthrust-repairs-v2`
   - NEW: `cd "$(git rev-parse --show-toplevel)"`

2. **Trigger.dev Build Caches** (CLEARED)
   - Location: `.trigger/` and `.worktrees/*/.trigger/`
   - Contained hardcoded absolute paths
   - Will regenerate on next build

### Safe Aspects Verified

- All source code uses relative imports (`@/*` aliases)
- All npm scripts are standard Next.js commands
- TypeScript configs use relative path aliases
- drizzle.config.ts uses `process.cwd()` for dynamic paths
- .env.local is at project root (portable)
- 13 internal worktrees in `.worktrees/` are self-contained

---

## Worktrees Inventory

### Internal Worktrees (KEPT - in `.worktrees/`)
- api, auth, database, trigger, ui
- Excel_DB_Update, inventory_revamp, RO_Detail, Status_Details, table_filter
- UI_Design, UI_Upgrade

### External Worktrees (PRUNED - were in parent)
- `UI_Contents/` - deleted
- `UI_Revamp/` - deleted (only contained .next build artifacts)

---

## Files Changed During Cleanup

1. `.claude/commands/new-worktree.md` - Fixed hardcoded path
2. `.claude/settings.local.json` - Copied from parent
3. `.claude/CLEANUP_CONTEXT.md` - This file (new)

## Files/Folders Deleted

1. Parent's `UI_Revamp/` folder
2. Parent's `UI_Contents/` folder (if existed)
3. Parent's `.git/` directory
4. Parent's `.claude/` directory (after copying settings)
5. `.trigger/` caches
6. `.worktrees/*/.trigger/` caches

---

## Final Structure

After cleanup, the project lives at:
```
/Users/cal/Documents/GitHub/Genthrust_Repairs_v.2/
├── .git/              # The real git repo
├── .claude/           # Claude Code config
├── .worktrees/        # 13 feature branch worktrees
├── src/               # Source code
├── drizzle/           # Database migrations
├── certs/             # SSL certificates
├── package.json
├── .env.local
└── ... (all project files at root)
```

---

## Rollback Info

If something goes wrong:
1. Branch `cleaning_main` has the pre-promotion state
2. GitHub remote has all commits up to Phase 13+
3. Can always `git clone` fresh from GitHub

---

## Technology Stack Reference

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** Aiven MySQL + Drizzle ORM
- **Orchestration:** Trigger.dev v3
- **Auth:** Auth.js v5 (Microsoft Entra ID)
- **AI:** Vercel AI SDK (Claude 3.5 Sonnet)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **External APIs:** Microsoft Graph API (Excel/SharePoint)

---

## Current Project Status

**Phase 14 Complete** - Multi-Sheet Excel Sync with:
- Net Terms routing (COMPLETE → NET/Paid sheet)
- buildDeleteRowRequest for row removal
- move-ro-sheet Trigger.dev task
- Dashboard status filtering (ARCHIVED_STATUSES)
- NET 30 count
- Connection pool ETIMEDOUT fix
