---
panel_run: 2026-05-21
phase: 1
expert: panel-adversary
axis: Coverage
commit_anchor: ede5d277
prompt_version: panel-adversary/0.1.0
spot_checks_total: 8
pass_rate: 0.71
axis_score: 6
axis_band: AMBER
---

# Phase 1 — Adversary (Coverage) assessment

## summary
Eight fresh blind spot-checks against odd-platform source at `ede5d277`. Coverage is genuinely deep where the ontology has worked a feature: lineage-depth boundary, webhook delivery, chunked upload, search facets and the attachment surface are all interrogated to primary-source `file:line` with boundary cases named. One `COVERED-WRONG` is the headline: the ontology asserts the collector ingestion token's RNG (`RandomStringUtils.randomAlphanumeric(40)`) is *non*-cryptographically-secure (`ThreadLocalRandom`) — the opposite of the truth at the repo's pinned `commons-lang3 3.18.0`, and the inverted claim has propagated into feature-flows, per-node sidecars **and** `concepts.yaml`. One `MISSED-SILENT` is a DB-migration behaviour change that no axis covers. Headline pass rate 5/7 = 0.71 → AMBER, dragged below GREEN solely by the single `COVERED-WRONG` (rubric: any `COVERED-WRONG` caps at AMBER).

## target_lens
The explicit target (`meta-reviews/target.md`) makes Coverage the owner of conditions 1 and 3. Condition 1 — "honest coverage, not vanity coverage": `stress_verified_pct ≥ 0.80` over ALL enriched sidecars, that denominator covering ≥90% of substrate nodes carrying Stress-Protocol triggers. Condition 3 — the eight §1 promises demonstrably answerable from artefacts for a randomly-chosen feature. The concrete bar my axis holds: a fresh, blind, non-cherry-picked spot-check of the real codebase should be COVERED-CORRECT ≥ 80% of the time with ZERO confident-but-wrong claims — "honest coverage" means the artefacts can be trusted without re-opening source, and a single COVERED-WRONG is worse for that trust than several honest MISSED-SILENTs. One caveat against the target itself: `manifest.yaml` reports `stress_verified_pct: 88.0` but computes it over only 3 sidecars with a stress section (`sidecars_with_stress_section: 3`) out of 144 enriched — so condition 1's "denominator of all enriched sidecars" is NOT met; the 88% is a 3-sidecar figure, exactly the "handful" the target warns against. That measurement-honesty gap sits squarely on the Coverage axis even though it is not one of my 8 source spot-checks.

## spot_check_ledger
- id: SC-1
  target: "V0_0_85__remove_length_constraint_for_description.sql — dataset_field.internal_description column-width change"
  sampling_strategy: negative-space
  check: "When a user saves a dataset-field internal description longer than 255 characters, the platform stores it (post-migration) rather than truncating/rejecting it (pre-migration)."
  ground_truth: |
    `dataset_field.internal_description` is `varchar(255)` at V0_0_1__init.sql:161.
    V0_0_85 runs `ALTER COLUMN internal_description TYPE varchar` — widening it to
    unbounded. The column had a hard 255-char ceiling for the project's history
    and only became unbounded at V0_0_85: a real user-observable change (long
    field descriptions failed before, succeed after).
  ground_truth_evidence: "odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:161, odd-platform-api/src/main/resources/db/migration/V0_0_85__remove_length_constraint_for_description.sql:1-2"
  ontology_claim: |
    F-004 (Entity Description Editing) is the closest feature. It cites
    `dataset_field.internal_description` extensively but ONLY through the
    stored-XSS lens; F-004:78,406 assert "NO length cap" and describe the schema
    as "dataset_field.internal_description text NULL". The 255→unbounded migration
    history is not surfaced as a behaviour, limitation, or versioning caveat.
    F-004:406 also calls the column `text` whereas init declares `varchar(255)`
    — a minor type-name transcription slip.
  ontology_evidence: "feature-flows/detail/F-004.yaml:78, feature-flows/detail/F-004.yaml:406"
  ontology_claimed_confidence: n/a
  verdict: MISSED-SILENT
  severity: LOW
  same-mistake-risk: "Low — I read both migrations directly; the 255 ceiling is unambiguous in init.sql. The methodology may have shared the blind spot because SQL migrations are not a declared substrate axis (manifest axes are ui_shell/openapi_tags/controllers/ui_routes/config_prefixes) so the migration directory is never systematically walked."

- id: SC-2
  target: "ReactiveLineageRepositoryImpl.lineageCte — recursive-CTE depth/cycle bound + LineageDepth.of() clamp"
  sampling_strategy: boundary
  check: "When a caller passes a very large lineage_depth (e.g. Integer.MAX_VALUE), the recursive lineage query has no upper-bound clamp and walks to that depth."
  ground_truth: |
    `LineageDepth.of(int)` (LineageDepth.java:12-14) stores the raw int — no
    Math.min, no ceiling. `LineageServiceImpl.getLineage` (line 96) hands it to
    the repo. `ReactiveLineageRepositoryImpl.lineageCte` (lines 150-176) builds a
    recursive UNION ALL CTE terminating only when `tDepth.lessThan(lineageDepth.
    getDepth())` is false (line 174) — NO `LIMIT`, NO Postgres `WITH ... CYCLE`,
    NO visited-set guard. A large depth drives an unbounded walk.
  ground_truth_evidence: "odd-platform-api/.../dto/lineage/LineageDepth.java:12-14, odd-platform-api/.../service/LineageServiceImpl.java:96, odd-platform-api/.../repository/reactive/ReactiveLineageRepositoryImpl.java:150-176"
  ontology_claim: |
    F-005 covers this exhaustively. The facet "no upper-bound check on
    lineageDepth at service tier" cites LineageServiceImpl.java:96 with the exact
    "hands the primitive int directly ... no Math.min" reasoning; the facet
    "recursive-CTE cycle/diamond amplification" cites the CTE at lines 150-176,
    names the absent LIMIT / WITH CYCLE / visited-set guard, reasons O(B^N)
    growth. The LineageDepth.empty()==-1 seed-only semantics is also captured.
  ontology_evidence: "feature-flows/detail/F-005.yaml:83-94 (cycle/diamond facet), feature-flows/detail/F-005.yaml:148-168 (no-upper-bound facet), feature-flows/detail/F-005.yaml:459-467 (LineageDepth.empty semantics)"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  same-mistake-risk: "Low — I read LineageDepth.java, LineageServiceImpl.java and the CTE builder independently before opening F-005; the absence of a LIMIT clause is a positive verification (I looked for it and it is not there)."
- id: SC-3
  target: "FileServiceImpl.uploadFileChunk / DataEntityAttachmentController.uploadFileChunk — chunk index handling + non-FilePart rejection"
  sampling_strategy: capability
  check: "When a user uploads a file chunk, a non-FilePart multipart is rejected, the chunk is staged under /tmp, and a non-numeric chunk index aborts the request."
  ground_truth: |
    `FileServiceImpl.uploadFileChunk` (lines 58-67): non-FilePart →
    `BadUserRequestException("Uploaded multipart is not a file")`; FilePart →
    `filePart.transferTo(chunkDirectory.resolve(String.valueOf(index)))` where
    chunkDirectory is `FileUtils.getChunkDirectory(uploadId)`. Upload must be
    in PROCESSING state (`checkProcessingUploadById`). The controller
    (DataEntityAttachmentController.java:60) parses the index via
    `Integer.parseInt(index)` — an UNCAUGHT NumberFormatException for a
    non-numeric `index` query value (→ HTTP 500, not a 4xx).
  ground_truth_evidence: "odd-platform-api/.../service/attachment/FileServiceImpl.java:58-67,93-102, odd-platform-api/.../controller/DataEntityAttachmentController.java:54-62"
  ontology_claim: |
    F-027 covers the 3-step chunked upload deeply: the server-owned uploadId
    state machine, non-FilePart rejection, PROCESSING-state gate, the hard-coded
    `/tmp/odd/chunks` staging path (LSN-001 residue), and FileUtils.
    listFilesInOrder's NumberFormatException-on-stray-file corner case. The
    controller-side `Integer.parseInt(index)` 500-on-bad-index is not
    individually called out — but it is the same NumberFormatException class the
    listFilesInOrder facet documents, on a thin-controller line.
  ontology_evidence: "feature-flows/detail/F-027.yaml:548-563 (chunk filename NumberFormatException facet), feature-flows/detail/F-027.yaml:611-627 (3-step server-owned uploadId facet), feature-flows/detail/F-027.yaml:372-402 (LSN-001 /tmp staging facet)"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  same-mistake-risk: "Low — I read FileServiceImpl and the controller directly. The only un-itemised boundary (controller-side parseInt of `index`) is genuinely a thin shell of the listFilesInOrder NumberFormat class the ontology already names; not counting it as a miss."
- id: SC-4
  target: "WebhookNotificationSender.send — outbound webhook request shape (headers, signing, status acceptance)"
  sampling_strategy: random-walk
  check: "When the platform delivers an alert to a generic webhook, the POST carries no signature/HMAC, no Content-Type header, and only HTTP 200 is treated as success."
  ground_truth: |
    `WebhookNotificationSender.send` (lines 18-23) builds the request as
    `.uri(webhookUrl).POST(BodyPublishers.ofString(serializeJson(message)))
    .build()` — no Authorization, no X-Signature/HMAC, no Content-Type header.
    `AbstractNotificationSender.sendAndValidate` (lines 16-30) treats
    `response.statusCode() != HttpStatus.OK.value()` (exactly 200) as failure →
    201/202/204 rejected. No connect timeout set in the send path.
  ground_truth_evidence: "odd-platform-api/.../notification/sender/WebhookNotificationSender.java:18-23, odd-platform-api/.../notification/sender/AbstractNotificationSender.java:16-30"
  ontology_claim: |
    F-009 batch-Y closes the webhook channel at primary source: facet 12 (no
    HMAC/signature), facet 13 (cross-tenant one-URL exposure), facet 14 (no
    Content-Type — names the exact one-line fix at WebhookNotificationSender.
    java:21-22), facet 15 (200-only accept rejects 2xx), facet 16 (no custom auth
    header knob), facet 17 (no connect timeout hangs the WAL consumer thread).
    Each cites file:line and reasons the operator consequence.
  ontology_evidence: "feature-flows/detail/F-009.yaml:415-487 (webhook facets 12-16), feature-flows/detail/F-009.yaml:493-516 (HTTP connect-timeout facet 17)"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  same-mistake-risk: "Low — I read WebhookNotificationSender and AbstractNotificationSender independently; the absent headers are a positive verification (looked for `.header(` calls, none present)."
- id: SC-5
  target: "TokenGeneratorImpl.generate / regenerate — collector ingestion-token randomness source"
  sampling_strategy: negative-space
  check: "When the platform mints or rotates a collector token, the 40-char value is generated with a cryptographically secure RNG."
  ground_truth: |
    `TokenGeneratorImpl.generate` (line 39) and `.regenerate` (line 49) call
    `RandomStringUtils.randomAlphanumeric(40)`. The repo pins commons-lang3 at
    `3.18.0` (gradle/libs.versions.toml:10). Per Apache Commons Lang javadoc +
    release notes: before 3.15.0 the static `RandomStringUtils` methods used
    `ThreadLocalRandom` (insecure); from 3.15.0 they use `SecureRandom.
    getInstanceStrong()`; from 3.17.0 the static `secure()` path uses
    `SecureRandom()`. At 3.18.0 the method IS backed by `SecureRandom` — it is
    cryptographically secure.
  ground_truth_evidence: "odd-platform-api/.../service/TokenGeneratorImpl.java:34-42,44-52, gradle/libs.versions.toml:10 (apache-lang = '3.18.0'); Apache Commons Lang RandomStringUtils javadoc + RELEASE-NOTES (commons.apache.org / github.com/apache/commons-lang)"
  ontology_claim: |
    The ontology asserts the OPPOSITE. F-020.yaml:358-359: "uses
    `RandomStringUtils.randomAlphanumeric(40)` which delegates to
    `ThreadLocalRandom` in commons-lang 3.16+, NOT `SecureRandom`." Same inverted
    claim at understanding/...CollectorController.md:149 and the
    regenerateCollectorToken method sidecar. It has also propagated into the
    reducer layer: concepts/index.yaml:2289-2290 ("`ThreadLocalRandom`-backed")
    and concepts/index.yaml:4922. The F-020 batch-W note frames it as a
    HIGH-severity security finding ("TOKEN ENTROPY USES NON-CRYPTOGRAPHICALLY-
    SECURE RNG").
  ontology_evidence: "feature-flows/detail/F-020.yaml:358-359, understanding/odd-platform__java__CollectorController__controller-class__CollectorController.md:149, concepts/index.yaml:2289-2290, concepts/index.yaml:4922"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-WRONG
  severity: HIGH
  same-mistake-risk: "Real and ruled out. The methodology made exactly the LLM error Rule 4 warns about — it 'knew' RandomStringUtils was historically insecure and never re-checked against the pinned version. I could have shared it; I defended mechanically by reading the version pin (3.18.0) and confirming the version→RNG mapping from TWO independent Apache sources (javadoc + release notes). Note: the OLDER sidecars (IngestionDataEntitiesFilter.md:147, ReactiveCollectorRepositoryImpl.md) do NOT make this claim — they correctly cite ~238-bit entropy as brute-force-infeasible without asserting the RNG is weak; the inverted claim entered only in the F-020/CollectorController batch and contradicts the older artefacts."

- id: SC-6
  target: "SearchController.facets → SearchServiceImpl.getFacets / getFilterOptions — faceted-search filter enumeration"
  sampling_strategy: capability
  check: "When a user requests filter options for a facet type, the result is paginated with no upper bound, and facet counts are computed catalog-wide with no owner scoping."
  ground_truth: |
    `SearchController` delegates facet endpoints to `SearchServiceImpl`
    (getFacets / getFilterOptions / getFacetFetchOperation — exhaustive switch
    over MultipleFacetType). The facet aggregators in ReactiveSearchFacetRepository
    Impl join SEARCH_ENTRYPOINT + DATA_ENTITY and apply only default conditions
    (HOLLOW/STATUS/EXCLUDE_FROM_SEARCH) — no OWNERSHIP join. `page`/`size` are raw
    Integers with no clamp. (SearchService file path + facet delegation
    grep-confirmed; repo SQL via the ontology's cited line ranges.)
  ground_truth_evidence: "odd-platform-api/.../controller/SearchController.java:45, odd-platform-api/.../service/search/SearchServiceImpl.java:51-72 (getFilterOptions / getFacetFetchOperation)"
  ontology_claim: |
    F-017 (Search Filter Facets) covers this thoroughly: facet "unbounded
    pagination at controller + OpenAPI + repository layers" cites the raw
    Integer page/size and size=1_000_000 hazard; facet "cross-owner facet
    enumeration" names the six aggregators by line range and confirms the
    absent OWNERSHIP join; the getFacetFetchOperation exhaustive switch over
    MultipleFacetType is described in the chain.
  ontology_evidence: "feature-flows/detail/F-017.yaml:243-279 (cross-owner facet enumeration), feature-flows/detail/F-017.yaml:362-387 (unbounded pagination), feature-flows/detail/F-017.yaml:117-142 (getFacetFetchOperation chain)"
  ontology_claimed_confidence: HIGH
  verdict: COVERED-CORRECT
  same-mistake-risk: "Medium — I confirmed the SearchService file path and the facet delegation by grep but did NOT line-by-line re-read ReactiveSearchFacetRepositoryImpl's six aggregators; I relied on the ontology's cited line ranges for the absent-OWNERSHIP-join claim. If the methodology mis-read one aggregator I would have inherited it. The pagination half is independently verified."

- id: SC-7
  target: "odd-platform-ui/src/lib/helpers.ts — bytesToKb / bytesToMb file-size unit conversion"
  sampling_strategy: random-walk
  check: "When the UI displays an attachment's file size, it converts bytes using decimal divisors (1000 / 1000000), i.e. SI KB/MB, not binary KiB/MiB."
  ground_truth: |
    `helpers.ts:227-228`: `bytesToKb = bytes => Math.ceil(bytes / 1000)`
    and `bytesToMb = bytes => Math.ceil(bytes / 1000000)` — decimal
    divisors, not 1024 / 1048576. The platform-wide unit convention for
    file sizes shown to the user is therefore SI/decimal.
  ground_truth_evidence: "odd-platform-ui/src/lib/helpers.ts:227-228"
  ontology_claim: |
    The decimal-vs-binary unit issue IS covered, anchored on the backend side:
    the AttachmentServiceImpl@L27 config-key sidecar invariants record "the
    wire-format multiplier is decimal MB (×1_000_000), not binary MiB
    (×1_048_576)" and cross-reference `bytesToMb` as the UI-side reciprocal.
    TEST-GAP-045 is a ranked test-gap pinning the MB↔bytes round-trip;
    `bytesToKb` is named in test-map.yaml. No dedicated helpers.ts sidecar, but
    the load-bearing behaviour (decimal divisor) is surfaced and assemblable.
  ontology_evidence: "understanding/odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:24,36, test-map/detail/TEST-GAP-045.yaml"
  ontology_claimed_confidence: MEDIUM
  verdict: COVERED-CORRECT
  same-mistake-risk: "Low — I read helpers.ts directly; the /1000 divisors are unambiguous. The ontology covers it from the backend config-key vantage rather than a UI-file sidecar, but the decimal-multiplier claim it makes is correct."

- id: SC-8
  target: "TokenGeneratorImpl.regenerateToken / CollectorServiceImpl.regenerateToken — token rotation preserves the FK, mutates value in place"
  sampling_strategy: boundary
  check: "When an operator regenerates a collector token, the same token ROW is mutated in place (its value column overwritten) — there is no new row, no history, and the old value is unrecoverable."
  ground_truth: |
    `CollectorServiceImpl.regenerateToken` (lines 83-90) reads the bound
    TokenPojo, calls `TokenGeneratorImpl.regenerateToken` (TokenGeneratorImpl.
    java:44-52 — `regenerate` sets `value = randomAlphanumeric(40)` and
    `updatedAt = now` ON THE EXISTING POJO; throws RuntimeException if the token
    is null), then persists via `tokenRepository.updateToken` (an UPDATE, not an
    INSERT). The prior value is overwritten and lost; no history table, no audit
    row.
  ground_truth_evidence: "odd-platform-api/.../service/CollectorServiceImpl.java:83-90, odd-platform-api/.../service/TokenGeneratorImpl.java:44-52"
  ontology_claim: |
    F-020 batch-R facet 5 ("REGENERATE_TOKEN NO AUDIT TRAIL") and the
    ReactiveCollectorRepositoryImpl sidecar describe this precisely:
    regenerateToken "mutates via TokenGeneratorImpl.regenerate ... persists via
    tokenRepository.updateToken (an UPDATE token SET value = ?, updated_at = ?)",
    "the PRIOR token value is LOST — no history table, no audit-log row, no
    ActivityEvent", COLLECTOR.updated_at not touched. Matches ground truth.
  ontology_evidence: "feature-flows/detail/F-020.yaml:147-165 (batch-R facet 5), understanding/odd-platform__java__repository__reactive__repository__ReactiveCollectorRepositoryImpl.md:150"
  ontology_claimed_confidence: MEDIUM
  verdict: COVERED-CORRECT
  same-mistake-risk: "Low — I read CollectorServiceImpl and TokenGeneratorImpl directly; the in-place mutate (`@MappingTarget`-style overwrite of the passed pojo + UPDATE) is unambiguous in the source. Independent of the SC-5 RNG error — the rotation MECHANISM is correctly described even though the same artefacts mis-describe the RNG."

## findings
- id: ADV-F1
  title: "Collector ingestion-token RNG is described as insecure (ThreadLocalRandom) when the pinned commons-lang3 3.18.0 makes it SecureRandom — confident misinformation in a security finding"
  severity: HIGH
  evidence: "feature-flows/detail/F-020.yaml:358-359, understanding/odd-platform__java__CollectorController__controller-class__CollectorController.md:149, concepts/index.yaml:2289-2290, concepts/index.yaml:4922; ground truth: gradle/libs.versions.toml:10 (apache-lang='3.18.0') + Apache Commons Lang RandomStringUtils javadoc/RELEASE-NOTES (3.15.0+ uses SecureRandom)"
  detail: |
    F-020's batch-W note ranks this a HIGH-severity security finding ("TOKEN
    ENTROPY USES NON-CRYPTOGRAPHICALLY-SECURE RNG") and states the method
    "delegates to ThreadLocalRandom in commons-lang 3.16+, NOT SecureRandom." It
    is factually inverted: from commons-lang3 3.15.0 the static RandomStringUtils
    methods use SecureRandom; 3.16/3.17 keep it (via secure()); the repo pins
    3.18.0 — the token IS generated with a CSPRNG. Operator consequence cuts both
    ways: a maintainer either raises a spurious SEC item / ships a caveat for a
    non-existent weakness, or loses trust once they check. The claim also
    contradicts the project's OWN older sidecars (IngestionDataEntitiesFilter.md,
    ReactiveCollectorRepositoryImpl.md) which correctly treat the 40-char token
    as brute-force-infeasible without asserting RNG weakness — a coherence sweep
    against existing artefacts should have flagged it. Calibration failure:
    claimed HIGH, propagated through three artefact tiers uncorrected.
  routed_to: lsn-candidate
  confidence: HIGH

- id: ADV-F2
  title: "Version-dependent library behaviour is asserted without pinning the actual dependency version — a systemic transcription-error class"
  severity: MEDIUM
  evidence: "feature-flows/detail/F-020.yaml:359 ('commons-lang 3.16+'); gradle/libs.versions.toml:10"
  detail: |
    ADV-F1's root cause is not a one-off typo — it is the methodology reasoning
    about a third-party library's behaviour ("commons-lang 3.16+") while never
    reading the version pin in `gradle/libs.versions.toml`. Any claim of the form
    "library X behaves like Y" is unverifiable without the resolved version, and
    LLM enrichment is especially prone to substituting a remembered (stale)
    library behaviour for the pinned one. Recommend a Gate-4/Gate-9 extension:
    any sidecar claim about framework/library runtime behaviour must cite the
    dependency version from the build manifest (`libs.versions.toml`, `pom.xml`,
    `package.json`), not just the library name. The unset-parameter-audit
    playbook already does version-aware reasoning for the AWS SDK; the same
    discipline is missing for general library-behaviour claims.
  routed_to: new-gate
  confidence: HIGH

- id: ADV-F3
  title: "DB migrations are not a declared substrate axis — schema-history behaviour changes are covered only opportunistically"
  severity: LOW
  evidence: "lineage/odd-platform/manifest.yaml:6-21 (axes: ui_shell/openapi_tags/controllers/ui_routes/config_prefixes — no migration axis); odd-platform-api/src/main/resources/db/migration/V0_0_85__remove_length_constraint_for_description.sql"
  detail: |
    SC-1's miss (the 255→unbounded `internal_description` change) is not a
    careless omission — `db/migration/*.sql` is not a substrate axis, so the
    ~90-file migration directory is never systematically walked. Feature-flows DO
    cite migrations when a feature happens to touch one (F-005 cites V0_0_2/17/79;
    F-020 cites V0_0_28/29/33), but that is incidental, not coverage.
    Schema-history changes (column-width, NOT NULL additions, default changes,
    hard-delete migrations) are exactly the operator-facing caveat class the
    methodology exists to catch. A scope-boundary observation, not an artefact
    defect: either add a `migrations` axis or document schema history as
    explicitly out of scope so the gap is a known one.
  routed_to: approach-rev
  confidence: MEDIUM

## what_went_well
- "F-005 (Lineage Graph Traversal) — the lineage-depth boundary (SC-2) is interrogated to a depth a skeptical maintainer would respect: uncapped LineageDepth.of(), the recursive CTE with no LIMIT / WITH CYCLE / visited-set guard, O(B^N) diamond growth, LineageDepth.empty()==-1 seed-only semantics, the UI ?d= URL with no upper bound — every claim at file:line, boundary cases (N=0, cycles, Integer.MAX_VALUE) named."
- "F-009 (WAL Notification Delivery) — the webhook channel (SC-4) is closed at primary source across six facets (no HMAC, cross-tenant exposure, no Content-Type, 200-only accept, no auth-header knob, no connect timeout), each with the operator consequence reasoned and the Content-Type one-line fix located."
- "F-020 (Collector Lifecycle) — token rotation mechanics (SC-8: in-place row mutation, no history, FK preserved) are described exactly right — the methodology gets the structural facts correct even in the same artefact where it gets a library-version fact wrong."

## axis_score
score: 6
band: AMBER
rationale: |
  Headline metric = pass rate = COVERED-CORRECT / (total − SCOPE-EXCLUDED) =
  5 / 7 = 0.71 (SC-1 is MISSED-SILENT, not scope-excluded; zero SCOPE-EXCLUDED
  checks). Per the rubric, a pass rate 0.5-0.8 OR any single COVERED-WRONG →
  AMBER; both apply, so AMBER is unambiguous. Within AMBER I score 6 not 4-5
  because the one COVERED-WRONG is a version-dependent library-fact error in a
  single batch (structural coverage around it correct; older sidecars got the
  topic right), not a wrong reading of the target's own code — and the depth of
  correct coverage on the load-bearing features (lineage, webhook, upload,
  facets, rotation) is genuinely high. Not GREEN: GREEN needs pass rate ≥ 0.8
  AND zero COVERED-WRONG, and a HIGH-severity inverted security claim that
  propagated into concepts.yaml is exactly the "confident misinformation" the
  rubric caps. Against target condition 1 the depth is real; the inverted claim
  is a calibration miss, not a coverage hole.

## independence_self_assessment
shared_blind_spot_risk: |
  My sharpest exposure was SC-5: the methodology made the canonical LLM error
  — "RandomStringUtils is insecure" is a widely-repeated training-data fact
  once true, now stale. I could have read F-020, nodded, and blessed it. I
  avoided that ONLY by reading the version pin (3.18.0) and confirming the
  3.15.0 RNG change from two independent Apache sources before the verdict —
  Rules 2 and 4 did real work. Residual risk: SC-6 — I confirmed the
  SearchService file path + facet delegation by grep but relied on the
  ontology's cited line ranges for the "no OWNERSHIP join in the six
  aggregators" claim rather than re-reading ReactiveSearchFacetRepositoryImpl;
  if the methodology mis-read one aggregator, I inherited it. SC-1's type-name
  nuance (F-004 says `text`, init says `varchar(255)`) I judged immaterial.
needs_human_verification:
  - "SC-5 — the commons-lang3 3.18.0 → SecureRandom mapping is the load-bearing fact behind ADV-F1 (HIGH); well-sourced (Apache javadoc + release notes), but confirm the resolved version on the actual classpath (a Spring Boot BOM override could in principle land below 3.15.0; I did not resolve the full dependency graph)."
  - "SC-6 — the 'no owner scoping in the six facet aggregators' claim relies on the ontology's cited ReactiveSearchFacetRepositoryImpl line ranges, not an independent re-read; worth a maintainer glance to confirm the absent OWNERSHIP join."
