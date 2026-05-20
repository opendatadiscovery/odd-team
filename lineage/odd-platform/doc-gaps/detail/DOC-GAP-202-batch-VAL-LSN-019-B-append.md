#### Batch VAL-LSN-019-B STRENGTHENS — Service-tier `ownerIds`-dropped-for-non-ALL discovery + class-tier `ActivityType` dispatch confirmation

Stress Protocol validation batch adds the SERVICE-TIER `getActivityList` dispatch switch primary source for the activity-feed two-tier taxonomy reconciliation finding. The catalog now has 3-LAYER coverage on this entry: **controller-method (batch T `getActivity` sidecar — original PRIMARY SOURCE) + controller-class (batch VAL-LSN-019-B `ActivityController` class-tier `ActivityType` enum-handling) + service-tier (batch VAL-LSN-019-B `ActivityServiceImpl` 4-arm dispatch switch)**.

**NEW SUB-FINDING — `ownerIds` query parameter SILENTLY DROPPED for non-ALL view modes**:

- **ActivityServiceImpl service-tier sidecar `stress_findings.S-B-2`** confirms verbatim: "**`getActivityList` drops `ownerIds` for non-ALL view modes**. Trigger: `:107-116` switch on `ActivityType`: ALL passes `ownerIds` to `fetchAllActivities`; MY_OBJECTS / UPSTREAM / DOWNSTREAM do NOT thread `ownerIds` through. Question: The HTTP API exposes `ownerIds` as a query parameter on `/api/activity` regardless of `type`. Does the parameter take effect for `type=MY_OBJECTS`? For `type=UPSTREAM`? Resolution: TRACE-answer (STATIC-INFERRED) — line 108 (`fetchMyActivities(beginDate, endDate, size, datasourceId, namespaceId, tagIds, userIds, eventTypeDto, lastEventId, lastEventDateTime)`) accepts NO `ownerIds`; line 110/112 (`fetchDependentActivities(... List<Long> userIds, ActivityEventTypeDto eventType, Long lastEventId, OffsetDateTime lastEventDateTime, LineageStreamKind lineageStreamKind)`) also accepts NO `ownerIds`. The HTTP-API-visible `ownerIds` query parameter is **silently ignored** for MY_OBJECTS / UPSTREAM / DOWNSTREAM modes. **Operator-visible drift:** an operator filtering 'show me Alice's activity on UPSTREAM entities' by setting `type=UPSTREAM&owner_ids=[alice]` gets the WHOLE UPSTREAM lineage's activity, unfiltered by owner. Severity: MEDIUM (the filter silently disappears)."

- **ActivityServiceImpl `bugs_limitations_corner_cases.[1]`** anchors severity MEDIUM: "**`ownerIds` query parameter is silently dropped for `type=MY_OBJECTS|UPSTREAM|DOWNSTREAM`**, asymmetric with `type=ALL`. Per S-B-2 stress finding. An operator setting `type=MY_OBJECTS&owner_ids=[5]` gets ONLY their own owner's activity (the owner-5 filter is ignored). Severity: MEDIUM. Evidence: lines 107-116 (switch dispatching to `fetchAllActivities` only for `null` and `ALL`; the other branches drop `ownerIds`)."

**The ownerIds-dropped finding extends DOC-GAP-202 with a THIRD undocumented mechanism**:
1. **(original DOC-GAP-202)** The `ActivityType` enum's four values (MY_OBJECTS / UPSTREAM / DOWNSTREAM / ALL) are an entirely separate axis from `ActivityEventType` and are undocumented on the live page.
2. **(original DOC-GAP-202)** The "additional internal types" referenced in the info box are the `systemEvent=true` discriminator class (per DOC-GAP-191 the enum has 27 values; the live page describes 20-24 depending on counting convention).
3. **(NEW batch VAL-LSN-019-B)** The `ownerIds` query parameter is SILENTLY DROPPED for three of the four `ActivityType` values; only `type=ALL` (and the default `type=null`) respect the filter.

**Operator-impact widening**: a security-compliance operator running a "all activity by owner X across UPSTREAM entities" report by setting `type=UPSTREAM&owner_ids=[X]` gets the WHOLE UPSTREAM lineage's activity — the owner-X filter silently disappears. The operator's report is wrong; the data leak is across owners. Combined with DOC-GAP-200 (zero authorization) and DOC-GAP-025 (cross-owner visibility), the operator-trap is now THREE-DIMENSIONAL: (a) no authorization gates the endpoint, (b) the visibility-scoping ownership filter silently drops for 3 of 4 view modes, (c) the operator has no in-band signal that the filter was ignored. The doc-side fix at DOC-GAP-202 (extend the live page with the `ActivityType` axis) should ALSO add a per-mode filter-applicability matrix:

| Filter parameter | type=null/ALL | type=MY_OBJECTS | type=UPSTREAM | type=DOWNSTREAM |
|---|---|---|---|---|
| `owner_ids` | applied | **silently dropped** | **silently dropped** | **silently dropped** |
| `user_ids` | applied | applied | applied | applied |
| `tag_ids` | applied | applied | applied | applied |
| `event_type` | applied | applied | applied | applied |
| `begin_date` / `end_date` | required | required | required | required |
| `size` | required-in-spec, nullable-in-code (see DOC-GAP-202 sibling DOC-GAP-257? — actually DOC-GAP-202 + size finding is sub-issue noted in original DOC-GAP-202 evidence) | same | same | same |

The per-mode-filter-applicability matrix is a high-leverage doc-product addition — one table replaces 4 paragraphs of prose AND surfaces the operator-trap surface in scannable form.

**Service-tier widening of the doc-side fix**: the proposed `features/active-platform-features/activity-feed.md` extension should be re-shaped to lead with the per-mode-filter-applicability matrix, then the `ActivityType` axis enumeration, then the visibility/authorization caveat (cross-link to DOC-GAP-025 + DOC-GAP-200). The original DOC-GAP-202 framing was "the page treats `type` as if it doesn't exist"; the strengthened framing is "the page treats `type` as if it doesn't exist AND the `ownerIds` filter silently behaves differently across the four `type` values".

The 3-LAYER coverage now spans controller-method + controller-class + service-tier; the operator-trap surface is materially widened by the NEW `ownerIds`-dropped sub-finding.
