# Frontend Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all frontend files from repo root into `client/` to mirror `server/` backend layout, with zero errors.

**Architecture:** Git-preserving moves (`git mv`) of frontend-only files into `client/`, then convert root `package.json` into a lightweight npm-workspaces monorepo root (`client`, `server`) with orchestration scripts. No code logic changes; only path/config updates.

**Tech Stack:** React 19 + Vite 8 + TypeScript + Tailwind 3 (frontend in `client/`); Express + Prisma (backend in `server/`); npm workspaces at root.

**Spec:** User request 2026-09-14 — "place all of the frontend in one folder like server/, ensure no error in all files of whole system". Decisions: folder = `client/`, root = monorepo with workspaces.

## Global Constraints

- Shell is Windows PowerShell 5.1: never use `&&` to chain commands; use `; if ($?) { ... }`.
- Preserve git history with `git mv` where possible.
- No functional code changes — moves + config path updates only.
- Must verify: `tsc -b` in `client/`, `tsc -p tsconfig.json` in `server/`, `vitest run` in `client/`, `oxlint` clean.
- `server/` untouched except if root script references require it (prefer no server changes).

---

### Task 1: Move frontend files into client/

**Files:**
- Move: `src/` -> `client/src/`
- Move: `public/` -> `client/public/`
- Move: `index.html` -> `client/index.html`
- Move: `vite.config.ts` -> `client/vite.config.ts`
- Move: `vitest.config.ts` -> `client/vitest.config.ts`
- Move: `tailwind.config.js` -> `client/tailwind.config.js`
- Move: `postcss.config.js` -> `client/postcss.config.js`
- Move: `tsconfig.app.json` -> `client/tsconfig.app.json`
- Move: `tsconfig.node.json` -> `client/tsconfig.node.json`
- Move: `tsconfig.json` -> `client/tsconfig.json`
- Move: `.oxlintrc.json` -> `client/.oxlintrc.json` (keep a root shim if needed)
- Move: `package.json` (frontend) -> `client/package.json`

**Interfaces:**
- Consumes: current root layout (frontend at root, backend at `server/`).
- Produces: `client/` self-contained Vite app; root freed for monorepo orchestration.

- [ ] **Step 1: Create client directory and git-move files**

```powershell
New-Item -ItemType Directory -Path "client"
git mv src client/src; if ($?) { git mv public client/public }
git mv index.html client/index.html; if ($?) { git mv vite.config.ts client/vite.config.ts }
git mv vitest.config.ts client/vitest.config.ts; if ($?) { git mv tailwind.config.js client/tailwind.config.js }
git mv postcss.config.js client/postcss.config.js; if ($?) { git mv tsconfig.app.json client/tsconfig.app.json }
git mv tsconfig.node.json client/tsconfig.node.json; if ($?) { git mv tsconfig.json client/tsconfig.json }
git mv .oxlintrc.json client/.oxlintrc.json
```

- [ ] **Step 2: Move package.json via copy (keep for next task to rewrite root)**

```powershell
Copy-Item -Path "package.json" -Destination "client/package.json"; if ($?) { git add client/package.json }
```

- [ ] **Step 3: Verify moves**

Run: `git status --short`
Expected: `R` (renamed) entries for all above under `client/`, no leftover `src/` or `index.html` at root.

---

### Task 2: Convert root to monorepo orchestrator

**Files:**
- Modify: `package.json` (root — rewrite as workspaces root)
- Modify: `.gitignore` (ensure `client/dist`, `client/node_modules` covered)

**Interfaces:**
- Consumes: `client/package.json` (frontend scripts), `server/package.json` (backend scripts).
- Produces: `npm run dev:typecheck:lint:test` working from root via `--workspace` flags.

- [ ] **Step 1: Rewrite root package.json as workspaces root**

```json
{
  "name": "gabay-prototype",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["client", "server"],
  "scripts": {
    "dev": "npm run dev --workspace=client",
    "dev:client": "npm run dev --workspace=client",
    "dev:server": "npm run dev --workspace=server",
    "dev:all": "npm run dev --workspace=client & npm run dev --workspace=server",
    "build": "npm run build --workspace=client",
    "build:client": "npm run build --workspace=client",
    "build:server": "npm run build --workspace=server",
    "typecheck": "npm run typecheck --workspace=client & npm run build --workspace=server",
    "typecheck:client": "npm run typecheck --workspace=client",
    "lint": "npm run lint --workspace=client",
    "test": "npm run test --workspace=client",
    "preview": "npm run preview --workspace=client"
  }
}
```

Note: `client/package.json` keeps original scripts (`dev`, `build: tsc -b && vite build`, `typecheck: tsc -b`, `lint: oxlint`, `preview`, `dev:server` removed or repointed). Keep `dev:server` out of client to avoid confusion (root owns it).

- [ ] **Step 2: Update .gitignore for client outputs**

Add (if missing):
```
client/dist
client/node_modules
```

Root `dist/` entry already covers old path; keep for safety but `client/dist` is explicit.

- [ ] **Step 3: Verify workspace wiring**

Run: `npm ls --workspaces` (or `Get-Content package.json`)
Expected: lists `client` + `server` with no errors.

---

### Task 3: Fix paths and verify zero errors

**Files:**
- Verify (no change expected): `client/tailwind.config.js` content `./index.html`, `./src/**/*` (still correct relative to `client/`)
- Verify: `client/vite.config.ts` proxy `/api -> localhost:4000`, uploads `path.resolve(process.cwd(), 'public/uploads')` (now resolves to `client/public/uploads` — correct)
- Verify: `client/tsconfig.app.json` include `["src"]`, `client/tsconfig.json` references, `client/vitest.config.ts` setup `./src/test/setup.ts`, `client/index.html` script `/src/main.tsx`
- Modify only if verification fails.

**Interfaces:**
- Consumes: moved `client/` tree + monorepo root.
- Produces: green verification across whole system.

- [ ] **Step 1: Reinstall / link workspaces**

Run: `npm install`
Expected: PASS, `client/node_modules` + `server/node_modules` linked.

- [ ] **Step 2: Typecheck client**

Run: `npx tsc -b client/tsconfig.json`
Expected: PASS, no output.

- [ ] **Step 3: Typecheck server**

Run: `npx tsc -p server/tsconfig.json --noEmit`
Expected: PASS (or pre-existing errors reported explicitly — fix only path-related ones, report pre-existing).

- [ ] **Step 4: Run client unit tests**

Requires `"test": "vitest"` in `client/package.json` (already added).

Run: `npm run test --workspace=client -- --run`
Expected: all PASS (sections, spr, quizImport, promise, notifiers, autoFolder, activities, api client, ChatMarkdown, InteractiveChart, etc.).

- [ ] **Step 5: Lint client**

Run: `npm run lint --workspace=client`
Expected: 0 errors (warnings OK, must list).

- [ ] **Step 6: Build client**

Run: `npm run build --workspace=client`
Expected: `client/dist/index.html` produced, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git status --short
git commit -m "refactor: consolidate frontend into client/ with monorepo root"
```

Only commit if all verifications pass.

## Self-Review

1. **Spec coverage:** Folder = `client/` ✓ (Task 1); mirror of `server/` ✓; no errors whole system ✓ (Task 3: tsc client+server, vitest, oxlint, vite build).
2. **Placeholder scan:** No TBD/TODO; all paths exact; all commands PowerShell-safe.
3. **Type consistency:** No type renames; moves only; `client/tsconfig` includes unchanged; server `tsconfig` untouched.
