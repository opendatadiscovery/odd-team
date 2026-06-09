---
playbook: user-facing-verification
status: active
since: 2026-06-09
applies_to: universal (code-issue drafts)
---

# PROTOCOL user-facing-verification

A user-facing claim derived from static code is not a verified claim. What the back-end code does and what the user sees are different systems: the front end transforms the back-end response (de-dup, formatting, empty-state handling), and a single screen composes several endpoints that can contradict each other. Only the running, assembled feature is authoritative for "what does the user actually experience." This protocol gates a code-issue draft's `## User-facing impact` section the way `live-site-verification` gates a documentation change. Per `retrospectives/LSN-031`.

## trigger

- Any code-issue draft (`issues/{repo}/{PLT|COL|SPEC}-NNN.md`) before it leaves `draft` for filing.
- Any `feature-reflector` verdict whose observable is a property of the running system (see `feature-reflector` Rule 12) - the verdict is `probe-needed` and this protocol's "drive it" step is how the probe is satisfied.
- Any `/review` of a code-issue item.

## inputs

- the draft's `## User-facing impact` claim (who the user is, what they do, what they see)
- the feature's entry surface: the UI route (SPA path), the HTTP endpoint(s), and the front-end component that renders the response
- a local running stack when one is available (`auth.type=DISABLED` default is fine for most reads)

## procedure

1. **Name the user and the surface.** Operator / API consumer / end user; the UI screen or the HTTP response they actually see. If the issue is back-end-only (no UI), the "surface" is the HTTP response or the operational effect (the 500, the dropped alert).

2. **Drive the running feature - do not infer from code.**
   - **UI surface:** load the SPA route; perform the action; observe the rendered result. Capture the on-screen numbers (counts, badges, row counts), not just the API payload.
   - **HTTP surface:** `curl` the endpoint(s) and record status + the relevant body shape.
   - **Read the front-end component** that consumes the response. The back-end payload is NOT what the user sees: check for client-side de-dup (normalised store keyed by id), formatting, empty-state branches, and silent error handling. The PLT-176 failure was exactly here - BE returns 20 rows, FE de-dupes to 5.

3. **Check cross-endpoint on-screen consistency.** If the screen shows a count/badge/summary ALONGSIDE a list (or any two surfaces fed by sibling endpoints), drive BOTH and confirm they agree. A count that disagrees with the list it labels is a user-facing bug the single-chain trace cannot see. (PLT-176: `/api/activity/counts` = 20 vs 5 rendered rows.)

4. **State the verified impact + correct the fix scope.** Write what the user actually observes, including any FE/BE contradiction and any sibling endpoint that shares the defect (so the fix covers every surface, not just the one in the original chain).

5. **If it genuinely cannot be run locally** (RBAC unobservable under `auth.type=DISABLED`; a 202-returning receiver / SMTP relay not available; a multi-replica race) - set frontmatter `user_facing_verified: false` with a one-line reason, and confine the user-facing claim to what the front-end code + HTTP contract support, explicitly labelled static. Do NOT present a static claim as observed.

## exit

- The draft's `## User-facing impact` cites what was OBSERVED on the running system (the screen state / the HTTP response), OR carries `user_facing_verified: false` + the concrete reason.
- Any FE/BE contradiction and any sibling-endpoint surface is named, and the `## Suggested fix` scope covers every affected surface.
- No banned phrases (per `playbooks/claim-inventory.md`): a user-facing claim is "observed via {drive}" or "NOT observed -> static-only, user_facing_verified: false" - never "renders as", "the user sees", "the UI shows" without a drive behind it.

## on-fail

- The static claim contradicts the running system (PLT-176 class): rewrite the `## User-facing impact` and `## Suggested fix` to the observed reality; if the item was already `review-ready`/filed, flip to `blocked` and surface. Capture the observation (screen numbers / HTTP excerpt) in the draft so it is not re-driven to diagnose.
- Cannot run locally and the front-end code is ambiguous: mark `user_facing_verified: false`, keep the draft, and do not file the user-facing claim as fact.

## case-law

- `retrospectives/LSN-031-reflection-confirms-user-facing-behaviour-from-static-code-not-the-running-system.md` - PLT-176: the reflection asserted "duplicate rows"; the running UI showed a count of 20 over a list of 5 (FE de-dupes; the count endpoint shares the fan-out). The whole code-issue corpus is statically authored, so every user-facing claim is unverified until driven; this gate + `feature-reflector` Rule 12 close it.
- `retrospectives/LSN-020-activity-userids-filter-binds-to-owner-id-no-top-down-reflection.md` - created the top-down reflection layer (same feature, F-021); its blind spot was that reflection never executes, which this gate fixes.
- `playbooks/live-site-verification.md` - the documentation analogue (build-time rendering != live rendering, as static code != running feature).
