## Recently Viewed: the detail-header marker shows the absolute open time, not "0 seconds ago"

Follow-up to #1816 (the Recently Viewed feature). On an asset's **detail page** the recency marker showed a
static **"Viewed 0 seconds ago"**: the detail page records the asset on open, so its `lastViewedAt` is always
~now and the relative "x ago" is always ~0, resetting on every refresh — no useful information.

This shows the **absolute time you last opened the asset** instead, in your browser's timezone with an
explicit UTC offset (e.g. `Viewed 29 Jun 2026, 14:32 UTC+02:00`), falling back to UTC. A user with many open
tabs can now tell when each asset was opened. The **list surfaces and the home panel keep the relative
"x ago"**, where recency genuinely varies and is meaningful.

### What changed
- `useAppDateTime`: a `dateTimeWithTimezone` formatter — the browser timezone with an explicit `UTC±HH:MM`
  offset, falling back to UTC when the timezone cannot be resolved.
- `RecentlyViewedTag`: an `absoluteTime` prop selecting the absolute form; the default stays relative.
- The three detail headers (Data Entity / Term / Query Example) opt in; the list columns + home panel are
  unchanged.

### Verification
- **Unit**: `tsc --noEmit` clean; a new `useAppDateTime.dateTimeWithTimezone` test (explicit-offset shape +
  fixed-instant stability).
- **Integration (IT-149, extended)**: a new test asserts the detail header shows an absolute timestamp with an
  explicit UTC offset (not a relative "ago"). GREEN on this branch; RED on `ref:main` (which renders the
  relative "0 seconds ago").
- **Full e2e regression** on the image built from this branch: `feature-complete` green-for-change (IT-149 all
  three tests green — open→see loop, the list column, and the new detail absolute time); `known-bugs` at its
  baseline.

Milestone: 1.0.0
Docs: documentation@release/1.0.0 — the Recently Viewed page now distinguishes the detail-header absolute open
time from the list-surface "how long ago" (publishes with the 1.0.0 release).

Part of #1816

🤖 Generated with [Claude Code](https://claude.com/claude-code)
