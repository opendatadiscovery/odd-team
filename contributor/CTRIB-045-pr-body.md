## Recently-viewed reachability — pin the recency column + a usable horizontal scrollbar

Follow-up to #1816 / #1830 (merged). The maintainer reported that on a standard-width screen the
Recently-viewed value + its ✕ remove control still could not be seen or scrolled to on the catalog search
list.

### Root cause (measured)
The search table floors at a `min-width` and overflows the results area on a normal screen, pushing the
**Recently viewed** column off the right edge. The only way to it was the app-global **4px, near-white
(`#EBECF0`) overlay** scrollbar rendered at the bottom of a viewport-tall container — effectively invisible
and far from the row.

### Fix (Search, verified)
- **Pin the Recently-viewed column to the right edge** (mirror of the Name column's existing left pin) — the
  recency value + ✕ are always on screen, no scrolling required (header + row + skeleton).
- **Widen** the recency column (grid proportion 1 → 1.6) so the longest "Viewed … ago ✕" fits the pinned
  169px cell without clipping.
- **`max-height`** (not a fixed height) so the horizontal scrollbar sits directly under the rows, and a
  **prominent 12px scrollbar** (vs the global 4px) so the middle columns (Status / Created / Updated) stay
  reachable.
- The Dictionary term + Query Examples lists get the same `max-height` + prominent scrollbar; the right-pin
  for their (flex) layout is a separately-verified follow-up.

### Verification
- IT-149's narrow-list test was **rewritten**: it now asserts the recency remove control is **in the viewport
  without any scrolling** (the previous test scrolled the container programmatically — green while the real
  affordance was broken). 5/5 GREEN at 1280px; RED on `main` (rv not pinned → overflows off-screen).
  `feature-complete` green-for-change.
- Measured at 1440px: the recency header's right edge moved 1551 → **1424** (now on-screen); the recency cell
  is 169px and the 145px "Viewed … ✕" tag fits inside it.

Milestone: 1.0.0 · Docs: no change (layout fix, no new user-facing concept).

Part of #1816

🤖 Generated with [Claude Code](https://claude.com/claude-code)
