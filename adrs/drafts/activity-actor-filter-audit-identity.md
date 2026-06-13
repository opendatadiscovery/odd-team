# ADR (draft) — Activity feed makes the User / Owner / actor distinction explicit

- **Status:** draft — GATE 1 re-sign-off required after the maintainer reframe (CTRIB-010, 2026-06-13).
  Supersedes the earlier "deprecate `user_ids`" framing (Variant A) — see History.
- **Date:** 2026-06-13
- **Driver:** odd-platform issue [#1657](https://github.com/opendatadiscovery/odd-platform/issues/1657) (milestone 0.28.0); CTRIB-010
- **Related:** `adrs/drafts/platform-info-popover-affordance.md` (the inline help affordance this uses);
  published ADR-0021/0022 (activity cursor pagination / single view-mode enum); prior-art draft PR #1658;
  `state/release-plan-2026-06.md`; `retrospectives/LSN-020`.

## Context

ODD has two distinct identities that the Activity feed conflates (full model:
memory `reference_odd_user_vs_owner_actor_model`):

- **User** — whoever has access (3rd-party IdP or login form). Their external identity is recorded
  IMMUTABLY on each event as `activity.created_by`.
- **Owner** — an INTERNAL platform concept. A **User<->Owner association** (`user_owner_mapping`) maps a
  user to an owner; once associated, the user's actions are attributed to the **Owner** (the Owner name
  even replaces the user's name in the top-left UI). The association is MUTABLE — re-associating an owner
  re-attributes historical actions.

On the Activity feed this produces three *different* actor/asset axes that today are mislabelled:
1. **Owner of the asset** — who owns the data entity where the action happened (`OWNERSHIP.OWNER_ID`).
   Exposed today as the **Owner** filter. Correct, but unlabelled as "asset owner".
2. **The actor's CURRENT owner** — the owner currently associated with whoever performed the action
   (`USER_OWNER_MAPPING.OWNER_ID.in(userIds)` over the `created_by` join). Exposed today as the **User**
   filter — a misleading name, and silently mutable (re-association changes the result).
3. **The actor's external username** — `created_by`, immutable. **Not exposed at all today**, so an
   actor with no owner association is unfilterable, and there is no stable actor audit.

The action ROW compounds it: it renders `created_by.owner?.name || created_by.identity.username` — the
actor's *current* owner name, with no indication it is an association (so re-association silently changes
who an old action appears to be "by").

## Decision (the pattern)

**Surface all three axes explicitly and consistently; never collapse the external user identity, the
mutable owner association, and the asset owner into one ambiguous control.**

1. **Three activity filters**, each with an inline info `(i)` popover
   (`adrs/drafts/platform-info-popover-affordance.md`) stating exactly what it matches:
   - **Owner (of the asset)** — unchanged binding (`OWNERSHIP.OWNER_ID`); label/help clarify "owner of
     the data entity where the change happened".
   - **The actor's current owner** (renamed from "User") — unchanged binding (`user_ids` ->
     `USER_OWNER_MAPPING.OWNER_ID`); label/help clarify "the Owner currently associated with whoever made
     the change — mutable: changing the association changes this". **`user_ids` stays a first-class
     parameter — NOT deprecated** (it is a legitimate axis, just badly named before).
   - **User (external username)** — NEW; binds `usernames` -> `ACTIVITY.CREATED_BY.in(usernames)`;
     immutable; works for users with no owner association. Fed by a new `GET /api/activity/users`
     (distinct `created_by`, enriched with the current owner name for display).
2. **The action row shows BOTH names**: the immutable external **username** (`created_by`) AND the
   **current associated owner name** — e.g. "A (as Owner B)" — so filter values and row values are
   consistent: filtering User=A or actor-owner=B both surface the same rows that the card labels A/B.
   A user with no association shows just the username.
3. **Contract: purely additive.** Add `usernames` to `/api/activity`, `/api/activity/counts`,
   `/api/dataentities/{id}/activity`; add `GET /api/activity/users`; KEEP `user_ids` unchanged. No
   deprecation, no removal, no breaking change — honours the 0.28.0 "no contract breaks" rule cleanly.
4. The enumeration endpoint uses offset pagination (`page`/`size`) like every other list endpoint;
   ADR-0021's cursor rule is scoped to the feed stream (its own text) — the structural scan is scoped to
   `getActivity`, ADR-0021 text unchanged.

## Consequences

- The feed becomes self-explanatory: an operator can audit "what did external-user A do" (stable),
  "what did the team currently-owned-by B do" (current association), and "what happened to assets owned
  by C" — three clearly-distinct questions, each with inline help.
- Filter/row consistency removes the silent re-attribution surprise.
- Compat: additive only; old `user_ids` callers are unaffected.
- The structural LSN-020 pin (`ActivityActorFilterKnownBugTest`) is replaced by a behavioural test
  (`ReactiveActivityRepositoryActorFilterTest`) — the actor-by-username path is proven; the
  actor-by-current-owner path remains valid (now intentionally, with a clear name).
- A new reusable info-popover component (its own ADR) lands as a side effect; future ambiguous controls
  can adopt it.
- Docs: the `release/0.28.0` train rewrites the Activity-feed filters section for the three axes + the
  dual-name rows; the released-truth correction on docs `main` (the "entity-ownership axis" error) still
  ships immediately.
- Promotion: on acceptance, this draft + the info-popover draft become published ADR-log entries.

## History

- **v1 (superseded):** "replace/deprecate `user_ids` with `usernames`" (additive-deprecate, Variant A) —
  implemented + tested, then reframed by the maintainer (2026-06-13): the real defect is the
  User/Owner *terminology confusion* and the missing immutable axis + dual-name rows, not the binding of
  one filter. v1's BE (the `usernames` filter + `/api/activity/users` + tests + IT-129) is REUSED; v1's
  `user_ids` deprecation is reverted; the FE expands from a rebind to three filters + dual-name rows + the
  info affordance.
