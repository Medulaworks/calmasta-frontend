# Agent Token Management & Fast Execution Protocol

This protocol must be followed strictly across all tasks to reduce token consumption by 70%–85% and achieve sub-minute execution speeds.

---

## The Core Problem

In sessions with ~100k context windows, **each tool round-trip re-processes the entire conversation history**.
- **20–30 turns** = 2M – 3M tokens and 10+ minutes of latency.
- **2–3 turns** = ~200k – 300k tokens and under 45 seconds of latency (**~90% token reduction**).

The primary driver of token waste and slow execution is **excessive tool round-trips and bloated file edits**.

---

## The 5 Mandatory Execution Rules

### 1. Max 2–3 Tool Turns Per Task (Hard Cap)
Every task must aim to complete within **1 to 3 turns**:
- **Turn 1 (Inspect)**: Read only the exact target lines (20–40 lines max). No exploratory browsing.
- **Turn 2 (Execute)**: Apply the minimal targeted diff.
- **Turn 3 (Validate & Report)**: Run a single chained validation command, then output the final summary.

### 2. Zero Piecemeal File Slicing
- **Forbidden**: Reading 50 lines, scrolling, reading another 50 lines across 5–10 calls.
- **Required**: Target the exact line numbers immediately. Never make more than **one** read call per file.

### 3. Surgical Diffs (Never Reprint SVG/Boilerplate Bloat)
- **Forbidden**: Outputting hundreds of lines of unchanged SVG `<path>` coordinates, large tables, or entire components when editing CSS classes or wrappers.
- **Required**:
  - Target strictly the surrounding wrapper tag, container `<div>`, or component prop (5–15 lines max).
  - Leave unchanged internal paths and data untouched.

### 4. Single Chained Validation Command
- **Forbidden**: Running Prettier, ESLint, and TypeScript type-checks in separate sequential commands across 3 round-trips.
- **Required**: Chain verification into a single call:
  ```bash
  pnpm prettier --write <files> && pnpm --filter <app> lint
  ```
  Only run targeted validations for files touched. Never run repository-wide builds for localized UI edits.

### 5. Zero Conversational Fluff & Rule 14 Response
- Do not narrate intermediate thoughts or steps.
- Provide only the standardized 4-part summary upon completion:
  ```markdown
  ### Implemented
  Brief description of what was done.

  ### Files Changed
  List of modified files.

  ### Validation
  Single chained command result.

  ### Notes
  Any critical context or pre-existing warnings.
  ```

---

## Pre-Flight Checklist Before Running Tools

Before making any tool call, verify:
1. Can this file read be avoided because the line range or structure is already known?
2. Is the diff scoped to only the lines changing, omitting large SVG trees or repetitive markup?
3. Can the validation commands be combined into one single `&&` terminal invocation?
4. Will this task complete within 3 tool turns? If not, consolidate actions immediately.
