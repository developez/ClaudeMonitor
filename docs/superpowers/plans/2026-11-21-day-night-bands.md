# Day and night chart bands

> **For agentic workers:** Use superpowers:executing-plans in the current session.

**Goal / user request:** Add a switch to distinguish day and night periods in the temporal consumption chart using background bands and sun/moon/star symbols.

**Design:** Fixed local day 08:00–20:00 and night 20:00–08:00 (implementation choice, stated to the user). Optional switch, initially off, available with 1/3/8/12 hour granularities. Daily mode disables the control and explains that an hourly view is needed. Use translucent sky blue daytime bands and indigo nighttime bands, plus a compact legend and symbols inside sufficiently wide bands. Split mixed blocks exactly at 08:00 and 20:00 and merge consecutive segments. Draw behind chart data/grid; preserve all values and filters.

**Files:** `index.html`, `README.md`, `tests/time-granularity.test.cjs`.

**Verification:** Node tests for band boundaries within 3/8/12 hour blocks, multi-day merging, off/daily states, canvas band positions and data invariance. Existing browser connection is unavailable; report this limitation if visual verification remains unavailable.

- [x] Write failing behavior tests (two expected failures before implementation).
- [x] Add switch styling, legend, band segmentation and Chart.js drawing plugin.
- [x] Run all tests, check diff, request final code review and document the result.

Result: All 16 tests pass. Independent review found no important defects and checked the bundled Chart.js draw order. Visual browser verification was attempted again but the CUA native connection remains unavailable.

Leave changes uncommitted, preserving previous work in this session.
