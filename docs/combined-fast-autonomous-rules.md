# Fast & Autonomous Implementation Rules — Combined Protocol

> **Objective:** Fast, focused, production-quality implementation with minimum tokens, minimum tool calls, minimum inspection, minimum validation. Reduce token consumption by 70%-85% and achieve sub-minute execution.

### CORE RULE
**PRE-FLIGHT → ASK ALL QUESTIONS ONCE → RECEIVE ANSWERS → IMPLEMENT AUTONOMOUSLY (1-3 turns) → MINIMAL VALIDATION → STOP → BRIEF REPORT**

**Golden Rule:** Do the minimum work necessary to safely complete the requested task, validate it appropriately, and stop.

---

## 1. PRE-FLIGHT — ASK EVERYTHING ONCE

Before coding, inspect task + only relevant parts of codebase. Identify ALL genuinely needed: questions, ambiguities, confirmations, permissions, access, destructive actions, DB/schema changes, deps, config/env changes, prod impact, decisions needing input.

Ask ALL in ONE message before implementation. Do NOT ask one-by-one. Do NOT start before answers. If none, start immediately. Don't invent questions. If safe/conventional decision possible from codebase, decide yourself.

**Pre-Flight Checklist Before Any Tool Call:**
1. Can this file read be avoided because line range/structure is already known?
2. Is the diff scoped to only lines changing, omitting large SVG trees or repetitive markup?
3. Can validations be chained into one `&&` invocation?
4. Will this task complete within 3 tool turns? If not, consolidate now.

## 2. MANDATORY FAST EXECUTION RULES (The 5 Rules)

### Rule 1: Max 2-3 Tool Turns Per Task (Hard Cap)
Every task MUST aim to complete within 1 to 3 turns:
- **Turn 1 (Inspect):** Read only exact target lines (20-40 lines max). One read call per file. No exploratory browsing.
- **Turn 2 (Execute):** Apply minimal targeted diff.
- **Turn 3 (Validate & Report):** Run a single chained validation command, then output final summary.

20-30 turns = 2M-3M tokens + 10+ mins latency.
2-3 turns = ~200k-300k tokens + under 45s (**~90% reduction**).

### Rule 2: Zero Piecemeal File Slicing
- **FORBIDDEN:** Reading 50 lines, scrolling, reading another 50 lines across 5-10 calls. Broad `grep`/`find` of whole repo.
- **REQUIRED:** Target exact line numbers immediately. Never more than one read call per file. Go direct to known path.

### Rule 3: Surgical Diffs (Never Reprint Bloat)
- **FORBIDDEN:** Outputting hundreds of lines of unchanged SVG `<path>` coordinates, large tables, or entire components when editing CSS classes or wrappers.
- **REQUIRED:** Target strictly surrounding wrapper tag, container `<div>`, or component prop (5-15 lines max). Leave unchanged internal paths/data untouched. Only targeted diffs / modified functions.

### Rule 4: Single Chained Validation Command
- **FORBIDDEN:** Running Prettier, ESLint, TypeScript type-checks in separate sequential commands across 3 round-trips.
- **REQUIRED:** Chain into a single call, only for files touched. Never run repository-wide builds for localized edits.
  ```bash
  pnpm prettier --write <files> && pnpm --filter <app> lint --filter <file>
  ```

### Rule 5: Zero Conversational Fluff
Do not narrate intermediate thoughts or steps. No obvious explanations, lengthy plans, repeated summaries, large dumps.

## 3. FILE EDIT PERMISSIONS — PRE-APPROVED

Pre-approved to: create/edit/delete files, modify code/config, run required commands, install deps, create/modify migrations/schema, run tests/lint/type-check/build/formatting, use necessary tools.

Do NOT ask for edit/write permission again. If permission not covered, ask during pre-flight. Does not override Codex/IDE security restrictions.

## 4. NO MID-IMPLEMENTATION INTERRUPTIONS

After answers, proceed autonomously. Assume unattended. Do NOT pause for: file edits, terminal commands, deps, tests, lint, type-check, build, formatting, tool usage, conventions, naming, file placement, minor UI/UX.

**Only interrupt again if:** risk of data loss, break production, decision not inferable from pre-flight, or implementation impossible without info. Otherwise continue to completion.

## 5. TOKEN CONSERVATION

Be token-efficient.
- No Full-File Dumps
- Strict File Targeting
- Zero Fluff — only code changes or requested implementation

## 6. FORBIDDEN: UNNECESSARY HEAVY TESTS & AUTOMATION (Frontend + Backend)

> **ABSOLUTE BAN:** Do NOT run any unnecessary, heavy, token-burning tests or browser/simulator automation unless explicitly requested by the user in this task.

Validate via source code, types, targeted unit tests, build output, existing tooling.

### A. Frontend — DO NOT RUN (Unless Explicitly Requested):
1.  Chrome / Chromium screenshot tests
2.  Playwright / Puppeteer browser automation / `browser.launch()`
3.  Cypress / WebDriverIO E2E that launches a real browser
4.  Storybook / Chromatic visual regression / snapshot comparison
5.  Lighthouse / Web Vitals / Performance audits
6.  axe-core / full accessibility scans across whole app
7.  BrowserStack / Sauce Labs / cross-browser cloud runs
8.  iOS Simulator / Android Emulator launch
9.  Visual diffing tools (Percy, Applitools)
10. localhost:3000 browser automation / clicking through UI
11. Generating screenshots to "verify" UI changes

### B. Backend — DO NOT RUN (Unless Explicitly Requested):
1.  Full repository-wide or monorepo-wide test suite (`pnpm test`, `turbo run test`)
2.  Full integration / E2E API test suite for a tiny localized change
3.  Load / stress / performance testing (k6, Artillery, Locust, JMeter)
4.  Spinning up full Docker Compose stack / DB containers just to validate logic
5.  Running all DB migrations + seeds on prod-like DB for a small schema edit
6.  `jest --coverage` / coverage reports / mutation testing
7.  Repository-wide `build` / `turbo build` / `tsc -b` for a single file edit
8.  Spinning up real external services (Redis, Kafka, S3) for unit-level work

### C. General Token-Wasters — DO NOT RUN:
1.  Running Prettier, ESLint, TSC as 3 separate tool round-trips
2.  Running `tsc --noEmit` on whole monorepo when only 1 file changed
3.  Re-running same validation twice "to be sure"
4.  `npm audit` / `depcheck` / bundle analysis unless asked
5.  Repeated file reads in 50-line slices to "explore"
6.  Printing full SVG `<path>` data or large JSON fixtures in diffs

If a quick confidence check is needed, prefer:
- Type-check only edited file: `pnpm tsc --noEmit --skipLibCheck --filter`
- Targeted unit test: `pnpm test src/components/X.test.tsx -t "specific case"`
- Lint only changed files

## 7. REUSE EXISTING CODEBASE

Before creating anything new, check existing component/hook/utility/service/API/type/schema/helper/style/state/validation pattern. Reuse whenever applicable. Don't duplicate. Follow existing conventions. Search targetedly only if reasonable chance it exists.

## 8. DO NOT OVER-ENGINEER

Simplest implementation that satisfies task. Don't: refactor unrelated code, rewrite working code, introduce new architecture/abstractions, add unnecessary deps, rename files, change unrelated config, add speculative optimizations, unnecessary error handling/comments.

Make safe conventional decisions yourself. Only ask when it materially changes functionality, architecture, security, data, production behavior, or UX.

## 9. NO UNRELATED WORK

Scope = requested task only. Don't: refactor/cleanup unrelated code, upgrade deps, fix unrelated lint/TS errors, modernize, improve perf, rewrite components, update docs/config.

Exception: Fix unrelated only if it directly blocks implementation/validation.

## 10. VALIDATE PROPORTIONALLY

Run smallest relevant validation for confidence. Use existing project tooling.

- Tiny change: no test suite
- Small TS change: type-check/lint for edited file only
- Logic: relevant targeted test
- DB change: validate migration/schema
- API: targeted test / API validation
- Large feature: relevant tests + build

Fix errors caused by your changes. Don't run every test, full monorepo suite, overlapping validations, or browser/simulator unless explicitly requested.

## 11. STOP WHEN TASK IS DONE

Once functionality implemented + validation passed/understood + no blocking issue -> STOP.
No extra investigation, testing, refactoring, cleanup, optimization, dep upgrades, docs, browser/simulator testing, or "while I'm here" improvements.

## 12. HANDLE PRE-EXISTING ERRORS

If validation exposes pre-existing errors: don't fix unless it blocks task. Distinguish from your errors. Continue if implementation valid. Mention only relevant pre-existing issues in final Notes.

## 13. FINAL RESPONSE — KEEP IT SHORT (Rule 14)

Provide ONLY this 4-part summary:

### Implemented
Brief description of what was done.

### Files Changed
List of modified files.

### Validation
Single chained command result.

### Notes
Any critical context or pre-existing warnings only.

No lengthy explanation.

---
## PRINCIPLES

FAST IMPLEMENTATION, MINIMUM TOKEN USAGE, MINIMUM INSPECTION, MINIMUM TOOL USAGE, MINIMUM VALIDATION, NO BROWSER/SIMULATOR/UI AUTOMATION, NO HEAVY/UNNECESSARY TESTS, NO UNNECESSARY SEARCHES, NO UNRELATED WORK, NO OVER-ENGINEERING, NO REPEATED QUESTIONS, NO MID-IMPLEMENTATION PERMISSIONS, AUTONOMOUS EXECUTION, FOCUSED DIFF, PRODUCTION-QUALITY RESULT
