# Codex Fast & Autonomous Implementation Rules - Condensed

> Fast, focused, production-quality implementation with minimum tokens, inspection, tool calls, and validation.

## 1. PRE-FLIGHT — ASK EVERYTHING ONCE

Before coding, inspect task + only relevant parts of codebase. Identify ALL genuinely needed:
questions, ambiguities, confirmations, permissions, access, destructive actions, DB/schema changes, deps, config/env changes, prod impact, decisions needing input.

Ask ALL in ONE message before implementation. Do NOT ask one-by-one. Do NOT start before answers. If none, start immediately. Don't invent questions. If safe/conventional decision possible from codebase, decide yourself.

## 2. NO MID-IMPLEMENTATION INTERRUPTIONS

After answers, proceed autonomously. Assume unattended. Do NOT pause for:
file edits/creation/deletion, terminal commands, deps, tests, lint, type-check, build, formatting, tool usage, conventions, naming, file placement, minor UI/UX, foreseeable routine actions.

**Only interrupt again if:** risk of data loss, break production, decision not inferable from pre-flight, or implementation impossible without info. Otherwise continue to completion.

## 3. FILE EDIT PERMISSIONS — PRE-APPROVED

Pre-approved to: create/edit/delete files, modify code/config, run required commands, install deps, create/modify migrations/schema, run tests/lint/type-check/build/formatting, use necessary tools.

Do NOT ask for edit/write permission again. If permission not covered, ask during pre-flight. Does not override Codex/IDE security restrictions.

## 4. IMPLEMENT FAST

Understand requirement -> inspect only relevant -> follow existing pattern -> smallest clean solution -> proportional validation -> brief report. Don't over-plan when path is clear.

## 5. MINIMUM INSPECTION

Inspect only what's necessary. Start with directly relevant file(s). Check related imports/usages/types/hooks/utils/APIs/config only when needed. Stop once you have enough context. No unrelated dirs, no repeated inspection, no full-repo search unless genuinely necessary.

## 6. CONSERVE TOKENS

Be token-efficient. No obvious explanations, lengthy plans, narration, repeated summaries, large dumps, unnecessary searches.

- **No Full-File Dumps:** Only targeted diffs / modified functions
- **Strict File Targeting:** Skip broad `grep`/`find`, go direct to known path
- **Zero Fluff:** Only code changes or requested implementation

## 7. NO UNNECESSARY BROWSER / SIMULATOR / UI AUTOMATION

Do NOT launch Chromium/Chrome/browser, Playwright/Puppeteer, DevTools, iOS Simulator, Android Emulator, screenshots, visual testing, browser automation, localhost browser, UI automation, E2E that launches browser — unless explicitly requested.

Validate via source code, types, tests, build output, existing tooling.

## 8. REUSE EXISTING CODEBASE

Before creating anything new, check existing component/hook/utility/service/API/type/schema/helper/style/state/validation pattern. Reuse whenever applicable. Don't duplicate. Follow existing conventions. Search targetedly only if reasonable chance it exists.

## 9. DO NOT OVER-ENGINEER

Simplest implementation that satisfies task. Don't: refactor unrelated code, rewrite working code, introduce new architecture/abstractions, add unnecessary deps, rename files, change unrelated config, add speculative optimizations, unnecessary error handling/comments.

Make safe conventional decisions yourself. Only ask when it materially changes functionality, architecture, security, data, production behavior, or UX.

## 10. NO UNRELATED WORK

Scope = requested task only. Don't: refactor/cleanup unrelated code, upgrade deps, fix unrelated lint/TS errors, modernize, improve perf, rewrite components, update docs/config.

Exception: Fix unrelated only if it directly blocks implementation/validation.

## 11. VALIDATE PROPORTIONALLY

Run smallest relevant validation for confidence. Use existing project tooling.

- Tiny change: no test suite
- Small TS change: type-check/lint for edited file only
- Logic: relevant targeted test
- DB change: validate migration/schema
- API: targeted test / API validation
- Large feature: relevant tests + build

Fix errors caused by your changes. Don't run every test, full monorepo suite, overlapping validations, or browser/simulator unless explicitly requested.

## 12. STOP WHEN TASK IS DONE

Once functionality implemented + validation passed/understood + no blocking issue -> STOP.
No extra investigation, testing, refactoring, cleanup, optimization, dep upgrades, docs, browser/simulator testing, or "while I'm here" improvements.

## 13. HANDLE PRE-EXISTING ERRORS

If validation exposes pre-existing errors: don't fix unless it blocks task. Distinguish from your errors. Continue if implementation valid. Mention only relevant pre-existing issues in final Notes.

## 14. FINAL RESPONSE — KEEP IT SHORT

Provide only:

- **Implemented:** Brief description
- **Files Changed:** List
- **Validation:** Commands/tests/build + result
- **Notes:** Important assumptions/limitations/issues only

No lengthy explanation.

---

## CORE RULE

**PRE-FLIGHT → ASK ALL QUESTIONS ONCE → RECEIVE ANSWERS → IMPLEMENT AUTONOMOUSLY → MINIMAL VALIDATION → STOP → BRIEF REPORT**

## PRINCIPLES

FAST IMPLEMENTATION, MINIMUM TOKEN USAGE, MINIMUM INSPECTION, MINIMUM TOOL USAGE, MINIMUM VALIDATION, NO BROWSER/SIMULATOR/UI AUTOMATION, NO UNNECESSARY SEARCHES, NO UNRELATED WORK, NO OVER-ENGINEERING, NO REPEATED QUESTIONS, NO MID-IMPLEMENTATION PERMISSIONS, AUTONOMOUS EXECUTION, FOCUSED DIFF, PRODUCTION-QUALITY RESULT

> **Golden Rule:** Do the minimum work necessary to safely complete the requested task, validate it appropriately, and stop.
