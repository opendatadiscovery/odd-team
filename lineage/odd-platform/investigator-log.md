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
