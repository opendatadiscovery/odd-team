---
doc_gap_id: DOC-GAP-303
severity: HIGH
category: drift
batch: ZI
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-08"           # Activity Feed (audit-trail surface) — User filter sits on the global Activity page
  - "P-09"           # Security & Access Control (LSN-020 instance)
related_features:
  - F-001            # Activity Feed
related_doc_gaps:
  - DOC-GAP-025      # Activity Feed cross-owner audit-trail exposure (sibling activity-feed doc-coverage)
  - DOC-GAP-200      # ActivityController zero-RBAC (sibling activity-feed authorization silence)
  - DOC-GAP-202      # Activity-feed two-tier taxonomy (sibling activity-feed completeness)
  - DOC-GAP-171      # user-owner-mapping table growth + cross-provider username collisions
related_retrospectives:
  - LSN-020          # name-vs-implementation drift class (canonical anchor)
  - LSN-001          # operator-trap canonical
  - LSN-002          # operator-trap canonical
  - LSN-018          # Rule-6 coherence-conflict mechanism
---

## DOC-GAP-303 — Activity Feed live doc REINFORCES the wrong promise on the `User` filter — verbatim "show events **performed by** one or more selected users (multi-select). Useful for auditing a specific person's platform activity" — but the SQL at `ReactiveActivityRepositoryImpl.java:272-273` binds `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (filters by OWNER-of-the-affected-entity-via-user-owner-mapping, NOT by the actor who performed the action); a compliance reviewer following the doc's guidance to "audit Alice's platform activity" by setting `userIds=[alice_id]` gets activity ON ENTITIES OWNED BY Alice's mapped-owner, MISSES Alice's actual actions on other owners' entities, AND collects activity by OTHER actors that happen to touch Alice-mapped entities — the operator-facing label, the doc copy, AND the UI label all align on the wrong promise; the actual actor column (`activity.created_by`) is read by the LEFT JOIN but is NEVER FILTERED — the available-but-unused column is the canonical LSN-020 instance at the canonical doc surface

**Severity**: HIGH
**Category**: drift (LSN-020 NAME-vs-IMPLEMENTATION class — doc + UI label + SQL all disagree; doc reinforces the wrong promise verbatim)

### Surfaced by

- `odd-platform__ts__routes__route__activity.md:docs_link_semantic.doc_drift_findings.[0]` ("The live doc page's User filter description ('show events **performed by** one or more selected users') promises filtering by who-performed-the-action, but the Filters component (`components/Activity/Filters/Filters.tsx:93-98`) binds `userIds` to a query parameter that — per the existing `ActivityController.getActivity` sidecar and LSN-020 — translates at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (i.e. filters by owner-of-entity via the user-owner mapping). The doc copy reinforces the wrong promise: a user without an owner mapping returns empty; reassigning a user-owner association retroactively rewrites who looks responsible for past actions. This is the same drift category as LSN-020, surfaced now at the UI layer where the operator first encounters the misleading label. The doc page does NOT warn about this translation.") **(NEW batch ZI — activity-route sidecar PRIMARY SOURCE)**
- `odd-platform__ts__routes__route__activity.md:bugs_limitations_corner_cases.[4]` (HIGH per sidecar — "Backend `userIds` filter does not honour the parameter name (LSN-020) — bound to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` not to `activity.created_by`. The UI Filters panel (`components/Activity/Filters/Filters.tsx:93-98`) labels the filter `t('User')` — and the live doc reinforces the wrong promise — but the SQL filters by owner-of-entity. The label is operator-misleading; this is the route's most material LSN-020 exposure point.")
- `odd-platform__ts__routes__route__activity.md:security.known_security_gaps.[2]` (HIGH per sidecar — "Doc page's 'User' filter description ('show events **performed by** one or more selected users') misleads operators about what the filter actually does. The `userIds` query parameter binds at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (per LSN-020). A security/compliance reviewer setting `userIds = [insider-suspect-id]` to audit that user's actions would get rows of activity on entities OWNED BY that user-via-mapping, NOT actions PERFORMED BY that user. Misses the actual actor (`activity.created_by`) entirely.")
- `odd-platform__ts__routes__route__activity.md:stress_findings.request_inputs.[0]` (the Category F probe trail — surfaces the LSN-020 mechanism by REFERENCE to `odd-platform__java__ActivityController__controller-method__getActivity` for the SQL trace)
- Inherited PRIMARY SOURCE via DOC-GAP-200 — `odd-platform__java__ActivityController__controller-method__getActivity.md` carries the SQL evidence; THIS finding adds the UI-LABEL + DOC-COPY layer where the operator first encounters the drift
- LSN-020 — canonical case-law anchor for the NAME-vs-IMPLEMENTATION drift class

### Evidence

- **Code primary source — the SQL bind**: `ReactiveActivityRepositoryImpl.java:272-273` (per ActivityController sidecar primary source): the `userIds` query parameter is bound at the JOOQ layer to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`. The activity row's actor column (`ACTIVITY.CREATED_BY`) is part of the LEFT JOIN but is NEVER referenced in any WHERE clause. The available-but-unused column is the canonical LSN-020 shape.
- **UI primary source — the filter label**: `components/Activity/Filters/Filters.tsx:93-98` (per activity-route sidecar) — the filter is labelled `t('User')`. The internationalisation key resolves to "User" in the English locale; the label promises "filter by user" with no qualifier about whether the user is the actor or the owner.
- **Live doc primary source — fresh WebFetch this session**: `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-26 status **200**. Verbatim User-filter description: *"show events **performed by** one or more selected users (multi-select). Useful for auditing a specific person's platform activity."* The doc explicitly uses the phrasing "performed by" — the same shape the operator's mental model defaults to (the user filter on every other platform's audit-trail surface filters by actor).
- **The contrast with the Owner filter**: the same live doc page describes the Owner filter as *"show events on entities with one or more selected owners (multi-select). Useful for 'what happened to my team's data this week'"* — verbatim. The Owner filter is correctly described (filters by owner of the affected entity). The User filter is incorrectly described (the doc says "performed by" but the SQL filters by user-mapped-owner of the affected entity — the SAME column the Owner filter binds to, via the user-owner-mapping translation).
- **The available-but-unused column mechanism (LSN-020 canonical)**: `ACTIVITY.CREATED_BY` is populated on every row at INSERT time (via `ActivityServiceImpl.save(...)` per sidecar — it captures the actor's identity from the request context). Every row carries the actor. The repository JOIN reads the column for display (the UI shows "Alice changed X" in the row, sourced from `CREATED_BY`). But the WHERE clause never filters on it. The available-but-unused shape is the canonical LSN-020 surface: the column the input NAME ("User", "performed by") promises IS in the schema, IS read for display, but is NOT filtered against. The filter binds to a DIFFERENT column (`USER_OWNER_MAPPING.OWNER_ID`) that has SIMILAR but distinct semantics.
- **The operator-impact narrative (compliance reviewer)**: a security / compliance reviewer is asked to audit "what did Alice do on the platform last week" — a standard SOX / GDPR audit task. They open the Activity Feed page, set the date range, set the User filter to Alice's user account, expect to see Alice's actions. They get: (a) zero rows if Alice has no user-owner mapping (the reviewer wonders if Alice was inactive); (b) rows of activity on entities owned by Alice's MAPPED-OWNER if Alice has a mapping (which may include actions BY OTHER USERS — Bob editing a description on a dataset Alice's mapped-owner owns); (c) MISSING actions Alice performed on entities owned by OTHER owners (Alice editing a description on Bob's dataset is NOT returned because the row's entity owner is not Alice's mapped-owner). The reviewer's audit is silently wrong in three independent ways. The doc surface tells them the filter does what they expected; the system gives them something else.
- **The retroactive-rewrite operator-impact**: reassigning Alice's user-owner mapping from `owner_id=10` to `owner_id=20` retroactively changes which rows the User-filter returns for `userIds=[alice_id]`. Historical audit queries return DIFFERENT row sets depending on when they're run. This compounds the doc-promise drift: a reviewer who runs the same query a week apart and gets different results has no doc-side warning that the filter's semantic depends on a mutable mapping.
- **The cluster context — distinctness from DOC-GAP-025 / DOC-GAP-200 / DOC-GAP-202**: this finding is structurally distinct from the three prior activity-feed doc-gaps:
  - DOC-GAP-025 covers cross-owner audit trail EXPOSURE (the visibility-scope admonition)
  - DOC-GAP-200 covers the controller's zero-RBAC wiring (the access-control admonition + the api-reference page)
  - DOC-GAP-202 covers the event-type + request-type axis taxonomy completeness
  - **THIS finding (DOC-GAP-303)** covers the FILTER PROMISE drift — the LSN-020 NAME-vs-IMPLEMENTATION instance at the canonical doc surface for the canonical audit-trail feature. The three prior findings make the doc surface silent on enforcement model; THIS finding makes the doc surface ACTIVELY WRONG on filter semantics.

### Proposed doc action

**TWO-PART action — doc-side rewrite + cross-link sweep.**

1. **Doc-side PRIMARY — rewrite the User filter description in `documentation/docs/features/active-platform-features/activity-feed.md`** (the live doc page).

   Replace the current verbatim copy ("show events **performed by** one or more selected users (multi-select). Useful for auditing a specific person's platform activity") with an accurate description:

   > **User** — show events on entities whose owner is mapped to one or more selected users via the user-owner mapping (multi-select).
   >
   > **What this filter is NOT.** This filter does NOT filter by the actor who performed the action. The Activity Feed stores the actor on each row (`activity.created_by`), and the row's text always identifies the actor ("Alice changed the description"), but **the User filter binds to USER_OWNER_MAPPING.OWNER_ID, not to created_by**.
   >
   > **Compliance / audit caveat.** To audit a specific person's actions across the platform, **this filter is not sufficient**. A user without an owner mapping returns zero rows; reassigning a user-owner association retroactively rewrites which rows match. For an actor-based audit, query the platform's activity API directly with a filter on `created_by` (no such filter is currently exposed on the API — see [api-reference/activity](../../developer-guides/api-reference/activity.md) and DOC-GAP-200/DOC-GAP-303 for tracking).
   >
   > **What this filter IS.** Use it to answer "which activity touched entities owned by the team(s) mapped to these users?" — e.g. select the lead engineer of a team to see activity on the team's data assets.

2. **Doc-side COMPANION — extend the Filters section preamble** (above the filter enumeration) with a short note: *"Each filter binds to a specific column at the SQL layer. Most filter names match operator expectations (datasource, namespace, event type, tags, owners, calendar); the User filter is an exception — see its description below."* This preamble warns the casual scanner; the per-filter description gives the precise behaviour.

3. **Code-side OPTIONAL — three ordered options at `/log-issue odd-platform`**:

   - **Minimum (rename)**: rename the UI label and the `userIds` query parameter to `user_owner_ids` / `userOwnerIds` (or `affectedOwnerIds`) to match the implementation. Breaking change at the API surface; deprecation period via OpenAPI `x-deprecated`.
   - **Medium (add the actor filter)**: add a new `createdByIds` query parameter that binds to `ACTIVITY.CREATED_BY.in(...)`. Surfaces the actor-based audit the operator expects. The existing `userIds` parameter is retained for the user-owner-mapping use case (and renamed in doc copy only). Compliance reviewers get the audit they need.
   - **Full (fix the filter)**: change the `userIds` SQL bind from `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` to `ACTIVITY.CREATED_BY.in(userIds)`. Aligns the filter's behaviour with its name. Backwards-incompatible for any caller relying on the existing semantics. RECOMMENDED — the simplest fix, but requires a deprecation cycle.

### Cross-references

- **DOC-GAP-025** (Activity Feed cross-owner audit trail exposure — sibling activity-feed doc-coverage; THIS finding is the FILTER-PROMISE-DRIFT dimension that compounds the visibility-scope dimension)
- **DOC-GAP-200** (NEW batch T — ActivityController zero-RBAC; sibling activity-feed access-control silence; THIS finding shares the LSN-020 mechanism with DOC-GAP-200's `userIds` enumeration probe gap)
- **DOC-GAP-202** (NEW batch T — Activity-feed two-tier taxonomy; sibling completeness gap on a different axis)
- **DOC-GAP-171** (user-owner-mapping table growth + cross-provider username collisions — THE mechanism that makes the filter behaviour MUTABLE; without a stable user-owner mapping, the User filter's row set drifts across reassignments)
- **DOC-GAP-095 META** (Read-collaborative cross-owner enumeration cluster) — THIS finding strengthens the cluster with the FILTER-LEVEL instance: even when the operator NARROWS by a user, the result set is governed by a different semantic than the name promises
- **DOC-GAP-149 META** (REV-3 LAYER-0 — P-09 Security & Access Control pillar-claim vs doc-page coverage drift) — THIS finding is a direct LSN-020 instance on the audit-trail surface, the canonical place where security & access control posture should be operator-clear
- **LSN-020** (canonical NAME-vs-IMPLEMENTATION drift class) — THIS finding is the doc-surface canonical instance of LSN-020: a user-facing filter named for a column the SQL never touches
- **LSN-001 / LSN-002** (operator-trap canonical) — compliance reviewer following the doc gets silently-wrong audit results

### Severity rationale

HIGH. The doc surface is ACTIVELY WRONG (not silent — silent would be MEDIUM per the DOC-GAP-025 / DOC-GAP-200 framing); the operator's mental model is REINFORCED in the wrong direction; the consequence is a compliance/audit failure that the operator cannot detect without code inspection. Severity equals DOC-GAP-025 / DOC-GAP-200's HIGH on the same surface because:

1. **The filter is the primary tool for audit-narrowing**: every compliance audit on an authenticated catalog starts with "show me what user X did". The User filter is the natural starting point. The doc's "performed by" copy tells the operator they're done; the implementation gives them something different.
2. **The result is silently wrong**: there is no error, no warning, no admonition. The operator gets rows, infers their audit is complete, files the audit conclusion. The error compounds over time as user-owner mappings shift.
3. **The available-but-unused column is the canonical LSN-020 shape**: `activity.created_by` IS in the schema AND IS read for display; the WHERE clause uses a different column. This is the exact shape LSN-020 was authored to catch.
4. **The doc surface is the canonical surface for the canonical audit feature**: this is the live `/features/active-platform-features/activity-feed` page — the page operators land on when they search "activity feed audit user filter" or follow the platform's left-nav. The page is the highest-leverage fix site.

Severity is NOT CRITICAL because the platform does not silently corrupt data and there is no security boundary crossed — the data exposed via the filter IS scoped to data the caller is already allowed to read (per the broader read-collaborative posture, DOC-GAP-200). The harm is operator-misleading at the audit / compliance / forensic surface; the fix is a doc rewrite + cross-link.

### Last verified

- 2026-05-26 — activity-route sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` status **200** (direct fetch this session — verbatim "performed by" copy confirmed) + inherited PRIMARY SOURCE via DOC-GAP-200's ActivityController.getActivity sidecar (SQL bind at ReactiveActivityRepositoryImpl.java:272-273) + LSN-020 case-law anchor.
