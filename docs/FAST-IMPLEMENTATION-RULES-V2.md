# Fast & Autonomous Implementation Rules — v2 (Muse Code Enforced)

> Objective: Fast, focused, production-quality implementation. Minimum tokens, minimum tool calls, minimum interruptions.
>
> **Core truth this version fixes:** A prompt cannot override Muse Code's permission system. Approval + Sandbox are harness-level. If you only write rules in a prompt, Muse Code will still ask to launch Chromium, still ask for shell approval, and still be slow because it re-reads a 200-line doc every turn.
>
> **This version enforces via 3 layers:** 1) Harness config, 2) Short AGENTS.md, 3) Lean protocol.

---

## 0. HARNESS SETUP — Do Once (This Is What Actually Stops Prompts)

### A. Global settings — `~/.config/muse/settings.json`

```json
{
  "schema_version": 1,
  "permissions": {
    "default_profile": "auto-review"
  }
}
```

Profiles:
- `auto-review` (default, safe for main machine) — automated reviewer clears routine approvals
- `unrestricted` — no approval, no sandbox, same as `--yolo`. ONLY in Docker / VM / throwaway container. Never on main machine with secrets.

### B. Launch command — Pick one per session

```bash
# Safe daily driver — no approval prompts, sandbox still protects you
muse --approval-mode never

# Throwaway container ONLY — no approval, no sandbox
muse --yolo

# Headless simple task — never asks
muse -p "fix X in file Y"
```

### C. Pre-allow common commands — Do once per workspace

When first prompted for `pnpm`, `tsc`, `eslint`, `git`, choose:
**Always allow in this workspace**

Muse Code remembers it. After that, it stops asking for that command.

---

## 1. PROJECT FILE — `AGENTS.md` (Copy-paste this, replace your old doc)

Run `muse init` once to create `AGENTS.md`, then overwrite with this. Keep it under 20 lines — long docs make the agent slower.

```md
# Rules — hard, no exceptions
- NEVER launch browser, Chromium, Playwright, Puppeteer, Cypress, Storybook, Lighthouse, simulator, or localhost clicking. No screenshots. Browser tool does not exist in this repo.
- NEVER run full test suite, full build, coverage, audit, or Docker stack for a localized edit.
- Max 1 read per file, max 40 lines. No repo-wide grep. Go direct to known path.
- Edit only requested files. No refactor, no extra features, no dep upgrades, no unrelated fixes.
- Validate with ONE chained command on touched files only.
- Assume YES for edits, commands, deps, tests, lint, type-check unless it deletes data or touches prod. Do not ask mid-task.
- Output only: Implemented / Files Changed / Validation / Notes.
```

---

## 2. EXECUTION PROTOCOL — 3 Turns Max

**PRE-FLIGHT → ASK ALL QUESTIONS ONCE → IMPLEMENT → VALIDATE → STOP**

1.  **Pre-flight (Turn 1):** Read only exact target lines. Ask ALL genuinely blocking questions in ONE message. If none, start immediately. Do not invent questions.
2.  **Execute (Turn 2):** Surgical diff only, 5-15 lines. Reuse existing component / hook / util. Simplest implementation that satisfies task.
3.  **Validate & Report (Turn 3):** One chained command, then stop. No extra investigation.

**Golden Rule:** Minimum work to safely complete task, validate proportionally, stop.

---

## 3. HARD BANS — No Exceptions Unless User Explicitly Requests

**Frontend — DO NOT RUN:**
Chrome/Chromium screenshot, Playwright/Puppeteer, Cypress/WebDriverIO, Storybook/Chromatic, Lighthouse, axe full scan, BrowserStack/Sauce, iOS/Android emulator, Percy/Applitools, localhost browser clicking.

**Backend — DO NOT RUN:**
Full repo test suite (`pnpm test`, `turbo run test`), full integration/E2E suite, load testing (k6, Artillery), full Docker Compose + DB seeds, `jest --coverage`, repo-wide `build` / `tsc -b`, spinning up Redis/Kafka/S3 for unit work.

**General — DO NOT RUN:**
Prettier + ESLint + TSC as 3 separate calls, `tsc --noEmit` on whole monorepo, re-running same validation twice, `npm audit`, repeated 50-line file slices, printing full SVG paths or large JSON fixtures.

**If confidence check needed, prefer:**
```bash
# Type-check edited file only
pnpm tsc --noEmit --skipLibCheck <changed-file>

# Targeted test only
pnpm test src/components/X.test.tsx -t "specific case"
```

---

## 4. VALIDATION — Single Chained Command

```bash
pnpm prettier --write <files> && pnpm --filter <app> lint --filter <file>
```

- Tiny change: no test suite
- Small TS change: type-check / lint edited file only
- Logic: relevant targeted test
- DB change: validate migration/schema only
- API: targeted test only

Fix only errors caused by your changes. Ignore pre-existing errors unless they block task. Mention them in Notes.

---

## 5. FINAL RESPONSE — Keep It Short

Provide ONLY:

### Implemented
Brief description.

### Files Changed
List of modified files.

### Validation
Single chained command result.

### Notes
Critical context or pre-existing warnings only. No lengthy explanation.

---

## 6. SAFETY

- `AGENTS.md` loads only in trusted workspaces. Trust workspace once.
- Never use `--yolo` / `unrestricted` on host with real credentials, prod DB, or personal files.
- Never auto-approve `rm -rf`, `sudo`, destructive migrations, or prod deploys — those still require human review even in fast mode.
- If implementation impossible without info, or risk of data loss / prod break, interrupt once. Otherwise continue autonomously.

---

## CHANGELOG — v1 → v2

- Removed 200-line prompt-only protocol (caused slowness + token bloat)
- Added harness enforcement: `settings.json` + `--approval-mode never` / `--yolo` — this is what actually stops Chromium prompts
- Added pre-allow workflow for common commands
- Shrunk AGENTS.md to 12 lines (actually followed)
- Kept: 3-turn cap, surgical diffs, single validation, hard bans on browser/heavy tests
