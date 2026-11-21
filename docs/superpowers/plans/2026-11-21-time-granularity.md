# Time granularity implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan in the current session.

**Goal:** Add daily, 1, 3, 8 and 12 hour views and rebuild cached summaries on the next page load.

**Architecture:** Keep the existing daily summaries and add local hourly summaries during transcript parsing, after request deduplication. Merge main sessions and agents, then regroup hourly summaries for the chart. Bump the cache namespace and remove obsolete cm3 entries.

**Tech Stack:** Static HTML, JavaScript, bundled Chart.js; Node built-in test runner for verification.

**Spec:** User-approved proposal in the conversation: fixed local-time blocks beginning at midnight, daily by default, all existing filters and metrics, adapted labels and active-block averages; subsequent request adds 1 hour.

## Global constraints

- No server changes or new runtime dependencies.
- Preserve daily behavior and total token/cost calculations.
- Rebuild once after this upgrade; reuse valid new summaries on later loads.

## Review focus

- Exact boundaries and midnight assign requests to the correct block.
- Empty blocks between first and last activity appear as zero.
- Daylight saving changes retain calendar-aligned local blocks and totals.
- Duplicate messages and agent summaries must not inflate totals.
- Old cached sessions and transcripts must both be ignored, including unchanged files.

### Task 1: Hourly summaries, selector, cache migration and documentation

**Files:** Modify `index.html` and `README.md`; add `tests/time-granularity.test.cjs`.

**Interfaces:** Transcript/session summaries gain `hours` (local YYYY-MM-DDTHH → model → usage). `groupHours(hours, span)` produces selected blocks; `timeRange(keys, span)` fills missing blocks, with span 24 for days.

- [x] Write tests for timestamp parsing/deduplication, block boundaries, gaps, daylight saving, conservation of totals, rendering/filtering, session/agent merging and cache rebuild/reuse.
- [x] Run `node --test`; confirm failures reflect missing hourly behavior (5 expected failures before implementation).
- [x] Implement summary fields, regrouping, selector/events, labels/tooltips/averages and cache version update.
- [x] Update README with options and one-time rebuild behavior.
- [x] Run `node --test`, inspect the diff and attempt browser verification (CUA native connection unavailable).

Execution: User explicitly requested implementation in the current workspace. Leave changes uncommitted for review.

Final review: Reproduced and fixed tooltip failures on empty blocks and cache reuse after a browser time zone change. Both regression tests failed before their fixes. The cache namespace now includes the local time zone; obsolete cm4 zones are also removed during initialization. Browser visual verification remains unavailable because the CUA native connection failed.
