# Date filter implementation plan

> **For agentic workers:** Use superpowers:executing-plans in the current session.

**Goal / approved spec:** Add Desde/Hasta dates to En el tiempo, defaulting to today and two previous local calendar days, inclusive.

**Architecture:** Filter existing daily/hourly summaries before chart calculations. Fill the selected interval with zero blocks when it contains activity; show an empty state otherwise. Counts, tokens, costs and averages reflect the selected interval. Empty date inputs leave that bound open. Reversed dates show a validation message.

**Tech stack:** Existing HTML/JavaScript/Chart.js; Node test runner, no added dependencies.

**Files:** `index.html`, `README.md`, `tests/time-granularity.test.cjs`.

**Review focus:** Inclusive final day, sessions spanning dates, all granularities, calendar day defaults across month/DST boundaries, invalid/empty ranges.

- [x] Write and run failing tests for local calendar defaults, filtering across all granularities, summary totals/session counts, empty and invalid ranges (3 expected failures before implementation).
- [x] Add date controls, startup defaults, filtering and change handlers, preserving the existing cache.
- [x] Update README and run `node --test` plus diff checks (14 tests passing).

User requested direct implementation; leave all session changes uncommitted.

Review: A very wide date range at hourly resolution could create hundreds of thousands of chart bars. Reproduced with a failing regression, then limited range enumeration to 10,000 blocks. Larger selections show an actionable message to narrow dates or increase granularity. Calendar days, including daylight saving days, remain aligned to local wall time.
