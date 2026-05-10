---
artefact: investigator-log
repo: odd-platform
purpose: |
  Per-batch trail of the agentic-ontology enrichment expansion. Each entry
  documents which sidecar surfaced which finding, which reducer rolled it
  up, in which batch, dated. Use to spot-check held-back ground-truth
  bugs/gaps against the ontology's auto-discovery.
---

# Investigator log — odd-platform

This log is the *traceability artefact* for the post-MVP enrichment expansion. Each batch entry below answers the maintainer's question: **"For a bug/missing-functionality I hold in mind, when did the ontology surface it, and which investigator?"**

## How to read this log

Each batch entry surfaces:

- **Sidecars added** (file-analyser outputs) with per-sidecar finding counts per section (intent-anchored ADRs vs gap-shaped bugs/limitations, security/perf gaps, doc-drift, test gaps).
- **Reducer diffs** (before → after counts + ID ranges introduced this batch by concept-merger / doc-gap-finder / adr-archaeologist / test-coverage-mapper).
- **Known-bug validators** — pre-existing refactoring scopes that should be re-surfaced from fresh enrichment. PASS = ontology rediscovered. Validates the loop closes.
- **Notable new findings** — HIGH-severity surfaces flagged for spot-check matching, with the investigator trail: `<reducer-artefact>:<entry-id>` ← `<sidecar>.md:<section>.<index>` ← `<source-file>:<line>`.

**To match a held-back spot-check:**
1. Grep this log for the finding's keyword (e.g. `SecureRandom`, `cross-owner`, `audit log`, `rate-limit`, `typo`).
2. Find the batch entry + sidecar + section that surfaced it.
3. Read the cited sidecar for the full citation chain.
4. Verdict: surfaced (✅) / not surfaced (open question for next batch).

## Investigator chain (which agent does what)

| Agent | When it runs | What it produces | Where its findings land |
|---|---|---|---|
| **file-analyser** | Per node (slice 5) | One sidecar per substrate node at `lineage/{repo}/understanding/{slug}.md` | Per-sidecar `implicit_adrs` (intent-anchored) + `bugs_limitations_corner_cases` (gap-shaped) + `security.known_security_gaps` + `performance.known_performance_gaps` + `docs_link_semantic.doc_drift_findings` + `tests_coverage_semantic.uncovered_behaviours` |
| **concept-merger** | Once per batch refresh (slice 6) | `lineage/{repo}/concepts.yaml` with per-concept security_aggregate + performance_aggregate | Concepts catalogue (entities / operations / invariants / audiences); per-concept aggregates feed the criticality ranking in downstream reducers |
| **doc-gap-finder** | Once per batch refresh (slice 7) | `lineage/{repo}/doc-gaps.md` with DOC-NNN candidates | Categories: broken-url / missing-anchor / drift / missing-page / stale-page / coverage-gap; severity HIGH/MEDIUM/LOW |
| **adr-archaeologist** | Once per batch refresh (slice 8 + slice-8-fix wisdom test) | `lineage/{repo}/implicit-adrs.md` (real ADRs) AND `lineage/{repo}/refactoring-scopes.md` (gap-shaped); 3-question wisdom test (Nygard 2011 / adr.github.io / AWS Prescriptive Guidance) classifies each candidate | ADRs: classification promote / extend-existing / drift / unique-load-bearing; severity HIGH/MEDIUM/LOW. Scopes: categories missing-validation / missing-auth / missing-rate-limit / missing-retry / buggy-default / missing-audit / missing-pagination / path-mismatch / etc. |
| **test-coverage-mapper** | Once per batch refresh (slice 8) | `lineage/{repo}/test-map.yaml` with TEST-GAP-NNN candidates ranked by node criticality (anchored on concepts.yaml aggregates) | Categories: missing-unit / missing-integration / missing-edge-case / missing-security / missing-performance / sidecar-stale; criticality CRITICAL/HIGH/MEDIUM/LOW |
| **feature-advisor** | On demand (slice 9, query-time via /code-walk) | `lineage/{repo}/feature-walks/{date}-{slug}.md` | Per-query impact assessment over the full ontology |

---

## Batch 2026-05-10A — controller-method expansion (5 nodes)

- **Date**: 2026-05-10
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-10A`
- **Substrate commit**: `ede5d277` (15 prior sidecars + 5 new from this batch = 20 total; 3.8% → 5.1% coverage of 395 substrate nodes)
- **Theme**: 2 known-bug validators (re-discover existing REFACTOR-013 + REFACTOR-024) + 3 new-area explorations (Activity Feed, Slack collaboration, Collector Token)

### Sidecars added (5)

| Sidecar | Source | Concept(s) | implicit_adrs | bugs_limitations | security gaps | perf gaps | doc-drift | test gaps |
|---|---|---|---|---|---|---|---|---|
| `AlertController.getAllAlerts` | `AlertController.java:35` | Alert | 1 (intent-anchored: SECURITY_RULES + catch-all auth) | 4 | 2 (1 HIGH cross-owner + 1 MEDIUM DISABLED reach) | 4 | 1 (alerting page "stewards and admins" without gate) | unmeasured method-level |
| `DataEntityAttachmentController.uploadFileChunk` | `DataEntityAttachmentController.java:53` | Attachment, Data Entity | 3 (pass-through, uploadId-as-session-key, centralised path-matcher) | 7 (2 HIGH + 3 MEDIUM + 2 LOW) | 4 | 3 | 1 (chunked-upload wire protocol undocumented) | full path uncovered |
| `ActivityController.getActivity` | `ActivityController.java:23` | **Activity Feed (NEW)** | 3 (cursor pagination, defence-in-depth date validation, view-modes-as-parameter) | 6 | 4 (1 HIGH cross-owner activity-feed exposure) | several | 2 (api-reference/activity 404 + `lasEventId` typo on public API) | cursor + filter + view-modes |
| `DataCollaborationController.postMessageInSlack` | `DataCollaborationController.java:33` | **Slack collaboration app (NEW)** | 5 (fail-fast OAuth, disabled-by-default, thin reactive proxy, **202+queue+Postgres-advisory-lock single-sender decoupling**, single-sender concurrency) | 9 (2 HIGH + 6 MEDIUM + 1 LOW) | several (in ODD vocab: OAUTH2/LDAP relevance, BYPASSES owner-scoping, no authorization_assertions) | 3 (single-leader sender bottleneck, per-request Slack `conversations.info`, Caffeine cache cost) | 2 (legacy `/active-platform-features/data-collaboration` 404 vs canonical 200; api-reference missing auth/validation/rate-limit) | most behaviours uncovered |
| `CollectorController.regenerateCollectorToken` | `CollectorController.java:47` | **Collector Token (NEW)** | 4 (SecurityConstants-as-registry, in-place UPDATE rotation, plaintext-on-rotate-masked-on-read, plaintext-equality token model) | 8 (non-SecureRandom RNG, plaintext-equality, no audit log, no grace period, DISABLED-mode bypass, no rate-limit, non-`@ReactiveTransactional`, no idempotency) | several (S2S filter coupling) | several | 0 | full rotation path uncovered |

### Reducer diffs

| Reducer | Artefact | Before | After | Net | What changed |
|---|---|---|---|---|---|
| concept-merger | `concepts.yaml` | 31 concepts | **42 concepts** | **+11** | New concepts: Activity Feed, Slack collaboration app, Collector, Collector Token. New audiences: Slack workspace, ODD Collector runtime. New invariants: Decoupled-write pattern, Plaintext-equality token model. New operations: Read Activity Feed, Enqueue Slack Discussion Message, Regenerate Collector Token. Security aggregates on 13 concepts (up from 7); performance on 13. 15 canonicalisation candidates. |
| doc-gap-finder | `doc-gaps.md` | 27 candidates | **35 candidates** | **+8** | Severity: 14 HIGH / 16 MEDIUM / 5 LOW. Categories: broken-url, drift, missing-page, coverage-gap. 9 live URLs verified including the legacy 404 vs canonical 200 split for `data-collaboration`. |
| adr-archaeologist (ADRs) | `implicit-adrs.md` | 16 ADR candidates | **23 ADR candidates** | **+7** | New: ADR-CANDIDATE-017..023. Strengthened (rediscovered): ADR-CANDIDATE-001 (pass-through controller), ADR-CANDIDATE-002 (centralised SECURITY_RULES), ADR-CANDIDATE-003 (GET-uniformly-authenticated read-collaborative), ADR-CANDIDATE-007 (uniform Mono<ResponseEntity>). Severity: 8 HIGH / 13 MEDIUM / 2 LOW. 0 wisdom-test fails (file-analyser/0.2.0 routing is working). |
| adr-archaeologist (scopes) | `refactoring-scopes.md` | 44 scopes | **67 scopes** | **+23** | New: REFACTOR-045..067. Strengthened: REFACTOR-010 (cross-owner audit-trail), REFACTOR-011 (cross-tenant Slack-thread exposure), REFACTOR-013 (uploadFileChunk size-cap bypass — VALIDATED), REFACTOR-024 (getAllAlerts cross-owner — VALIDATED). Severity: 0 CRITICAL / 25 HIGH / 33 MEDIUM / 9 LOW. |
| test-coverage-mapper | `test-map.yaml` | 69 test gaps | **100 test gaps** | **+31** | Criticality: 24 CRITICAL / 31 HIGH / 29 MEDIUM / 16 LOW. CRITICAL count nearly doubled (14 → 24) — driven by the new sidecars' HIGH-security-aggregate concepts (token rotation, cross-owner activity, Slack posting). 0 sidecar-quality findings (all `test_files` claims verified). 65 test files indexed. |

### Known-bug validators (✅ rediscovery loop closes)

| Pre-existing finding | Rediscovered by | Verdict | Detail |
|---|---|---|---|
| **REFACTOR-024** — `getAllAlerts` cross-owner exposure | `AlertController.getAllAlerts.md` | ✅ **PASS** | Sidecar surfaces "no SecurityRule for `GET /api/alerts`, falls through to `.authenticated()`; no owner predicate in `listAllWithStatusOpen`" from primary source. Adr-archaeologist strengthened REFACTOR-024's `surfaced_by` rather than creating duplicate. |
| **REFACTOR-013** — `uploadFileChunk` size-cap bypass | `DataEntityAttachmentController.uploadFileChunk.md` | ✅ **PASS** | Sidecar surfaces "no size enforcement on chunk path" from primary source. Adr-archaeologist strengthened REFACTOR-013. **Plus** new finding the class-level sidecar missed: chunk staging at `/tmp/odd/chunks` is `attachment.storage`-INDEPENDENT (multi-instance failure mode affects LOCAL **and** REMOTE; new REFACTOR entry). |

### Notable new findings (HIGH-severity, spot-check candidates)

The full ID list lives in the reducer artefacts; below are the surfacing trails for findings most likely to match held-back spot-checks.

**Security / authorization gaps (HIGH):**

- **Cross-owner activity-feed exposure** ← `ActivityController.getActivity.md:security.known_security_gaps.[0]` ← `ActivityController.java:23` + `SecurityConstants.java` (no rule for `/api/activity`) → any authenticated user reads global cross-owner activity feed including old/new state diffs of descriptions / business names / ownership / custom-metadata. **Investigator chain**: file-analyser → adr-archaeologist (refactoring-scopes.md).
- **Cross-owner Slack-posting via unscoped `data_entity_id`** ← `DataCollaborationController.postMessageInSlack.md:bugs_limitations_corner_cases.[1]` ← `DataCollaborationController.java:33`. **Investigator chain**: file-analyser → adr-archaeologist.
- **No authorization gate on Slack POST endpoint** ← `DataCollaborationController.postMessageInSlack.md:bugs_limitations_corner_cases.[0]` ← `DataCollaborationController.java:33`. **Investigator chain**: file-analyser → adr-archaeologist.
- **Cross-entity `uploadId` hijack via path-vs-uploadId auth-context mismatch** ← `DataEntityAttachmentController.uploadFileChunk.md:bugs_limitations_corner_cases.[N]` ← `DataEntityAttachmentController.java:53`. NEW finding not in pre-batch refactoring-scopes. **Investigator chain**: file-analyser → adr-archaeologist.
- **Chunk staging at `/tmp/odd/chunks` is `attachment.storage`-INDEPENDENT** ← `DataEntityAttachmentController.uploadFileChunk.md:bugs_limitations_corner_cases.[N]` ← `DataEntityAttachmentController.java:53`. NEW finding refining class-level sidecar's LOCAL-only attribution. **Investigator chain**: file-analyser → adr-archaeologist.
- **`getAllAlerts` cross-owner exposure** (rediscovery of REFACTOR-024) ← `AlertController.getAllAlerts.md:security.known_security_gaps.[0]` ← `AlertController.java:35`. **Investigator chain**: file-analyser strengthens existing REFACTOR-024.

**Token / RNG gaps (collector token area, all NEW):**

- **Non-SecureRandom RNG for collector token generation** ← `CollectorController.regenerateCollectorToken.md:bugs_limitations_corner_cases.[N]` ← `CollectorController.java:47` + downstream service. **Investigator chain**: file-analyser → adr-archaeologist.
- **Plaintext-equality token model** — `IngestionDataEntitiesFilter` uses `.equals(...)` for ingestion token verification (not constant-time, not hashed) ← `CollectorController.regenerateCollectorToken.md:implicit_adrs.[N]` (intent-anchored — chose to keep this model) AND `bugs_limitations_corner_cases.[N]` (gap-shaped — the equality-comparison risks). The agent split the intent (model choice) from the gap (no constant-time comparison). **Investigator chain**: file-analyser → adr-archaeologist (both ADR + scope).
- **No rotation audit log** ← `CollectorController.regenerateCollectorToken.md:bugs_limitations_corner_cases.[N]`. **Investigator chain**: file-analyser → adr-archaeologist.
- **No grace period for old tokens (immediate invalidation)** ← `CollectorController.regenerateCollectorToken.md:bugs_limitations_corner_cases.[N]`. **Investigator chain**: file-analyser → adr-archaeologist.
- **DISABLED-mode bypass on regeneration endpoint** ← `CollectorController.regenerateCollectorToken.md:security.known_security_gaps.[N]`. **Investigator chain**: file-analyser → adr-archaeologist.

**API contract / public-surface defects:**

- **`lasEventId` typo on public activity-feed API contract** ← `ActivityController.getActivity.md:bugs_limitations_corner_cases.[N]` ← `ActivityController.java:23`. Spelt as `lasEventId` (missing `t`); if doc-side spells `lastEventId`, that's a code↔doc drift. **Investigator chain**: file-analyser → adr-archaeologist + doc-gap-finder.

**Doc-product / publication gaps:**

- **`developer-guides/api-reference/activity` page returns 404** ← `ActivityController.getActivity.md:docs_link_semantic.doc_drift_findings`. Parallels DOC-161 pattern (api-reference subtree sparse). **Investigator chain**: file-analyser → doc-gap-finder.
- **Live `/active-platform-features/data-collaboration` page returns 404** even though `.md` exists in docs repo (broken deploy or GitBook routing rule drift); canonical lives at `/features/active-platform-features/data-collaboration` (200). ← `DataCollaborationController.postMessageInSlack.md:docs_link_semantic.doc_drift_findings`. **Investigator chain**: file-analyser → doc-gap-finder.
- **Chunked-upload wire protocol not documented in attachments page** ← `DataEntityAttachmentController.uploadFileChunk.md:docs_link_semantic.doc_drift_findings`. **Investigator chain**: file-analyser → doc-gap-finder.
- **Alerting feature page recommends "stewards and admins" but enforces no role gate** ← `AlertController.getAllAlerts.md:docs_link_semantic.doc_drift_findings`. **Investigator chain**: file-analyser → doc-gap-finder.

**Concurrency / data-integrity patterns (intent-anchored, novel):**

- **202+queue+Postgres-advisory-lock single-sender decoupling** (Slack collaboration) — intent-anchored ADR captured ← `DataCollaborationController.postMessageInSlack.md:implicit_adrs.[N]` ← `DataCollaborationController.java:33` + `MessageProviderConsumer.java` (advisory-lock acquisition) → adr-archaeologist → `implicit-adrs.md` new ADR-CANDIDATE-XXX. Maintainer triage point: this is a substantive concurrency pattern that may need its own ADR draft.

### Investigator-to-finding trail format

Every entry in the reducer artefacts cites its surfacing sidecar. Example trace for a maintainer running a spot-check:

```
held-back spot-check: "is there a known bug about non-SecureRandom RNG in collector token generation?"
  ↓ grep this log
batch 2026-05-10A — CollectorController.regenerateCollectorToken sidecar surfaced non-SecureRandom RNG
  ↓ open refactoring-scopes.md
REFACTOR-XXX — non-SecureRandom RNG for collector token generation
  ↓ trace surfaced_by
CollectorController.regenerateCollectorToken.md:bugs_limitations_corner_cases.[N]
  ↓ open sidecar
sidecar's sources block cites: CollectorController.java:47 + CollectorService.java:NN (the RNG call)
  ↓ verdict
✅ surfaced; investigator chain: file-analyser → adr-archaeologist; batch: 2026-05-10A
```

If the spot-check does NOT appear in any batch entry → record it for next-batch verification. Add the source file to the next batch's node-pick list if it's not covered.

---

## Next-batch planning notes

The 20 sidecars / 5.1% substrate coverage are heavy on controllers + controller-methods. The next batch should broaden into:

- **`config-key-consumer` nodes** (73 total; 1 enriched) — services consuming config keys. Each is a candidate site for LSN-001/002-class default-leak bugs. Examples: `IngestionDataEntitiesFilter`, `AuthorizationManagerCondition`, `MetricsExtractor` family, `OAuth*Configuration`.
- **`config-properties-class` nodes** (9 total; 1 enriched — only GenAIProperties) — config-property POJOs that boot-time-validate the runtime configuration.
- **`route` nodes** (12 total; 1 enriched — only alerts) — UI routes; each maps to a feature surface and its security posture.

Until the next batch fires, the held-back spot-check set should be matched against this batch's log entries above. Misses → candidate node-picks for batch 2026-05-10B.
