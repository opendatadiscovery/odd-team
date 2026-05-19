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

---

## Batch 2026-05-10B — config-key-consumer expansion (5 nodes)

- **Date**: 2026-05-10 (sidecars + reducers landed late evening; commit deferred to 2026-05-11 for privacy-remediation scrub)
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-10B`
- **Substrate commit**: `ede5d277` (20 prior sidecars + 5 new = 25 total; 5.1% → 6.3% coverage of 395 substrate nodes)
- **Theme**: config-key-consumer layer — Spring `@ConditionalOnProperty` / `@Value` consumers where LSN-001/002-class default-leak bugs land. 5 new-area exploration nodes (no known-bug validators this batch — pure exploration).
- **Bundled-in this commit**: privacy remediation (see below).

### Privacy remediation (bundled in this batch's commit)

A maintainer audit on 2026-05-11 surfaced that batch-A's agents had echoed absolute filesystem paths (`/home/USER/work/odd/...`) into 30 committed artefacts — 10 sidecars + 4 reducer outputs + 14 backlog/research files. Scrubbed all 30 forward; zero `/home/...` leaks remain in committed-artefact directories. **Note**: historical commits on `main` retain the un-scrubbed text; force-rewriting history is a separate maintainer decision (destructive op, not done unilaterally). Preventive fix landed in this commit: `.claude/agents/file-analyser.md` Rule 5 + memory rule `feedback_no_absolute_paths_in_artefacts.md`. The 5 remaining agent contracts (concept-merger / doc-gap-finder / adr-archaeologist / test-coverage-mapper / feature-advisor) inherit the same discipline in the next batch's prep; their batch-B outputs were scrubbed too.

### Sidecars added (5)

All sidecars in this batch are `config-key-consumer` nodes — Spring `@ConditionalOnProperty` / `@Value` consumers in the auth / metrics / activity-feed-operational layer.

| Sidecar | Source | Concept(s) | implicit_adrs | bugs_limitations | security gaps | perf gaps | doc-drift | test gaps |
|---|---|---|---|---|---|---|---|---|
| `AppInfoController @ auth.type@L18` | `AppInfoController.java:18` | Auth Mode | 2 (auth-mode exposure as intentional published contract; reporter-not-reactor pattern vs the four `@ConditionalOnProperty` SecurityConfigurations) | 5 | several | — | 1 (live `enable-security` page silent on `/api/appInfo` unauth-leak) | **zero** — entire AppInfoController surface untested |
| `AuthorizationManagerCondition @ auth.type@L11` | `AuthorizationManagerCondition.java:11` | Authorization (RBAC bean wiring) | 2 (intentional `AnyNestedCondition` OR-pattern at `PARSE_CONFIGURATION` consistent with `SlackMessageGeneratorCondition` from batch A) | 4 | several (LOGIN_FORM without `AuthorizationCustomizer`; DISABLED bypasses both auth axes) | — | 2 (live `/authorization` page doesn't state which auth modes wire authorization; live `/authentication` page doesn't surface DISABLED is default) | testing inapplicable until reactivated |
| `CounterTimeSeriesExtractor @ metrics.storage@L20` | `CounterTimeSeriesExtractor.java:20` | **Metrics ingestion (NEW)**, **Multi-tenant configuration (NEW)** | 2 (mirrored `@ConditionalOnProperty` + `matchIfMissing=true` default-on for INTERNAL_POSTGRES; per-MetricType dispatch via `canExtract`) | 5 (HIGH: tenant-id label asymmetry — write `tenantId != null`, read `StringUtils.isNotEmpty` → empty-string env var silently splits multi-tenant dataset) | 3 (tenant-isolation brittleness, label PII pass-through, no rate-limit) | 2 (no retry/DLQ on Prometheus failure, linear dispatcher in inner-inner loop) | 0 (live `configuration-and-deployment/odd-platform` covers `#metric-storage-backend` and `#prometheus-tenant-label-odd-tenant-id` anchors — unusually well-documented surface) | write/read pair test required (uncovered) |
| `IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20` | `IngestionDataEntitiesFilter.java:20` | Ingestion auth filter (canonical sidecar; 15+ prior sidecars referenced this class) | 4 | 8 | several | — | 1 (live docs silent on `auth.ingestion.filter.enabled` — CRITICAL: the key controls whether the S2S filter is on, and shipped default is OFF) | full filter path uncovered |
| `ActivityTablePartitionManager @ odd.activity.partition-period@L11` | `ActivityTablePartitionManager.java:11` | **Activity table partitioning (NEW operational)**, Activity Feed (existing) | 4 (2x-overlap WIDTH design, dual-lock concurrency via advisory-lock-90 + ShedLock, List-injection extensibility, continue-on-failure orchestration) | 7 | — | several | 4 (HIGH doc-drift: activity-feed live page claims "retention and partitioning" but code creates WIDTH partitions and never DROPs — LSN-001-shape silent-growth) | scheduled paths + dual-lock + silent-fail-on-CREATE all uncovered |

### Reducer diffs

| Reducer | Artefact | Before → After | Net | What changed |
|---|---|---|---|---|
| concept-merger | `concepts.yaml` | catalog_version 2 → 3; 25 sidecars consumed | refreshed | New concepts likely: Metrics ingestion / Multi-tenant configuration / Activity table partitioning (operational). Aggregates refreshed for existing concepts (Auth Mode, Authorization, Ingestion auth filter, Activity Feed) with batch-B findings folded in. |
| doc-gap-finder | `doc-gaps.md` | 35 → **44 candidates** | **+9** | 19 HIGH / 19 MEDIUM / 6 LOW. HIGH count: 14 → 19 (+5). New: `auth.ingestion.filter.enabled` undocumented (CRITICAL — key controls default-OFF S2S filter); AuthorizationManagerCondition-related authorization-mode coverage gaps; ActivityTablePartitionManager retention-claim drift; AppInfoController unauth-leak doc-gap. 6 live URLs verified. |
| adr-archaeologist (ADRs) | `implicit-adrs.md` | 23 → **28 ADR candidates** | **+5** | 11 HIGH / 15 MEDIUM / 2 LOW. 26 promote + 2 unique-load-bearing. **0 wisdom-test fails** — file-analyser/0.2.0 routing + adr-archaeologist Rule 0 both working. |
| adr-archaeologist (scopes) | `refactoring-scopes.md` | 67 → **91 refactoring scopes** | **+24** | 0 CRITICAL / 33 HIGH / 46 MEDIUM / 12 LOW. Notable new entries: REFACTOR-071 (AuthorizationManagerCondition dead-code), REFACTOR-073 (3-sidecar-triangulated default-DISABLED + no-fail-fast pattern — captured as a single cross-cutting scope, not 3 duplicates), REFACTOR-085 (ActivityTablePartitionManager retention/DROP doc-contradiction). |
| test-coverage-mapper | `test-map.yaml` | 100 → **132 test gaps** | **+32** | 32 CRITICAL / 44 HIGH / 37 MEDIUM / 19 LOW. CRITICAL count: 24 → 32 (+8). HIGH count: 31 → 44 (+13). 65 test files indexed; 0 sidecar-quality findings. |

### Known-bug validators

No pre-existing refactoring scopes were targeted as validators this batch (pure new-area exploration). Continuity check: batch A's REFACTOR-013 + REFACTOR-024 remained in `refactoring-scopes.md` with their previous strengthening intact.

### Cross-sidecar triangulation (the standout pattern this batch)

The ontology triangulated the **default-DISABLED + no-fail-fast** security posture from THREE independent sidecars this batch:

- `AppInfoController @ auth.type@L18` ← `/api/appInfo` reachable unauth under DISABLED default; leaks `authType` + `projectVersion`
- `AuthorizationManagerCondition @ auth.type@L11` ← DISABLED bypasses both auth axes; no `matchIfMissing` on any SecurityConfiguration
- `IngestionDataEntitiesFilter @ auth.ingestion.filter.enabled@L20` ← filter defaults OFF (no matchIfMissing + application.yml:48 explicit `false`); every UI auth mode permits `/ingestion/entities` → POST `/ingestion/entities` unauthenticated under default deployment

The cross-cutting roll-up landed as **REFACTOR-073** (single scope, not 3 duplicates) — exactly the cross-sidecar pattern emergence the ontology is designed to produce. **Investigator chain**: 3 file-analyser sidecars → adr-archaeologist roll-up → refactoring-scopes.md REFACTOR-073.

Additionally, the **plaintext-equality token model** was corroborated from a SECOND independent sidecar this batch:

- batch A: `CollectorController.regenerateCollectorToken.md:implicit_adrs.[N]` (plaintext-on-rotate token storage)
- batch B: `IngestionDataEntitiesFilter.java:56` (plaintext `.equals(...)` comparison for ingestion token verification)

Same token model from two independent angles. The adr-archaeologist strengthened the existing entry rather than creating duplicates.

### Notable new findings (spot-check candidates)

The full ID list lives in the reducer artefacts; below are the surfacing trails for findings most likely to match held-back spot-checks.

**Security / authorization (HIGH):**

- **Default deployment ships with `POST /ingestion/entities` unauthenticated** ← `IngestionDataEntitiesFilter.java:20` + `application.yml:48` (explicit `false`) + no `matchIfMissing` on `@ConditionalOnProperty`. **The orchestrator's pre-batch hypothesis was wrong** ("default-on via matchIfMissing or explicit YAML"); the file-analyser corrected via primary-source reading. This is the divergence-detection rate the ADR's defence-against-doc-contamination section names as the success metric.
- **`AuthorizationManagerCondition` is DEAD CODE** ← zero `@Conditional` consumers verified via grep across the entire repo. Filed as REFACTOR-071. Future maintainer reading the Condition class would reasonably assume it gates the authorization-manager wiring; the wiring would silently fail because nothing consults the Condition.
- **`LOGIN_FORM` runs WITHOUT `AuthorizationCustomizer`** — meaning LOGIN_FORM mode may have no policy/permission enforcement at all. Surfaces as part of REFACTOR-073 cluster.
- **`/api/appInfo` reachable by unauthenticated callers under DISABLED default; leaks active `authType` + `projectVersion`** ← `AppInfoController.java:18`. Passive deployment-fingerprinting surface + CVE-scoping vector (project version pins exploitable CVE windows).

**Multi-tenant integrity (HIGH):**

- **Tenant-id label asymmetry — silent multi-tenant data split via empty-string env var** ← `CounterTimeSeriesExtractor.java:20` (write side: `tenantId != null`; read side: `StringUtils.isNotEmpty(tenantId)`). Empty-string env var for `odd.tenant-id` would cause writes to include an empty-string tenant label (null-check passes) but reads to skip tenant filtering (isNotEmpty-check fails) → silent multi-tenant data split.

**Data-lifecycle (HIGH doc-drift):**

- **Activity table grows unbounded — code never DROPs partitions despite docs claiming "retention and partitioning"** ← `ActivityTablePartitionManager.java:11` (setting controls WIDTH only; no DROP path). LSN-001-shape silent-growth. Filed as REFACTOR-085. Operators expecting bounded retention will hit unbounded table growth.
- **Silent-fail swallow on partition CREATE failure** ← `ActivityTablePartitionManager.java` (no observability — eventual insert failures when next partition window opens).

**Doc-product gaps (HIGH coverage-gaps):**

- **`auth.ingestion.filter.enabled` undocumented** ← live security docs (WebFetched 2026-05-10 / 200) do NOT mention this key at all, despite it controlling whether the S2S filter is enabled (shipped default: OFF). The most-load-bearing security-config key has zero doc coverage.
- **Live `/authorization` page silent on which auth modes wire authorization** ← `AuthorizationManagerCondition`-related coverage gap. Operators have no doc-side signal about whether DISABLED or LOGIN_FORM modes actually enforce policies.
- **Live `/authentication` page silent on DISABLED being the shipped default** ← `application.yml:34` explicit but undocumented.

**Concurrency / data-integrity (intent-anchored, novel):**

- **Dual-execution boot+cron paths gated by Postgres advisory-lock-90 + ShedLock** ← `ActivityTablePartitionManager` ADR-candidate. Substantive concurrency pattern — pairs with batch A's `postMessageInSlack` 202+queue+advisory-lock single-sender decoupling.
- **`AnyNestedCondition` OR-pattern at `PARSE_CONFIGURATION`** ← `AuthorizationManagerCondition` ADR-candidate. Same shape as `SlackMessageGeneratorCondition` (batch A). Codebase-wide convention: OR-conditions consume `@ConditionalOnProperty` rather than custom Boolean logic.

### Cumulative ontology state on `main` (after this batch lands)

| Layer | Count | Note |
|---|---|---|
| Substrate scaffold | 395 nodes / 479 edges | unchanged (5 axes from substrate slices 1-4) |
| Sidecars | **25** | 6.3% coverage of 395 substrate nodes |
| concepts.yaml | catalog_version 3 | refreshed with batch-B concepts |
| doc-gaps.md | **44 candidates** | 19 HIGH / 19 MEDIUM / 6 LOW |
| implicit-adrs.md | **28 ADR candidates** | 11 HIGH / 15 MEDIUM / 2 LOW |
| refactoring-scopes.md | **91 refactoring scopes** | 33 HIGH / 46 MEDIUM / 12 LOW |
| test-map.yaml | **132 test gaps** | 32 CRITICAL / 44 HIGH / 37 MEDIUM / 19 LOW |
| existing ADRs catalogued | 5 | unchanged |
| feature-walks | 0 | none run yet (slice 9 query-time is on-demand) |
| probe-rounds.yaml | not started | Type 4 / 6 probe rounds deferred to continuous validation per MVP acceptance |

### Next-batch planning notes

After batch B, the substrate coverage by kind:

- `controller-method` (203 total; 6 enriched — 1 in batch A's 5, the rest from earlier slices)
- `config-key-consumer` (73 total; 6 enriched — 5 in batch B, 1 from earlier)
- `controller` (36 total; 7 enriched)
- `openapi-tag` (35 total; 2 enriched)
- `config-prefix` (14 total; 1 enriched)
- `route` (12 total; 1 enriched)
- `config-properties-class` (9 total; 1 enriched — only GenAIProperties)
- `i18n-resource` (6 total; 0 enriched)
- `ui-shell-widget` (5 total; 1 enriched)
- `ui-shell-bootstrap` (1 total; 1 enriched)
- `ui-shell-app-entry` (1 total; 0 enriched)

Suggested batch 2026-05-10C themes:

- **Auth surface deepening**: `OAuthSecurityConfiguration`, `LoginFormSecurityConfiguration`, `LDAPSecurityConfiguration`, `DisabledAuthSecurityConfiguration` — the 4 SecurityConfiguration beans each correspond to one auth mode. Pairs with batch-B's AuthorizationManagerCondition + AppInfoController sidecars and may close the loop on the default-DISABLED + no-fail-fast triangulation (REFACTOR-073).
- **`config-properties-class` deepening**: only GenAIProperties enriched of 9. The remaining 8 each define the boot-time validated config surface for a feature area — likely surfaces LSN-class missing-validation findings.
- **Notification / messaging surface**: not yet enriched. Could surface notification routing concerns the maintainer's spot-checks may cover.

Until the next batch fires, the held-back spot-check set should be matched against batch A + batch B log entries above. Misses → candidate node-picks for batch 2026-05-10C.

---

## Batch 2026-05-12C — auth-surface deepening + notifications new-area (5 nodes)

- **Date**: 2026-05-12
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-12C`
- **Substrate commit**: `ede5d277` (25 prior sidecars + 5 new = 30 total; 6.3% → 7.6% coverage of 395 substrate nodes)
- **Theme**: closes loop on batch-B's REFACTOR-073 (default-DISABLED + no-fail-fast triangulation) by enriching the 4 `*SecurityConfiguration` beans (one per auth mode) + opens a new area via `NotificationsProperties` (config-properties-class deepening; 1 of 9 enriched pre-batch).
- **Rule 5 compliance**: all 5 sidecars + all 4 reducer outputs verified by pre-commit grep — 0 `/home/USER/...` paths in artefact content. The new policy is operating cleanly across 9 spawned agents this batch.

### Sidecars added (5)

| Sidecar | Source | Concept(s) | implicit_adrs | bugs_limitations | security gaps | perf gaps | doc-drift | test gaps |
|---|---|---|---|---|---|---|---|---|
| `DisabledAuthSecurityConfiguration @ auth.type@L10` | `config/DisabledAuthSecurityConfiguration.java:10` | Auth Mode (DISABLED branch) | 3 (DISABLED-is-default-by-design, explicit-chain-as-statement-of-intent, four-way-enum-mode-selection) | 8 (no CORS, no boot WARN on DISABLED activation, S2S silently ignored, no CSRF, actuator unauthenticated, no audit logging, missing-key fall-through, case-sensitive typo failure) | 6 | — | partial-positive (live `disabled-authentication` page 200 carries "default" + production warning, BUT omits full blast radius) | zero |
| `LoginFormSecurityConfiguration @ auth.type@L31` | `config/LoginFormSecurityConfiguration.java:31` | Auth Mode (LOGIN_FORM branch) | 5 (dev-only intent, **ADMIN-for-all**, additive S2S, CSRF-disabled convention, hand-coded permit-all paths) | 9 (HIGH authorization-absence, MEDIUM open-redirect on `auth.login-form-redirect`, plaintext-credential leak via `/actuator/env`, session cookies without Secure/HttpOnly/SameSite, never-expiring sessions, etc.) | several | — | 3 (Authorization page omits LOGIN_FORM precondition; `auth.login-form-redirect` undocumented; S2S+LOGIN_FORM ADMIN-overlap undocumented) | zero — **VALIDATES REFACTOR-073** by confirming LOGIN_FORM runs WITHOUT `AuthorizationCustomizer` at `LoginFormSecurityConfiguration.java:55-57` (vs OAuth at .java:98 + LDAP at .java:145) |
| `OAuthSecurityConfiguration @ auth.type@L71` | `config/OAuthSecurityConfiguration.java:71` | Auth Mode (OAUTH2 branch) | 6 (inline-authorization wiring, **S2S-composes-not-mutex**, Google `allowedDomain` URL-mutation, conditional multi-client chooser, handler-chain strategy pattern, fail-closed `GrantedAuthoritiesMapper`) | 9 (HIGH standout: **S2S filter grants ADMIN across all `/**` when composed with OAUTH2** — privilege-escalation; Okta/Keycloak documented but code lacks user-enrichment + provider-specific logout handlers) | several | — | 4 (Provider enum lists 5 values but docs claim 7 providers; S2S composition not surfaced in OAuth2 docs; Azure `logout-uri` flagged required-in-docs but not `@PostConstruct`-validated; `azureTenantId` absent from POJO despite docs YAML referencing it) | mostly uncovered |
| `LDAPSecurityConfiguration @ auth.type@L51` | `config/LDAPSecurityConfiguration.java:51` | Auth Mode (LDAP branch) | 6 (mode-agnostic AuthorizationCustomizer wiring, LDAP-as-enterprise-OAuth2-sibling, dedicated AD branch, **containsIgnoreCase admin match**, S2S composable across modes, LdapTemplate fail-loud-tolerate-size-limit) | 10 (3 HIGH: `auth.ldap.password` exposed via default-enabled `/actuator/env` on permitAll path; no `ldap://` vs `ldaps://` scheme enforcement; **substring-collision admin escalation** via `containsIgnoreCase` on admin-groups; MEDIUM: empty `admin-groups` deployment has zero LDAP-path to ADMIN — only S2S can grant admin) | several | — | 7 (none of HIGH caveats surface in live LDAP / authentication / S2S docs — all 200) | zero |
| `NotificationsProperties` | `notification/config/NotificationsProperties.java` | **Notifications (NEW)**, Email, Slack, Webhook | 6 (off-by-default condition, per-channel URL-presence activation, fail-soft fan-out, **leader-elected single-thread WAL consumer**, **lazy-create-no-drop replication artefacts**, per-recipient email loop) | 14 (HIGH: no retry/DLQ/audit, email silent-partial-delivery, no rate-limiting, SMTP infinite timeouts; MEDIUM: dead `webhookUrl` field, advisory-lock collision risk, no per-channel routing, **unsigned webhooks**, replication-slot orphan, PII surface) | several | several | 1 (legacy `/active-platform-features/notifications` 404 vs canonical `/features/active-platform-features/notifications` 200 — same shape as batch A's data-collaboration finding) | zero |

### Reducer diffs

| Reducer | Artefact | Before → After | Net | What changed |
|---|---|---|---|---|
| concept-merger | `concepts.yaml` | 42 → **55 concepts** | **+13** | catalog_version 3 → 4. 20 entities / 11 operations / **13 invariants** / 11 audiences. New concepts: Notifications, Email-channel, Slack-channel, Webhook-channel, Deployment Introspection, AlertManager Webhook Receiver, plus 4-mode Auth Mode branches. Security aggregates on 18 concepts (up from 13); performance on 17 (up from 13). New cross-cutting **invariants** captured: lazy-create-no-drop, dead-code-in-load-bearing-positions, 202+queue+advisory-lock single-sender, default-DISABLED+no-fail-fast, legacy-vs-canonical doc-paths, S2S-composes-not-mutex, ADMIN-for-all in LOGIN_FORM. |
| doc-gap-finder | `doc-gaps.md` | 44 → **58 candidates** | **+14** | 29 HIGH / 23 MEDIUM / 6 LOW. Categories: broken-url 8, drift 44, missing-page 4, coverage-gap 2. DOC-GAP-053 captures **meta-pattern** *"docs frame default behaviour but omit blast radius"* (now corroborated across `disabled-authentication`, ingestion-filter, activity-feed retention). DOC-GAP-058 captures **meta-pattern** *"GitBook legacy-vs-canonical routing drift"* (data-collaboration + notifications + likely more). Auth Mode concept now 7-sidecar triangulated with 12 distinct doc-gaps across 5 sub-pages of `enable-security/authentication/`. Two meta-recommendations: (1) add Gate 3 adjacency rule to `pillars/documentation/gates.md`; (2) doc-side audit of legacy `/active-platform-features/*` paths. |
| adr-archaeologist (ADRs) | `implicit-adrs.md` | 28 → **44 ADR candidates** | **+16** | 13 HIGH / 27 MEDIUM / 4 LOW. 42 promote + 2 unique-load-bearing. **0 wisdom-test fails** (3rd consecutive batch). |
| adr-archaeologist (scopes) | `refactoring-scopes.md` | 91 → **140 refactoring scopes** | **+49** | 0 CRITICAL / 43 HIGH / 70 MEDIUM / 27 LOW. New IDs include REFACTOR-099 / 108 / 113 / 117-119 / 127-130 among others. Strengthened: REFACTOR-073 (now 4-sidecar triangulated for default-DISABLED + no-fail-fast — DisabledAuthSecurityConfiguration validates batch-B's finding from primary source). |
| test-coverage-mapper | `test-map.yaml` | 132 → **180 test gaps** | **+48** | 46 CRITICAL / 65 HIGH / 45 MEDIUM / 24 LOW. CRITICAL: 32 → 46 (+14). HIGH: 44 → 65 (+21). All 4 SecurityConfigurations + NotificationsProperties fully uncovered; HIGH-aggregate concepts landed at top severity. 65 test files indexed (unchanged corpus). 0 sidecar-quality findings. |

### Known-bug validators

| Pre-existing finding | Rediscovered by | Verdict |
|---|---|---|
| **REFACTOR-073** — default-DISABLED + no-fail-fast (batch-B 3-sidecar triangulated) | `DisabledAuthSecurityConfiguration @ auth.type@L10.md` | ✅ **VALIDATED** — now 4-sidecar triangulated. The DisabledAuthSecurityConfiguration sidecar confirmed from primary source: shipped default is DISABLED (no `matchIfMissing`-needed because `application.yml:34` explicitly carries `auth.type: DISABLED`); no boot WARN on activation; S2S silently ignored; actuator unauthenticated. Strengthened existing scope. |
| **LOGIN_FORM-without-AuthorizationCustomizer** (batch-B AuthorizationManagerCondition implication) | `LoginFormSecurityConfiguration @ auth.type@L31.md` | ✅ **VALIDATED** — confirmed from primary source at `LoginFormSecurityConfiguration.java:55-57` (vs OAuth at .java:98 + LDAP at .java:145 which both wire `AuthorizationCustomizer`). Means LOGIN_FORM mode has no policy/permission enforcement; combined with ADMIN-for-all, every authenticated LOGIN_FORM user has admin. |

### Cross-batch triangulation (multi-batch patterns now emergent)

The ontology is producing the cross-sidecar pattern-emergence the ADR's success criteria name. Across A+B+C the following patterns triangulated:

| Pattern | Sidecar count | Sidecars surfacing it | Captured as |
|---|---|---|---|
| **Default-DISABLED + no-fail-fast** | 4 | AppInfoController + AuthorizationManagerCondition + IngestionDataEntitiesFilter (B) + DisabledAuthSecurityConfiguration (C) | REFACTOR-073 (strengthened to 4 surfaced_by) + concepts.yaml invariant |
| **S2S composes-not-mutex (privilege escalation)** | 4 | DisabledAuthSecurityConfiguration silently-ignores + LoginFormSecurityConfiguration additive + OAuthSecurityConfiguration composes (ADMIN-everywhere) + LDAPSecurityConfiguration composable (all C) | new ADR-CANDIDATE for composition stance + new HIGH-severity REFACTOR for ADMIN-blast-radius + concepts.yaml invariant |
| **Lazy-create-no-drop pattern** | 2 | ActivityTablePartitionManager (B) + NotificationsProperties replication slots (C) | concepts.yaml invariant + cross-cutting REFACTOR scope |
| **Dead code in load-bearing positions** | 2 | AuthorizationManagerCondition (B) + NotificationsProperties.webhookUrl (C) | concepts.yaml invariant + hygiene-audit REFACTOR |
| **202+queue+Postgres-advisory-lock single-sender** | 2 | postMessageInSlack (A) + NotificationsProperties WAL consumer (C) | concepts.yaml invariant + candidate ADR for codebase concurrency convention |
| **Legacy-vs-canonical GitBook routing drift** | 2 | data-collaboration (A) + notifications (C) | DOC-GAP-058 (class-level finding + maintainer recommendation for doc-side audit of legacy paths) |
| **Docs frame default behaviour but omit blast radius** | 3+ | `disabled-authentication` doc + `enable-security` ingestion-filter + activity-feed retention | DOC-GAP-053 (class-level finding) |
| **Plaintext-equality token model** | 2 | regenerateCollectorToken (A) + IngestionDataEntitiesFilter:56 (B) | strengthened existing entries |

### Notable new findings (spot-check candidates)

**Security / authorization (HIGH, NEW this batch):**

- **S2S filter grants ADMIN across all `/**` when composed with OAUTH2** ← `OAuthSecurityConfiguration.java:71` + the S2S composition pattern across 4 SecurityConfigurations. Privilege-escalation vector — if S2S is enabled alongside any authenticated mode, S2S-tokens become admin-grants.
- **`auth.ldap.password` exposed via default-enabled `/actuator/env`** on a permitAll-ed whitelist path ← `LDAPSecurityConfiguration.java`. Operators leak LDAP bind password to any unauthenticated `/actuator/env` caller.
- **No `ldap://` vs `ldaps://` scheme enforcement** ← `LDAPSecurityConfiguration.java`. Bind + user credentials transit cleartext if operator misconfigures URL.
- **`containsIgnoreCase` substring match on admin-groups admits substring-collision admin escalation** ← `LDAPSecurityConfiguration.java`. Admin-groups `["admin"]` matches "non-admins", "system-administrators", "admin-readonly" etc.
- **`LoginFormSecurityConfiguration` grants ADMIN to every authenticated user** ← `LoginFormSecurityConfiguration.java` (sidecar's "ADMIN-for-all" implicit ADR). Dev-only intent — but if operator runs LOGIN_FORM in production, every user is admin.
- **Open-redirect surface on `auth.login-form-redirect`** ← `LoginFormSecurityConfiguration.java:41`. Redirect URI unvalidated.
- **Plaintext credentials leak via `/actuator/env`** (LOGIN_FORM mode) ← `LoginFormSecurityConfiguration.java`. Same actuator pattern as LDAP.

**Concurrency / data-integrity (HIGH, NEW):**

- **`NotificationsProperties` SMTP infinite timeouts** — no SMTP send timeout configured → notification thread can hang indefinitely on unresponsive SMTP server, eventually exhausting the leader-elected single-thread WAL consumer.
- **`NotificationsProperties` email silent-partial-delivery** — per-recipient loop with no per-recipient outcome tracking; some recipients receive, some don't, no audit trail.
- **`NotificationsProperties` advisory-lock collision risk** — uses an advisory lock ID that may collide with `ActivityTablePartitionManager`'s advisory-lock-90 (shared DB collision risk).

**Doc-product meta-patterns (HIGH, NEW):**

- **DOC-GAP-053** — *"docs frame default behaviour but omit its blast radius"* — corroborated by `disabled-authentication`, `enable-security` ingestion-filter, activity-feed retention. **Meta-recommendation**: add Gate 3 adjacency rule to `pillars/documentation/gates.md` requiring "consequence cluster" on any page documenting a default.
- **DOC-GAP-058** — *"GitBook legacy-vs-canonical routing drift"* — corroborated by data-collaboration and notifications. **Meta-recommendation**: doc-side audit of all legacy `/active-platform-features/*`, `/data-discovery/*`, `/main-concepts` paths with GitBook redirect rules.

### Cumulative ontology state (after this batch lands)

| Layer | Count | Note |
|---|---|---|
| Substrate scaffold | 395 nodes / 479 edges | unchanged (5 axes from substrate slices 1-4) |
| Sidecars | **30** | 7.6% coverage of 395 substrate nodes |
| concepts.yaml | catalog_version 4 (55 concepts) | refreshed with batch-C concepts + invariants |
| doc-gaps.md | **58 candidates** | 29 HIGH / 23 MEDIUM / 6 LOW |
| implicit-adrs.md | **44 ADR candidates** | 13 HIGH / 27 MEDIUM / 4 LOW |
| refactoring-scopes.md | **140 refactoring scopes** | 43 HIGH / 70 MEDIUM / 27 LOW |
| test-map.yaml | **180 test gaps** | 46 CRITICAL / 65 HIGH / 45 MEDIUM / 24 LOW |
| existing ADRs catalogued | 5 | unchanged |
| feature-walks | 0 | none run yet (slice 9 query-time is on-demand) |

### Substrate coverage by kind (after batch C)

- `controller-method` (203 total; 6 enriched — 3.0%)
- `config-key-consumer` (73 total; **10 enriched** — 13.7%; +4 batch-C SecurityConfigurations + 5 batch-B)
- `controller` (36 total; 7 enriched — 19.4%)
- `openapi-tag` (35 total; 2 enriched — 5.7%)
- `config-prefix` (14 total; 1 enriched — 7.1%)
- `route` (12 total; 1 enriched — 8.3%)
- `config-properties-class` (9 total; **2 enriched** — 22.2%; +1 batch-C NotificationsProperties)
- `i18n-resource` (6 total; 0 enriched — 0%)
- `ui-shell-widget` (5 total; 1 enriched — 20.0%)
- `ui-shell-bootstrap` (1 total; 1 enriched)
- `ui-shell-app-entry` (1 total; 0 enriched)

### Next-batch planning notes

Three high-leverage themes for batch 2026-05-12D (or later):

1. **Config-properties-class deepening**: 7 of 9 still unenriched. Likely high-yield candidates:
   - `ODDOAuth2Properties` — pairs with batch-C OAuthSecurityConfiguration; full OAuth provider config
   - `ODDLDAPProperties` — pairs with batch-C LDAPSecurityConfiguration; LDAP connection + bind config
   - `EmailSenderProperties` — sibling of NotificationsProperties; SMTP config + auth
   - `DataCollaborationProperties` — pairs with batch A's postMessageInSlack; Slack OAuth + channel routing
   - `HousekeepingTTLProperties` — likely resolves the ActivityTablePartitionManager retention-claim drift (if retention IS handled, it's here)
2. **Repository layer**: zero `*RepositoryImpl` enriched. The jOOQ + R2DBC reactive repo layer is where transaction boundaries, advisory-lock interactions, and tenant-isolation enforcement live.
3. **Service layer (deeper than controllers)**: `AlertServiceImpl`, `DataEntityServiceImpl`, `IngestionService`, `NotificationsDispatcher` — the service-layer logic that controllers delegate to. Where ownership-scoping, validation, and authorization assertions live.

Until the next batch fires, the held-back spot-check set should be matched against batch A + batch B + batch C log entries above. Misses → candidate node-picks for batch D.

---

## Batch 2026-05-12D — config-properties-class deepening (5 nodes)

- **Date**: 2026-05-12
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-12D`
- **Substrate commit**: `ede5d277` (30 prior sidecars + 5 new = 35 total; 7.6% → 8.9% coverage)
- **Theme**: config-properties-class deepening (1 of 9 enriched pre-batch → 7 of 9 post-batch). 4 of 5 nodes pair with prior-batch SecurityConfigurations / postMessageInSlack / NotificationsProperties — closing semantic loops from a second angle. 1 known-bug-validator/-resolver (HousekeepingTTLProperties for REFACTOR-085 activity-feed retention drift).
- **Rule 5 compliance**: all 5 sidecars + 4 reducer outputs verified clean. Pre-commit grep across `lineage/ backlog/ adrs/ playbooks/ pillars/ state/ navigation/ scanners/ findings/ issues/ retrospectives/ .claude/agents/` → 0 matches.

### Sidecars added (5)

| Sidecar | Source | Concept(s) | implicit_adrs | bugs_limitations | doc-drift | test gaps |
|---|---|---|---|---|---|---|
| `ODDOAuth2Properties` | `auth/ODDOAuth2Properties.java` | Auth Mode (OAUTH2) | 4 (map-keyed schema, narrow-fail-fast, provider-as-string, **Lombok-bundle**) | 7 (clientSecret-not-`@ToString.Exclude`'d, no URL validation, empty-map passes validation, Azure-logoutUri NPE-prone at `AzureLogoutSuccessHandler.java:39`, no scheme enforcement, etc.) | 5 (**`username-attribute` vs `userNameAttribute` docs-vs-code spelling mismatch**, undocumented `adminUserInfoFlag` for ODD_IAM, Provider 5-vs-7 confirmed 2nd-angle, `azureTenantId` POJO-absent confirmed 2nd-angle) | zero |
| `ODDLDAPProperties` | `auth/ODDLDAPProperties.java` | Auth Mode (LDAP) | 4 | 7 (4 HIGH: substring-collision admin via `Set<String> adminGroups`; password Lombok-`toString()`-leak refines batch-C `/actuator/env` claim; no `ldap://` vs `ldaps://` scheme enforcement; empty `admin-groups` yields zero LDAP-admin path) | 5 (new vs live LDAP page) | zero |
| `EmailSenderProperties` | `notification/config/EmailSenderProperties.java` | Notifications (Email channel) | 3 (presence-gated channel, fail-fast on blank fields, protocol pass-through) | **15** (most of any sidecar) — HIGH: SMTP timeouts unset (2-sidecar with NotificationsProperties), STARTTLS-only, no `ssl.trust`, Lombok-`toString` password leak, no `@Email` on sender, port=0 silent default, Boolean nullability NPE risk, **recipient list outside POJO (partial-home)**, silent partial delivery, PII surface, no OAUTH2 / connection pool / Reply-To / DKIM | docs cover 4 of 15 caveats verbatim (positive doc signal); 11 undocumented | zero |
| `DataCollaborationProperties` | `datacollaboration/config/DataCollaborationProperties.java` | Slack collaboration app | 3 (fail-fast `@PostConstruct` validator, **lock-IDs-as-properties for collision-avoidance**, Postgres-as-only-runtime-dependency) | 6 (**partial-home — binds only 3 of 7 `datacollaboration.*` keys**; no lock-id-equality invariant; no upper bound on retry; no cross-subsystem lock-id-collision check; OAuth-token-elsewhere refactor risk; no `@Validated` / JSR-303) | 2 (unstated lock-id-collision risk, undocumented retry-count-zero semantics) | zero |
| `HousekeepingTTLProperties` | `housekeeping/config/HousekeepingTTLProperties.java` | **Housekeeping TTL retention (NEW)** | 3 (30/30/30 default uniformity, `@Scheduled(fixedRate=15 min)` + ShedLock concurrency, presence-gated by `housekeeping.enabled`) | several — **the headline**: POJO has **NO `activity*Days` or `messageDays` field**; time-based retention for activity / message tables does NOT exist in the codebase. `EmptyPartitionsHousekeepingJob` subclasses drop **empty** past partitions only. Plus jOOQ-precedence bug. | 2 (housekeeping subsystem Java-vs-YAML default cliff; 3-vs-5 jobs framing) | zero |

### Reducer diffs

| Reducer | Artefact | Before → After | Net | Highlights |
|---|---|---|---|---|
| concept-merger | `concepts.yaml` | 55 → **60 concepts** | +5 | catalog_version 4 → 5. **17 invariants** (+4: Lombok-toString-sensitive-field-leak, partial-home @ConfigurationProperties pattern, advisory-lock-collision-risk-across-subsystems, retention-claim-vs-code-drift strengthening). Security aggregates on 19; performance on 18. New concept: Housekeeping TTL retention. 29 canonicalisation candidates. |
| doc-gap-finder | `doc-gaps.md` | 58 → **71 candidates** | +13 | 35 HIGH / 29 MEDIUM / 7 LOW. New category: **`meta`** (2 entries — DOC-GAP-067 Lombok-toString 4-sidecar triangulated; DOC-GAP-068 partial-home 2-sidecar triangulated). 4 existing findings strengthened (S3 credentials, activity-feed retention now 2-angle, OAuth2 5-vs-7 now 2-angle, LDAP password Lombok-vs-actuator refinement). 13 new candidates (DOC-GAP-059..071). |
| adr-archaeologist (ADRs) | `implicit-adrs.md` | 44 → **48 ADRs** | +4 | 13 HIGH / 31 MEDIUM / 4 LOW. 46 promote + 2 unique-load-bearing. **0 wisdom-test fails** (4th consecutive batch). Most batch-D sidecar-level ADRs clustered or strengthened existing entries. |
| adr-archaeologist (scopes) | `refactoring-scopes.md` | 140 → **182 refactoring scopes** | **+42** | 0 CRITICAL / 48 HIGH / 86 MEDIUM / 48 LOW. New: REFACTOR-141 (primitive-default-leak), REFACTOR-142 (jOOQ-precedence bug), REFACTOR-155 (Azure-logoutUri NPE), REFACTOR-156 (azureTenantId doc drift), among others. |
| test-coverage-mapper | `test-map.yaml` | 180 → **215 test gaps** | +35 | 54 CRITICAL / 76 HIGH / 59 MEDIUM / 26 LOW. **+4 cross-cutting patterns** (no-@ConfigurationProperties-binding-tests class; no-@ToString.Exclude-assertion-tests class; no-advisory-lock-collision-tests; no-housekeeping-job-tests). **+18 double_jeopardy entries** (behaviours both untested AND undocumented). |

### Known-bug validators / resolvers

| Pre-existing finding | Result | Verdict | Detail |
|---|---|---|---|
| **REFACTOR-085** — `ActivityTablePartitionManager` retention/DROP drift (batch B) | **CONFIRMED FROM 2ND ANGLE** | ✅ drift REAL | `HousekeepingTTLProperties` has no `activity*Days` field; **time-based retention for activity + message tables does not exist anywhere in the codebase**. The drift was not just one file missing it — it's globally absent. REFACTOR-085 strengthened. |
| **batch-C `/actuator/env` password-leak claim** (multiple sidecars) | **REFINED / REFUTED-AT-NARROW-CLAIM** | ✅ refined | Spring Boot 3.4.10's default `management.endpoint.env.show-values: NEVER` DOES mask values in `/actuator/env`. The DURABLE leak surface is Lombok-`@Data`-generated `toString()` if the properties bean is ever logged. **4-sidecar triangulated** across batches B+C+D. Captured as DOC-GAP-067 + concepts.yaml invariant + cross-cutting REFACTOR. |
| **batch-C OAuth2 5-vs-7 provider drift** | **CONFIRMED FROM 2ND ANGLE** | ✅ drift REAL | `ODDOAuth2Properties` Provider enum has exactly 5 values; docs claim 7 (adds Okta/Keycloak/Custom-OIDC, omits ODD_IAM). |
| **batch-C Azure `tenantId` POJO-absent** | **CONFIRMED FROM 2ND ANGLE** | ✅ drift REAL | `ODDOAuth2Properties` has no `azureTenantId` field; further refined: Azure `logoutUri` NPE-prone at `AzureLogoutSuccessHandler.java:39` (`URI.create(getLogoutUri())` with no null guard, vs Cognito's defensive `isEmpty` check). |

### Cross-batch triangulation (multi-batch patterns continue to strengthen)

| Pattern | Sidecar count | Sidecars surfacing it | Captured as |
|---|---|---|---|
| **Lombok-toString sensitive-field leak** | **4** | Notifications (C hint) + EmailSenderProperties + ODDLDAPProperties + ODDOAuth2Properties (all D) | DOC-GAP-067 meta + concepts.yaml invariant + cross-cutting REFACTOR replacing the overbroad batch-B/C `/actuator/env` framings |
| **Partial-home @ConfigurationProperties** | **2** | DataCollaborationProperties + EmailSenderProperties (both D) | DOC-GAP-068 meta + concepts.yaml invariant + REFACTOR for consolidate-prefix-bindings hygiene sprint |
| **Advisory-lock-ID collision risk across subsystems** | **3** | NotificationsProperties (C) + DataCollaborationProperties (D) + ActivityTablePartitionManager lock-90 (B) | concepts.yaml invariant + candidate ADR for central advisory-lock-ID registry |
| **REFACTOR-085 retention drift confirmation** | **2** | ActivityTablePartitionManager (B) + HousekeepingTTLProperties (D) | strengthened REFACTOR-085 |
| **Default-DISABLED + no-fail-fast** | 4 | from batches B+C (unchanged) | REFACTOR-073 |
| **S2S composes-not-mutex (privilege escalation)** | 4 | batch C SecurityConfigurations | REFACTOR (batch C) |
| **202+queue+Postgres-advisory-lock single-sender** | 2 | postMessageInSlack (A) + NotificationsProperties (C) | candidate ADR |
| **Dead code in load-bearing positions** | 2 | AuthorizationManagerCondition (B) + NotificationsProperties.webhookUrl (C) | concepts.yaml invariant |
| **Legacy-vs-canonical GitBook routing drift** | 2 | data-collaboration (A) + notifications (C) | DOC-GAP-058 |
| **Docs frame default behaviour but omit blast radius** | 3+ | `disabled-authentication` + `enable-security` ingestion-filter + activity-feed retention | DOC-GAP-053 |
| **Plaintext-equality token model** | 2 | regenerateCollectorToken (A) + IngestionDataEntitiesFilter:56 (B) | existing strengthened |
| **Docs-vs-code spelling mismatch** (NEW) | 1 | `username-attribute` vs `userNameAttribute` in ODDOAuth2Properties (D) | DOC-GAP candidate; relaxed-binding hides the bug |

### Notable new findings (spot-check candidates this batch)

**Architectural / refactoring (HIGH, NEW):**

- **Lombok-`@Data` `toString()` leaks sensitive Properties fields codebase-wide** ← 4-sidecar triangulated (Email/LDAP/OAuth2 passwords + Slack client-secret; Notifications hinted at it). Maintainer remediation: add `@ToString.Exclude` / `@JsonIgnore` to every sensitive Properties field across the codebase. REPLACES the overbroad batch-B/C `/actuator/env` framings.
- **Partial-home @ConfigurationProperties pattern** ← `DataCollaborationProperties` binds 3 of 7 `datacollaboration.*` keys; `NotificationsProperties` recipients live outside the POJO. Refactor: consolidate prefix bindings.
- **Advisory-lock-ID collision risk across 3 subsystems** ← partition manager (lock 90) + notifications WAL + data-collaboration sender. No central registry; collisions silent.
- **Activity / message tables have no time-based retention anywhere in codebase** ← `HousekeepingTTLProperties` confirms drift from 2nd angle. Operators relying on "retention and partitioning" doc claim will see unbounded growth.
- **Azure `logoutUri` NPE-prone at `AzureLogoutSuccessHandler.java:39`** ← `URI.create(getLogoutUri())` with no null guard; Cognito branch has defensive `isEmpty` check (asymmetric defensive programming).
- **OAuth2 docs vs code spelling drift** (`username-attribute` vs `userNameAttribute`) ← operator copy-paste from docs yaml verbatim fails to bind without Spring's relaxed-binding tolerance.

**Doc-product meta-patterns (now in `meta` category):**

- **DOC-GAP-067** — Lombok-toString sensitive-field-leak class (4-sidecar)
- **DOC-GAP-068** — Partial-home @ConfigurationProperties class (2-sidecar)

### Cumulative ontology state (after this batch lands)

| Layer | Count |
|---|---|
| Substrate scaffold | 395 nodes / 479 edges (unchanged) |
| Sidecars | **35** (8.9% coverage) |
| concepts.yaml | catalog_version 5 (60 concepts; **17 invariants**) |
| doc-gaps.md | **71 candidates** (35 HIGH) |
| implicit-adrs.md | **48 ADR candidates** (13 HIGH) |
| refactoring-scopes.md | **182 refactoring scopes** (48 HIGH) |
| test-map.yaml | **215 test gaps** (54 CRITICAL / 76 HIGH) |

### Substrate coverage by kind (after batch D)

- `controller-method`: 6/203 (3.0%)
- `config-key-consumer`: 10/73 (13.7%)
- `controller`: 7/36 (19.4%)
- `openapi-tag`: 2/35 (5.7%)
- `config-prefix`: 1/14 (7.1%)
- `route`: 1/12 (8.3%)
- `config-properties-class`: **7/9** (77.8%; +5 batch-D — now the most-covered kind by %)
- `i18n-resource`: 0/6 (0%)
- `ui-shell-widget`: 1/5 (20.0%)
- `ui-shell-bootstrap`: 1/1, `ui-shell-app-entry`: 0/1

### Next-batch planning notes

The config-properties-class layer is now well-covered (7/9 = 77.8%; remaining: `AdditionalLinkProperties`, `MetricExporterProperties`). Three high-leverage themes for batch E (or later):

1. **Repository layer** — still 0 enriched. `*RepositoryImpl` files where transaction boundaries, advisory-lock interactions, tenant-isolation enforcement live. Pairs with batch-D's advisory-lock-collision finding.
2. **Service layer (deeper than controllers)** — still 0 enriched. `AlertServiceImpl`, `DataEntityServiceImpl`, `IngestionService`, `NotificationsDispatcher`, `HousekeepingJobManager`, `MessageProviderConsumer`. Where ownership-scoping, validation, authorization assertions, and the actual job-execution logic live.
3. **controller-method deepening** — 6 of 203 enriched (3.0%). The methods most likely to surface remaining spot-checks would be on under-enriched controllers: `DataEntityController.*` methods (5 sub-controllers covered at class level but only 1 method); `IngestionController.*` methods; `OwnerController` family; `PolicyController` (RBAC).

Until the next batch fires, the held-back spot-check set should be matched against batch A + batch B + batch C + batch D log entries above. Misses → candidate node-picks for batch E.

---

## Batch 2026-05-12E — RBAC primary + Search new-area (5 nodes)

- **Date**: 2026-05-12
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-12E`
- **Substrate commit**: `ede5d277` (35 prior sidecars + 5 new = 40 total; 8.9% → **10.1%** coverage — crossed 10% milestone)
- **Theme**: closes the loop on REFACTOR-073 / REFACTOR-008 / ADR-CANDIDATE-002/003 from the actual RBAC mutation surface. 4 RBAC-primary controller-methods (PolicyController + RoleController + OwnerController + PermissionController) + 1 new-area diversity (SearchController). All 5 are controller-method nodes (deepening that kind: 6/203 → 11/203, 5.4%).
- **Rule 5 compliance**: all 5 sidecars + 4 reducer outputs verified clean. Pre-commit grep across all committed-artefact directories: 0 matches.
- **Rate-limit handling**: 3 of 4 reducer agents (doc-gap / adr-archaeologist / test-coverage) hit Anthropic's account rate limit late in their runs (resets 9:50pm Europe/Warsaw). File-system inspection confirmed all 4 reducer artefacts had been WRITTEN before the limit hit (mod times 18:04-18:18, all carrying batch-E frontmatter). Same pattern as batch B's concept-merger limit hit — the work landed; only the exit-message reply was truncated. Proceeded with the commit phase.

### Sidecars added (5)

| Sidecar | Source | Concept(s) | implicit_adrs | bugs_limitations | Notable findings |
|---|---|---|---|---|---|
| `PolicyController.createPolicy` | `controller/PolicyController.java:19` | **Policy (NEW)**, Authorization | 5 (declarative SECURITY_RULES, schema-validation-at-write, NO_CONTEXT MANAGEMENT permissions, Administrator-name reservation on update/delete, soft-delete-aware partial UNIQUE index) | 7 | **Keys-to-the-kingdom endpoint**. POLICY_CREATE MANAGEMENT-tier correctly wired in `SecurityConstants.java:163-164` — BUT BYPASSED under `auth.type=DISABLED` (`DisabledAuthSecurityConfiguration.java:14-18` short-circuits ALL SECURITY_RULES). Plus Administrator-name asymmetry (present on update/delete, missing on create); no audit logging; no anti-elevation guard. 5 doc-drift findings on Policies live page. |
| `RoleController.createRole` | `controller/RoleController.java:19` | **Role (NEW)**, Authorization | 4 (uniform SECURITY_RULES gating, predefined-name mutation-only protection, role-to-policy rewrite-on-update + insert-on-create, ReactiveTransactional) | 10 | **Predefined-name protection asymmetry**: `update` + `delete` check `UserProviderRole.values()` to block modifying 'Administrator' / 'User'; `create` does NOT. Only DB-layer partial unique index `role_name_unique` prevents recreation. Plus S2S implicit ADMIN, no audit on RBAC mutations, no policy-id validation, Role-rows-vs-LDAP-group-mapping operator confusion. 5 doc-drift findings — live `/authorization/roles` documents 2 predefined roles but NO content on creation API. |
| `OwnerController.createOwner` | `controller/OwnerController.java:21` | **Owner (NEW)**, Authorization | 3 (centralised SECURITY_RULES gate at `SecurityConstants.java:143` (OWNER_CREATE); **identity-decoupled directory CRUD** with user-association as a separate flow; service-layer @ReactiveTransactional) | 7 | **OpenAPI 201 vs impl 200 status-code drift** (the OpenAPI-generated-controller pattern is supposed to prevent contract drift, yet here it is). **No auto-Owner-on-LDAP/OAuth-login** — OAuth2/LDAP users authenticate but have no Owner unless an admin creates one → cannot be assigned as data-entity owner, cannot use `/my*` ownership-scoped queries. Onboarding gap. Non-partial UNIQUE blocks soft-delete recovery. No activity-feed event on owner create. Unbounded owner sprawl. Anonymous reach under DISABLED. |
| `PermissionController.getResourcePermissions` | `controller/PermissionController.java:19` | **Permission (NEW)**, Authorization | 4 (**shared read+enforce evaluation graph** — POSITIVE design; **authoritative-not-UI-hint** — POSITIVE; resource-type↔context enum coupling; deliberate `.authenticated()` fall-through) | 6 | 2 HIGH auth-mode-bypass findings: (a) **DISABLED + getResourcePermissions returns empty/null silent contradiction** (API says "you have nothing" but SECURITY_RULES bypassed = user has everything → UI hides buttons user CAN use); (b) **LOGIN_FORM static-admin-ALL bypass** (user has ADMIN at enforcement but per-policy returns mix → UI shows limited permissions). Per-resource N+1 perf gap. Zero tests. 3 doc-drift findings — entire read-side surface undocumented across 3 live pages. |
| `SearchController.search` | `controller/SearchController.java:59` | **Search Session (NEW)**, Data Discovery | 3 (**search-session-as-server-state** — unique-load-bearing; centralised-SECURITY_RULES corroboration; controllers-as-delegates corroboration) | 9 | **HIGH: catalog-wide cross-owner enumeration** (REFACTOR-024-shape with wider blast radius — search is the workhorse read endpoint). `to_tsquery` syntax-error vector via raw user input through `JooqFTSHelper.tsQuery` (Postgres FTS injection / DoS). Unbounded search_facets writes intersecting REFACTOR-141 housekeeping default-leak (compounding cross-batch finding). Unbounded query length. No rate-limit. Search-session UUID has no per-user binding. Persistent query text PII risk. 3 doc-drift findings — canonical `/features/data-discovery/search` silent on WHO can search + query syntax + pagination; alternative `/features/active-platform-features/search` is **404** (3rd legacy-vs-canonical drift instance). |

### Reducer diffs

| Reducer | Artefact | Before → After | Net | Highlights |
|---|---|---|---|---|
| concept-merger | `concepts.yaml` | 60 → **73 concepts** | +13 | catalog_version 5 → 6. 26 entities (+5: Policy, Role, Owner, Permission, Search Session) / 16 operations (+5) / **20 invariants** (+3) / 11 audiences. 35 canonicalisation candidates. Security aggregates on ~25 concepts; perf on ~25. |
| doc-gap-finder | `doc-gaps.md` | 71 → **83 candidates** | +12 | 41 HIGH / 34 MEDIUM / 8 LOW. Categories: broken-url 9, drift 64, missing-page 5, coverage-gap 2, meta 3 (+1 new meta finding). |
| adr-archaeologist (ADRs) | `implicit-adrs.md` | 48 → **53 ADRs** | +5 | 15 HIGH / 34 MEDIUM / 4 LOW. 51 promote + 2 unique-load-bearing. **0 wisdom-test fails** (5th consecutive batch). |
| adr-archaeologist (scopes) | `refactoring-scopes.md` | 182 → **210 refactoring scopes** | +28 | 0 CRITICAL / 57 HIGH / 99 MEDIUM / 54 LOW. Category taxonomy now ~80 distinct labels (rich refactoring backlog index). Notable new categories: `lombok-tostring-leak`, `partial-home-properties`, `advisory-lock-collision`, `advisory-lock-registry`, `substring-collision`, `contract-typo`, `doc-spelling-drift`, `weak-rng`, `primitive-default-leak`, `jooq-precedence-bug`, plus 30+ more. |
| test-coverage-mapper | `test-map.yaml` | 215 → **252 test gaps** | +37 | **71 CRITICAL** / 88 HIGH / 67 MEDIUM / 26 LOW. CRITICAL: 54 → 71 (+17). HIGH: 76 → 88 (+12). NEW category: `missing-binding` (6 entries — RBAC primary endpoints have no `@ConfigurationProperties` binding tests / authorization tests). 67 test files indexed (up from 65 — agent found 2 additional test files that prior runs missed). |

### Known-bug validators / continuations

| Pre-existing finding | Result this batch | Detail |
|---|---|---|
| **REFACTOR-073** — default-DISABLED + no-fail-fast (8-sidecar pre-batch) | **VALIDATED + STRENGTHENED — now per-endpoint confirmed across the RBAC mutation surface** | PolicyController + RoleController + OwnerController + PermissionController all surface DISABLED-mode-bypass behaviour. The blast radius is the ENTIRE SECURITY_RULES chain. |
| **REFACTOR-024** — read-collaborative cross-owner enumeration (alerts; activity-feed) | **VALIDATED + WIDENED — catalog-wide via SearchController** | search surfaces the entire catalog regardless of ownership; wider blast radius than alerts/activity. |
| **ADR-CANDIDATE-002** — centralised SECURITY_RULES | **VALIDATED 4-times this batch** | All 4 RBAC mutation endpoints honour SECURITY_RULES correctly (positive baseline — the design is correctly applied). |
| **ADR-CANDIDATE-003** — read-collaborative GET endpoints | **VALIDATED on Search read** | SearchController.search is `.authenticated()` fall-through, matching the read-collaborative posture. |

### Cross-batch triangulation (multi-batch patterns escalated)

| Pattern | Sidecar count | Sidecars surfacing it | Captured as |
|---|---|---|---|
| **DISABLED-mode bypasses SECURITY_RULES** | **8** (4 carried from B/C + 4 NEW this batch on RBAC mutation surface) | AppInfoController + AuthorizationManagerCondition + IngestionDataEntitiesFilter (B) + DisabledAuthSecurityConfiguration (C) + PolicyController + RoleController + OwnerController + PermissionController (E) | REFACTOR-073 strengthened — now load-bearing across the RBAC primary surface |
| **LOGIN_FORM ADMIN-for-all (silent bypass)** | **3** (NEW this batch) | LoginFormSecurityConfiguration (C) + RoleController (E) + PermissionController (E) | NEW HIGH-severity refactoring scope cluster |
| **Administrator-name reservation create-vs-update asymmetry** | **2** (NEW invariant this batch) | RoleController.createRole + PolicyController.createPolicy | NEW concepts.yaml invariant + NEW cross-cutting REFACTOR for CRUD-defensive-symmetry |
| **No-audit-log-on-RBAC-mutations** | **3** (NEW invariant this batch) | RoleController + PolicyController + OwnerController create operations | NEW concepts.yaml invariant + NEW cross-cutting REFACTOR |
| **Read-collaborative cross-owner enumeration** | **3** | getAllAlerts (A) + getActivity (B) + search (E) | REFACTOR-024 strengthened; search has wider blast radius |
| **Legacy-vs-canonical GitBook routing drift** | **3** | data-collaboration (A) + notifications (C) + search (E) | DOC-GAP-058 strengthened (now 3-sidecar; maintainer recommendation for doc-side audit reinforced) |
| **OpenAPI-generated controller contract drift** | **1** (NEW finding shape) | OwnerController OpenAPI 201 vs impl 200 status drift | NEW hygiene REFACTOR — the pattern that's supposed to prevent contract drift surfaced a contract drift |
| Plus carried forward from prior batches | | | Lombok-toString leak (4-sidecar); partial-home @ConfigurationProperties (2-sidecar); advisory-lock collision (3-sidecar); REFACTOR-085 retention drift (2-sidecar); S2S composes-not-mutex (4-sidecar batch C); etc. |

### Notable new findings (spot-check candidates this batch)

**Authorization / privilege-escalation (HIGH):**

- **POLICY_CREATE unauthenticated under DISABLED default deployment** ← `PolicyController.createPolicy` validates SECURITY_RULES gating wired correctly but bypassed by DISABLED mode. Combined with no audit logging and no anti-elevation guard, an attacker on the network of a default deployment can create policies granting MANAGEMENT/ALL to a role they then assign to themselves.
- **Administrator-name reservation create-vs-update asymmetry** ← both Policy and Role check `UserProviderRole.values()` on update + delete but NOT on create. Only DB partial unique index protects against recreating the predefined 'Administrator' / 'User' names. Defensive programming added late as a band-aid on update/delete, never propagated to create.
- **LOGIN_FORM static-admin-ALL bypass undermines per-policy returns** ← `PermissionController.getResourcePermissions` returns per-policy permissions but LOGIN_FORM users have ADMIN at enforcement layer regardless. UI/server divergence.
- **`/api/permissions` returns empty under DISABLED while SECURITY_RULES bypassed** ← user has all permissions at enforcement, API says they have none. UI hides buttons the user can actually use → operability degradation + operator confusion.

**Data-discovery / search (HIGH):**

- **Catalog-wide cross-owner enumeration via `/api/search`** ← entire platform catalog enumerable by any authenticated user. Wider than REFACTOR-024 (alerts) or activity-feed.
- **`to_tsquery` syntax-error / DoS vector** ← raw user input through `JooqFTSHelper.tsQuery`. Crafted query can either crash the FTS parser or cause expensive query plans.
- **Search-session UUID has no per-user binding** ← session-id is the only identifier; no link to the calling principal. UUID guessing could allow cross-user session enumeration.

**Onboarding / identity (HIGH):**

- **No auto-Owner-on-LDAP/OAuth-login** ← OAuth2 / LDAP users authenticate but cannot be assigned ownership without an admin manually creating an Owner entity per user. Operator-facing onboarding gap.
- **OpenAPI 201 vs impl 200 status-code drift on `POST /api/owners`** ← the OpenAPI-generated-controller pattern that's supposed to prevent contract drift surfaced a drift. Hygiene-class REFACTOR.

**Cross-batch invariants now codebase-wide:**

- **Lombok-toString sensitive-field leak** — 4-sidecar (batch D), already documented; no new instances this batch but the RBAC mutations don't have new sensitive-field surfaces to extend it.
- **Advisory-lock-ID collision** — 3-sidecar (batches B+C+D), already documented; this batch's search-session-as-server-state pattern uses different concurrency (no advisory locks), so doesn't extend.
- **No-audit-log-on-mutations** — 3-sidecar codebase-wide (RoleController + PolicyController + OwnerController this batch). RBAC mutations leave no trace.

### Cumulative ontology state (after this batch lands)

| Layer | Count |
|---|---|
| Substrate scaffold | 395 nodes / 479 edges (unchanged) |
| Sidecars | **40** (10.1% coverage — crossed 10% milestone) |
| concepts.yaml | catalog_version 6 (73 concepts; **20 invariants**) |
| doc-gaps.md | **83 candidates** (41 HIGH) |
| implicit-adrs.md | **53 ADR candidates** (15 HIGH) |
| refactoring-scopes.md | **210 refactoring scopes** (57 HIGH; ~80 distinct category labels) |
| test-map.yaml | **252 test gaps** (71 CRITICAL / 88 HIGH) |

### Substrate coverage by kind (after batch E)

- `controller-method`: **11/203** (5.4%; +5 batch-E)
- `config-key-consumer`: 10/73 (13.7%)
- `controller`: 7/36 (19.4%)
- `openapi-tag`: 2/35 (5.7%)
- `config-prefix`: 1/14 (7.1%)
- `route`: 1/12 (8.3%)
- `config-properties-class`: 7/9 (77.8%)
- `i18n-resource`: 0/6 (0%)
- `ui-shell-widget`: 1/5 (20.0%)
- `ui-shell-bootstrap`: 1/1, `ui-shell-app-entry`: 0/1

### Next-batch planning notes

Three high-leverage themes for batch F:

1. **Repository layer** — still 0 enriched. `*RepositoryImpl` (jOOQ + R2DBC reactive). Where transaction boundaries, advisory-lock interactions, tenant-isolation enforcement, and the bulk of SQL injection / SQL-aware optimisation lives. Pairs with batch-D advisory-lock-collision finding + batch-E `JooqFTSHelper.tsQuery` injection vector.
2. **DataEntityController.* method deepening** — 0 of 40+ methods enriched (class is enriched at the class level only). DataEntity is the platform's largest tag (40 operations across CRUD/relationships/lineage/alerts/activity/messaging). The "mega-tag" tension (per ADR-CANDIDATE-008) means this is the highest-traffic mutation+read surface.
3. **IngestionController.* methods** — S2S ingestion endpoint that REFACTOR-073's S2S-composes-not-mutex pattern centres on. Closes the S2S loop completely. Pair with the batch-B IngestionDataEntitiesFilter and batch-A AlertManagerController sidecars.

Until the next batch fires, the held-back spot-check set should be matched against batch A + batch B + batch C + batch D + batch E log entries above. Misses → candidate node-picks for batch F.

---

## Batch 2026-05-12F — DataEntity mega-tag + S2S Ingestion loop close (5 nodes)

- **Date**: 2026-05-12 (sidecars + 4 of 5 reducers landed late evening; commit 2026-05-13)
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-12F`
- **Substrate commit**: `ede5d277` (40 prior sidecars + 5 new = 45 total; **11.4% coverage**)
- **Theme**: DataEntity mega-tag method deepening (5 controller-methods) + closing the S2S ingestion loop with batch-B IngestionDataEntitiesFilter.
- **Rule 5 compliance**: 0 leaks across all committed-artefact directories.
- **Partial reducer phase**: 4 of 5 reducer artefacts refreshed cleanly (concept-merger + doc-gap-finder + adr-archaeologist dual-output). **test-coverage-mapper agent hit a stream idle timeout BEFORE writing** — test-map.yaml shows stale sidecar_count: 40. Deferred to batch G's reducer phase (will fold batch-F test gaps in then). Not stale-because-wrong; stale-because-doesn't-yet-include-batch-F.

### Sidecars added (5)

| Sidecar | Concept(s) | Headline finding |
|---|---|---|
| `DataEntityController.getDataEntityDetails` | Data Entity | **Resolves ADR-CANDIDATE-003 borderline_flag** via primary source — read-collaborative GET intentionally outside SECURITY_RULES on the centerpiece read. Plus read-as-write `view_count` increment (4th cross-owner blast-radius surface; row-level write-contention on popular entities under DISABLED). |
| `DataEntityController.createOwnership` | Data Entity, Owner | **NEW HIGH structural finding: Owner auto-create BYPASSES OWNER_CREATE permission**. createOwnership auto-instantiates Owner if missing — the side-door past batch-E's OwnerController gate. Plus Title auto-create no allowlist; self-grant ambiguity. |
| `DataEntityController.updateStatus` | Data Entity, Activity Feed | **NEW HIGH cross-batch finding**: `applyStatus` ordering bug nulls `statusUpdatedAt` on every transition → breaks 30-day housekeeping TTL retention (combines with batch-D HousekeepingTTLProperties). **POSITIVE**: audit-log emission CONFIRMED present (programmatic, not AOP) — refines batch-E's no-audit-log-on-mutations theme to RBAC-specific, NOT codebase-wide. |
| `DataEntityController.getDataEntityDownstreamLineage` | Lineage Graph Traversal (NEW concept) | **VALIDATES REFACTOR-044** (lineageDepth no upper-bound cap) from primary source. Plus null-Integer NPE on missing `lineage_depth` (int primitive can't be null); no CTE cycle guard (diamond-DAG amplification); cross-owner graph enumeration (5th sidecar of the read-collaborative pattern). |
| `IngestionController.postDataEntityList` | S2S Ingestion Pipeline (NEW concept), Ingestion Filter | **CLOSES THE S2S LOOP** with batch-B IngestionDataEntitiesFilter. Controller-side confirmation: no `@PreAuthorize` backup gate — entirely relies on the filter (which defaults OFF). Major doc-drift: live S2S doc uses `X-API-Key` example but code expects `Authorization: Bearer` — operator-trap (copy-paste verbatim fails to auth, possibly leading operators to disable the filter). No canonical operator-facing doc page for `POST /ingestion/entities`. OpenAPI 200/201 status drift (2nd sidecar). |

### Reducer diffs

| Reducer | Before → After | Net |
|---|---|---|
| concept-merger | 73 → **84 concepts** | +11 (catalog_v7; 2 new entities — Lineage Graph Traversal, S2S Ingestion Pipeline) |
| doc-gap-finder | 83 → (sidecar_count: 45; full counts to be verified post-merge) | refreshed |
| adr-archaeologist (ADRs) | 53 → **61 ADRs** | +8 (054-061: read-as-write view-count, soft-deleted-by-id reads, zip-merge enrichment, lineage recursive-CTE + progressive expansion, status state machine, service-layer transactional boundary, programmatic activity emission for bulk, ingestion controller validation split). **ADR-CANDIDATE-003 borderline_flag RESOLVED → intentional** (9-sidecar support). |
| adr-archaeologist (scopes) | 210 → **199 refactoring scopes** | **-11 net (deduplicated)** — the count went DOWN this batch because the agent consolidated duplicate entries that previously appeared in both the main and "Cross-cutting" sections; batch-F actually ADDED ~28 new scopes but removed ~39 duplicate entries from prior batches. **Key new HIGH scopes**: REFACTOR-198 (statusUpdatedAt-nullification breaks TTL — cross-batch D+F), REFACTOR-199 + REFACTOR-206 (Owner + Title auto-create-on-miss permission-bypass). **REFACTOR-073/185 (DISABLED-mode bypass) now 11-sidecar — strongest single finding in the catalog.** |
| test-coverage-mapper | 252 → DEFERRED | stale at batch-E count (sidecar_count: 40). Stream timeout; deferred to batch G's reducer phase. |

**0 wisdom-test fails on batch F — 6th consecutive batch**.

### Known-bug validators / cross-batch validations

| Pre-existing finding | Result this batch | Detail |
|---|---|---|
| **ADR-CANDIDATE-003** (borderline_flag — read-collaborative posture) | **RESOLVED → intentional** | `getDataEntityDetails` primary source on the centerpiece read explicitly uses `.includeDeleted(true)` + `isStale` flag + read-as-write view-count — 4 intent-anchored ADRs collectively confirm the read-collaborative posture is deliberate. The maintainer can de-borderline and promote. |
| **REFACTOR-044** (lineageDepth no cap) | **VALIDATED from primary source** | `getDataEntityDownstreamLineage` confirms no upper-bound cap; recursive-CTE walks to client-driven depth. |
| **REFACTOR-073** (DISABLED-mode bypass) | **VALIDATED + STRENGTHENED — 11-sidecar** | 3 new batch-F sidecars confirm DISABLED bypass: getDataEntityDetails + createOwnership + updateStatus. Now load-bearing across the platform's mutation + read surface. |
| **REFACTOR-024** (read-collaborative cross-owner enumeration) | **VALIDATED + WIDENED — 6-sidecar** | Centerpiece read + lineage traversal both confirm cross-owner unfiltered. Strongest cross-batch finding. |
| **HousekeepingTTLProperties 30-day defaults** (batch D) | **CROSS-BATCH BUG SURFACED** | batch-D's housekeeping TTL relies on `statusUpdatedAt`; batch-F's updateStatus nulls that field on every transition. The 30-day retention TTL effectively never fires. Two batches independently illuminated the bug — exactly the cross-sidecar emergence the ontology is designed to produce. |

### Cross-batch triangulation (escalations this batch)

| Pattern | Sidecar count | Status this batch |
|---|---|---|
| **DISABLED-mode bypasses SECURITY_RULES** | **11** | strongest single finding — 8 prior + 3 new |
| **Read-collaborative cross-owner enumeration** | **6** | borderline resolved to intentional; doc-side alignment captured as sprint candidate |
| **OpenAPI 200/201 status-code drift** | 2 | OwnerController.createOwner E + IngestionController.postDataEntityList F |
| **Doc-vs-code spelling/format mismatch** | 2 | OAuth2 username-attribute D + S2S Authorization-vs-X-API-Key F |
| **Audit-log-on-mutations refinement** | RBAC-specific (not codebase-wide) | updateStatus PROVES DataEntity mutations emit audit; refines batch-E theme |
| **Permission-bypass via auto-create-on-miss** (NEW) | 1 + suspected pattern | createOwnership: Owner + Title auto-create bypasses OWNER_CREATE; codebase-wide audit needed (Tag? Term? Namespace?) |
| **TTL retention broken by statusUpdatedAt nullification** (NEW cross-batch D+F) | 2 | HousekeepingTTLProperties (D) + updateStatus (F) |

### Notable new findings (spot-check candidates this batch)

- **S2S `POST /ingestion/entities` accepts any unauth caller under default deployment** (controller-side primary source confirms batch-B filter-side finding). The most-load-bearing security gap in the platform — and the most-likely operator-trap given the X-API-Key-vs-Authorization-Bearer doc drift.
- **`statusUpdatedAt` nullification silently breaks the 30-day TTL retention** — operators expect 30-day retention; status updates make it never fire. Cross-batch finding that emerges only when both ends are enriched.
- **Owner + Title auto-create-on-miss BYPASSES the dedicated create-side permission gates** — createOwnership can mint Owners without OWNER_CREATE permission. Pattern likely repeats on other entities (Tag / Term / Namespace).
- **Centerpiece read `GET /api/data-entities/{id}` is intentionally read-collaborative** — primary source resolution of the long-standing borderline_flag.
- **`view_count` row-level write-contention on popular entities** — every read takes a write lock on a hot row; popular entities throttle.
- **Lineage diamond-DAG amplification + null-Integer NPE** — recursive-CTE with no cycle guard + missing `lineage_depth` default crashes the endpoint.

### Cumulative ontology state (after this batch lands)

| Layer | Count |
|---|---|
| Substrate scaffold | 395 nodes / 479 edges |
| Sidecars | **45** (11.4% coverage) |
| concepts.yaml | catalog_version 7 (84 concepts; 19 invariants; 2 new entities) |
| doc-gaps.md | refreshed (sidecar_count: 45) |
| implicit-adrs.md | **61 ADR candidates** (17 HIGH / 39 MEDIUM / 5 LOW) |
| refactoring-scopes.md | **199 refactoring scopes** (58 HIGH / 92 MEDIUM / 49 LOW; deduplicated) |
| test-map.yaml | **STALE at 252 gaps (sidecar_count: 40)** — batch-F test-coverage-mapper timed out; refresh deferred to batch G |

### Next-batch planning notes

Three high-leverage themes for batch G:

1. **Re-run test-coverage-mapper FIRST** (to fold in batch-F test gaps before any new sidecars land — cleanest catch-up). Then proceed with new node enrichment.
2. **Repository layer** — still 0 enriched. Where transaction boundaries, advisory-lock interactions, tenant-isolation enforcement, jOOQ FTS injection territory live.
3. **DataEntityController.* further deepening** — 4 of 40+ methods enriched now. Still 36+ uncovered methods on the mega-tag — addOwnership / addTerm / addTag / updateDescription / metadataField operations / etc.

Until batch G fires, the held-back spot-check set should be matched against batch A + B + C + D + E + F log entries above. Misses → candidate node-picks for batch G.

---

## Batch 2026-05-13-G — DataEntity round-2 method-level deepening (5 nodes)

- **Date**: 2026-05-13 (orchestration + reducer merges 2026-05-18 due to retry of 2 stream-timeout agents)
- **Branch**: `feature/agentic-ontology-enrichment-batch-2026-05-13-G`
- **Substrate commit**: `ede5d277` (45 prior sidecars + 5 new = **50 total; 12.7% coverage of 395 substrate nodes**)
- **Theme**: DataEntityController method-level deepening round 2 — five high-leverage methods chosen against next-batch planning notes from batch F: known-bug validation (term path-mismatch from TEST-GAP-017) + new-area attack-surface exploration (XSS / Markdown rendering) + pattern-check (Tag auto-create vs Owner/Title batch-F sub-pattern) + ADR-CANDIDATE-015 primary-source confirmation (owner-scoped reads) + cross-batch loop closure (view_count from getDataEntityDetails → getPopular ranking).
- **Pre-batch catch-up**: `/test-coverage` refreshed first to fold in batch-F sidecars (sidecar_count: 40 → 45; +34 TEST-GAPs; total 252 → 286). Cleanest catch-up per batch-F next-batch notes.
- **Source repo**: re-cloned at `/home/raman/work/odd/odd-platform` (commit ede5d277) — was missing from the working tree before this batch; needed for file-analyser primary-source reads.
- **Retry note**: 2 of 5 file-analyser agents (createDataEntityTagsRelations + getPopular) hit stream-idle timeouts on first attempt (likely WebFetch-induced); both succeeded on retry with explicit "no WebFetch" mode (source-only primary-read).

### Sidecars added (5)

| Sidecar | Concept(s) | Headline finding |
|---|---|---|
| `DataEntityController.addDataEntityTerm` | Term Linkage (NEW), Term | **CONFIRMED FROM 3 PRIMARY SOURCES**: `SecurityConstants.java:237-239` registers `/term` (singular) while `openapi.yaml:973` declares `/terms` (plural); `AuthorizationCustomizer.java:24-30` falls through to `.authenticated()` on no-match; DATA_ENTITY_ADD_TERM is NEVER ENFORCED. DELETE counterpart has the identical bug (SecurityConstants.java:240-242). The CRITICAL test-pin gap (TEST-GAP-017) is now PRIMARY-SOURCE backed. |
| `DataEntityController.upsertDataEntityInternalDescription` | Internal Description (NEW), Markdown Rendering Pipeline (NEW), FTS Search Vector (NEW) | **Stored-XSS surface**: Markdown description stored verbatim (no Jsoup.clean) + UI pulls rehype-raw@6.1.1 without rehype-sanitize. Plus "upsert" misleading — pure UPDATE with silent 200 OK on missing entity. Plus term-linking side-channel (DATA_ENTITY_DESCRIPTION_UPDATE → [[ns:term]] auto-creates term_relations bypassing DATA_ENTITY_ADD_TERM). Plus activity-feed leakage of full description payload cross-owner. |
| `DataEntityController.createDataEntityTagsRelations` | Tag (NEW), Tag Directory Consumers (NEW audience) | **REFINES BATCH-F AUTO-CREATE PATTERN**: Tag auto-create-on-miss is EXPLICITLY SPEC-DOCUMENTED (`openapi.yaml:1174` "Also creates corresponding tags in the system if they don't exist") — distinguishes from batch-F Owner/Title UNDOCUMENTED auto-create. Structural gap is SCOPE-ASYMMETRY: DATA_ENTITY_TAGS_UPDATE (DATA_ENTITY-scoped, grantable to per-entity owners) writes into MANAGEMENT-scoped TAG_CREATE territory. Per-data-entity-owner globally pollutes Tag directory; cross-tenant Tag pollution enabled. Plus name-vs-behaviour drift: `createXxx` operationId for REPLACE-ALL semantic. |
| `DataEntityController.getMyObjects` | User-Owner Mapping (NEW) | **ADR-CANDIDATE-015 PRIMARY-SOURCE CONFIRMED**: controller method body (DataEntityController.java:283-289) takes only (page, size, exchange) — no Authentication/Principal/owner-id. Principal flows via `ReactiveSecurityContextHolder.getContext()` → `AuthIdentityProviderImpl.fetchAssociatedOwner()` → `user_owner_mapping` lookup → JOIN OWNERSHIP at SQL layer. Plus unlinked-user silent empty Flux UX trap. Plus lineage-variant single-point-of-failure (getMyObjectsWithUpstream/Downstream rely on anchor-set correctness; no JOIN-side owner filter on response). Plus LOGIN_FORM+LDAP both produce provider=null cross-mode bleed. |
| `DataEntityController.getPopular` | Popular Entities Ranking (NEW), ODD Platform Home-Page Visitors (NEW audience) | **CLOSES THE view_count CROSS-BATCH LOOP**: REFACTOR-201 PRIMARY-SOURCE CONFIRMED. Producer (getDataEntityDetails, batch F) + Consumer (getPopular: `ReactiveDataEntityRepositoryImpl.java:633` `view_count DESC` sole ranking; no anti-abuse signal, no rate-limit, no index). NEW finding: EXCLUDE_FROM_SEARCH is broadly applied at 9 sites but NOT in listPopular's CTE — internal/staging entities surface on home page. Inflation attack confirmed end-to-end. |

### Reducer diffs

| Reducer | Before → After | Net |
|---|---|---|
| concept-merger | 84 → **105 concepts** | +21 (catalog_v8; 7 new entities, 5 new operations, 7 new invariants, 2 new audiences + 6 new canonicalisation candidates + 8 STRENGTHENS on existing concepts). Mode = incremental-delta. |
| doc-gap-finder | 95 → **103 findings** | +8 (DOC-GAP-096..103 — 4 HIGH + 3 MEDIUM + 1 LOW) + 6 STRENGTHENS on existing findings (DOC-GAP-001 path-mismatch PRIMARY-SOURCE confirmed; DOC-GAP-009 api-reference gap; DOC-GAP-053 META; DOC-GAP-077 Permissions page omissions). 5 live URLs WebFetched. |
| adr-archaeologist (ADRs) | 61 → **67 ADR candidates** | +6 (ADR-CANDIDATE-062..067 — 1 HIGH + 5 MEDIUM) + 7 STRENGTHENS (ADR-CANDIDATE-001 controllers-as-delegates now 19-sidecar; ADR-CANDIDATE-003 read-collaborative now 4-sidecar; **ADR-CANDIDATE-015 PROMOTED FROM BORDERLINE TO PRIMARY-SOURCE**; ADR-CANDIDATE-007, ADR-CANDIDATE-002, ADR-CANDIDATE-050, ADR-CANDIDATE-059). 6 wisdom-test passes (0 fails — 7th consecutive batch). |
| adr-archaeologist (scopes) | 199 → **211 refactoring scopes** | +12 (REFACTOR-217..228 — 5 HIGH + 5 MEDIUM + 2 LOW). **Key HIGH scopes**: REFACTOR-217 (SecurityRule /term vs /terms path mismatch — PRIMARY-SOURCE PROVEN), REFACTOR-218 (Markdown stored-XSS — backend + UI rehype-raw + no sanitize), REFACTOR-220 (view_count inflation loop CLOSED — REFACTOR-201 primary-source confirmed), REFACTOR-221 (no view_count index — sequential scan + sort on every Popular render), REFACTOR-222 (EXCLUDE_FROM_SEARCH not applied to /popular). **4 STRENGTHENS**: REFACTOR-073 (DISABLED-mode bypass) → **18-sidecar cluster**; REFACTOR-024 (cross-owner read) → 7-sidecar; REFACTOR-199 (Owner auto-create) → Tag joins as parallel-pattern; REFACTOR-201 (view_count inflation) → PRIMARY-SOURCE CONFIRMED. |
| test-coverage-mapper | 286 → **312 test gaps** | +26 net-new (TEST-GAP-287..312 — 5 CRITICAL + 10 HIGH + 5 MEDIUM + 6 LOW) + 8 STRENGTHENS (TEST-GAP-017 path-mismatch primary-source pin; TEST-GAP-018, 020, 002 ADR-CANDIDATE-015 confirmation; TEST-GAP-256, 259 view_count loop closure; TEST-GAP-104, 108, 133, 134 DISABLED-bypass cluster expansion to 17 endpoints). 0 new sidecar-quality findings (all 5 batch-G sidecar `test_files` claims grep-verified clean against the live odd-platform clone). 7 new double-jeopardy entries. |

**0 wisdom-test fails on batch G — 7th consecutive batch**.

### Known-bug validators / cross-batch validations

| Pre-existing finding | Result this batch | Detail |
|---|---|---|
| **TEST-GAP-017** (term path-mismatch `/term` vs `/terms`) | **PRIMARY-SOURCE PROVEN — three independent citations** | `SecurityConstants.java:237-239` (singular registration) + `openapi.yaml:973` (plural declaration) + `AuthorizationCustomizer.java:24-30, 29-30` (dispatch + `.authenticated()` fall-through). DELETE counterpart at SecurityConstants.java:240-242 vs openapi.yaml:1042 has identical bug. REFACTOR-217 created with file:line evidence. |
| **ADR-CANDIDATE-015** (Owner-scoped routes — borderline since batch A) | **PROMOTED TO PRIMARY-SOURCE** | `getMyObjects` controller method body is the architectural anchor. Resolution chain primary-source documented: ReactiveSecurityContextHolder → AuthIdentityProviderImpl.fetchAssociatedOwner → user_owner_mapping → JOIN OWNERSHIP. The contrast with cross-owner reads (centerpiece detail, lineage, alerts, popular — all no-principal-and-cross-owner) makes the deliberate asymmetry visible. Borderline flag resolved. |
| **REFACTOR-201** (view_count UPDATE inside @ReactiveTransactional GET → inflation) | **PRIMARY-SOURCE CONFIRMED end-to-end** | Producer (getDataEntityDetails, batch F) + Consumer (getPopular, batch G — `ReactiveDataEntityRepositoryImpl.java:633` view_count DESC sole ranking). No rate-limit, no anti-abuse, no index. Inflation attack works. |
| **REFACTOR-073** (DISABLED-mode bypass) | **VALIDATED + STRENGTHENED — 18-sidecar cluster** | 5 new batch-G sidecars all flag DISABLED-mode anonymous reachability. Cumulative cluster now reaches 17 endpoints across batches A-G; getPopular (home-page surface) joining is consequential — first-impression read of the platform is anonymously accessible without boot-time warning. |
| **REFACTOR-024** (read-collaborative cross-owner) | **VALIDATED + STRENGTHENED — 7-sidecar** | getPopular joins as the home-page surface confirming cross-owner read-collaborative posture. Contrast with getMyObjects (deliberate JOIN-side owner filter) makes the intentionality vs. carelessness question sharper. |
| **REFACTOR-199** (Owner auto-create-on-miss bypass) | **REFINED — sub-pattern split** | createDataEntityTagsRelations confirms Tag auto-create is SPEC-DOCUMENTED (openapi.yaml:1174). Sub-pattern split: (a) undocumented Owner/Title (batch F) → REFACTOR-199; (b) spec-documented-with-scope-asymmetry Tag (batch G) → REFACTOR-223. Three confirmed members of the "directory side-channel via per-resource write permission" family. |

### Cross-batch triangulation (escalations this batch)

| Pattern | Sidecar count | Status this batch |
|---|---|---|
| **DISABLED-mode bypasses SECURITY_RULES** | **18** | strongest single finding — 13 prior + 5 new; reaches 17 endpoints across A-G |
| **Read-collaborative cross-owner enumeration** | **7** | getPopular as home-page surface joins; ADR-CANDIDATE-003 now 4-sidecar locked |
| **Permission-bypass via auto-create-on-miss** | **3** | Owner (F) + Title (F) + Tag (G — with spec-asymmetry sub-pattern); pattern split into documented vs undocumented sub-classes |
| **Doc-vs-code spelling/format mismatch / spec-vs-impl drift** | **5** | OAuth2 username-attribute (D) + S2S Authorization-vs-X-API-Key (F) + IngestionController 200-vs-201 (F) + createDataEntityTagsRelations create-vs-replace-all (G) + getMyObjectsWithUpstream/Downstream owned-vs-non-owned (G) |
| **OpenAPI 200/201 status-code drift** | 4 | unchanged from F (Owner / Role / Policy / postDataEntityList) |
| **view_count UPDATE→READ inflation loop closure** | 2 cross-batch | producer (F) + consumer (G); REFACTOR-201 PRIMARY-SOURCE CONFIRMED |
| **Authorization path-pattern mismatch** (NEW class — batch G) | 2 | term singular vs plural + DELETE counterpart; new failure-mode class not previously surfaced |
| **Markdown rendering security** (NEW finding — batch G) | 1 | single sidecar; severity HIGH; UI rehype-raw+no-sanitize + backend no-Jsoup.clean |
| **Anchor-set-derived endpoints with no defence-in-depth** (NEW class — batch G) | 3 | getMyObjects + getMyObjectsWithUpstream/Downstream; NEW class of cross-cutting risk |
| **Operation name vs behaviour drift** (NEW finding — batch G) | 2 | createDataEntityTagsRelations + upsertDataEntityInternalDescription |

### Notable new findings (spot-check candidates this batch)

- **SecurityRule `/term` vs `/terms` path mismatch silently disables DATA_ENTITY_ADD_TERM** — PRIMARY-SOURCE confirmed via three independent file:line citations. ANY authenticated user can link/unlink any term to any data entity. One-line fix in SecurityConstants.java; TEST-GAP-017 regression-pin.
- **Markdown description is the largest free-text injection surface on the platform** — three-way cluster: stored-XSS via rehype-raw+no-sanitize+no-backend-sanitisation (REFACTOR-218); DISABLED-mode anonymous body rewrite (TEST-GAP-294); term-linking side-channel via [[ns:term]] auto-link (TEST-GAP-295).
- **getPopular closes the view_count inflation loop** — REFACTOR-201 primary-source confirmed from consumer side. Home-page first impression is publicly manipulable; under DISABLED, no auth even required.
- **EXCLUDE_FROM_SEARCH bypass on Popular** — internal/staging entities marked hidden-from-search surface on the home page. 1 of 10 list-shape application sites missed.
- **Owner-scoped routes architectural pattern primary-source confirmed** — ADR-CANDIDATE-015 promoted from borderline. The Reactor Context → AuthIdentityProvider → user_owner_mapping → JOIN OWNERSHIP chain is the canonical owner-scoping mechanism.
- **Tag auto-create-on-miss is intentional UX trade-off with scope-asymmetry consequence** — refines batch-F Owner/Title pattern: documented vs undocumented sub-classes. Per-data-entity-owner globally pollutes Tag directory; cross-tenant pollution enabled.
- **getMyObjectsWithUpstream/Downstream OpenAPI summary is literally wrong** — claims "owned by current user with upstream dependencies"; actual response is NON-owned entities reachable from owned set. Security-impact gap in multi-tenant deployments. NEW HIGH doc-drift (DOC-GAP-099).
- **getMyObjects silent empty-Flux for unlinked users** — 200 OK + [] body indistinguishable from "owns nothing"; no error, no header, no troubleshooting flow in docs.
- **Lineage-variant single-point-of-failure** — anchor-set-derived endpoints with no defence-in-depth; regression in fetchAssociatedOwner leaks lineage neighbours. NEW class of cross-cutting risk.

### Cumulative ontology state (after this batch lands)

| Layer | Count |
|---|---|
| Substrate scaffold | 395 nodes / 479 edges |
| Sidecars | **50** (12.7% coverage; +5 from batch F) |
| concepts.yaml | catalog_version 8 (**105 concepts**; 35 entities / 26 operations / 31 invariants / 13 audiences; 48 canonicalisation candidates; 8 batch-G STRENGTHENS recorded) |
| doc-gaps.md | **103 findings** (53 HIGH / 40 MEDIUM / 10 LOW; +8 from batch F) |
| implicit-adrs.md | **67 ADR candidates** (18 HIGH / 44 MEDIUM / 5 LOW; +6 from batch F) |
| refactoring-scopes.md | **211 refactoring scopes** (63 HIGH / 97 MEDIUM / 51 LOW; +12 from batch F) |
| test-map.yaml | **312 test gaps** (81 CRITICAL / 109 HIGH / 88 MEDIUM / 34 LOW; +26 from batch F catchup); 7 batch-G double-jeopardy entries; 0 new sidecar-quality findings |

### Next-batch planning notes

Three high-leverage themes for batch H:

1. **Repository layer** — still 0 enriched. With the source repo now reliably cloned at `/home/raman/work/odd/odd-platform`, the substrate axis (currently jOOQ-based + `Reactive*RepositoryImpl` shape) is reachable. Where transaction boundaries, advisory-lock interactions, tenant-isolation enforcement, jOOQ FTS injection territory live. Pick anchors: `ReactiveDataEntityRepositoryImpl` (the largest by far), `ReactiveLineageRepositoryImpl` (cycle-detection territory), `ReactiveOwnershipRepositoryImpl` (Owner-scoping enforcement).
2. **DataEntityController.* further deepening** — 9 of 40 methods enriched after batches F + G. 31+ uncovered methods on the mega-tag — `addDataEntityDataEntityGroup`, `deleteDataEntityFromDataEntityGroup`, `getDataEntityActivity`, `getDataEntityAlerts`, `getDataEntityMessages`, `getDataEntityMetrics`, `getDataEntityUpstreamLineage`, `deleteTermFromDataEntity`, `deleteOwnership`, `updateOwnership`, `upsertDataEntityInternalName`, `upsertDataEntityMetadataFieldValue`, `getMessages`, `getDataEntityGroupsLineage`, etc. Symmetric DELETE/UPDATE methods are high-leverage (likely confirm or refute Owner/Tag/Title symmetric bypasses).
3. **Anchor-set defence-in-depth audit** — batch G's NEW cross-cutting pattern. Enumerate every controller method that resolves owner via `fetchAssociatedOwner` and computes a derived response set (lineage, recommendations, search-scope filters). For each, the question is: does the derived-set logic apply a JOIN-side owner filter, or does it rely on anchor-set correctness? Only enrichment can answer; potential single-batch theme.

Until batch H fires, the held-back spot-check set should be matched against batch A + B + C + D + E + F + G log entries above. Misses → candidate node-picks for batch H.

## Probe-runs 2026-05-19 — `batch P-001 P-002 P-003 P-004 P-005 P-006 P-007 P-008 P-009` (layer-5 dynamic verification)

Per dynamic-verification ADR slice 5: each batch's investigator-log entry now records the probe-runs that empirically grounded the static ontology updates. This block is appended automatically by `lineage/_extractor/probe-runtime/runner.py` after every batch run.

- **Trigger**: `batch P-001 P-002 P-003 P-004 P-005 P-006 P-007 P-008 P-009`
- **Probes run**: 9 (9 PASS / 0 FAIL / 0 ERROR)
- **Features measured**: 5 (`F-001`, `F-002`, `F-003`, `F-004`, `F-005`)
- **Batch summary**: `lineage/odd-platform/probe-runs/2026-05-19-batch-p-001-p-002-p-003-p-004-p-005-p-006-p-007-p-008-p-009.md`

### Probe-run outcomes

| Probe | Feature | Test class | Outcome | Run ID |
|---|---|---|---|---|
| `P-001` | `F-001` | integration | **PASS** | `R-20260519T023643Z-P-001` |
| `P-002` | `F-001` | security | **PASS** | `R-20260519T023647Z-P-002` |
| `P-003` | `F-001` | performance | **PASS** | `R-20260519T023650Z-P-003` |
| `P-004` | `F-001` | integration | **PASS** | `R-20260519T023657Z-P-004` |
| `P-005` | `F-002` | security | **PASS** | `R-20260519T023708Z-P-005` |
| `P-006` | `F-003` | security | **PASS** | `R-20260519T023710Z-P-006` |
| `P-007` | `F-004` | security | **PASS** | `R-20260519T023711Z-P-007` |
| `P-008` | `F-005` | integration | **PASS** | `R-20260519T023712Z-P-008` |
| `P-009` | `F-004` | security | **PASS** | `R-20260519T023713Z-P-009` |

### Layer-5 → layer-2 feedback closure

Each PASS/FAIL run merged a `## probe_verifications` entry into the contributing sidecars under `lineage/odd-platform/understanding/` (per dynamic-verification ADR Rule 4).

---
## Probe-runs 2026-05-19 — `--feature F-004` (layer-5 dynamic verification)

Per dynamic-verification ADR slice 5: each batch's investigator-log entry now records the probe-runs that empirically grounded the static ontology updates. This block is appended automatically by `lineage/_extractor/probe-runtime/runner.py` after every batch run.

- **Trigger**: `--feature F-004`
- **Probes run**: 2 (2 PASS / 0 FAIL / 0 ERROR)
- **Features measured**: 1 (`F-004`)
- **Batch summary**: `lineage/odd-platform/probe-runs/2026-05-19-batch-feature-f-004.md`

### Probe-run outcomes

| Probe | Feature | Test class | Outcome | Run ID |
|---|---|---|---|---|
| `P-007` | `F-004` | security | **PASS** | `R-20260519T020607Z-P-007` |
| `P-009` | `F-004` | security | **PASS** | `R-20260519T020610Z-P-009` |

### Layer-5 → layer-2 feedback closure

Each PASS/FAIL run merged a `## probe_verifications` entry into the contributing sidecars under `lineage/odd-platform/understanding/` (per dynamic-verification ADR Rule 4).

---

## Batch 2026-05-19-H — Repository layer (5 nodes; FIRST rev-2 batch on sharded artefacts)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate commit**: `ede5d277` (50 prior sidecars + 5 new = **55 total**)
- **Theme**: Repository layer — `Reactive*RepositoryImpl` files. Closes batch G's open theme (transaction boundaries / advisory-lock interactions / tenant-isolation enforcement / jOOQ FTS-injection territory).
- **FIRST batch under rev-2 mechanics**: sharded registry artefacts (slice 6) + reducer prompts spawning grep-then-narrow-Read against the sharded indexes (slice 7) + emergent feature registry sharded from day 1 (slice 9) + coverage metrics on manifest (slice 8). Validated end-to-end in this batch.
- **Substrate-axis gap surfaced**: The substrate (nodes.jsonl) does NOT yet enumerate repository nodes; the 5 batch-H sidecars use synthetic `node_id: ... repository:Reactive*RepositoryImpl` IDs. The coverage `## Integrity audit` block surfaces this as "Sidecars referencing nodes NOT in substrate: 5". **LSN candidate**: log as `LSN-018-repository-axis-gap` in a follow-up — the substrate's axis set needs `repository` added for clean denominator semantics. The methodology accommodated the gap gracefully (sidecars + feature-flow chains both reference the synthetic IDs; reducers consumed without issue).

### Sidecars added (5)

| Sidecar | Headline finding |
|---|---|
| `ReactiveDataEntityRepositoryImpl` | **NEW HIGH: SQL-format injection in `getHighlightedResult` (lines 799-806) via raw `String.formatted()` on user-controllable inputs** — the only raw-SQL-format path across the 5-repository batch; under DISABLED-mode anonymous remote SQL injection. Plus F-001 / F-003 / F-004 hops primary-source confirmed. REFACTOR-222 EXCLUDE_FROM_SEARCH inconsistency primary-source confirmed. |
| `ReactiveLineageRepositoryImpl` | **REFACTOR-202 cycle/diamond amplification + REFACTOR-203 cross-owner enumeration both PRIMARY-SOURCE confirmed at SQL layer**. **NEW pattern**: anchor-set defence-in-depth bifurcated — `DataEntityRelationsServiceImpl` is the positive case; `LineageServiceImpl.getLineage` is the negative case. |
| `ReactiveOwnershipRepositoryImpl` | **CROSS-BATCH CORRECTION**: batch-F `createOwnership` sidecar's "5xx surface on duplicate-key" claim is WRONG. Actual surface is HTTP 400 + `USR003`. **Orchestrator-hypothesis refuted**: this repository does NOT own the JOIN OWNERSHIP for `/my` reads — that lives in `ReactiveDataEntityRepositoryImpl#listByOwner:526-527`. |
| `ReactivePolicyRepositoryImpl` | **NEW HIGH: `getRolesPolicies` (per-request RBAC hot path) does NOT filter soft-deleted policies** — soft-deleted policies still grant permissions. Plus 5 implicit ADRs including the canonical `policy_name_unique` partial UNIQUE INDEX `WHERE deleted_at IS NULL` pattern from primary source. |
| `ReactiveAlertRepositoryImpl` | **NEW HIGH: AlertManager webhook `POST /ingestion/alert/alertmanager` is NOT gated by IngestionDataEntitiesFilter** — untrusted `entity_oddrn` label admits cross-tenant alert creation (extends REFACTOR-082). REFACTOR-024 PRIMARY-SOURCE confirmed at SQL layer. REFACTOR-188 narrowed: alert activity emission at service layer, not repository. |

### Reducer diffs (rev-2 sharded; all 5 ran without timeout/rate-limit)

| Reducer | Before → After | Delta | Highlights |
|---|---|---|---|
| concept-merger | 153 → **160 concepts** | +7 net-new (1 entity / 3 invariants / 3 operations); 8 strengthened | New invariants codify repo-layer patterns: **three soft-delete mechanisms across the persistence layer**, **repository transactional boundary at service layer not repository** (5/5 repos uniformly transaction-free), **DB-uniqueness with centralised friendly-error translation** (USR-codes via ExceptionUtils). |
| adr-archaeologist (ADRs) | 67 → **75 candidates** | +8 new (068-075); 2 strengthened (058 + 067) | **0 wisdom-test fails** (8th consecutive batch). ADR-067 `@ReactiveTransactional` boundary asymmetry now **9-sidecar**. ADR-075 NEW: "repositories take no Principal" — codebase-wide architectural finding (HIGH). |
| adr-archaeologist (scopes) | 211 → **227 scopes** | +16 new (229-244); 6 strengthened (024, 082, 202, 203, 207, 222) | **REFACTOR-229 SQL-format injection** (HIGH). **REFACTOR-230 getRolesPolicies soft-delete bypass** (HIGH). **REFACTOR-231 AlertManager webhook payload-driven alert creation** (HIGH; extends REFACTOR-082). **REFACTOR-232 cross-batch correction**: createOwnership = HTTP 400/USR003, NOT 5xx. REFACTOR-024 strengthened to **full-stack 8-sidecar** (controller+service+repository SQL). |
| doc-gap-finder | 103 → **112 findings** | +9 new (104-112); 8 strengthened | **DOC-GAP-104 SQL-injection** (first in catalog). **DOC-GAP-105 Lineage CTE no defence** — supersedes DOC-GAP-021 with 4-angle primary-source. **DOC-GAP-106 getRolesPolicies returns soft-deleted policies**. **DOC-GAP-107 AlertManager webhook bypass**. **DOC-GAP-108 cross-batch correction** (5xx→400/USR003). DOC-GAP-082 now **13-sidecar** (DISABLED-mode bypass cluster). WebFetch denied this session — same constraint as batches D/E/F/G; inherited verifications cited. |
| test-coverage-mapper | 312 → **364 gaps** | +52 new (313-364); 11 strengthened | **4 NEW CRITICAL**: TEST-GAP-316 (FTS SQL-injection), TEST-GAP-345 (getRolesPolicies soft-delete), TEST-GAP-356 (REFACTOR-024 SQL-layer), TEST-GAP-363 (AlertManager webhook unauth). 13 HIGH / 27 MEDIUM / 8 LOW. **0 sidecar-quality findings** (all test_files claims grep-verified). |
| feature-flow-builder | 5 → **7 features** | +2 new (F-006, F-007); 4 extended (F-001, F-003, F-004, F-005) | **F-006 NEW: RBAC policy lifecycle** — soft-delete + permission-grant persistence. **F-007 NEW: AlertManager webhook ingestion** — ungated cross-tenant alert creation. F-001 / F-003 / F-004 / F-005 each gained extended_features delta with primary-source SQL evidence and new facets. |

### Rev-2 mechanics validation (FIRST batch under sharded artefacts — empirical cost-ceiling test)

- **Reducer context budget**: All 5 reducers operated within their per-batch budget (vs 200-800 KB monolithic-input pattern of batches A-G). **ZERO rate-limit hits this batch. ZERO stream-idle timeouts.** The cost-ceiling promise of rev-2 principle 7 is empirically validated on the first batch.
- **Grep-then-narrow-Read pattern**: adr-archaeologist hit the read-limit on full index files (25K-token Read cap) and naturally fell back to Grep-then-narrow — exactly the rev-2 design ("never load the full index"). Output as `index-batch-H-append.md` files which the orchestrator merged into the live indexes.
- **Cross-batch correction propagation**: ReactiveOwnershipRepositoryImpl sidecar surfaced batch-F's `createOwnership` 5xx-claim is wrong; the correction propagated as REFACTOR-232 + DOC-GAP-108 across 3 reducer artefacts. The architecture supports cross-batch corrections without resurfacing as duplicates.
- **Emergent-feature registry** (rev-2 principle 8): 2 new features (F-006, F-007) discovered organically; NOT pre-enumerated. 4 existing features extended without merge. Zero auto-merges; zero maintainer-triage-ambiguous cases.

### Cumulative state after batch H

| Layer | Count |
|---|---|
| Substrate scaffold | 395 nodes / 479 edges (unchanged) |
| Sidecars | **55** (13.9% direct; **16.5% effective coverage** via feature-flow chains) |
| Features | **7** (5 prior + 2 new) — 4 with ≥1 PROBED cell |
| concepts/ | catalog v9; **160 concepts** |
| implicit-adrs/ | **75 ADR candidates** (22 HIGH / 48 MEDIUM / 5 LOW) |
| refactoring-scopes/ | **227 scopes** (66 HIGH / 106 MEDIUM / 55 LOW) |
| doc-gaps/ | **112 findings** (58 HIGH / 43 MEDIUM / 11 LOW) |
| test-map/ | **364 test gaps** (85 CRITICAL / 122 HIGH / 115 MEDIUM / 42 LOW) |

### Next-batch planning notes

Three high-leverage themes for batch I:

1. **Service layer** — `AlertServiceImpl`, `DataEntityServiceImpl`, `IngestionService`, `NotificationsDispatcher`, `PolicyServiceImpl`. The integration-tier between controllers and repositories. ZERO enriched. Will resolve UNRESOLVED references in the new F-006 / F-007 chains + extend F-001 / F-003 / F-005 with service-layer hops. The lost-update race surfaced in F-006 (`PolicyServiceImpl.update` lines 71-81 outside `@ReactiveTransactional`) is a candidate primary-source target.
2. **Anchor-set defence-in-depth audit** — batch H's NEW pattern from ReactiveLineageRepositoryImpl. Enumerate every controller method resolving owner via `fetchAssociatedOwner` then computing a derived response set. Narrower scope than service layer; can pair with #1.
3. **UI-axis sidecars** — `DataEntityDetails.tsx` + redux thunks. Resolve remaining UNRESOLVED references in F-001's chain (the UI useEffect dep-array bug at hop 1). Pairs with the live dynamic-verification P-001/P-004 probes that already pin the +2 behaviour empirically.

Plus follow-ups from this batch:
- **`LSN-018-repository-axis-gap`** — write the retrospective; propose a `repository` axis for the substrate (slice 10 candidate).
- **`shard.py` improvement** — the feature-flow-builder occasionally writes YAML scalars containing unquoted `: ` or leading `@` which break parsing. 3 of 7 F-NNN detail files needed post-write quoting fixes this batch. Add a yaml-safe-dump validator in either the sharder or the feature-flow-builder prompt's emit rules.


## Batch 2026-05-19-I — Service layer A (5 nodes; FIRST autonomous-driver batch via /next-batch)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate commit**: `ede5d277` (55 prior sidecars + 5 new = **60 total**)
- **Theme**: Service layer A — AlertServiceImpl + DataEntityServiceImpl + IngestionServiceImpl + PolicyServiceImpl + LineageServiceImpl
- **FIRST batch via the `/next-batch` autonomous skill** — pre-flight checks, theme-pick from sprint-themes.yaml, theme-lock, 5 file-analysers in parallel, 5 reducers in parallel, delta merge, coverage refresh, log + commit + push. Validates the skill's orchestration end-to-end before /loop kicks off overnight.
- **Substrate-axis gap (service)**: same shape as batch H repository-axis gap. 5 new synthetic `service:...` node_ids. Coverage integrity audit shows 10 outside-substrate nodes now (5 repository + 5 service). LSN-018 candidate broadens to: substrate needs both `repository` AND `service` axes.

### Sidecars added (5)

| Sidecar | Headline finding |
|---|---|
| `AlertServiceImpl` | Service-tier cross-owner bypass on 3 methods (REFACTOR-024 family confirmed at service layer); AlertManager webhook `entity_oddrn` spoofing surface; `@ActivityLog` AOP `@Profile("!integration-test")` test-coverage trap. |
| `DataEntityServiceImpl` | 22 methods, 8 `@ReactiveTransactional` boundaries quantified; F-001/F-003/F-004 service-tier hops triangulated. Silent-UPDATE-on-missing for description/business-name (existence-check asymmetry vs metadata/DEG paths). |
| `IngestionServiceImpl` | **NEW HIGH (CRITICAL-class data-loss surface): silent metadata-delete-on-absence + lineage-replace-on-each-call destruction.** Operators expect "merge" semantics; service does "replace" → silent data loss on every ingestion batch. F-008 new feature minted. |
| `PolicyServiceImpl` | **PRIMARY-SOURCE confirmation of batch-H lost-update race at lines 71-81.** Sibling RoleServiceImpl IS `@ReactiveTransactional` on the same shape — sibling-asymmetry is the canonical invariant. Cascade-delete check at lines 89-92 is sole service-layer defence against orphan-binding permission leak. |
| `LineageServiceImpl` | **Anchor-set defence-in-depth NEGATIVE-CASE primary-source confirmed** (no AuthIdentityProvider field; getLineage doesn't call fetchAssociatedOwner). REFACTOR-203 cross-owner enumeration is unmitigated end-to-end. LineageDepth.empty()/of(0) folklore (misleading API naming). |

### Reducer diffs (rev-2 sharded; ALL 5 ran without timeout/rate-limit)

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 160 → **179 concepts** (rebuilt index has 176 — 3 entity files have YAML emit bug; see follow-ups) | +19 net-new (9 invariants + 7 operations + 3 canon-cands); 4 strengthened. Key new invariants: service-tier transactional asymmetry between siblings; anchor-set defence-in-depth positive vs negative; silent data-loss replace-not-merge ingestion. |
| adr-archaeologist (ADRs) | 75 → **83** | +8 new (076-083); 6 strengthened. ADR-067 (`@ReactiveTransactional` boundary at service-not-repository) now **14-sidecar** — strongest after ADR-001 at 18. ADR-079/080/081/082 are HIGH. |
| adr-archaeologist (scopes) | 227 → **259** | +32 new (245-276) + REFACTOR-189 re-sharded. New HIGHs: REFACTOR-258 (ingestion silent metadata delete), 259 (silent lineage-replace), 266 (Policy lost-update race), 267 (Policy orphan-binding race). |
| doc-gap-finder | 112 → **127 findings** | +15 new (113-127); 5 strengthened. New HIGHs: DOC-GAP-113/114 (ingestion silent destruction LSN-001 family), 115 (anchor-set asymmetry), 116 META (txn-at-service boundary undocumented platform-wide), 117 (AlertManager webhook generatorURL XSS chain). |
| test-coverage-mapper | 312 → **416 gaps** (rebuilt index has 413 — 3 detail files have YAML emit bug; see follow-ups) | +52 new (365-416); 14 strengthened. 4 new CRITICAL: TEST-GAP-388 (silent metadata-delete), 389 (silent lineage-replace), 392 (cross-tenant ingestion under filter-OFF), 403 (Policy cascade-delete race). |
| feature-flow-builder | 7 → **8 features** | +1 new (F-008 Ingestion-replace destruction surface — `webhook:POST /ingestion/entities`; HIGH user-observable feature). 6 extended (F-001 hop-3.5 + F-003 service pass-through + F-004 silent-200-on-missing + F-005 anchor-set negative-case + F-006 lost-update race primary source + F-007 entity_oddrn primary source). |

### Coverage state after batch I

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment (nodes with own sidecar) | 60 | **15.2%** |
| Effective coverage (touched by any feature-flow OR own sidecar) | 72 | **18.2%** |
| Features discovered | 8 | (informational; no denominator) |
| Features with ≥1 cell PROBED | 4 | (informational) |

### Critical follow-up — YAML emit bug in 6 detail files

Same shape as the batch-H feature-flows YAML emit bug — reducers emit YAML scalars containing unquoted `: ` substrings (e.g. embedded `@ReactiveTransactional on update` or `(proposed: ...)` parentheticals inside list items). YAML parses these as ambiguous mapping values and rejects the file.

Affected files this batch:
- `test-map/detail/TEST-GAP-402.yaml` (line 32)
- `test-map/detail/TEST-GAP-403.yaml` (line 37)
- `test-map/detail/TEST-GAP-410.yaml` (line 32)
- `concepts/detail/entities/alert.yaml` (line 144)
- `concepts/detail/entities/data-entity.yaml` (line 144)
- `concepts/detail/entities/lineage-graph-traversal.yaml` (line 96)

**Structural fix needed BEFORE /loop overnight** — without it, every batch produces ~5-10% broken YAML files that need manual triage. Two options: (a) add an explicit rule to every reducer's prompt: "any string scalar containing `: ` or starting with `@` MUST use `|-` block-scalar form OR be single-quoted"; (b) add a post-reducer `yaml-validator` pass in `/next-batch` Phase 3 that catches + auto-quotes broken scalars.

Detail files preserve the DATA (the 6 files are present on disk; only the YAML parse is broken). Indexes rebuilt from detail/ via `/tmp/rebuild_indexes.py` — captures 413 test-gaps + 176 concepts; 6 entries deferred until detail files are fixed.

### Cross-batch triangulation deltas

- **REFACTOR-024 family** — now **full-stack 4-layer**: controller (batch A) + repository (batch H) + service (batch I) + concept invariant. Read-collaborative cross-owner enumeration end-to-end confirmed.
- **ADR-067 txn-at-service-not-repository** — 14-sidecar (was 9-sidecar at batch H). The PolicyServiceImpl OUTLIER is the canonical break-the-rule example.
- **REFACTOR-203 (cross-owner lineage enumeration)** — now unmitigated end-to-end at THREE layers (controller, service, repository).
- **Forensic silence (no audit on mutations)** — 3-batch confirmed (E + H + I) for RBAC mutations.

### Rev-2 mechanics validation (SECOND batch under sharded artefacts)

- **Reducer context budget**: All 5 ran without timeout/rate-limit. Repeating the batch-H validation finding.
- **Grep-then-narrow-Read pattern**: adr-archaeologist + concept-merger + test-coverage-mapper all fell back to `index-batch-I-append.md` / `index.delta.yaml` / `concepts.delta.batch-I.yaml` files when their full Read on indexes exceeded the 25K cap. The orchestrator (this skill) merged them.
- **Append-merge robustness**: The implicit-adrs + refactoring-scopes awk-merge worked cleanly. The test-map delta merger hit a key-name mismatch (`test_gaps_index_append` expected, got something else) — fix landed in next batch by rebuilding index from detail/. The concepts delta hit the YAML emit bug as above.
- **Emergent-feature registry**: F-008 minted organically (NOT pre-enumerated); 6 features extended without merge. Zero auto-merges.

### Next-batch planning notes

Two follow-ups BEFORE batch J:
1. **Fix the YAML emit bug** — update reducer prompts to enforce `|-` block scalars / single quotes on any value containing `: ` or starting with `@`. Without this, batch J will produce another ~6 broken files.
2. **Fix merge_deltas.py key-name mismatch** — test-coverage-mapper's delta uses a key the merger doesn't recognize. Quick fix to the merger.

Then batch J can fire: UI-axis — DataEntityDetails.tsx + thunks + Description + PopularStrip + LineageGraph. Resolves F-001 hop 1+2 (the LSN-017 useEffect dep-array bug from primary source) + F-003/F-004/F-005 UI sides.


## Rev-3 transition — Layer 0 system mission anchor + F-001..F-008 re-classification (2026-05-19, post batch I)

- **Trigger**: maintainer review after batch I — "we have so many nodes but 8 features that are mostly about some particular caveats of features"; the diagnosis was that the methodology lacked the platform's gestalt (what "feature" means at operator-facing granularity).
- **Methodology change**: new Layer 0 sits beneath the existing 5 layers. New `domain-extractor` subagent (`.claude/agents/domain-extractor.md`) reads canonical docs (live URLs or local source-of-truth markdown) + maintainer-curated concepts + (when needed) maintainer interview, and emits `lineage/{repo}/system-mission.md` — a doc-anchored 8-12-pillar shape.
- **ADR**: `adrs/drafts/feature-anchored-ontology.md` rev 3 + APPROACH.md §13 (universal Layer 0 framing for any project bootstrapping the methodology).
- **Reducer prompts updated**: feature-flow-builder (Rule 0 LOAD-BEARING: consult Layer 0 before classifying) + concept-merger / adr-archaeologist / doc-gap-finder / test-coverage-mapper (lighter "consult system-mission.md" rules for pillar-anchored naming, severity weighting, pillar-coverage gaps, integration-boundary test classification).

### `system-mission.md` produced

11 pillars + 4 canonicalisation candidates + 12 audiences + 6 architectural pillars. Doc source: local `documentation/docs/**/*.md` (WebFetch denied this session — same constraint as batches D-I; live verification logged as known follow-up per the Layer-0 doc-source contract). Confidence: MEDIUM (local-anchored; live verification pending).

| Pillar | Capability |
|---|---|
| P-01 Data Discovery | Find existing data entities (Search, Directory, Catalog Overview) + annotate (tags, statuses, descriptions, attachments, groupings) |
| P-02 Data Modelling | Capture dataset contract (Query Examples + Relationships / ERDs) |
| P-03 Master Data Management | Operator-curated reference data (Lookup Tables — partial-MDM scope) |
| P-04 Data Quality | Aggregate per-dataset quality signals (aggregator only — checks performed externally) |
| P-05 Data Lineage | Upstream/downstream traceability across data + microservices |
| P-06 Data Glossary | Business-term catalog + term-entity linkage |
| P-07 Active Platform Features | Event-driven actor surfaces (alerts/notifications/activity/collab/genai) |
| P-08 Management & Administration | 9-tab operator UI (config / policies / roles / owners / namespaces / collectors / tokens / settings / audit) |
| P-09 Security & Access Control | 3 auth surfaces + RBAC |
| P-10 Integrations & Ingestion | Producer ecosystem (collectors + push adapters + Ingestion API) |
| P-11 Platform API & Developer Surface | API Reference + Swagger + custom-collector authoring |

### F-001..F-008 → pillar-anchored re-classification

Each rev-2 bug-anchored feature is now a `drift_class` facet inside a pillar-anchored feature. Detail files preserve all existing content; pillar_id + pillar_anchored_id + primary_drift_class + drift_class_summary + rev3_reclassification fields added at the top.

| rev-2 F-NNN | rev-3 pillar_anchored_id | Pillar-anchored feature name | Primary drift class |
|---|---|---|---|
| F-001 (Detail-page view tracking) | **P-01:F-001** | Popular Entities Ranking | `ui_amplification` |
| F-002 (Term linking) | **P-06:F-001** | Term-to-Entity Linkage | `auth_layer_hides_endpoint` |
| F-003 (Popular ranking exclude-from-search) | **P-01:F-001** ← merge candidate with F-001 | Popular Entities Ranking | `filter_application_inconsistency` |
| F-004 (Markdown description) | **P-01:F-002** | Entity Description Editing | `external_lib_assumes_sanitisation` |
| F-005 (Downstream lineage) | **P-05:F-001** | Lineage Graph Traversal | `spec_says_X_impl_does_Y` |
| F-006 (RBAC policy lifecycle) | **P-09:F-001** | Role-Based Access Control | `permission_persistence_after_soft_delete` |
| F-007 (AlertManager webhook) | **P-07:F-001** | AlertManager Integration | `unauthenticated_payload_trust` |
| F-008 (Ingestion-replace destruction) | **P-10:F-001** | Batch Ingestion (S2S API) | `silent_destruction_replace_not_merge` |

**Merge candidate surfaced**: F-001 + F-003 are both `P-01:F-001` Popular Entities Ranking with different drift facets. Per rev-2 principle 8, merges are maintainer-triggered, not automatic. The two detail files stay separate; the rev3_reclassification block carries `merge_candidate_with: F-001` / `F-003` cross-references for the maintainer to decide.

### Pillar coverage from existing 60 sidecars (informational)

- P-01 Data Discovery: ~25 sidecars touching this pillar (controllers + services + repositories for data-entity surface)
- P-09 Security & Access Control: ~12 sidecars (auth configs + RBAC controllers/services/repository)
- P-10 Integrations & Ingestion: ~8 sidecars (IngestionService + IngestionDataEntitiesFilter + AlertManager + collector controllers)
- P-07 Active Platform Features: ~7 sidecars (Activity / Alerting / Slack collab / GenAI / Notifications)
- P-04 Data Quality: ~3 sidecars (sparse — most DQ code lives in collectors, outside odd-platform)
- P-05 Data Lineage: ~3 sidecars (lineage controller + service + repository)
- P-06 Data Glossary: ~2 sidecars (Term controller paths + concept entries)
- P-08 Management & Admin: ~5 sidecars (Settings / Policies UI surfaces — partial)
- P-02 Data Modelling: 0 sidecars yet (Query Examples + Relationships not enriched)
- P-03 Master Data Management: 0 sidecars yet (Lookup Tables not enriched)
- P-11 Platform API & Developer Surface: 0 sidecars yet (api-reference surface itself not enriched)

Pillars P-02, P-03, P-11 are doc-mentioned-but-code-uncovered → batch theme candidates ranked by pillar-coverage gap.

### Methodology state after rev 3

- 60 direct sidecars (15.2%) + 72 effective coverage (18.2%) [unchanged from batch I]
- 8 features now properly pillar-anchored (was bug-pin features)
- 1 merge candidate surfaced for maintainer review (F-001 + F-003)
- 11 pillars + 4 canon-candidates + 12 audiences + 6 architectural pillars in system-mission.md
- Layer 0 confidence: MEDIUM (live-URL verification deferred to WebFetch-enabled session)

### Follow-ups for /loop overnight

- Subsequent batches (J / K / L / ...) use the new pillar-anchored shape for any new features they discover or extend. The rev-3 feature-flow-builder prompt is the gate.
- Live-URL verification of all 14 pillar/mission/relationship URLs is a known follow-up — needs WebFetch-enabled session (same constraint as batches D-I).
- F-001 + F-003 merge triage is maintainer-pending.
- The 3 broken-yaml-pending-fix files from batch I (alert.yaml, data-entity.yaml, TEST-GAP-402.yaml) remain quarantined; the new YAML-safe-emit reducer rule prevents future occurrences but doesn't auto-fix the existing 3.


## Batch 2026-05-19-J — UI-axis (DataEntityDetails + thunks closes F-001 chain; 5 nodes; SECOND autonomous-driver batch)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate commit**: `ede5d277` (60 prior sidecars + 5 new = **65 total**)
- **Theme**: UI-axis — DataEntityDetails + fetchDataEntityDetails thunk + DataEntityDescription + PopularStrip + LineageGraph. Closes F-001/F-003/F-004/F-005 chains at the UI half.
- **Second autonomous /next-batch invocation** — second validation of the orchestration end-to-end + the rev-3 Layer-0 consult pattern.
- **Substrate-axis gap (UI components / redux-thunk)**: 5 new synthetic node_ids (ts react-component + ts redux-thunk kinds). Integrity audit will surface in the next coverage report. Total substrate-axis-gap nodes now: 15 (5 repository + 5 service + 5 UI).

### Sidecars added (5)

| Sidecar | Headline finding |
|---|---|
| `DataEntityDetails` | **LSN-017 root-cause PRIMARY-SOURCE PINNED** at lines 56-64 — `useEffect` dep-array contains `details.status?.status` derived from fetch response → re-fires after first fetch lands → +2 fetch dispatches per page-open. 3 ADRs, 10 uncovered_behaviours. **Zero `.test.tsx` files exist anywhere in odd-platform-ui codebase** (vitest + testing-library installed but unused — META-finding). |
| `fetchDataEntityDetails thunk` | **Self-feeding double-fetch loop CONFIRMED from UI side** — `handleResponseAsyncThunk` 1:1 dispatch:HTTP multiplicity; thunk's own fulfilled action populates `details.status?.status` which retriggers the DataEntityDetails useEffect. Loop closure end-to-end with empirical P-001+P-004 measurements. 3 ADRs, 6 corner cases. |
| `DataEntityDescription` | **F-004 UI half EXHAUSTIVELY CONFIRMED** — `MDEditor.Markdown` invoked with NO `rehypePlugins` override at `Markdown.tsx:112-124`. `grep -rln 'rehype-sanitize' <odd-platform-ui>` returns 0 matches in source AND 0 in `pnpm-lock.yaml`. `@uiw/react-md-editor@3.25.6` → `@uiw/react-markdown-preview@4.2.2` transitively pulls in `rehype-raw@6.1.1` (pnpm-lock.yaml:5911-5938). **Permission gating is PARTIAL** — `<WithPermissions Permission.DATA_ENTITY_DESCRIPTION_UPDATE>` wraps ONLY Edit/Add buttons; the `<Markdown value>` content render at `InternalDescriptionPreview.tsx:21` is UNCONDITIONAL for every `DATA_ENTITY_VIEW` holder. 7 ADRs, 8 corner cases. |
| `PopularStrip` | **SUBSTRATE PATH DRIFT**: the substrate's target `OverviewPopular/OverviewPopular.tsx` does NOT exist as of `9ac6436e`. The Popular surface is implemented as the 4th column inside `OwnerEntitiesList.tsx`. Surfaced as canonicalisation_candidate. **NEW doc-vs-code drift**: live docs say tile-click opens Structure tab; code opens Overview tab. Plus: docs say Recommended panel visible under DISABLED auth; code unconditionally hides it under DISABLED. 4 ADRs, 8 corner cases. |
| `LineageGraph` | **REFACTOR-202 UI realisation PRIMARY-SOURCE CONFIRMED**: d3-hierarchy is tree-not-DAG, so diamond DAGs render DUPLICATE nodes at the UI layer. UI ALWAYS supplies `d=1` from `defaultLineageQuery` (constants.ts:77) — F-005 NPE caveat masked from typical UI path. **REFACTOR-203 UI realisation**: UI's only fetch path is the NEGATIVE-anchor-set `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage`, NEVER `getMyObjectsWith*` (anchor-set-defended endpoints unused at UI). 6 ADRs, 10 corner cases, 5 doc-drift findings, 14 uncovered_behaviours. |

### Reducer diffs (rev-3 sharded; all 5 ran cleanly)

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 177 → **198 concepts** (rebuilt index has 198; 1 entity file lineage-graph-traversal.yaml broke from a write at line 1 col 1 — quarantined to .broken-yaml-backup; see follow-ups) | +22 net-new (4 entities + 3 operations + 10 invariants + 5 canon-candidates); 11 strengthened. Pillar_affinity field added per concept (rev-3 Layer-0 consult applied). |
| adr-archaeologist (ADRs) | 83 → **97 candidates** | +14 new (084-097) + 3 strengthened (ADR-003 read-collaborative now 4-sidecar; ADR-054 view-count read-as-write; ADR-066 Popular single-signal). Wisdom test: 14 PASS + 8 reclassified to scopes. ADR-CANDIDATE-089 NEW HIGH: partial-permission-gating-at-UI architectural commit. ADR-CANDIDATE-084 NEW: handleResponseAsyncThunk wrapper codified as project-wide pattern (15 thunk files). |
| adr-archaeologist (scopes) | 259 → **300 scopes** | +24 new (277-300) + 6 strengthened (REFACTOR-200/203/218/220/225+237/227). **REFACTOR-289 NEW (CRITICAL-class META)**: zero `.test.tsx` files across entire odd-platform-ui SPA — cross-cutting foundational gap that unblocks every other UI hardening item. REFACTOR-287 NEW HIGH: P-05+P-09 cross-pillar `d=` URL exploit. REFACTOR-220 strengthened with empirical P-004 measurement. |
| doc-gap-finder | 127 → **126 sharded findings** (index frontmatter claims 138 — see follow-ups; the discrepancy is from batch F's DOC-GAP-084..095 IDs that were assigned but never sharded; surfaced for reconciliation next batch) | +11 new (128-138; minus 12 not-yet-sharded IDs from batch F) + 5 strengthened (DOC-GAP-101/105/096/100). 2 new HIGH: DOC-GAP-130 (LSN-017 +2 doubling undocumented end-to-end); DOC-GAP-137 META (zero UI test coverage). 4 live WebFetches at status 200 — WebFetch IS available in this session for some agents. |
| test-coverage-mapper | 415 → **453 gaps** | +38 new (417-454, all in sharded detail/) + 0 strengthened. **4 new CRITICAL**: TEST-GAP-417 (LSN-017 useEffect dep-array regression-pin), TEST-GAP-428 (rehype-sanitize XSS defence-in-depth cross-Markdown-surface), TEST-GAP-438 (F-001 cross-tier Playwright spec promoting P-001+P-004 to CI), TEST-GAP-454 META (UI test infrastructure baseline). **Probe-to-test promotion pattern proposed for the first time**: P-001+P-004 → CI-permanent Playwright specs via TEST-GAP-417 + TEST-GAP-438. 1 sidecar-quality finding: 4 of 5 batch-J sidecars overstate "zero UI tests"; actually 7 leaf-component tests exist — log for /enrich refresh. |
| feature-flow-builder | 8 → **8 features** (unchanged count; 4 extended) | +0 new + 4 extended (F-001/F-003/F-004/F-005 each gained UI-side drift facets). 24 total new drift facets across the 4 features. F-001 chain now PRIMARY-SOURCE CONFIRMED end-to-end at every layer (UI + thunk + controller + service + repository + DB) + empirically measured (P-001/P-004). All 5 detail YAMLs validated parse-clean per YAML-safe emit rule. |

### Coverage state after batch J

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment (nodes with own sidecar) | 65 | **16.5%** |
| Effective coverage (touched by any feature-flow OR own sidecar) | 79 | **20.0%** ← crossed 20% milestone |
| Features discovered | 8 | (unchanged; rev-3 8-feature pillar-anchored shape stable) |
| Features with ≥1 cell PROBED | 4 | (unchanged) |

### Cross-batch triangulation deltas (rev-3 pillar-anchored)

- **F-001 / P-01:F-001 Popular Entities Ranking** — chain CLOSED end-to-end at every tier; LSN-017 root-cause locus now PRIMARY-SOURCE pinned at UI; the +2 doubling is empirically measured AND structurally explained from UI through DB. Strongest single end-to-end story in the catalog.
- **REFACTOR-202 / REFACTOR-203 (Lineage Graph Traversal drifts)** — now BOTH have UI-layer primary-source confirmation; the abstract "cross-owner enumeration" + "diamond DAG amplification" findings have explicit UI realisations.
- **REFACTOR-218 (F-004 stored XSS)** — UI half EXHAUSTIVELY confirmed; pnpm-lock primary-source citation for rehype-raw transitive dependency. Permission gating PARTIAL → strengthens REFACTOR-218 with the partial-gating-attack-surface dimension.
- **ADR-CANDIDATE-003 (read-collaborative GET posture)** — now 11+ sidecars triangulated; strongest in the catalog.
- **ADR-CANDIDATE-089 NEW**: partial-UI-permission-gating-as-architectural-commit — strengthens ADR-003 end-to-end read-collaborative posture at the UI layer.
- **REFACTOR-289 NEW**: zero-UI-test-codebase-wide cross-cutting META scope.

### Rev-3 mechanics validation (FIRST batch under Layer 0)

- All 5 reducers consulted `system-mission.md` per rev-3 Rule 0; pillar-affinity / pillars-affected / pillar-anchored fields added to outputs.
- feature-flow-builder produced 0 new features (correct outcome — UI sidecars are downstream HOPS in existing pillar-anchored features, not new pillar entries). Drift facets attached INSIDE existing features per rev-3 principle 9.
- WebFetch worked for some agents (4 live URL verifications at status 200). Session-level permission may have improved since batches D-I.

### Follow-ups (logged, not blocking)

- `concepts/detail/entities/lineage-graph-traversal.yaml` broke during the concept-merger write (line 1 col 1 — likely a malformed top-of-file write). Backup in `.broken-yaml-backup`; quarantine + manual fix or next-batch regeneration recovers.
- `doc-gaps/index.md` frontmatter claims `total_findings: 138`; actual sharded entries are 126 (batch F's DOC-GAP-084..095 IDs were referenced but never sharded). Reconcile in next batch.
- adr-archaeologist + refactoring-scopes detail directories now contain "X-strengthen-batch-J" suffixed files alongside the canonical numbered ones (e.g. `ADR-CANDIDATE-003-strengthen-batch-J.md`). These are NEW SHAPE this batch — strengthens were emitted as separate files instead of appending to the canonical detail file. The markdown verify surfaces them as "detail without index" (25 in implicit-adrs + 63 in refactoring-scopes). Reducer-prompt fix: strengthens MUST append to canonical detail (per rev-2 playbook) rather than mint -strengthen-batch-N files.
- 1 test-coverage-mapper sidecar-quality finding: 4 of 5 batch-J sidecars overstate "zero UI tests" — actually 7 leaf-component tests exist. /enrich refresh candidate.

### Next-batch planning notes

Three high-leverage themes for batch K (already in queue):

1. **Theme K — Service layer B** (NotificationsDispatcher + HousekeepingJobManager + AuthIdentityProviderImpl + TermServiceImpl + OwnershipServiceImpl). Continues service-tier coverage; pairs with batch I service-layer findings.
2. **Theme L — DataEntityController continuation 1** (5 more controller methods).
3. **Theme M — Anchor-set defence audit** (cross-cutting; ~5 controllers).

P-02 Data Modelling + P-03 Master Data Management + P-11 Platform API & Developer Surface remain at 0-sidecar coverage — surface for future batch theme prioritisation.


## Batch 2026-05-19-K — Service layer B (5 nodes; THIRD autonomous batch under rev-3 Layer 0)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: ede5d277 (65 prior + 5 new = **70 total**)
- **Theme**: Service layer B — NotificationsDispatcher + HousekeepingJobManager + AuthIdentityProviderImpl + TermServiceImpl + OwnershipServiceImpl
- **Headline coverage jump**: effective **20.0% → 30.1%** (+10 percentage points in one batch) thanks to 3 new pillar-anchored features pulling many existing nodes into chains.

### Sidecars added (5)

| Sidecar | Pillar | Headline finding |
|---|---|---|
| `NotificationsDispatcher` (real name: AlertNotificationMessageProcessor) | P-07 | Exception-type asymmetry: email RuntimeException bypasses per-sender catch and aborts mid-message; poison-message WAL replay loop (10s back-off blocks subsequent delivery). |
| `HousekeepingJobManager` | P-08 + P-04 + P-07 | **REFACTOR-142 jOOQ operator-precedence bug PRIMARY-SOURCE PINNED at AlertHousekeepingJob.java:28-34**. REFACTOR-145 .block()-inside-transaction PRIMARY-SOURCE at DataEntityHousekeepingJob.java:142. 14m-vs-15m ShedLock window. |
| `AuthIdentityProviderImpl` | P-09 | **NEW HIGH: S2S username='ADMIN' literal-collision** at S2sAuthenticationFilter.java:31 — S2S API key holders inherit ADMIN's Owner. **LOGIN_FORM ↔ LDAP provider=null cross-mode bleed** primary-source at lines 29-33. No auto-create-on-first-login UX trap. ADR-CANDIDATE-015 POSITIVE-CASE PRIMARY-SOURCE CONFIRMED. |
| `TermServiceImpl` | P-06 | REFACTOR-217 service-tier — TermServiceImpl has **ZERO permission checks at service tier** (defence-in-depth absent). **NEW HIGH BUG**: second SecurityConstants path-mismatch — `/api/alerts/{id}/status` PUT gated by `DATASET_FIELD_ADD_TERM` (wrong permission entirely). REFACTOR-227 `[[ns:term]]` auto-link side-channel PRIMARY-SOURCE. REFACTOR-228 triple-re-query PRIMARY-SOURCE. |
| `OwnershipServiceImpl` | P-09 + P-01 | **REFACTOR-199 primary anchor**: `ownerService.getOrCreate` at OwnershipServiceImpl.java:52 bypasses OWNER_CREATE permission. **Cross-batch correction PRIMARY-SOURCE**: ExceptionUtils.java:69-71 returns HTTP 400 USR003 (NOT 5xx as batch-F claimed). DEG-propagation cascade audit-feed asymmetry (lines 134-148 emit no per-child events). |

### Reducer diffs (rev-3 sharded; all 5 ran cleanly)

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 198 → **212 concepts** (3 broken yaml — 2 batch-K + 1 batch-J carried; see follow-ups) | +16 net-new (2 entities + 9 invariants + 5 operations); 9 strengthened. `permission-bypass-via-owner-auto-create` now 4-way (Owner + Title + Tag + Namespace getOrCreate's). |
| adr-archaeologist (ADRs) | 97 → **112 candidates** | +15 (098-112) + 4 strengthened (ADR-015 / -040 / -046 / -075). ADR-015 + -075 + new -104/-105/-106 form a 4-ADR authorization-plumbing family now complete end-to-end. Strengthens batch-J followed CANONICAL append pattern (NOT -strengthen-batch-K suffix). |
| adr-archaeologist (scopes) | 300 → **330 scopes** | +30 (301-330) + 7 strengthened (REFACTOR-142 / -145 / -199 / -206 / -217 / -228 / -232). **REFACTOR-301 NEW HIGH: S2S 'ADMIN' username-collision**. **REFACTOR-314 NEW HIGH: 2nd SecurityConstants bug `/api/alerts/{id}/status` wrong permission**. **REFACTOR-318 NEW HIGH: TermServiceImpl service-tier defence-in-depth absence** (no permission checks at service layer). |
| doc-gap-finder | 127 → **137 findings** (frontmatter reconciled to actual count) | +11 (139-149) + 10 strengthened. 5 new HIGH (139 SecurityConstants 2nd bug; 140 auto-link side-channel; 141 S2S ADMIN; 142 no auto-create UX trap; 143 WAL poison-message). 5 live WebFetches at status 200. META: DOC-GAP-149 P-09 pillar-overpromise on user-owner-association doc. |
| test-coverage-mapper | 453 → **486 gaps** | +33 (455-487) + 3 strengthened (TEST-GAP-017 / 211 / 265 — all CRITICAL). 4 new CRITICAL: 455 (WAL replay-loop), 471 (provider=null bleed), 472 (S2S ADMIN collision), 477 (alerts/status wrong permission). 0 sidecar-quality findings. |
| feature-flow-builder | 8 → **11 features** (+3 new) | **F-009 / P-07:F-002 WAL-driven Notification Delivery** (NEW); **F-010 / P-08:F-002 Housekeeping TTL Enforcement** (NEW; cross-pillar to P-04+P-07); **F-011 / P-09:F-002 Principal-to-Owner Resolution** (NEW; feeds P-01/P-05/P-06/P-07). F-002 + F-006 extended with service-tier hops. ~40 total new drift facets. All 5 detail YAMLs validated parse-clean. |

### Coverage state after batch K

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 70 | **17.7%** (was 16.5%) |
| Effective coverage | 119 | **30.1%** (was 20.0%) ← **major milestone** |
| Features discovered | 11 (was 8) | 3 NEW pillar-anchored features (F-009/F-010/F-011) |
| Features with ≥1 cell PROBED | 4 | unchanged (probes pending for new features) |

The 10-percentage-point effective-coverage jump validates rev-3 Layer-0 anchoring: features-as-pillars naturally pull more nodes into chains, vs the rev-2 bug-pin shape that confined each feature to a narrow drift surface.

### Cross-batch triangulation deltas

- **F-011 NEW HIGH HEADLINE**: S2S 'ADMIN' username-collision — S2S API key holders inherit operator-named 'ADMIN' user's Owner. Single line of code (S2sAuthenticationFilter.java:31). Cross-pillar P-09 + P-10 implications.
- **REFACTOR-142** jOOQ-precedence: now PRIMARY-SOURCE pinned at exact lines. Empirical fix candidate.
- **REFACTOR-199** OWNER_CREATE bypass: now PRIMARY-SOURCE pinned at OwnershipServiceImpl.java:52.
- **REFACTOR-217** path-mismatch: now defence-in-depth at service tier confirmed ABSENT (TermServiceImpl has no permission checks); strengthens cross-tier.
- **`permission-bypass-via-owner-auto-create`** invariant: now 4-way (Owner + Title + Tag + Namespace getOrCreate's all bypass create-side permissions). Codebase-wide audit candidate.
- **Cross-batch correction (batch-F 5xx → HTTP 400 USR003)**: now 3-layer triangulated (controller + service + ExceptionUtils primary-source).

### Follow-ups (logged, not blocking)

- 2 NEW broken yaml files this batch: `operations/manage-ownership-lifecycle-with-deg-cascade.yaml` (leading `@` in scalar) + `operations/run-housekeeping-cycle-five-jobs.yaml` (leading backtick in scalar). Both autofix-unfixable; quarantined to `.broken-yaml-backup`. The reducer's YAML-safe-emit rule needs to add backtick to the banned-leading-character set (currently catches `@`/`>`/`|`/`*`/`&`/`?`/`!`/`%` but not backtick).
- 1 broken yaml carried from batch J: `entities/lineage-graph-traversal.yaml` (line 1 col 1 — malformed top-of-file). Still quarantined.
- 88 + 5 detail-without-index in implicit-adrs + refactoring-scopes — adr-archaeologist's NEW batch-K strengthens used canonical-append (correct), but batch-J's `*-strengthen-batch-J` files still polluting the detail directory. Future cleanup: rename them OR fold into canonical detail files.

### Next-batch planning notes

Theme L next: DataEntityController continuation 1 (5 controller methods). Pillar P-01 Data Discovery continuation.

P-02 Data Modelling + P-03 Master Data Management + P-11 Platform API & Developer Surface remain 0-sidecar — surface for prioritisation.


## Batch 2026-05-19-L — DataEntityController continuation 1 (5 nodes; FOURTH autonomous batch)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: ede5d277 (70 prior + 5 new = **75 total**)
- **Theme**: DataEntityController continuation — addDataEntityDataEntityGroup + deleteDataEntityFromDataEntityGroup + getDataEntityAlerts + upsertDataEntityMetadataFieldValue + deleteTermFromDataEntity

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `addDataEntityDataEntityGroup` | P-01 | **NEW HIGH: write-collaborative DEG (NO DEG-side authorization)** — any DATA_ENTITY_ADD_TO_GROUP holder writes into ANY manually-created DEG. DEG path DIVERGES from REFACTOR-199/206/223 family (explicit isManuallyCreatedDEG defensive check — NOT auto-create-on-miss). Forensic silence: DATA_ENTITY_RELATION_UPDATED enum dead-code. |
| `deleteDataEntityFromDataEntityGroup` | P-01 | 3 documented-nowhere asymmetries: distinct ADD/DELETE permissions per Policy resolver; silent-204 no-op DELETE vs 400-duplicate no-op ADD; no @ActivityLog on membership flips. |
| `getDataEntityAlerts` | P-07 + P-01 | REFACTOR-024 cross-owner posture EXTENDED to per-entity surface. Live alerting doc names this endpoint as "audit-export workaround" but silent on audience scoping. |
| `upsertDataEntityMetadataFieldValue` | P-01 | NOT a REFACTOR-199 family member (permission IS enforced) but silent-200-on-missing-pair + silent-200-on-missing-entity (same as batch G upsertInternalDescription — pattern now 2-sidecar). EXTERNAL-origin-writable, active=NULL regression, no type validation. |
| `deleteTermFromDataEntity` | P-06 | **REFACTOR-217 DELETE half SYMMETRIC PRIMARY-SOURCE CONFIRMED** at SecurityConstants.java:240-242 singular `/term/{term_id}` vs openapi.yaml:1042 plural `/terms/{term_id}`. HARD-DELETE amplifies under DISABLED-mode (anonymous reach + irreversible). |

### Reducer diffs (rev-3 sharded)

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 212 → **228 concepts** | +16 net-new (3 entities + 5 operations + 8 invariants) + 7 strengthened. NEW HIGH invariants: write-collaborative-DEG; ADD/DELETE permission asymmetry; HARD-DELETE on relationship edges (3rd site confirmed). |
| adr-archaeologist (ADRs) | 112 → **116** | +4 (113-116) + 6 strengthened (ADR-001/-002 now 23-sidecar tied for strongest; ADR-007 now 19-sidecar; ADR-067 11-sidecar; ADR-003 + ADR-069 strengthened). ADR-113 NEW HIGH: DEG no-auto-create (counter-example to REFACTOR-199 family — intent-anchored). |
| adr-archaeologist (scopes) | 330 → **342** | +12 (331-342) + 2 strengthened. **REFACTOR-331 NEW HIGH: write-collaborative DEG**. **REFACTOR-340 NEW HIGH: cross-owner per-entity alert read** (extends REFACTOR-024 to per-entity surface). REFACTOR-217 substrate now EXHAUSTED (POST + service + DELETE all triangulated). |
| doc-gap-finder | 137 → **146** | +9 (150-158) + 2 strengthened. **DOC-GAP-153 NEW HIGH**: DEG activity-feed page MISREPRESENTS coverage (CUSTOM_GROUP_UPDATED claims membership-flips recorded; code emits NOTHING — DOC-CLAIMS-CODE-PROVIDES-SILENCE drift, strongest drift class in catalog). DOC-GAP-150 DEG write-collaborative. DOC-GAP-156 silent-200 metadata upsert. DOC-GAP-157 cross-owner per-entity alert read. 4 live WebFetches at status 200. |
| test-coverage-mapper | 486 → **502 gaps** | +16 (488-503) + 4 strengthened. 3 NEW CRITICAL: TEST-GAP-488 (DEG write-collaborative regression-pin), TEST-GAP-489 (REFACTOR-217 DELETE half primary-source pin), TEST-GAP-491 (@Profile("!integration-test") META trap). |
| feature-flow-builder | 11 → **14 features** (+3 new) | **F-012 / P-01:F-003 Data Entity Group Membership** (NEW; primary drift: write_collaborative_no_deg_side_authorization). **F-013 / P-01:F-004 Custom Metadata Field Editing** (NEW; primary drift: silent_200_on_missing_pair — sibling of F-004 Description Editing). **F-014 / P-07:F-003 Per-Entity Alert View** (NEW; cross-pillar P-07+P-01; REFACTOR-024 family extension). F-002 extended with DELETE half REFACTOR-217 SYMMETRIC PRIMARY-SOURCE. 36 new drift facets across batch. |

### Coverage state after batch L

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 75 | **19.0%** (was 17.7%) |
| Effective coverage | 133 | **33.7%** (was 30.1%) |
| Features discovered | 14 (was 11) | 3 NEW pillar-anchored features |
| Features with ≥1 cell PROBED | 4 | unchanged |

### Cross-batch triangulation deltas

- **REFACTOR-217**: now full substrate-exhausted — POST (batch G) + service (batch K) + DELETE (batch L). One-PR-fixes-both-halves observation reinforced.
- **write-collaborative DEG** (NEW HIGH): joins read-collaborative cross-owner enumeration as a sibling — write surface too is cross-tenant-permissive.
- **silent-200-on-missing-pair**: now 2-sidecar (batch G upsertInternalDescription + batch L upsertMetadataFieldValue) — codebase-wide upsert-family pattern.
- **HARD-DELETE on relationship edges**: now 3-site confirmed (term_relations + group_entity_relations + ownership) — strengthens batch-H three-soft-delete-mechanisms invariant.
- **Reserved-but-never-fired activity enum**: now 4-slot pattern (DATA_ENTITY_RELATION_UPDATED + CUSTOM_METADATA_CREATED/UPDATED/DELETED) — cohesive cleanup sprint candidate.

### Follow-ups (logged, not blocking)

- 3 broken-yaml files persist (2 from batch K + 1 from batch J): manage-ownership-lifecycle-with-deg-cascade.yaml (leading `@`), run-housekeeping-cycle-five-jobs.yaml (leading backtick), lineage-graph-traversal.yaml (line 1 col 1).
- doc-gaps detail-vs-index: 11 detail-without-index + 4 index-without-detail (batch-F orphan IDs 084-088). Reconcile next batch.
- 105 detail-without-index in refactoring-scopes (batch-J *-strengthen orphans persist; batches K+L correctly used canonical-append).

### Next-batch planning notes

Theme M next: Anchor-set defence audit (cross-cutting; ~5 controllers — getDataEntityUpstreamLineage / getDataEntityGroupsLineage / getMyObjectsWithUpstream / getMyObjectsWithDownstream / SearchController.facets).

