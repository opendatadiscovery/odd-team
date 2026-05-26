# SHB-060 — "My objects" Activity view silently shows empty for users without an Owner association — discoverability gap, looks identical to "no activity"

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators using ODD's Activity Feed see four view-mode tabs: All / My objects / Upstream / Downstream. The "My objects" view requires a `user_owner_mapping` row binding the authenticated user's username to an Owner — without that mapping, the view silently returns ZERO activity. The UI presents this as "no recent activity for you," visually indistinguishable from a fresh deployment where the user genuinely has no activity. Users who have never associated their account with an Owner (the platform admin who set up RBAC for OTHERS but not themselves, a new joiner who created an account but never went through onboarding) experience the feature as broken. There is no UI affordance pointing them at "associate yourself with an Owner to enable this view." Compounds with the `getActivityCounts` Mono.zip's `defaultIfEmpty(0L)` — the count badge shows "0 My objects" reinforcing the empty appearance.

## Evidence

- `odd-platform-api/src/main/java/.../service/ActivityServiceImpl.java:194-198` — `fetchMyActivities` calls `authIdentityProvider.fetchAssociatedOwner().flatMapMany(...).switchIfEmpty(Flux.empty())`. The `switchIfEmpty(Flux.empty())` is the silent-empty branch.
- `ActivityServiceImpl.java:239-243` — `getMyObjectActivitiesCount` mirrors the pattern: `.switchIfEmpty(Mono.just(0L))` / `.defaultIfEmpty(0L)`. Returns 0 for unmapped users.
- Per ActivityServiceImpl sidecar `stress_findings.S-D-2` STATIC-INFERRED HIGH: "no error, no UI hint that the user has no Owner association." Severity MEDIUM (discoverability gap).
- `AuthIdentityProviderImpl.java:50-53` (referenced in ActivityServiceImpl sidecar `invariants.[3]`) — `fetchAssociatedOwner()` returns `getCurrentUser().flatMap(user -> userOwnerMappingRepository.getAssociatedOwner(user.username(), user.provider()))`. Returns `Mono.empty()` when no mapping row exists.
- Live Activity Feed doc (`features/active-platform-features/activity-feed`, verified 2026-05-10 + 2026-05-20 status 200): mentions a "My objects" view-mode but DOES NOT document the user-owner-association prerequisite. Per ActivityServiceImpl sidecar `docs_link_semantic.doc_drift_findings.[1]`: "The My objects view returns activity only for data entities owned by the Owner you are associated with. If no association exists, the My objects view is empty."
- The same silent-empty pattern applies to alerts' My tab — `AlertServiceImpl.listByOwner` (line 82-87) calls `authIdentityProvider.fetchAssociatedOwner()` and an empty owner-resolution means the Mono completes empty, the downstream flatMap never fires. Symmetric concern.
- `ActivityController.getActivity` sidecar `tests_coverage_semantic.uncovered_behaviours[2]` enumerates the silent-empty path under MY_OBJECTS but no test pins it.

## Notes

- This is BOTH an ENRICHER for F-021 (Activity Feed) AND a cross-cut for F-014 (Per-Entity Alert View) + the F-015 (My-Objects Anchor-Set Reads) pattern. The "silent empty for unmapped users" is a CROSS-CUTTING UX gap that affects every "My" view in the platform — alerts, activity, possibly data-entity directory views.
- The product-owner question: when an operator sets up ODD, is the User-Owner association expected to happen automatically (via OAuth claim → email match against an Owner created during onboarding)? Per the ODD model the association is a manual admin step — but the docs do not flag it as required for the "My" views to work.
- The fix is small and reversible: at the controller boundary, when the user has no associated Owner AND requests a MY_OBJECTS view, return a structured 200 response with `items: []` AND a `hint: "no_owner_association"` payload; UI renders an inline banner "Associate yourself with an Owner to enable this view" with a click-through to the User-Owner association page.
- Alternative: surface the missing association at the global navigation / profile widget level ("Your account is not associated with an Owner") so users see it across the whole product, not just on the Activity page.
- This is "open" not "clustering" because while the evidence is mature on the activity side, the cross-feature scope (every "My" view in the product) needs UI sidecars to confirm.

## Next

1. **Probe**: log in as a user with no `user_owner_mapping` row, navigate to Activity → My objects, observe the response. Then navigate to Alerts → My tab, observe.
2. **Read** UI sidecars for `Activity.tsx` + `Alerts.tsx` to confirm whether the UI distinguishes "user has no Owner" from "no activity in window."
3. **Graduate** as F-NNN "User-Owner association discoverability — silent-empty 'My' views across product." Pillar P-09 (RBAC / users + owners).
4. **REFACTOR-NNN MEDIUM** — controller-tier hint payload, UI inline banner, OR global "your account is not associated" widget. Three different fixes at increasing scope; the global widget is the highest-leverage one.
5. **DOC-NNN MEDIUM** — `features/active-platform-features/activity-feed` add the prerequisite explicit; `users-and-owners` (or equivalent) page should cross-link.

## Links

- cluster_with: [F-021, F-014, F-015, F-011]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — minted F-064 at lineage/odd-platform/feature-flows/detail/F-064.yaml (pillar P-07:F-007 "User-Owner Association Discoverability"). Evidence list spans TWO substrate axes (service tier + auth tier) PLUS the live-doc gap on activity-feed.md — sufficient for graduation per the 3-refs/2-axes threshold. The cross-feature framing (Activity My + Alerts My + future Owned My all share the same silent-empty chokepoint at AuthIdentityProviderImpl.fetchAssociatedOwner) is captured as F-064's `cross_feature_uniform_silent_empty_pattern_activity_alerts_my_objects_views` drift facet. Status flagged ui-incomplete per Rule 0b LSN-023 — the UI-dependent drift facets (silent-empty-vs-no-affordance, onboarding-workflow-gap) carry `ui_unverified: true` pending dedicated empty-state-component sidecar enrichment for Activity.tsx + Alerts.tsx. The pillar choice (P-07:F-007) reflects that the feature lives downstream of P-09's user_owner_mapping infrastructure but the operator-visible surface is the Active Platform Features pillar's read views.
