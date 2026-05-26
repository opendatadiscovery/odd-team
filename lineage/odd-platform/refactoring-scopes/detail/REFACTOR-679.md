## REFACTOR-679 — Activity page's default 6-day window (`beginDate = now - 5 days`, `endDate = now + 1 day`) is computed at MODULE-EVAL TIME and is NOT stamped into the URL; sharing the URL `/activity` with a colleague yields a different window on their side because their `now` is different — silent semantic drift across share-time

**Severity**: MEDIUM
**Category**: time-relative-default-not-url-stamped / cross-time-share-fidelity-leak
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-04 Activity]

**Surfaced by**:
- `odd-platform__ts__routes__route__activity.md:bugs_limitations_corner_cases[3]` (MEDIUM) — "The route does not implement a redirect from `/activity` (bare) to `/activity?<defaults>` — visiting `/activity` directly relies on the consumer (`ActivityResults.tsx:26`) calling `useQueryParams<ActivityQuery>(defaultActivityQuery)` which fills in defaults at the React-state layer but does NOT push them into the URL. The URL stays `/activity` (no query string visible to the user) while the page renders the default 6-day window with `type=ALL`. Sharing the URL with a colleague then surfaces the same default 6-day window relative to THEIR `now`, not the original visitor's `now` — silent semantic drift across share-time. This is by design (the `defaultActivityQuery` is recomputed each render), but operators who expect 'the URL I shared = the view I saw' will be surprised."
- `odd-platform__ts__routes__route__activity.md:stress_findings.tunables[default-window]` — "default-window: beginDate / endDate — startOfDay(now - 5 days) / endOfDay(now + 1 day) (a ~6-day window). The 6-day default is a UI choice, not enforced server-side."

**Description**: The Activity feature page renders by default a 6-day window of activity events. The window bounds are computed at module-evaluation time as:

```typescript
// components/shared/elements/Activity/common.ts:33-41
export const defaultActivityQuery: ActivityQuery = {
  beginDate: startOfDay(addDays(new Date(), -5)),
  endDate: endOfDay(addDays(new Date(), 1)),
  size: 30,
  type: ActivityType.ALL,
};
```

The values are JavaScript `Date` objects. When a user navigates to `/activity` directly (bare URL, no query string), the consumer (`ActivityResults.tsx:26`) calls `useQueryParams<ActivityQuery>(defaultActivityQuery)` which:

- Returns the `defaultActivityQuery` values as the IN-MEMORY query state.
- Does NOT push the values into the URL bar — the URL stays `/activity` (no query string).
- Fires `fetchActivityList` with the in-memory values.

**The semantic drift**: User A visits `/activity` on Monday at 10:00. The page renders activity from Wednesday-of-the-previous-week through Tuesday-of-this-week (the 6-day window relative to Monday at 10:00). The URL stays `/activity`. User A copies the URL and shares it with User B who opens it on Friday at 18:00. The page on User B's screen renders activity from Sunday through Saturday (the 6-day window relative to Friday at 18:00) — a COMPLETELY DIFFERENT window than User A saw. User A and User B both believe they shared "the same Activity view" because the URL is identical.

**Why this is operator-visible**:
- A bug-reporting workflow ("here's what I see at /activity") fails because the linked URL shows different data to the recipient.
- An audit-trail workflow ("I'm reviewing the activity for the last week — here's the link") fails because the recipient's window doesn't match the auditor's.
- A "check this weird event I just saw" workflow ("look at the green deployment at /activity") fails because the event may be outside the recipient's window.

**Why this is by design (and the design is wrong)**: the `defaultActivityQuery` is recomputed by JavaScript's `new Date()` evaluation. The choice to NOT push the resolved values into the URL was deliberate (the bare URL `/activity` is short and shareable). But the consequence — that the URL bears no time-window information — defeats the URL's purpose as a share-handle.

**Compounding issue**: even when the user EXPLICITLY interacts with the calendar filter (changing the window), the URL DOES get updated (per `Filters.tsx:80-90` writing to `setQueryParams`). The bare-URL default-window case is the ONE case where the URL doesn't capture the rendered state.

**Operator-visible failure modes**:
1. Cross-time URL sharing — A and B see different data.
2. Bookmark fidelity — bookmarking `/activity` on Monday shows different data on Friday.
3. Cross-timezone (compound with timezone considerations) — A in UTC+0 and B in UTC+8 see different days even at the same shared moment.

**Evidence**:
- `components/shared/elements/Activity/common.ts:33-41` (defaultActivityQuery computation)
- `components/Activity/ActivityResults/ActivityResults.tsx:26` (useQueryParams call — fills defaults but doesn't push)
- `routes/activityRoutes.ts:1-7` (no redirect logic from bare `/activity` to defaults-stamped URL)
- `components/Activity/Filters/Filters.tsx:80-90` (the contrasting case — explicit calendar interaction DOES update URL)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-230 NEW** (query-string view-mode dispatch) — this scope is the time-relative-default subcase that the convention does NOT defend against.
- No prior ADR governs URL-state-fidelity vs default-state-resolution.

**Proposed remedy**: Three viable paths:

**Path A — Stamp resolved defaults into URL on first render** (preferred):
```typescript
// In Activity.tsx mount:
useEffect(() => {
  if (!searchParams.toString()) {
    setSearchParams(toQueryString(defaultActivityQuery), { replace: true });
  }
}, []);
```
This pushes the resolved 6-day window into the URL the first time the user lands on `/activity`. The user sees `/activity?beginDate=...&endDate=...` after a fraction of a second; subsequent shares carry the timestamps explicitly.

**Path B — Redirect at the route level**:
Use a React-Router `<Navigate>` redirect from `/activity` (bare) to `/activity?<defaults>` — same pattern as ADR-CANDIDATE-232 (transient-URL redirects). This is more aggressive than Path A; it changes the URL the operator typed.

**Path C — Display a banner explaining the window is time-relative**:
Cosmetic; does not fix the underlying drift.

Recommended: Path A. Implements URL-state fidelity; does not change the user-visible affordance; backward-compatible with existing bookmarks (the bare-URL still works, it just resolves to a stamped URL).

Companion: update the live `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` doc page to describe the default-window behaviour (currently silent — composes with the activity sidecar's `doc_drift_findings`).

**Severity rationale**: MEDIUM — operator-visible failure with concrete share-fidelity consequences; bounded by the fact that most operators interact with the calendar (which DOES update the URL) before sharing, so the bare-URL case is the corner case. Severity reinforced because the drift is INVISIBLE to the user (no UI signal that the URL doesn't capture the window).

**Suggested backlog grouping**: `Activity UX clarity sprint` (composes with REFACTOR-053, REFACTOR-567 — the activity-feed family of operator-visible drifts).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-230 (query-string dispatch); REFACTOR-053 (activity exposure — share-friendly URLs make the exposure more easily-amplified).
- SUPERSEDES: none.
- CONFLICTS: none.
