---
panel_run: 2026-05-22
phase: 1
expert: panel-adversary
axis: Coverage
commit_anchor: ede5d277
prompt_version: panel-adversary/0.1.0
spot_checks_total: 7
pass_rate: 0.57
axis_score: 6
axis_band: AMBER
---

# Phase 1 — Adversary (Coverage) assessment

## summary
Seven fresh spot-checks against odd-platform source: 4 COVERED-CORRECT, 2 PARTIAL, 1 MISSED-SILENT, 0 COVERED-WRONG. Where the ontology has a node sidecar, the coverage is genuinely deep and accurate — the attachment cap, GenAI auth, activity pagination boundary, and namespace cascade-delete were all traced precisely, including the misleading-name trap (`CascadeDeleteException` on a block-if-attached check). The gaps are all of one shape: a behaviour that lives in a substrate node that was **extracted but never enriched** (`DataEntityRunController.getRuns`), or in a class that is **not a substrate node at all** (`AlertActionResolverImpl`, the migration file). Coverage of *enriched* nodes is GREEN-grade; coverage of the *enrichment frontier* (159/395 nodes) is where reality leaks out.

## target_lens
The explicit target (`target.md` v1.1) makes conditions 1, 3, 10 the Coverage axis's own. Condition 1 demands honest coverage — `stress_verified_pct ≥ 0.80` over *all* enriched sidecars covering `≥ 90%` of trigger-carrying substrate nodes. Condition 3 demands the eight §1 promises answerable from a *randomly chosen* feature with zero forced source opens. Condition 10 demands the UI interaction layer threaded into every feature flow. The concrete bar my axis holds: **a skeptical maintainer who picks an arbitrary user-observable behaviour — not a pre-enriched one — must be able to find the truth of it in the ontology.** That bar is not cleared while a load-bearing capability (`getRuns`) sits in `nodes.jsonl` with no sidecar and no feature-flow, and while operator-relevant mechanisms (alert-halt suppression semantics, a migration's destructive `DELETE FROM activity`) are only fragmentarily present. The manifest's own `nodes_with_own_sidecar: 159 / 395` is the honest measure of how much of reality is still uncovered — the vanity number, by the target's own words.

## spot_check_ledger

- id: SC-1
  target: "AttachmentServiceImpl.getUploadOptions / uploadFileChunk — attachment.max-file-size enforcement"
  sampling_strategy: negative-space
  check: "When a non-browser client POSTs file chunks whose total size exceeds attachment.max-file-size, does the server reject the upload?"
  ground_truth: |
    No. `attachment.max-file-size` (an Integer @Value at AttachmentServiceImpl.java:27)
    is consumed in exactly ONE place — `getUploadOptions()` (line 60-62) returns
    `maxFileSize * 1_000_000` (decimal MB, not binary MiB) to the UI. `uploadFileChunk`
    (FileServiceImpl.java:58-67) calls `filePart.transferTo(...)` with NO size check;
    `completeFileUpload` (lines 70-76) has none either. The cap is a UI-side hint;
    a curl/script caller bypasses it entirely.
  ground_truth_evidence: "AttachmentServiceImpl.java:27, 60-62; FileServiceImpl.java:58-67, 70-76"
  ontology_claim: |
    The `attachment.max-file-size@L27` sidecar states this exactly: understanding §
    "the cap is therefore a UI-driven hint, not a server-side guard"; implicit_adrs[1];
    bugs_limitations_corner_cases[0] "Server-side bypass ... severity: HIGH"; also the
    MB-vs-MiB multiplier and the boot-crash-if-unset corner case.
  ontology_evidence: "understanding/odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:18, 60-61, 65-67"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  severity: n/a
  same-mistake-risk: "Low — I traced the consumer chain to FileServiceImpl independently before opening the sidecar; both the sidecar and I read the same `transferTo` with no guard, so a shared transcription error is conceivable but the absence of a size check is a structural fact, not an inference."

- id: SC-2
  target: "ActivityController.getActivity — `size` parameter boundary on the activity-feed list"
  sampling_strategy: boundary
  check: "When a caller passes size=Integer.MAX_VALUE (or null) to GET /api/activity, is there a server-side cap?"
  ground_truth: |
    No cap. `getActivity` (ActivityController.java:24-41) passes `size` to the service
    unchecked; ActivityServiceImpl.getActivityList threads it unchanged to the repository;
    ReactiveActivityRepositoryImpl.findActivities (line 290-292) does `.orderBy(CREATED_AT.desc,
    ID.desc).limit(size)`. No @Max, no null-default, no clamp. Pagination is keyset:
    `row(trunc(CREATED_AT,SECOND), ID).lessThan(lastEventDateTime, lastEventId)` — correct
    for append-only audit data.
  ground_truth_evidence: "ActivityController.java:24-41; ActivityServiceImpl.java:86-117, 179-181; ReactiveActivityRepositoryImpl.java:284-292"
  ontology_claim: |
    The getActivity sidecar covers this in three places: bugs_limitations_corner_cases[3]
    "`size` parameter has no documented or enforced upper bound"; performance.known_performance_gaps[0]
    "no @Max constraint ... severity: MEDIUM"; concepts.invariants — cursor pagination via
    (lastEventId, lastEventDateTime), "no offset/skip parameter".
  ontology_evidence: "understanding/odd-platform__java__ActivityController__controller-method__getActivity.md:156, 199, 26"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  severity: n/a
  same-mistake-risk: "Low — I read the real `.limit(size)` clause and the keyset predicate in the repository; the sidecar's claim matches the SQL I traced. Both could share an LLM blind spot on jOOQ `.limit(null)` behaviour, but the sidecar's claim is the absence of a cap, which I verified at the clause."

- id: SC-3
  target: "GenAIController.genAiQuestion — RBAC gate on POST /api/genai/ask"
  sampling_strategy: capability
  check: "When an authenticated user with no special permission calls POST /api/genai/ask, is the request permitted?"
  ground_truth: |
    Yes — permitted for any authenticated user. GenAIController (GenAIController.java:13-24)
    has no @PreAuthorize and no programmatic permission check. GenAIServiceImpl.getResponseFromGenAI
    (lines 36-39) gates only on `genAIProperties.isEnabled()` — a feature toggle, not RBAC.
    There is no GENAI_USE permission. Under auth.type=DISABLED the endpoint is anonymous.
    User free-text is forwarded verbatim to the external `{genai.url}/query_data`.
  ground_truth_evidence: "GenAIController.java:13-24; GenAIServiceImpl.java:36-47"
  ontology_claim: |
    The GenAIProperties sidecar states it exactly: security.authorization_assertions "[] —
    GenAIController has no @PreAuthorize ... Any authenticated user ... can invoke POST /api/genai/ask";
    security.known_security_gaps "GenAIController has no @PreAuthorize ... no GENAI_USE Permission ...
    Under auth.type=DISABLED the endpoint is fully open"; bugs_limitations_corner_cases[4] confirms
    API-only (no UI consumer).
  ontology_evidence: "understanding/odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:105, 114, 99"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  severity: n/a
  same-mistake-risk: "Low — I confirmed the absence of @PreAuthorize on the controller class directly and the isEnabled-only gate in the service. The sidecar reasons from the same files; the claim is a verifiable absence, not a behaviour requiring runtime."

- id: SC-4
  target: "NamespaceServiceImpl.delete — what happens when DELETE /api/namespaces/{id} hits a namespace with attached resources"
  sampling_strategy: random-walk
  check: "When an operator deletes a namespace that still has a datasource/term/collector/data-entity attached, what does the platform do?"
  ground_truth: |
    The delete is REFUSED. `NamespaceServiceImpl.delete` (lines 74-90) does Mono.zip of four
    `existsByNamespace*` checks; if ANY returns true it errors with `CascadeDeleteException
    ("Namespace cannot be deleted: there are still resources attached")`. Despite the exception
    NAME, this is NOT a cascade — it is a block-if-attached guard. It is application-tier
    (the FKs have no ON DELETE clause). The check+delete are not in one transaction (TOCTOU risk).
  ground_truth_evidence: "NamespaceServiceImpl.java:74-90; NamespaceController.java:38-42"
  ontology_claim: |
    The NamespaceController sidecar captures this precisely: concepts.invariants "Cascade-on-delete
    is application-tier-guarded across exactly 4 referent classes"; implicit_adrs "Cascade-on-delete
    is APPLICATION-tier-guarded (NOT FK-cascade-DB-tier)"; bugs_limitations_corner_cases[2]
    "TOCTOU class between cascade-check and concurrent referent insert ... severity: MEDIUM";
    tests_coverage_semantic enumerates one test per blocker class.
  ontology_evidence: "understanding/odd-platform__java__NamespaceController__controller-class__NamespaceController.md:41, 141, 153, 65-69"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  severity: n/a
  same-mistake-risk: "Low — this is the strongest defence against Rule 4: the method name `CascadeDeleteException` would mislead a name-truster, and the sidecar did NOT fall for it (it explicitly says 'block-if-attached', application-tier, not FK-cascade). I traced the four `existsByNamespace` checks myself and reached the same conclusion."

- id: SC-5
  target: "DataEntityRunController.getRuns — the per-entity test/job RUNS list (GET /api/dataentities/{id}/runs)"
  sampling_strategy: capability
  check: "When a user opens the runs history of a quality test or transformer, how is the list scoped and filtered — and what happens for an entity that is neither?"
  ground_truth: |
    `DataEntityRunController.getRuns` (DataEntityRunController.java:18-27) lists runs filtered
    ONLY by an optional `DataEntityRunStatus` enum + page/size — there is NO date-range filter.
    `DataEntityRunServiceImpl.getDataEntityRuns` (lines 27-45) first loads the entity, then
    filters via `checkIfDeClassSupposedToHaveRuns` (entity must be DATA_TRANSFORMER or
    DATA_QUALITY_TEST class); any other class → `BadUserRequestException` → HTTP 400 ("not
    supposed to have runs due to its class").
  ground_truth_evidence: "DataEntityRunController.java:18-27; DataEntityRunServiceImpl.java:27-45"
  ontology_claim: |
    Nothing. `DataEntityRunController controller-method:getRuns` exists as a substrate node
    (nodes.jsonl:216) but has NO sidecar in understanding/. No feature-flow threads it: F-022
    ("Per-Dataset Data Quality Test Reports & SLA") covers ONLY the 5 DataQualityController
    endpoints — the DataQualityController sidecar itself notes runs are "adjacent ... not the
    surfaces this controller exposes". No concept in concepts.yaml covers the runs list.
  ontology_evidence: "nodes.jsonl:216 (node present, unenriched); feature-flows/index.yaml:4515-4589 (F-022, no getRuns node); understanding/...DataQualityController...md:117"
  ontology_claimed_confidence: n/a
  verdict: MISSED-SILENT
  severity: HIGH
  same-mistake-risk: "Low — the absence is structural and verifiable: I confirmed no `understanding/*DataEntityRun*` file exists and no feature-flow lists the node. The only judgement call is whether `getRuns` is 'load-bearing' — it is: the runs history is the primary surface for the Data Quality and Transformer-runs pillars (P-04/P-05)."

- id: SC-6
  target: "V0_0_79__data_deprecation.sql — the data-entity status migration"
  sampling_strategy: negative-space
  check: "Does the ontology surface that migration V0_0_79 irreversibly DELETEs historical CUSTOM_GROUP_DELETED audit rows and backfills data_entity.status?"
  ground_truth: |
    V0_0_79__data_deprecation.sql does three things: (1) adds `data_entity.status SMALLINT
    DEFAULT 1 NOT NULL` + `status_switch_time`, and backfills `UPDATE data_entity SET status=5
    WHERE deleted_at IS NOT NULL` (lines 1-9); (2) adds `is_deleted BOOLEAN` to lineage and two
    group-relation tables (lines 11-18); (3) **`DELETE FROM activity WHERE event_type =
    'CUSTOM_GROUP_DELETED'`** (lines 20-22) — an unconditional, forward-only purge of
    historical audit rows.
  ground_truth_evidence: "odd-platform-api/src/main/resources/db/migration/V0_0_79__data_deprecation.sql:1-22"
  ontology_claim: |
    Partially. The `three-soft-delete-mechanisms` invariant cites V0_0_79:11-12 precisely for
    the `lineage.is_deleted` boolean, and covers the DataEntity STATUS state-machine. But the
    `DELETE FROM activity WHERE event_type='CUSTOM_GROUP_DELETED'` row-purge and the
    `status=5` backfill are NOT surfaced anywhere readable — `CUSTOM_GROUP_DELETED` returns
    zero matches across concepts.yaml and the concept detail files.
  ontology_evidence: "concepts/detail/invariants/three-soft-delete-mechanisms-across-the-repository-layer.yaml:17, 209-211, 322-323"
  ontology_claimed_confidence: HIGH
  verdict: PARTIAL
  severity: MEDIUM
  same-mistake-risk: "Medium — the methodology has no `schema_migrations` axis in the manifest, so migrations are only covered incidentally where a repository sidecar happens to cite one. A migration's destructive data step is exactly the kind of thing an LLM enriching a repository sidecar would skip (it's not a code-path the repo class executes). I share that blind spot: I only caught it because I read the raw SQL. Maintainer should confirm whether migration-as-substrate is in declared scope (manifest lists 5 axes, none for migrations)."

- id: SC-7
  target: "AlertActionResolverImpl.toHalt — per-entity alert-halting suppression semantics"
  sampling_strategy: boundary
  check: "When an operator sets a per-entity alert halt, exactly what is suppressed — and does auto-resolution of existing alerts still happen during the halt window?"
  ground_truth: |
    `AlertActionResolverImpl.toHalt` (lines 176-191): a halt is active iff `haltUntil != null
    && haltUntil.isAfter(baseline)` — TIME-BOUNDED, per-alert-type (4 distinct `_halt_until`
    timestamps in `alert_halt_config`, V0_0_62). Critically, line 54: when halted, the resolver
    keeps `ResolveAutomaticallyAlertAction` and filters out `CreateAlertAction`/`StackAlertAction`
    — i.e. a halt suppresses NEW alerts but auto-resolution of existing open alerts STILL proceeds.
  ground_truth_evidence: "AlertActionResolverImpl.java:38-56, 71-73, 176-191; V0_0_62__introduce_alert_halting.sql:1-10"
  ontology_claim: |
    Fragmentary. `AlertActionResolverImpl` and `alert_halt_config` are not substrate nodes
    (nodes.jsonl: zero matches). The `apply-alert-actions` concept says the resolver "loads ...
    halt configs" and is "halt-config-aware" but does not describe `toHalt`'s time-bounded
    check or the auto-resolve-still-proceeds behaviour. The `alert` openapi-tag sidecar names
    "Halt-config endpoints" but not the suppression semantics. The AlertServiceImpl sidecar
    mentions halt configs only in passing.
  ontology_evidence: "concepts/detail/operations/apply-alert-actions-discriminated-union-dispatch.yaml:9-11; understanding/odd-platform__openapi__tags__openapi-tag__alert.md:89, 122"
  ontology_claimed_confidence: n/a
  verdict: PARTIAL
  severity: MEDIUM
  same-mistake-risk: "Low — I traced `toHalt` and the `.filter(a -> !toHalt || a instanceof ResolveAutomaticallyAlertAction)` line directly. The judgement is whether 'resolver is halt-config-aware' counts as coverage — it does not: a maintainer documenting the alert-halt UI control could not, from the artefacts, tell an operator that a halt still permits auto-resolution. The mechanism's host class is simply not a node."

## findings

- id: ADV-F1
  title: "Load-bearing capability `DataEntityRunController.getRuns` is an extracted-but-unenriched node, threaded by no feature-flow"
  severity: HIGH
  evidence: "nodes.jsonl:216 (node present); no understanding/*DataEntityRun* sidecar; feature-flows/index.yaml:4515-4589 (F-022 omits it); DataEntityRunController.java:18-27; DataEntityRunServiceImpl.java:27-45"
  detail: |
    The per-entity test/job RUNS list is the primary history surface for two pillars (P-04
    Data Quality, P-05 lineage transformers). It carries real, operator-observable boundary
    behaviour: an HTTP 400 ("not supposed to have runs due to its class") for any entity that
    is not a DATA_TRANSFORMER or DATA_QUALITY_TEST. The substrate scan extracted the node but
    enrichment never reached it (manifest: 159/395 enriched), and no feature-flow threads it —
    F-022, the one P-04 feature, explicitly scopes itself to DataQualityController's 5 endpoints.
    A maintainer answering "how do I see a quality test's run history / what's the runs API
    contract" (a §1 promise: test-coverage + feature-flow lookup) gets nothing. This is the
    target's condition 3 (eight promises answerable from a *random* feature) failing on a
    non-cherry-picked surface. It is one MISSED-SILENT on a load-bearing capability — close to
    the RED threshold (≥2 such misses).
  routed_to: backlog-item
  confidence: HIGH

- id: ADV-F2
  title: "Alert-halting suppression semantics have no node and no assembled coverage"
  severity: MEDIUM
  evidence: "AlertActionResolverImpl.java:38-56, 176-191; nodes.jsonl (no AlertActionResolver / AlertHaltConfig node); concepts/detail/operations/apply-alert-actions-discriminated-union-dispatch.yaml:9-11"
  detail: |
    Per-entity alert halting is a documented operator control (the `alert` openapi-tag sidecar
    confirms Halt-config endpoints exist). Its actual behaviour — a halt is time-bounded
    (`haltUntil.isAfter(baseline)`), per-alert-type, and crucially still permits automatic
    resolution of existing open alerts while suppressing new ones — lives entirely in
    `AlertActionResolverImpl`, which is not a substrate node. The ontology has fragments
    ("resolver is halt-config-aware", "Halt-config endpoints", the `alert_halt_config` table
    shape elsewhere) but a consumer cannot assemble the truth. An operator who halts alerts on
    a noisy entity and then sees alerts auto-resolve would have no ontology answer for why.
    Resolver/orchestrator classes that hold cross-cutting behaviour fall between the substrate
    axes (controllers / config / openapi-tags / ui) — a recurring blind spot.
  routed_to: approach-rev
  confidence: HIGH

- id: ADV-F3
  title: "Migrations are not a substrate axis — destructive data steps inside migrations are uncovered"
  severity: MEDIUM
  evidence: "V0_0_79__data_deprecation.sql:20-22 (unconditional DELETE FROM activity); manifest.yaml:6-21 (5 axes, none for schema_migrations); `CUSTOM_GROUP_DELETED` absent from concepts.yaml"
  detail: |
    The manifest declares 5 axes (ui_shell, openapi_tags, controllers, ui_routes,
    config_prefixes) — none for schema migrations. Migrations are covered only incidentally,
    where a repository sidecar happens to cite one for a column it reads. V0_0_79 is cited for
    its `is_deleted`/`status` schema additions but its forward-only `DELETE FROM activity WHERE
    event_type='CUSTOM_GROUP_DELETED'` — an irreversible purge of historical audit rows — is
    silent, as is the `status=5` data backfill. Audit-trail loss is precisely the operator-harm
    class the methodology exists to catch (cf. LSN-001). Several concept files reference V0_0_*
    migrations richly, so the gap is not "migrations are invisible" but "destructive DML inside
    a migration is invisible because no axis owns the migration as a unit." If many future
    spot-checks land here, the axis set is too narrow.
  routed_to: approach-rev
  confidence: HIGH

- id: ADV-F4
  title: "Enrichment frontier (159/395) is the real coverage exposure — vanity-vs-honest gap is structural, not incidental"
  severity: MEDIUM
  evidence: "manifest.yaml:25-27 (nodes_with_own_sidecar: 159 / total_substrate_nodes: 395); SC-5 (getRuns node unenriched)"
  detail: |
    Every COVERED-CORRECT in this run is a node that HAS a sidecar; the one MISSED-SILENT is a
    node that does NOT. The methodology's coverage quality on enriched nodes is GREEN-grade —
    the four passes were deep, accurate, and resisted the name-vs-mechanism trap. But 236 of
    395 substrate nodes carry no sidecar. The target's condition 1 explicitly distinguishes
    honest coverage from "vanity coverage (`nodes_with_sidecar / total`)". A skeptical
    maintainer picking blind will keep landing on the 60% unenriched frontier. This is not a
    defect in what the methodology produced — it is the honest statement that the methodology
    is ~40% of the way through odd-platform. The panel verdict should read it as "on track,
    not arrived": coverage *depth* is on target; coverage *breadth* is the open work.
  routed_to: backlog-item
  confidence: HIGH

## what_went_well
- "SC-4: the NamespaceController sidecar did NOT fall for the `CascadeDeleteException` name — it explicitly states the delete is a 'block-if-attached' application-tier guard, NOT an FK cascade, and even flags the TOCTOU race. This is the exact Rule-4 trap and the methodology passed it (NamespaceController.md:141, 153)."
- "SC-1: the attachment sidecar caught the curl-bypass at HIGH severity, the decimal-MB-vs-binary-MiB multiplier, AND the boot-crash-if-unset corner case — three distinct boundary observations from one config key (attachment_max-file-size@L27.md:65-67)."
- "SC-2: the getActivity sidecar interrogated the `size` boundary in three independent sections and correctly identified keyset (not offset) pagination — boundary behaviour, not just the surface (getActivity.md:156, 199)."
- "SC-3: the GenAIProperties sidecar surfaced four distinct security gaps on a feature the docs call 'API-only', including the absence of a GENAI_USE permission and the SSRF surface — depth well beyond transcription (GenAIProperties.md:111-115)."

## axis_score
score: 6
band: AMBER
rationale: |
  Pass rate 4/7 = 0.57 (in the AMBER 0.5-0.8 band) with ZERO COVERED-WRONG — no confident
  misinformation, which keeps this clear of RED. The 4 passes are not shallow: each interrogated
  a boundary or an absence and resisted name-trusting. Against RED triggers: 1 MISSED-SILENT on
  a load-bearing capability (RED needs ≥2) and 0 COVERED-WRONG (RED needs ≥2). Score 6 rather
  than 7 because the single miss (getRuns) is a genuine load-bearing P-04/P-05 surface and the
  two PARTIALs are both operator-relevant (alert-halt suppression semantics, a migration's
  irreversible audit purge) — the gaps cluster on a real structural seam (the enrichment
  frontier + axis coverage of resolver/migration substrate), not on noise. Measured against the
  target's own conditions 1/3/10: coverage *depth* of enriched nodes meets the bar; coverage
  *breadth* (159/395) and the UI/feature threading of unenriched capabilities does not yet.

## independence_self_assessment
shared_blind_spot_risk: |
  Three places I may share the methodology's blind spot. (1) SC-6 — migrations: I only caught
  the destructive `DELETE FROM activity` because I read the raw SQL; an LLM enriching a
  repository sidecar would skip it for the same reason I nearly did (it is not a code-path the
  class executes). My finding ADV-F3 rests on noticing the same thing the methodology missed —
  but I cannot rule out that a maintainer would judge migration-DML out of declared scope. (2)
  SC-1 — the absence of a server-side size check: both the sidecar and I read the same
  `transferTo` call and concluded "no guard"; if the guard lived in a WebFlux filter or an
  interceptor neither of us traced, we would both be wrong. (3) General: I assessed only nodes
  the ontology chose to expose; I did not sample the 236 unenriched nodes for what *should*
  have been enriched — so my pass rate measures coverage *correctness*, and under-weights
  coverage *breadth*, which ADV-F4 addresses qualitatively but not by measurement.
needs_human_verification:
  - "SC-6 — confirm whether schema migrations (and destructive DML inside them) are in the methodology's declared substrate scope; the manifest lists 5 axes and none is `schema_migrations`. If intentionally out of scope, ADV-F3 downgrades to SCOPE-EXCLUDED; if not, the V0_0_79 activity-purge is a real uncovered operator-harm fact."
  - "SC-1 — re-verify there is no server-side attachment size enforcement in a WebFlux filter / WebFilter / codec config outside AttachmentServiceImpl + FileServiceImpl; I traced the service+controller chain but not every global filter bean."
  - "SC-5 — confirm `DataEntityRunController.getRuns` is genuinely a user-facing capability worth a sidecar (it is, via the per-entity Runs history tab), and is not deliberately deferred; if deferred, ADV-F1 is a known-backlog item rather than a coverage defect."
