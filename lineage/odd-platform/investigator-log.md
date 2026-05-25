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
- **Source repo**: re-cloned at `<REPO_ROOT>` (commit ede5d277) — was missing from the working tree before this batch; needed for file-analyser primary-source reads.
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

1. **Repository layer** — still 0 enriched. With the source repo now reliably cloned at `<REPO_ROOT>`, the substrate axis (currently jOOQ-based + `Reactive*RepositoryImpl` shape) is reachable. Where transaction boundaries, advisory-lock interactions, tenant-isolation enforcement, jOOQ FTS injection territory live. Pick anchors: `ReactiveDataEntityRepositoryImpl` (the largest by far), `ReactiveLineageRepositoryImpl` (cycle-detection territory), `ReactiveOwnershipRepositoryImpl` (Owner-scoping enforcement).
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


## Batch 2026-05-19-M — Anchor-set defence audit (4/5 nodes; FIFTH autonomous batch)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: ede5d277 (75 prior + 4 new = **79 total**; 1 deferred — getDataEntityUpstreamLineage socket-errored 2× both attempts; symmetric to batch F downstream sibling, inheritance applied)
- **Theme**: Anchor-set defence audit — getDataEntityGroupsLineage + getMyObjectsWithUpstream + getMyObjectsWithDownstream + SearchController.facets + getDataEntityUpstreamLineage (DEFERRED)

### Sidecars added (4)

| Sidecar | Pillar | Headline |
|---|---|---|
| `getDataEntityGroupsLineage` | P-05 + P-01 | DEG-anchored sibling of REFACTOR-203 — cross-owner enumeration via DEG-internal lineage graph; no SecurityRule entry. Co-membership leakage on multi-team DEGs/Domains materially WIDER than per-entity REFACTOR-203. NEW: DEG-membership read vs write authorization asymmetry (write gated; read open). Inner-DEG suppression deferred-feature lacks backlog/ADR/test anchor. |
| `getMyObjectsWithUpstream` | P-09 + P-01 + P-05 | **REFACTOR-225 PRIMARY-SOURCE CONFIRMED**: anchor-set scoping at DataEntityRelationsServiceImpl.java:26 is single-point-of-failure; listByOddrns at ReactiveDataEntityRepositoryImpl.java:228-253 has NO JOIN-side OWNERSHIP filter (vs listByOwner at :515-534 which DOES). **DOC-GAP-099 PRIMARY-SOURCE CONFIRMED**: openapi.yaml:843-844 says "data entities owned by current user with upstream dependencies" but DataEntityRelationsServiceImpl.java:37 explicitly excludes owned set via `Predicate.not` — the spec is the LYING contract layer. LineageDepth.empty() = `-1` sentinel single-hop encoding. |
| `getMyObjectsWithDownstream` | P-09 + P-01 + P-05 | Symmetric REFACTOR-225 + DOC-GAP-099 confirmation (now 4-angle triangulated: controller G + repo H + service I + batch M). |
| `SearchController.facets` | P-01 | NEW HIGH: cross-owner facet-count enumeration via 5 facet aggregators; search-session UUIDs no per-user binding at SCHEMA level (V0_0_1__init.sql:204-211); to_tsquery operator-injection DoS at JooqFTSHelper.java:164-168 reached from EVERY facet aggregator (compounds batch H finding). Side-effect UPDATE on read. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 228 → **238 concepts** | +10 net-new (1 entity + 2 operations + 7 invariants) + 9 strengthened. NEW HIGH invariants: REFACTOR-225 PRIMARY SOURCE; DOC-GAP-099 inverse-semantic 4-angle; DEG read-vs-write auth asymmetry; tsquery injection via persisted state; cross-owner facet enumeration. |
| adr-archaeologist (ADRs) | 116 → **122** | +6 (117-122) + 3 strengthened (ADR-003 13-sidecar; ADR-015 16-sidecar — controller-method TRIPLET COMPLETED via /my + /my/upstream + /my/downstream; ADR-075 6-sidecar PRIMARY-SOURCE). 2 borderline_flag ADRs (118/121). 0 wisdom-test reclassifications (every implicit_adrs entry had explicit positive intent anchor). |
| adr-archaeologist (scopes) | 342 → **352** | +10 (343-352) + 6 strengthened (REFACTOR-024 5-batch/5-surface; REFACTOR-185 15-sidecar STRONGEST in catalog; REFACTOR-203 sibling DEG-anchored; REFACTOR-225 BOTH /my halves; REFACTOR-229 SECOND invocation site at facet aggregators; REFACTOR-242 LineageDepth.empty sentinel). **REFACTOR-343 NEW HIGH**: DEG-lineage cross-owner CO-MEMBERSHIP enumeration. **REFACTOR-344 NEW HIGH**: search_facets no user binding bearer-token vector. |
| doc-gap-finder | 146 → **155** | +9 (159-167) + 5 strengthened (DOC-GAP-099 4-angle triangulated end-to-end; DOC-GAP-105 7-angle; DOC-GAP-115 controller-method-tier 2/2+3/3; DOC-GAP-104 2-invocation-site; DOC-GAP-009 9-column row template). DOC-GAP-167 THIRD pillar-overpromise META (P-05 Data Lineage) — cross-pillar pattern with P-09 + P-01 META. |
| test-coverage-mapper | 502 → **522 gaps** | +20 (504-523) + 4 strengthened. 3 NEW CRITICAL: TEST-GAP-504 (DEG-anchored lineage cross-owner); TEST-GAP-512 (REFACTOR-225 PRIMARY-SOURCE BOTH /my halves); TEST-GAP-518 (cross-owner facet-count enumeration). 2 reclassifications: TEST-GAP-308 HIGH→CRITICAL, TEST-GAP-252 LOW→HIGH. |
| feature-flow-builder | 14 → **17 features** (+3 new) | **F-015 / P-09:F-003 My-Objects Anchor-Set Reads** (NEW; primary drift: anchor_set_single_point_of_failure). **F-016 / P-05:F-002 DEG-Anchored Lineage** (NEW; cross-pillar P-05+P-01; primary drift: co_membership_leakage — WIDEST blast). **F-017 / P-01:F-005 Search Filter Facets** (NEW; primary drift: cross_owner_facet_enumeration + bearer-token-shaped session UUIDs + tsquery DoS). F-005 extended. |

### Coverage state after batch M

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 79 | **20.0%** (was 19.0%) ← 20% direct milestone |
| Effective coverage | 144 | **36.5%** (was 33.7%) |
| Features discovered | 17 (was 14) | 3 NEW pillar-anchored features |
| Features with ≥1 cell PROBED | 4 | unchanged |

### Cross-batch triangulation deltas

- **REFACTOR-185 DISABLED-mode bypass**: now **15-sidecar** — STRONGEST single finding in the catalog
- **REFACTOR-024 cross-owner enumeration family**: now **5-batch / 5-surface** (BATCH alerts + per-entity alerts + per-entity catalog search + facet aggregators + lineage-graph traversal)
- **ADR-CANDIDATE-015 owner-scoping mechanism**: 16-sidecar with controller-method TRIPLET completed (`/my` + `/my/upstream` + `/my/downstream`)
- **DOC-GAP-099 OpenAPI inverse-semantic**: 4-angle triangulated end-to-end
- **REFACTOR-225 anchor-set defence**: PRIMARY-SOURCE for BOTH /my/upstream + /my/downstream
- **REFACTOR-229 FTS SQL-injection**: SECOND invocation site at facet aggregators compounds with REFACTOR-344 (poison-session DoS)
- **3rd pillar-overpromise META** (DOC-GAP-167 P-05): cross-pillar META pattern across P-09 / P-01 / P-05 — methodology reviewer-checklist gate recommendation

### Follow-ups (logged, not blocking)

- getDataEntityUpstreamLineage DEFERRED — socket-errored both attempts. Symmetric to batch F downstream; logged as deferred-sidecar carve-out. Future-batch retry candidate (likely just enriches identically to downstream).
- 3 broken-yaml files persist from batch J/K (lineage-graph-traversal.yaml, manage-ownership-lifecycle-with-deg-cascade.yaml, run-housekeeping-cycle-five-jobs.yaml). Quarantined.
- 115 detail-without-index in refactoring-scopes (batch-J *-strengthen orphans + batch-K/L canonical patterns); doc-gaps has 11 detail-without-index + 4 index-without-detail (batch-F orphans 084-088).


## Batch 2026-05-19-N — Repository continuation: Term + Tag + Search + User-owner mapping + Role (4/5 nodes; SIXTH autonomous batch)

- **Date**: 2026-05-19
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: ede5d277 (79 prior + 4 new = **83 total**; 1 deferred — ReactiveSearchEntrypointRepositoryImpl socket-errored; below 3-failure threshold)
- **Theme**: Repository-tier continuation — Term + Tag + Search + UserOwnerMapping + Role

### Sidecars added (4)

| Sidecar | Pillar | Headline |
|---|---|---|
| `ReactiveTermRepositoryImpl` | P-06 + P-09 | F-002 (Term-to-Entity Linkage) repository-tier; `term_to_term.deleted_at` V0_0_76-vs-V0_0_91 SCHEMA-DRIFT — column retained but NEVER filtered at any of 7 read sites; `hasDescriptionRelations` excludes parent `STATUS=DELETED` → Term mentioned only in soft-deleted entity dangles on entity restore (MEDIUM corner-case); `getTermDetailsDto` 12-JOIN + 7 jsonArrayAgg fanout on permission-resolution HOT PATH via `TermPermissionExtractor` (every authorized TERM-scoped request); zero direct test coverage of any of 15 public methods. |
| `ReactiveTagRepositoryImpl` | P-01 | REFACTOR-223 repository-side substrate CONFIRMED + NEW HIGH TOCTOU `listByNames`→`bulkCreate` race in `getOrCreateTagsByName`; MEDIUM: case-sensitive `listByNames` silently forks case-duplicate rows (`PII` vs `pii`); 6 implicit_adrs (partial-unique-index, dynamic conflict-target, RETURNING-trigger no-op, soft/hard delete asymmetry, onDuplicateKeyIgnore relations, bulkCreate-vs-ingestData dual contract). |
| `ReactiveUserOwnerMappingRepositoryImpl` | P-09 | **PRIMARY-SOURCE of provider-null cross-mode bleed at lines 121-125** (SQL-layer ground truth — was 5-sidecar inferred from upstream; now SQL-layer manifestation of AuthIdentityProviderImpl ADR); NEW HIGH: 4 external repos (Alert/Activity/OwnerAssociationRequest/Owner) JOIN on `OIDC_USERNAME` ONLY without provider clause → cross-provider username collision row-duplication; clear-active-then-insert two-clear pattern is the persistence-layer twin of the principal-resolution ADR. |
| `ReactiveRoleRepositoryImpl` | P-09 | 4-SIDECAR audit-silence pattern CLOSED (RoleController E + PolicyController E + ReactivePolicyRepositoryImpl H + this N); `getDto`/`listDto`/`getByName` LEFT JOIN POLICY WITHOUT `policy.deleted_at IS NULL` is the **symmetric mirror** of batch-H's `getRolesPolicies` finding — soft-deleted policy still bound to a role surfaces in policy_relations aggregation; partial unique index `role_name_unique WHERE deleted_at IS NULL` makes `Administrator`/`User` name gap exploitable across BOTH halves of RBAC mutation surface. |
| `ReactiveSearchEntrypointRepositoryImpl` | DEFERRED | socket-errored ~10min in (0 tokens). Pairs with REFACTOR-229 + batch-M facet-aggregator finding remain unaddressed at write-side this batch. Next-batch retry candidate. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 238 → **246 concepts** | +8 net-new (5 invariants + 3 operations) + 6 strengthened. NEW HIGH invariants: provider-null cross-mode bleed SQL-layer PRIMARY-SOURCE; cross-provider username row-duplication in external JOINs; Tag TOCTOU listByNames→bulkCreate race; RBAC soft-delete persistence Role/Policy aggregation SYMMETRIC mirror; hasDescriptionRelations parent soft-delete bypass; term_to_term.deleted_at schema-drift V0_0_76-vs-V0_0_91. |
| adr-archaeologist (ADRs) | 122 → **131** | +9 (123-131) + 5 strengthened. ADR-CANDIDATE-130 NEW HIGH: provider-null collapse architectural triangle (principal+SQL+schema vertices closed). |
| adr-archaeologist (scopes) | 352 → **389** | +37 (353-389) + 6 strengthened. THREE NEW HIGH consequences of ADR-130: REFACTOR-353 LOGIN_FORM↔LDAP bleed; REFACTOR-354 S2S 'ADMIN' literal collision; REFACTOR-355 cross-provider OIDC_USERNAME-only LEFT JOIN row-duplication. REFACTOR-356 Term V0_0_91 schema-vs-application drift; REFACTOR-357 RBAC soft-delete-filter symmetric mirror. |
| doc-gap-finder | 155 → **160** | +5 (168-172) + 9 strengthened. NEW: Tag tagging-surface FIRST 3 DOC-GAPs (DOC-GAP-168 directory side-door via DATA_ENTITY_TAGS_UPDATE per-entity permission mints global Tag-directory rows; DOC-GAP-169 case-sensitivity divergence; DOC-GAP-170 delete-then-recreate loses relations). DOC-GAP-172 LOW: term_to_term schema-drift. DOC-GAP-106 + DOC-GAP-112 closed FOUR-CORNERED across RBAC primary surface. |
| test-coverage-mapper | 522 → **577 gaps** | +55 (524-578); 100 → **103 CRITICAL**. 3 NEW CRITICAL: TEST-GAP for provider-null cross-mode bleed SQL primary source; cross-provider OIDC-only JOIN row-duplication on 4 repos; Role getDto missing policy.deleted_at filter (symmetric to batch-H Policy TEST-GAP-345). |
| feature-flow-builder | 17 → **18 features** (+1 new) | **F-018 / P-01:F-006 Manual Object Tagging** (NEW; primary drift: REFACTOR-223 directory-side-door — promoted from drift-facet to standalone pillar feature). F-002 + F-006 + F-011 EXTENDED (6/4/6 new drift facets each). F-002 hop-3 resolved. F-011 SQL-layer PRIMARY-SOURCE — provider-null architectural triangle CLOSED. |

### Coverage state after batch N

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 83 | **21.0%** (was 20.0%) |
| Effective coverage | 157 | **39.7%** (was 36.5%) |
| Features discovered | 18 (was 17) | 1 NEW pillar-anchored feature (F-018) |
| Features with ≥1 cell PROBED | 4 | unchanged |
| Total test-gaps | 577 (was 522) | 103 CRITICAL (was 100) |

### Cross-batch triangulation deltas

- **Provider-null cross-mode bleed ARCHITECTURAL TRIANGLE CLOSED**: principal layer (batch K/G inferred) + SQL layer (batch N PRIMARY-SOURCE at UserOwnerMapping:121-125) + schema layer (V0_0_x migrations + partial unique index)
- **RBAC audit-silence pattern**: now 4-SIDECAR closed (RoleController-E + PolicyController-E + ReactivePolicyRepositoryImpl-H + ReactiveRoleRepositoryImpl-N)
- **ADR-015 owner-scoping mechanism**: now at JOIN-source repo → **17-sidecar** (was 16)
- **REFACTOR-223 (Tag auto-create-on-miss)**: substrate-finding promoted with repository-side TOCTOU primary source + F-018 pillar-anchored feature elevation
- **Term-side schema-drift**: NEW class of finding — V0_0_76-vs-V0_0_91 retained-but-unfiltered columns at 7 read sites
- **Cross-provider OIDC_USERNAME-only LEFT JOINs**: NEW HIGH propagating across 4 sibling external repos
- **DOC-GAP-099 + DOC-GAP-105 + DOC-GAP-115**: untouched this batch (controller/service tier — no new evidence in repo-tier sidecars)
- **Tagging surface FIRST 3 DOC-GAPs**: tagging-feature documentation never reviewed pre-batch-N

### Follow-ups (logged, not blocking)

- `ReactiveSearchEntrypointRepositoryImpl` DEFERRED — socket-errored. Pairs with REFACTOR-229 + batch-M facet-aggregator finding remain WRITE-SIDE unaddressed. Next-batch retry candidate (priority: HIGH for FTS triangulation closure).
- 3 broken-YAML files persist from earlier batches (lineage-graph-traversal.yaml, manage-ownership-lifecycle-with-deg-cascade.yaml, run-housekeeping-cycle-five-jobs.yaml). Quarantined.
- **152 detail-without-index** in refactoring-scopes (batch-J `-strengthen-batch-J` legacy + batch-K/L/M/N canonical-append-pattern entries lacking index lines). The reducers grep detail/ directly so this is functionally OK; rebuild_indexes.py reconstructs index.yaml from detail/. Markdown index lags but data is intact.
- **6 detail-without-index** + **4 index-without-detail** in doc-gaps (batch-F orphans 084-088).
- F-001 + F-003 merge candidate still maintainer-pending (P-01:F-001 Popular Entities Ranking).


## Batch 2026-05-20-O — Auth handlers: OAuth provider chain + Logout + Ingestion filter (5/5 nodes; SEVENTH autonomous batch — LSN-018 Rule 6 OPERATIONAL)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: 83 prior + 5 new = **88 total**; 0 deferred (first full-success batch since J)
- **Theme**: Auth handlers — OAuth provider chain (Google + Github) + Logout (Azure + Cognito) + IngestionDataEntitiesFilter

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `GoogleUserHandler` | P-09 | Silently no-ops `admin-groups` config (documented for Cognito/GitHub, never read by Google handler); 4 implicit ADRs (two-layer hd defence-in-depth, admin-attribute defaults to email, diverges from AbstractOIDCUserHandler, Mono.error rejection); LSN-018 Rule 6: 3 strengthens, back-links to F-011 + ADR-034 + REFACTOR-152 + REFACTOR-154 + ADR-035. |
| `GithubUserHandler` | P-09 | 8 corner cases (HIGH: username-rename orphans USER_OWNER_MAPPING; MEDIUM: GHES hard-coded incompatible, admin-principals bypass org gate, undocumented); 2 outbound HTTPS to api.github.com for /user/orgs + /user/teams gating. **LSN-018 Rule 6 surfaced CONFLICT** with existing `substring-match-admin-escalation-ldap-containsignorecase.yaml` canonicalisation_candidate — `OperationUtils.containsIgnoreCase` is full-string `equalsIgnoreCase`, NOT substring; concept-merger SUPERSEDED the wrong candidate in this batch. |
| `AzureLogoutSuccessHandler` | P-09 | Local-only WebSession invalidation (no Azure token revocation, no end_session_endpoint discovery); URI.create(null) NPE if operator omits logout-uri (docs flag as required); post_logout_redirect_uri derived from inbound Host header with no platform-side allowlist (open-redirect class bounded by Azure-side App Registration); **LSN-018 confirmation**: search_facets NOT cleaned at logout but doesn't need to be — F-010 TTL eviction is correct sole reaper. |
| `CognitoLogoutSuccessHandler` | P-09 | 302 to AWS /logout with client_id + dynamic logout_uri from UriUtils.getBaseUri(); atomic local-session invalidation; silent no-op on empty logoutUri HIGH; no upstream-IdP signout MEDIUM (contrasts with Google/Github which DO revoke). |
| `IngestionDataEntitiesFilter` | P-10 + P-09 | **STRONGEST**: bundled `auth.type=DISABLED` + `auth.ingestion.filter.enabled=false` default produces unauthenticated centerpiece S2S endpoint reachable by any HTTP caller. Body-buffered-before-auth (DoS class); plaintext-equality token compare (timing-attack class); hard-coded path; orthogonal to all 4 UI auth modes. **REFACTOR-185 SIXTEENTH-SIDECAR**: filter-class layer added — STRONGEST single finding in catalog reaffirmed. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 246 → **253 concepts** | +7 new (4 invariants + 3 canonicalisation_candidates) + 4 strengthened + **1 SUPERSEDED** (substring-match LDAP candidate — LSN-018 Rule 6 first-fire in production). New: oauth-provider-quirks-strategy-pattern, admin-groups-silent-no-op-asymmetric, logout-side-token-revocation-asymmetric, admin-principals-bypass-org-gate, github-enterprise-server-unsupported, oauth-admin-allowlist-full-string-equality (CORRECT canonical replacing the retracted substring claim), github-username-rename-orphans-user-owner-mapping. Coherence: strengthens=4 supersedes=1 conflicts_surfaced=1-resolved. |
| adr-archaeologist (ADRs) | 131 → **139** | +8 (132-139) + 3 strengthened (ADR-034 OAuth provider-quirks now cross-handler-anchored; ADR-027, ADR-017). 5 HIGH + 3 MEDIUM new. 22 implicit_adrs entries reclassified to scopes via wisdom test (~73% reclass rate). |
| adr-archaeologist (scopes) | 389 → **418** | +29 (390-418) + 4 strengthened. **REFACTOR-185 now 16-SIDECAR** (filter-class-layer added as new invocation site — reaffirms STRONGEST single finding in catalog). REFACTOR-073 + REFACTOR-155 + REFACTOR-113 strengthened. 4 HIGH + 13 MEDIUM + 12 LOW new. |
| doc-gap-finder | 160 → **165** | +5 (173-177) + 3 strengthened (DOC-GAP-038 filter-class-layer evidence; DOC-GAP-048 consumer-site NPE at AzureLogoutSuccessHandler.java:39; DOC-GAP-082 META now 14-sidecar). New: DOC-173 Google admin-groups silent no-op HIGH; DOC-174 GHES silent incompatibility MEDIUM; DOC-175 logout-flow provider-asymmetry MEDIUM; DOC-176 GitHub admin-principals bypass org-gate MEDIUM; DOC-177 GitHub username-rename orphans USER_OWNER_MAPPING HIGH. |
| test-coverage-mapper | 577 → **616 gaps** | +39 (579-617) + 13 strengthened. **+3 CRITICAL**: IngestionDataEntitiesFilter DISABLED+disabled-filter default unauthenticated endpoint, plaintext-equality token timing-attack, body-buffered DoS. 0 test files exist for auth/handler/ + auth/logout/ + IngestionDataEntitiesFilter (verified via Glob — entire packages have zero test coverage). |
| feature-flow-builder | 18 → **18 features** (+0 new, +2 extended) | **F-008 (P-10:F-001 Batch Ingestion) EXTENDED**: 3 → 8 drift classes (+5 new auth-tier facets); 7 → 8 contributing nodes (+IngestionDataEntitiesFilter); 6 → 11 facets. **F-011 (P-09:F-002 Principal-to-Owner Resolution) EXTENDED**: 13 → 18 drift classes (+5 new OAuth handler-tier facets); 10 → 14 contributing nodes (+4 OAuth handlers); 4 → 5 chain hops (+hop-0 oauth-handler tier); 13 → 18 facets. Strong cross-batch architectural anchoring across all 4 handler sidecars. |

### Coverage state after batch O

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 88 | **22.3%** (was 21.0%) |
| Effective coverage | 163 | **41.3%** (was 39.7%) |
| Features discovered | 18 (was 18) | 0 NEW (auth tier extends pillar features) |
| Total test-gaps | 616 (was 577) | 106 CRITICAL (was 103) |

### Cross-batch triangulation deltas

- **REFACTOR-185 DISABLED-mode bypass**: now **16-SIDECAR** — STRONGEST in catalog (filter-class layer added)
- **ADR-CANDIDATE-034 OAuth provider-quirks**: now cross-batch architectural anchoring across 4 handler sidecars (Google + Github + Microsoft from earlier batches if present)
- **LSN-018 mechanism OPERATIONAL**: first production-fire of the supersede protocol (substring-match LDAP candidate retracted with primary-source verification)
- **LSN-018 positive confirmation**: AzureLogoutSuccessHandler confirms F-010 TTL eviction is correct (search_facets cleanup at logout NOT needed because TTL job handles it)
- **F-011 Principal-to-Owner Resolution**: now spans 5-hop chain (oauth-handler → identity-provider → user-owner-mapping repo → permission-extractor → query layer)
- **LSN-001 pattern third surface**: Cognito empty-logout-uri silent no-op (after attachment-ephemeral-default + admin-groups silent no-op patterns)

### Follow-ups (logged, not blocking)

- 3 broken-YAML files persist (lineage-graph-traversal, manage-ownership-lifecycle-with-deg-cascade, run-housekeeping-cycle-five-jobs). Quarantined.
- 181 detail-without-index in refactoring-scopes; 67 in implicit-adrs (batch-J `-strengthen-batch-J` legacy + batch-K/L/M/N/O canonical-append-pattern entries lacking index lines). The reducers grep detail/ directly so this is functionally OK; rebuild_indexes.py reconstructs index.yaml from detail/.
- 6 detail-without-index + 4 index-without-detail in doc-gaps (batch-F orphans persist).
- Coherence-sweep candidate count grew 27.8k → 29.8k (linear with new artefacts; fanout dominant — most are one anchor matching N test-gaps via same class). Audit pass deferred.
- F-001 + F-003 merge candidate still maintainer-pending.


## Batch 2026-05-20-P — Controllers: Ingestion + AlertManager + Owner trio + Permission (5/5 nodes; LSN-018 PRODUCING REAL VALUE)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: 88 prior + 5 new = **93 total**; 0 deferred (1 PHANTOM — sidecar documents methodology miss)
- **Theme**: Controllers deeper — IngestionController.createDataSourceEntity + AlertManagerController.postAlerts + OwnerController.{updateOwner,deleteOwner} + PermissionController.getPolicyPermissions (PHANTOM)

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `IngestionController.createDataSourceEntity` | P-10 | TWO ingestion filters ASYMMETRIC: `/datasources` ALWAYS-auth-required (unconditional `@Component`) vs `/entities` OPT-IN (auth.ingestion.filter.enabled=false default). Collector identity via stringly-typed `COLLECTOR_ID_SESSION_KEY` WebSession attribute (NOT Principal) — cluster-deployment-without-sticky-sessions produces HTTP 500 not 401. UPSERT-by-ODDRN PARTIAL-MERGE (only name + description propagate). |
| `AlertManagerController.postAlerts` | P-07 | METHOD-TIER primary-source confirmation of F-007's 3 named drift facets (unauthenticated_payload_trust + cross_tenant_alert_creation + no_idempotency_no_audit). 4 ancillary corner-cases. **SUPERSEDE**: prior class-level sidecar's 404 finding on alerting page → 200 in this session. |
| `OwnerController.updateOwner` | P-09 | Owner-name rename SAFE for USER_OWNER_MAPPING (FK by `owner.id` at V0_0_4:3, NOT by name — **DISAMBIGUATES from REFACTOR-355** OIDC_USERNAME-rename which IS unsafe). 5 concerns: no @ActivityLog, empty/omitted roles silently DELETES all role-links (HIGH destructive default), name collision returns 400 not 409, case-sensitive no normalization, OpenAPI 201-vs-controller 200. |
| `OwnerController.deleteOwner` | P-09 | **5th audit-silence sidecar** (no @ActivityLog); 3-leg cascade-block + HARD-DELETE on OWNER_TO_ROLE + SOFT-DELETE on owner.deleted_at; **closes orphan-binding CORRECTLY on Owner side** (positive case-law contrast to F-006 Policy/Role half which does it WRONGLY); race-window between cascade-check and delete; FTS search vector NOT refreshed; orphan owner_association_request rows. **SUPERSEDE**: createOwner sidecar's claim of non-partial UNIQUE on owner.name is WRONG (V0_0_64 made it partial). |
| `PermissionController.getPolicyPermissions` | P-09 | **PHANTOM NODE** — method does NOT exist on PermissionController.java (file 27 lines; single method is getResourcePermissions already enriched). Synthetic-node walker emitted candidate from rationale-only synthesis without method-existence verification. Negative finding documented as substrate_quality canonicalisation_candidate; methodology gap surfaced. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 253 → **267 concepts** | +14 new (3 operations + 10 invariants + 1 canonicalisation_candidate) + 3 strengthened + **2 SUPERSEDED** (createOwner partial-unique-index correction + alertmanager-receiver 404→200). Coherence: 3 strengthens, 2 supersedes, 3 conflicts surfaced (all resolved). |
| adr-archaeologist (ADRs) | 139 → **145** | +6 (140-145) + 6 strengthened (ADR-002/006/014/015/027/067). ADR-015 owner-scoping mechanism now **19-SIDECAR** (was 17). ADR-140 Ingestion-endpoint auth ASYMMETRIC by design HIGH; ADR-141 Collector identity via WebSession attribute HIGH; ADR-142 UPSERT-by-ODDRN partial-merge HIGH; ADR-143/144/145 MEDIUM. |
| adr-archaeologist (scopes) | 418 → **435** | +17 (419-435) + 4 strengthened. **REFACTOR-185 now 17+18-SIDECAR** (createDataSourceEntity + filter-class additions). HIGH: REFACTOR-419 cluster fragility; -425 destructive empty roles; -426 no audit on Owner mutations; -427 owner_association_request orphans; -431 no audit on datasource registration. REFACTOR-435 substrate-quality phantom-node MEDIUM. |
| doc-gap-finder | 165 → **172 detail / 184 reported** | +7 (178-184) + 5 strengthened + 1 SUPERSEDED (DOC-GAP-011 wording-correction). 3 HIGH + 4 MEDIUM new. DOC-GAP-082 META now 17+ surfaces. |
| test-coverage-mapper | 616 → **631 indexed (107 CRITICAL)** | +16 (618-633) + 9 strengthened + 1 SUPERSEDED (TEST-GAP-239 partial-index correction). 2 NEW CRITICAL: TEST-GAP-618 IngestionController createDataSource asymmetric auth; TEST-GAP-622 updateOwner empty-roles destructive. |
| feature-flow-builder | 18 → **19 features** (+1 new, +4 extended) | **F-019 / P-08:F-003 Owner Lifecycle Management** (NEW — the createOwner/updateOwner/deleteOwner trinity now coherent user-observable feature; 13 facets). F-006 RBAC: 5-SIDECAR audit-silence + positive case-law contrast. F-007 AlertManager: METHOD-TIER primary source for 3 facets. F-008 Batch Ingestion: 5 architectural-asymmetry facets. F-011 Principal-to-Owner: OWNER.NAME rename safe disambiguation. Coherence: strengthens=4 supersedes=1 conflicts_surfaced=0. |

### Coverage state after batch P

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 93 | **23.5%** (was 22.3%) |
| Effective coverage | 171 | **43.3%** (was 41.3%) |
| Features discovered | 19 (was 18) | +1 NEW (F-019 Owner Lifecycle Management) |
| Total test-gaps | 631 indexed (632 written, 1 broken) | 107 CRITICAL (was 106) |

### Cross-batch triangulation deltas

- **REFACTOR-185 DISABLED-mode bypass**: now **17-18 SIDECAR** (createDataSourceEntity adds new invocation site; STRONGEST in catalog reaffirmed)
- **ADR-015 owner-scoping mechanism**: now **19-SIDECAR** (updateOwner + deleteOwner add 2 touch-points)
- **F-006 audit-silence pattern**: now **5-SIDECAR** (deleteOwner + updateOwner extend Role+Policy closure)
- **F-006 positive case-law contrast**: Owner-side OWNER_TO_ROLE hard-delete CLOSES orphan-binding pattern that Policy/Role half does WRONGLY — first POSITIVE pattern in F-006 (canonicalisation candidate)
- **F-011 rename hazard surface complete**: OWNER.NAME rename SAFE (FK by owner.id) vs OIDC_USERNAME rename UNSAFE (REFACTOR-391)
- **LSN-018 Rule 6 production fire #2-5**: 5 supersedes across registries this batch (concept-merger 2 + doc-gap-finder 1 + test-coverage-mapper 1 + feature-flow-builder 1)

### Follow-ups (logged, not blocking)

- **TEST-GAP-363 broken YAML** introduced this batch (strengthen-edit corrupted scalar). Auto-quarantined to `.broken-yaml-pending-fix`; data preserved in `.broken-yaml-backup`. Recoverable next batch.
- 3 broken-YAML files persist from earlier batches (lineage-graph-traversal, manage-ownership-lifecycle-with-deg-cascade, run-housekeeping-cycle-five-jobs).
- 199 detail-without-index in refactoring-scopes; 78 in implicit-adrs (legacy batch-J + ongoing canonical-append-pattern). rebuild_indexes.py reconstructs from detail/ so functional. Markdown indexes lag.
- 13 detail-without-index + 4 index-without-detail in doc-gaps.
- **PHANTOM-NODE methodology miss** captured as REFACTOR-435 + substrate_quality concept. Future sprint-themes entries should run a "method-existence verification" (Grep for the method name in the source_file) BEFORE adding to the theme queue.
- Coherence-sweep candidates: 29.8k (batch O) → 33.1k (batch P; linear growth, fanout-dominated).


## Batch 2026-05-20-Q — UI-axis: AppToolbar + RBAC + Owner + Collector lists (5/5; LSN-018 phantom-prevention pre-fired)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: 93 prior + 5 new = **98 total**; 0 deferred. **FIRST UI-axis batch in the ontology.**
- **Theme**: UI-axis — Auth + RBAC + Settings surfaces (LoginForm originally a PHANTOM; substituted with AppToolbar)

### Pre-Phase-1 path corrections (LSN-018 phantom-node prevention)

The /next-batch orchestrator verified all 5 target paths via `find` BEFORE firing file-analysers. Outcome:
- **5/5 original paths were wrong**:
  - 1 PHANTOM: LoginForm.tsx — no component by that name exists in odd-platform-ui. Auth model is OIDC-redirect-only with no local login form. **Substituted**: AppToolbar.tsx (the actual user-facing auth surface)
  - 4 directory-naming typos: Policies/Policies.tsx → PolicyList/PolicyList.tsx, Roles/Roles.tsx → RolesList/RolesList.tsx, Owners/Owners.tsx → OwnersList/OwnersList.tsx, Collectors/Collectors.tsx → CollectorsList/CollectorsList.tsx
- Corrections committed before Phase 1: this is the LSN-018 phantom-node prevention working end-to-end. Methodology cost of correction: ~30 seconds; methodology cost without correction: 5 wasted file-analyser cycles + 5 phantom sidecars.

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `AppToolbar` (substitute for phantom LoginForm) | P-09 | Only user-facing auth UI surface; Identity wire has NO provider field → **POSITIVE: NOT a leak surface for F-011 provider-null cross-mode bleed**; Management tab visible to ALL authenticated users (unpermissioned visibility); logout = full-page navigation deferring to backend chain. Zero test files. |
| `PolicyList` | P-09 | 5 ADRs, 5 security gaps (1 HIGH catalogue-vs-grant soft-delete asymmetry). **REFUTED LSN-017 doubling hypothesis** (stable thunk ref). CONFIRMED LSN-001 catalogue-vs-GRANT pattern: permissions shown as JSON-schema CODES not labels. |
| `RolesList` | P-09 | **F-006 audit-silence now 6-SIDECAR** (UI tier added). Soft-deleted ROLES invisible BUT soft-deleted POLICIES still render in chip list (F-006 drift_class A UI manifestation). RoleForm has NO predefined-name validation → viable exploit path for batch-H/N create-path asymmetry. |
| `OwnersList` | P-08 | **Destructive empty-roles UPDATE is REACHABLE FROM UI in 3 clicks with NO confirmation modal** (while more-reversible Delete has one). Elevates batch-P REFACTOR-425 from API-only to UI-operator-reachable. GET /api/owners has NO SecurityRule — any authenticated user reads full directory. 17th DISABLED-mode anonymous surface. |
| `CollectorsList` | P-08+P-10 | Tokens returned as 40-char PLAINTEXT on register/regenerate, rendered as DOM text. UI distinguishes plaintext-vs-masked via FRAGILE substring-prefix sniff with no test. **UI-vs-API asymmetry under DISABLED: UI hides COLLECTOR_* mutation buttons while backend endpoints accept anonymous mutations — NEW REFACTOR-185 facet**. **REFACTOR-185 now 19-SIDECAR (NEW STRONGEST count)**. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 267 → **274 indexed (276 written; 2 quarantined)** | +9 new (1 entity + 7 invariants + 1 operation) + 6 strengthened. 2 BROKEN-YAML quarantined (`destructive-empty-roles-update-reachable-from-ui-three-clicks-no-confirmation.yaml` + `plaintext-token-rendered-into-dom-fragile-substring-prefix-sniff-masking.yaml` — backtick scalars; data preserved in `.broken-yaml-backup`). Coherence: strengthens=6 supersedes=0 conflicts_surfaced=0 positive_findings=3. |
| adr-archaeologist (ADRs) | 145 → **150** | +5 (146-150) + 5 strengthened. ADR-001 to 23-sidecar UI-shell mirror; ADR-003 to 12-sidecar UI-tier confirmation. 8 candidates failed wisdom test → reclassified to scopes. |
| adr-archaeologist (scopes) | 435 → **455** | +20 (436-455) + 7 strengthened. **REFACTOR-185 NOW 19-SIDECAR — NEW STRONGEST COUNT** (was 17-18). REFACTOR-425 elevated to UI-REACHABLE. REFACTOR-426 audit-silence now 6-SIDECAR with UI tier. |
| doc-gap-finder | 184 → **190** | +6 (185-190) + 5 strengthened. NEW HIGH: DOC-187 UI-vs-API asymmetry under DISABLED operator-trap; DOC-188 empty-roles UI-reachable destructive UPDATE. DOC-082 META now 17→24-sidecar; DOC-083 8→9+; DOC-137 5→9. |
| test-coverage-mapper | 632 → **657 detail (656 indexed)** | +25 (634-658) + 1 strengthened. **3 NEW CRITICAL** (TEST-643 UI exploit chain for create-path asymmetry; TEST-647 empty-roles destructive UI; TEST-652 UI-vs-API asymmetry under DISABLED). 110 CRITICAL total. **5 LSN-017 negative findings recorded** (useEffect doubling does NOT exhibit in batch-Q components). |
| feature-flow-builder | 19 → **20 features** (+1 new, +4 extended) | **F-020 / P-08:F-004 Collector Lifecycle Management** (NEW — minted per system-mission.md P-08 sub-feature seed; credential-AUTHORING side under Management, distinct from F-008 credential-CONSUMER side under Integrations). F-006/F-008/F-011/F-019 extended. Coherence: strengthens=4 supersedes=0 conflicts_surfaced=0. |

### Coverage state after batch Q

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 98 | **24.8%** (was 23.5%) |
| Effective coverage | 188 | **47.6%** (was 43.3%) |
| Features discovered | 20 (was 19) | +1 NEW (F-020 Collector Lifecycle Management) |
| Total test-gaps | 656 indexed (657 written; 1 broken from batch P) | 110 CRITICAL (was 107) |

### Cross-batch triangulation deltas

- **REFACTOR-185 DISABLED-mode bypass**: now **19-SIDECAR** (UI-vs-API asymmetry from CollectorsList adds a NEW facet beyond filter/controller surfaces). STRONGEST in catalog reaffirmed.
- **F-006 audit-silence pattern**: now **6-SIDECAR** (UI tier added: PolicyList + RolesList + AppToolbar all forensically silent)
- **F-019 Owner Lifecycle Management**: UI-tier elevated batch-P REFACTOR-425 (empty-roles destructive UPDATE) from API-only to UI-operator-reachable
- **F-011 Principal-to-Owner Resolution**: AppToolbar POSITIVE finding — Identity wire has NO provider field, RULES OUT provider-null leak at UI surface
- **LSN-001 catalogue-vs-grant pattern**: 3rd surface (Cognito empty-logout + admin-groups silent + PolicyList JSON-schema codes)
- **LSN-017 doubling**: explicit NEGATIVE findings recorded for 4/5 UI components (useEffect dep-arrays are guarded by `if (!query)` or primitive deps)
- **LSN-018 phantom-node prevention**: PRE-PHASE-1 fire saved 5 file-analyser cycles

### Follow-ups (logged, not blocking)

- **2 new BROKEN-YAML quarantines** (concept-merger emit-bug — backtick scalars): `destructive-empty-roles-update-reachable-from-ui-three-clicks-no-confirmation.yaml` + `plaintext-token-rendered-into-dom-fragile-substring-prefix-sniff-masking.yaml`. Data preserved in `.broken-yaml-backup`. Recoverable next batch.
- 1 broken-yaml from batch P (TEST-GAP-363) persists.
- 3 broken-yaml from earlier batches persist (lineage-graph-traversal, manage-ownership-lifecycle-with-deg-cascade, run-housekeeping-cycle-five-jobs).
- 199 detail-without-index in refactoring-scopes; 78 in implicit-adrs (legacy + ongoing canonical-append).
- 17 detail-without-index + 4 index-without-detail in doc-gaps.
- Coherence-sweep candidates: 33k (P) → 36k (Q; linear growth, fanout-dominated).
- F-001 + F-003 merge candidate still maintainer-pending.


## Batch 2026-05-20-R — Repository continuation: Activity + DataSource + MetadataField + Collector + DatasetField (5/5; LSN-018 phantom-prevention pre-fired)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: 98 prior + 5 new = **103 total**; 0 deferred. LSN-018 path-verification: 5/5 paths verified pre-Phase-1.
- **Theme**: Repository-tier — Activity (audit-trail backbone) + DataSource (UPSERT-by-ODDRN SQL primary) + MetadataField (TOCTOU + soft-delete partial-unique-mismatch) + Collector (token storage) + DatasetField (versioning-by-reference)

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `ReactiveActivityRepositoryImpl` | P-07+P-09 | **F-006 audit-silence rooted in SCHEMA** (data_entity_id NOT NULL FK at V0_0_48:4,12 — Activity is data-entity-scoped, structurally cannot audit RBAC/Owner/Datasource mutations); Provider-agnostic LEFT JOIN to USER_OWNER_MAPPING.OIDC_USERNAME at 4 sites = LSN-018 cross-mode-bleed READ-side mirror; monotonic growth (no DELETE path); 27 enum values vs 20 documented. |
| `ReactiveDataSourceRepositoryImpl` | P-10+P-08 | SQL-tier PRIMARY SOURCE for ADR-142 (UPSERT-by-ODDRN partial-merge is SERVICE-tier convention, NOT repo or schema enforced). **2 NEW CONFLICTS**: (1) listDto page-vs-count predicate divergence (startsWithIgnoreCase vs containsIgnoreCase) breaks pagination math; (2) data_source.name partial-unique-index silent-failure rolls back transaction with no diagnostic. |
| `ReactiveMetadataFieldRepositoryImpl` | P-01 | Soft-delete + partial-unique-index MISMATCH (Tag fixed V0_0_64; metadata_field NOT migrated → INTERNAL fields un-recreatable after soft-delete). TOCTOU sibling. Case-sensitivity asymmetry. IX_UNIQUE_EXTERNAL_NAME_TYPE missing from ExceptionUtils.formatMessage. getDtosByDataEntityId surfaces soft-deleted values. |
| `ReactiveCollectorRepositoryImpl` | P-08+P-10 | **Plaintext token at-rest SEV-HIGH** → end-to-end plaintext-everywhere chain with batch-Q CollectorsList DOM-render finding. Orphaned token rows. No-rotation-audit. |
| `ReactiveDatasetFieldRepositoryImpl` | P-01+P-05 | Versioning-by-reference (rows SHARED across dataset_versions via M:N); NO native soft-delete; NO orphan cleanup → unbounded accumulation; Missing @ActivityLog on description edits (asymmetric vs updateInternalName); Verbatim XSS-class storage. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 274 → **281 indexed (281 written; 0 new quarantines)** | +7 new (all invariants) + 7 strengthened. provider-null-cross-mode-bleed now 4-vertex (principal + persistence-write + schema + persistence-READ at Activity 4 JOIN sites). three-soft-delete-mechanisms now 6-mechanism. plaintext-equality-shared-secret-token-model now 4-axis. No new YAML quarantines (rule fired cleanly). |
| adr-archaeologist (ADRs) | 150 → **153** | +3 (146-148) + 3 strengthened. ADR-146 audit-log schema-rooted (RESOLVES F-006 family question: STRUCTURAL not annotation gap). ADR-147 dataset_field versioning-by-reference. ADR-148 operator-metadata forward-copy. ADR-142 UPSERT-by-ODDRN now 3-LAYER triangulation (service+repo+SQL). |
| adr-archaeologist (scopes) | 455 → **461** | +6 (436-441) + 3 strengthened. REFACTOR-085 (activity-table monotonic growth) now 3-sidecar triangulated. REFACTOR-185 + REFACTOR-419 SQL-tier confirmation. 2 borderline-ADR candidates surfaced for maintainer triage (TOKEN.value plaintext, activity retention). |
| doc-gap-finder | 190 → **195** | +5 (191-195) + 2 strengthened. DOC-191 Activity 27-vs-20 enum HIGH; DOC-192 Activity scope constraint HIGH; DOC-193 Custom Metadata absent HIGH; DOC-194 Collector token threat model HIGH; DOC-195 DatasetField audit-invisible MEDIUM. 4 live WebFetches at 200. |
| test-coverage-mapper | 656 → **677 indexed** | +21 (659-679) + 4 strengthened. **2 NEW CRITICAL** (Activity audit-silence schema-rooted; Collector plaintext-at-rest SQL primary). 112 CRITICAL total. |
| feature-flow-builder | 20 → **21 features** (+1 new, +8 extended) | **F-021 / P-07:F-004 Activity Feed Audit-Trail Surface** (NEW — distinct user-observable Active Platform sub-feature per system-mission.md P-07). F-004/F-006/F-007/F-008/F-010/F-011/F-013/F-020 ALL extended (44 new drift facets across batch — largest reducer extension of the sprint). Coherence: 8 strengthens / 0 supersedes / 0 conflicts. |

### Coverage state after batch R

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 103 | **26.1%** (was 24.8%) |
| Effective coverage | 196 | **49.6%** (was 47.6%) — approaching 50% milestone |
| Features discovered | 21 (was 20) | +1 NEW (F-021 Activity Feed P-07:F-004) |
| Total test-gaps | 677 indexed (677 written) | 112 CRITICAL (was 110) |

### Cross-batch triangulation deltas

- **F-006 audit-silence pattern**: now **8-SIDECAR with SCHEMA-LAYER ROOT CAUSE identified** (data_entity_id NOT NULL FK structurally limits Activity to data-entity events). The pattern was 6-SIDECAR (controller/service/repo at API + UI); now adds Activity-repo + DatasetField-repo asymmetric, with SCHEMA ROOT confirmed.
- **provider-null cross-mode-bleed**: now **4-VERTEX** (principal + persistence-write + schema + persistence-READ via Activity 4 JOIN sites)
- **three-soft-delete-mechanisms**: now **6-mechanism × 10+ sites** (NEW: NO-DELETION-AT-ALL with M:N edge lifecycle on dataset_field; V0_0_64 CONVERGENCE OUTLIERS at collector.name + metadata_field partial indexes)
- **plaintext-equality-shared-secret-token-model**: now **4-axis** (rotate + verify-annotation + verify-filter + SQL primary)
- **ADR-142 UPSERT-by-ODDRN partial-merge**: now **3-LAYER triangulation** (service + repo + SQL primary)
- **End-to-end plaintext token chain CLOSED**: SQL at-rest (batch R) + DOM render (batch Q) + plaintext-equality verify (batch P) — single class spanning 3 batches
- **F-010 user-initiated extension**: 3 new drift facets folded into F-010 during this batch (activity monotonic growth + empty-partition-sole-reaper + orphan-token-no-housekeeping)
- **LSN-018 Rule 6 sustained**: 5+3 conflicts surfaced this batch (all resolved via SUPERSEDE or CONFLICT-FOLD); zero contradictions reached the registry

### Follow-ups (logged, not blocking)

- 2 broken-yaml from batch Q persist (destructive-empty-roles + plaintext-token concepts — backtick scalars); 1 from batch P (TEST-GAP-363); 3 from earlier batches. All quarantined.
- 207 detail-without-index in refactoring-scopes; 82 in implicit-adrs (legacy + ongoing canonical-append).
- 22 detail-without-index + 4 index-without-detail in doc-gaps.
- Coherence-sweep candidates: 36k (Q) → 40k (R; linear growth, fanout-dominated).
- F-001 + F-003 merge candidate still maintainer-pending.
- Concept-merger deferred 1 strengthen for next batch (read-collaborative-cross-owner-enumeration; DatasetField.listByTerm as 25th surface — file size risk).


## Batch 2026-05-20-S — Services tier: Owner + Policy + Role + DataSourceIngestion + Alert (auto-extended; **50% effective-coverage milestone CROSSED**)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-rev2-sprint-2026-05-19`
- **Substrate**: 103 prior + 5 new = **106 total**; 0 deferred. **Auto-extended** after queue exhaustion at R (4 consecutive `/next-batch` invocations into empty queue triggered auto-extension).
- **Theme**: Services tier — F-006 audit-silence primary-source closure (the canonical missing layer — referenced 5+ times across batches H-R but never directly enriched)

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `OwnerServiceImpl` | P-08+P-09 | **REFACTOR-425 destructive-empty-roles cascade COMPOSED across 3 lines** (71+76-81+117-122 — getRoleIdsList null+empty collapse silently reaches the explicit wipe-all primitive that delete uses INTENTIONALLY at line 97). Full-set REPLACEMENT role-rebind. Cascade-block not atomic with soft-delete. Service-tier closure of F-019 + 6-sidecar audit-silence intersection. |
| `PolicyServiceImpl` | P-09 | 4 F-006 drift facets PRIMARY-SOURCE at service tier. **NO @ReactiveTransactional** (asymmetric vs RoleServiceImpl) — likely accidental, lost-update race exposed. NO @ActivityLog (7th audit-silence sidecar). **Schema-rooted fix requirement**: V0_0_48 NOT NULL FK means annotation fix would FAIL → schema migration required. **10 STRENGTHENS**. |
| `RoleServiceImpl` | P-09 | 10 drift facets (A-J). Create-path Administrator/User name asymmetry PRIMARY-SOURCE (lines 49-61 no check vs 68/81-82/104 four guards). **Three-policy case-sensitivity mismatch** (create no-check / update case-sensitive .equals / delete case-insensitive .equalsIgnoreCase). @ReactiveTransactional uniformity = deliberate POSITIVE contrast. **AUTHORIZATION HOT PATH**: getCurrentUserRoles invoked from PolicyServiceImpl on every authorized request. |
| `DataSourceIngestionServiceImpl` | P-10+P-08 | **SERVICE-TIER VERTEX of ADR-142+143 triangulation** — primary file:line at 74-92 (copy-construct + 2-field setter) and line 106 (namespace inheritance via MappingUtils). ADR-142 now **4-LAYER triangulated** (controller P + service S + repo R + schema). 3 NEW conflicts: dead-code branch lines 82-84; asymmetric defense-in-depth (ODDRN checked but not name); operator-name-precedence convention extension. |
| `AlertServiceImpl` | P-07 | **All 3 F-007 drift facets PRIMARY-SOURCE at service tier** (cross_tenant_alert_creation verbatim at line 178; no_idempotency_no_audit via handleExternalAlerts SKIP-AlertActionResolver lines 151-191 vs applyAlertActions 222-227; unauthenticated_payload_trust via deliberate AuthIdentityProvider OMISSION). Activity emission is via BATCH SAVE path NOT @ActivityLog AOP — **audit gap is at INGRESS only**. **11 STRENGTHENS — strongest single-sidecar coherence signal of the sprint**. 2 SUPERSEDES (doc URL refreshes). |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 281 → **296 concepts** | +11 new (9 invariants + 2 operations) + 11 strengthened + 4 superseded-tombstones (Rule 6 caught 4 duplicates pre-emit; folded into existing). NEW: @ReactiveTransactional asymmetry; three-policy case-sensitivity mismatch; authorization hot path no-cache; ALERTSERVICE handle-external-alerts skip-resolver; audit-silence at INGRESS only (not state-transitions); destructive-empty-roles COMPOSED; ADR-142+143 service-tier vertex; PolicyService lost-update race; F-006 9-sidecar extension. |
| adr-archaeologist (ADRs) | 153 → **156** | +3 (154-156) + 4 strengthened (ADR-142 → 4-LAYER triangulation; ADR-015 owner-scoping → 21+ sidecar; ADR-146 schema-rooted audit; ADR-144). New: audit-context-at-service-not-controller; reopen-conflict-guard-intent; ingestion-path-divergence. |
| adr-archaeologist (scopes) | 461 → **466** | +5 (462-466) + 2 strengthened (REFACTOR-425 service-tier composition; REFACTOR-085 activity retention). New HIGH: PolicyService @ReactiveTransactional gap; AlertManager service-tier compound XSS/cross-tenant/no-idempotency; authorization hot-path no-cache; reopen-conflict race; IllegalArgumentException → HTTP 500. 5 wisdom-test reclassifications from implicit-ADRs → scopes. |
| doc-gap-finder | 195 → **197** | +2 (196-197) + 5 strengthened (DOC-107 + DOC-180 + DOC-181 + DOC-122 + DOC-082 META). |
| test-coverage-mapper | 677 → **701 indexed (702 written; 1 new broken-yaml quarantine — TEST-GAP-687)** | +25 (680-704) + 7 strengthened. +2 CRITICAL → 114 CRITICAL (TEST-GAP-680 OwnerService REFACTOR-425 composition; TEST-GAP for AlertService cross_tenant_alert_creation). |
| feature-flow-builder | 21 → **21 features** (+0 new, +5 extended) | F-019 + F-006 + F-007 + F-008 + F-020 ALL extended. F-006 audit-silence now **8-SIDECAR** at feature-flow level (UI tier + 6 mutation tier including services); concept tier sees 9-SIDECAR refinement. Coherence: 33 strengthens / 0 supersedes / 0 conflicts. |

### Coverage state after batch S

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 106 | **26.8%** (was 26.1%) |
| Effective coverage | 198 | **50.1%** (was 49.6%) — **50% milestone CROSSED** |
| Features discovered | 21 (unchanged) | service tier extends API features |
| Total test-gaps | 701 indexed (702 written) | 114 CRITICAL (was 112) |

### Cross-batch triangulation deltas

- **50% effective-coverage milestone CROSSED** (50.1%)
- **F-006 audit-silence pattern**: now **9-SIDECAR with SCHEMA-LAYER ROOT identified + 8-tier closure** (Controller-E + Policy-repo-H + Role-repo-N + UI-Q + Activity-repo-R schema root + Owner-service-P→S + Policy-service-S + Role-service-S). Schema migration is the load-bearing fix anchor.
- **ADR-142 UPSERT-by-ODDRN partial-merge**: now **4-LAYER triangulated** (controller + service + repo + SQL) with full file:line evidence at every layer
- **ADR-015 owner-scoping mechanism**: now **21+-SIDECAR** (was 19; OwnerService + PolicyService + RoleService all touch)
- **AlertServiceImpl 11-strengthens**: strongest single-sidecar coherence signal of the entire sprint
- **Authorization HOT PATH discovered**: `getCurrentUserRoles` invoked from PolicyServiceImpl on every authorized request (no cache; 2-JOIN cost per request)
- **Audit-emission asymmetry refined**: INGRESS silence vs state-transition audit — F-007 webhook ingress is unauthenticated AND silently received, but the RESULTING `OPEN_ALERT_RECEIVED` events ARE persisted via batch save path
- **REFACTOR-185 DISABLED-mode bypass**: now 19-SIDECAR (unchanged from R; service tier inherits but adds no new invocation site)
- **LSN-018 Rule 6**: 4 supersede-tombstones caught pre-emit by concept-merger; 5 wisdom-test reclassifications by adr-archaeologist; all conflicts resolved before commit

### Follow-ups (logged, not blocking)

- TEST-GAP-687 broken-yaml (test-coverage-mapper emit-bug — block-collection issue); quarantined.
- 2 broken-yaml from batch Q + 1 from batch P + 3 earlier persist.
- 207 detail-without-index in refactoring-scopes; 82 in implicit-adrs.
- 17 detail-without-index + 4 index-without-detail in doc-gaps.
- Coherence-sweep candidates: 40k (R) → 41k (S; linear growth).
- F-001 + F-003 merge candidate still maintainer-pending.


## Batch 2026-05-20-T — Discovery cross-cuts: Activity + AppInfo + DataQuality + Directory + Relationship (4/5; new branch feature/ontology-finalize-2026-05-20)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20` (NEW working branch off merged main; PR #144 closed rev-2 sprint)
- **Substrate**: 106 prior + 4 new = **110 total**; 1 deferred (RelationshipController socket-errored; P-02 first sidecar still pending).
- **Theme**: Discovery cross-cuts — first batch of the finalization sprint (themes T-ZA queued)

### Sidecars added (4)

| Sidecar | Pillar | Headline |
|---|---|---|
| `ActivityController` | P-07+P-09 | F-021 read surface is this 2-method class with **ZERO authorization wiring**. F-006 audit-silence reaches **10-SIDECAR** at this layer. The 27-vs-20 enum mismatch (batch R) RECONCILED via WebFetch 200: "20 named + 7 categorical = 27" is the actual taxonomy split. |
| `AppInfoController` | P-09 | **REFACTOR-185 NOW 19-SIDECAR at controller-class layer** (symmetric with batch-O IngestionDataEntitiesFilter two-axis pattern). expose-mode-hide-provider contract paired with IdentityController. NEW finding: Overview.tsx silently mis-gates OwnerAssociation card on auth.type typo. /api/appInfo is a DISABLED-mode fingerprint surface NOT documented or warned. |
| `DataQualityController` | P-04 | **P-04's FIRST direct sidecar**. CRITICAL NEW: /api/datasets/{id}/sla returns **image/png** but live doc claims DataSetSLAReport JSON — operator/BI-engineer falls-off-the-cliff drift. Sibling endpoint /sla_report is the actual JSON one. 5 implicit ADRs. REFACTOR-024 cross-owner family +4 invocation sites. |
| `DirectoryController` | P-01 | **NEW page-vs-count predicate divergence at level 4** — listByDatasourceAndType (HOLLOW+soft-delete only) vs countByDatasourceAndType (full getDataEntityDefaultConditions including EXCLUDE_FROM_SEARCH). STRUCTURALLY analogous to REFACTOR-425 but at a DISTINCT repository site (ReactiveDataEntityRepositoryImpl). Reflection property leak (infrastructure-revealing ODDRN extractor). |
| `RelationshipController` | DEFERRED | Socket-errored ~5min in (agent abdc2d561a8d84ac2; 0 tokens). DEFERRED to next-batch retry. **P-02 Data Modelling first-sidecar still pending** — needs retry. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 296 → **314 concepts** | +18 new (4 entities + 9 invariants + 3 operations + 2 canon-candidates) + 3 strengthened + 1 SUPERSEDED (DirectoryController v0.1.0 STALE). F-006 audit-silence now 10-SIDECAR; REFACTOR-185 19-SIDECAR; REFACTOR-024 28-sidecar. |
| adr-archaeologist (ADRs) | 156 → **160** | +4 (157-160) + 3 strengthened. Activity-event-enum-as-2-tier-taxonomy ADR; Expose-mode-hide-provider ADR; SLA-as-PNG-for-BI ADR; Existence-check-includes-soft-deleted ADR. |
| adr-archaeologist (scopes) | 466 → **470** | +4 (467-470) + 2 strengthened. REFACTOR-185 now **23-SIDECAR** triangulated; REFACTOR-024 cross-owner family now ~30 read endpoints. NEW HIGH: SLA-PNG-vs-JSON live-doc drift. NEW MEDIUM: page-vs-count predicate at ReactiveDataEntityRepositoryImpl (REFACTOR-425 sibling). |
| doc-gap-finder | 197 → **202** | +5 (198-202) + 2 META strengthened (DOC-082 now 33-sidecar; DOC-083 now 9-sidecar bifurcated into PRESENCE-axis + VISIBILITY-axis). DOC-198 HIGH (SLA PNG/JSON drift); DOC-199 HIGH (AppInfo fingerprint); DOC-200 HIGH (Activity no-authz cross-owner); DOC-201 MEDIUM; DOC-202 MEDIUM. |
| test-coverage-mapper | 701 → **714 indexed** | +13 (705-717) + 3 strengthened. **3 NEW CRITICAL** (TEST-705 SLA PNG-vs-JSON drift; TEST-706 ActivityController cross-owner audit no-authz; TEST-717 cross-cutting 4-controller HTTP-tier integration absence). 117 CRITICAL total. |
| feature-flow-builder | 21 → **23 features** (+2 new, +4 extended) | **F-022 / P-04:F-001 Per-Dataset DQ Tests & SLA** (NEW — P-04's FIRST anchored feature). **F-023 / P-01:F-007 Directory Browsing** (NEW — distinct from F-001 search + F-003 popular ranking). F-021 + F-011 + F-008 + F-007 extended. 43 new drift facets — second-largest batch extension after batch R. |

### Coverage state after batch T

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 110 | **27.8%** (was 26.8%) |
| Effective coverage | 209 | **52.9%** (was 50.1%) |
| Features discovered | 23 (was 21) | +2 NEW (F-022 P-04 DQ + F-023 P-01 Directory) |
| Total test-gaps | 714 indexed | 117 CRITICAL (was 114) |

### Cross-batch triangulation deltas

- **P-04 Data Quality pillar now anchored** (was entirely empty) — F-022 first feature minted
- **F-006 audit-silence pattern**: 9-SIDECAR → **10-SIDECAR** (ActivityController controller-class layer added)
- **REFACTOR-185 DISABLED-mode bypass**: 19 → **23-SIDECAR** triangulated (AppInfoController + ActivityController + DirectoryController + DataQualityController all reachable in DISABLED)
- **REFACTOR-024 cross-owner enumeration family**: 24 → **28 invocation sites / 9 feature surfaces**
- **REFACTOR-425 page-vs-count divergence**: now confirmed at TWO repository sites (was DataSource-only; now also ReactiveDataEntityRepositoryImpl)
- **LSN-001 pattern (insecure default)**: AppInfo `/api/appInfo` adds a 4th surface (the DISABLED fingerprint)
- **DOC-082 META (DISABLED bypass operator-trap)**: 29 → **33-sidecar**; 8th tier (cross-cutting endpoints) added
- **DOC-083 META (no-audit-log)**: 8 → **9-sidecar**, BIFURCATED into PRESENCE-axis + VISIBILITY-axis (Activity feed itself is cross-owner unscoped)

### Follow-ups (logged, not blocking)

- **RelationshipController DEFERRED** — socket-errored. P-02 Data Modelling first-sidecar still pending; next-batch retry candidate (priority HIGH for closing P-02).
- 2 broken-yaml from batches Q+P+S persist; 3 from earlier. Quarantined.
- 207 detail-without-index in refactoring-scopes; 82 in implicit-adrs; 22+4 in doc-gaps.
- Coherence-sweep candidates: 41k (S) → 43k (T; linear growth).
- F-001 + F-003 merge candidate still maintainer-pending.


## Batch 2026-05-20-U — Term + Glossary: **P-06 Data Glossary 5-LAYER closure** (5/5)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 110 prior + 4 new + 1 UI subst = **114 total**; 0 deferred
- **Theme**: P-06 Data Glossary closure (Term controller + service + UI list + UI details + FTS write repo)

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `TermController` | P-06+P-09 | 23 endpoints; **term-to-term linkage POST/DELETE have NO SecurityRule entry** (2nd SecurityConstants wiring failure — different bug class from REFACTOR-217). Status-code drift. NAMESPACE_CREATE + TAG_CREATE side-doors. Term link/unlink invisible to Activity Feed. |
| `TermServiceImpl` | P-06+P-09 | **F-004 stored-XSS intersection at handleDataEntityDescriptionTerms**: `[[<script>:foo]]` payloads persist verbatim in unhandled-staging rows. **V0_0_91 term_to_term.deleted_at confirmed DEAD-schema MISSED migration** (not intentional — Grep zero matches for TERM_TO_TERM.DELETED_AT writes). **F-006 audit-silence ENUM-ROOTED**: ActivityEventTypeDto has NO TERM/TAG/NAMESPACE values — structurally invisible. |
| `TermSearch` (UI, substitute for phantom TermsList) | P-06 | TWO LSN-017-class dep-array smells (latent + potentially active). **Broken 1500ms debouncer recreated every render**. Stale-session-UUID broken-page (cross-link F-010 30-day TTL). 5 ADRs (URL-backed server session model; WithPermissions UI-hide pattern; 1500ms leading-edge debouncer; read-collaborative posture; pageSize=30 twice). |
| `TermDetails` (UI) | P-06 | **REFUTES LSN-017 doubling for TermDetails** BUT surfaces sibling-class: **cross-component fetch duplication** (shell + Overview tab both fire `getTermDetailsDto` 12-JOIN hot path per page-open). **F-004 stored-XSS EXTENDS to TermDefinition** (rehype-raw bundled via @uiw/react-md-editor 6.1.1, **no rehype-sanitize anywhere in odd-platform-ui** — Grep verified). 5th UI shell confirming LSN-017-negative cluster — DataEntityDetails increasingly SOLE platform-wide canonical instance. |
| `ReactiveTermSearchEntrypointRepositoryImpl` | P-06+P-01 | Term-side FTS WRITE surface. **REFACTOR-229 ROLE-DISAMBIGUATED** (not strengthened): WRITE path stores tokenized (safe); READ path detonates user-controlled query text. Sidecar is UPSTREAM-of-vulnerability node. Patch scope tightened to READ side only. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 314 → **328 concepts** | +8 new + 6 strengthened. NEW: third-SecurityConstants-wiring-failure; F-004-extends-to-TermDefinition; no-rehype-sanitize-anywhere-in-odd-platform-ui systemic; V0_0_91-dead-schema-classification (severity HIGH→MEDIUM after disambiguation); F-006-audit-silence-ENUM-ROOTED (deeper than schema-rooted); REFACTOR-229-WRITE-vs-READ-disambiguation; cross-component-fetch-duplication (sibling-class to LSN-017); broken-debouncer-recreation-every-render; cross_namespace_term_pollution UI surface confirmed; NAMESPACE_CREATE+TAG_CREATE side-doors. LSN-017-5-UI-shell-negative-cluster: TermDetails confirms DataEntityDetails as SOLE platform-wide canonical. |
| adr-archaeologist (ADRs) | 160 → **163** | +3 (161-163: URL-backed search-session / per-source-column tsvector / recompute-don't-delta FTS) + 2 strengthened (ADR-089 UI-only-hide WithPermissions 6-sidecar; ADR-152 @ReactiveTransactional uniformity — TermService POSITIVE-COMMITMENT exemplar). 5 wisdom-test reclassifications → scopes. |
| adr-archaeologist (scopes) | 470 → **480** | +10 (471-480) + 2 strengthened (REFACTOR-229 WRITE-vs-READ disambiguation patch-scope tightened; REFACTOR-188 audit-silence ENUM-ROOTED at ActivityEventTypeDto.java:3-31 — 9-SIDECAR). 2 HIGH + 8 MEDIUM new. |
| doc-gap-finder | 202 → **210** | +8 (203-210) + 3 META strengthened (DOC-082 + DOC-083 + DOC-099). 2 HIGH (term-to-term unguarded; TermDefinition stored-XSS) + 6 MEDIUM. |
| test-coverage-mapper | 714 → **724 indexed** | +10 (718-727) + 7 strengthened + 1 SUPERSEDED (TEST-538). **4 NEW CRITICAL** (TermController term-to-term no-authz; TermServiceImpl stored-XSS in unhandled-staging; TermDefinition rehype-raw XSS; F-006 audit-silence ENUM-ROOTED on TermController.deleteTerm). 121 CRITICAL total. |
| feature-flow-builder | 23 → **24 features** (+1 new, +3 extended) | **F-024 / P-06:F-002 Term Search & Browse — Dictionary tab** (NEW — distinct from F-002 Term-to-Entity Linkage; sibling capability per system-mission.md P-06 sub-features). F-002 + F-004 + F-006 extended. F-002 achieves **FULL 5-LAYER pillar chain closure**. 18 new drift facets. |

### Coverage state after batch U

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 114 | **28.9%** (was 27.8%) |
| Effective coverage | 215 | **54.4%** (was 52.9%) |
| Features discovered | 24 (was 23) | +1 NEW (F-024 P-06:F-002 Term Search & Browse) |
| Total test-gaps | 724 indexed | 121 CRITICAL (was 117) |

### Cross-batch triangulation deltas

- **P-06 Data Glossary CLOSED at 5-LAYER** (controller + service + UI list + UI detail + FTS write repo)
- **F-002 FULL pillar chain** (was repository-only at batch N; now 5-layer with this batch)
- **F-004 stored-XSS surface count**: 2 → **3** (data-entity description + dataset-field description + term-definition — all unsanitized markdown via rehype-raw)
- **F-006 audit-silence pattern**: 10-SIDECAR → **ENUM-ROOTED at ActivityEventTypeDto** (deeper than schema-rooted; 4-tier remediation required: schema migration + enum extension + ActivityHandler implementations + ~25 service-method annotations)
- **SecurityConstants wiring failures**: 3 distinct cases (REFACTOR-217 path-mismatch + batch-K alert-status mis-permission + term-to-term no-rule) — startup-time invariant scanner case strengthened
- **LSN-017 negative cluster**: 5 UI shells confirmed (PolicyList + RolesList + OwnersList + CollectorsList + TermDetails) — **DataEntityDetails is the SOLE platform-wide canonical instance** of within-component doubling
- **Cross-component fetch duplication**: NEW sibling-class to LSN-017 (within-component → cross-component multiplication)
- **REFACTOR-229 patch scope tightened**: write-side stores safely tokenized; read-side detonates — fix at JooqFTSHelper.tsQuery covers all current + future consumers

### Follow-ups (logged, not blocking)

- RelationshipController DEFERRED from batch T still pending (P-02 first sidecar)
- 2 broken-yaml from batches P+S persist; 3 from earlier; quarantined
- 207 detail-without-index in refactoring-scopes; 82 in implicit-adrs; 30+4 in doc-gaps
- Coherence-sweep candidates: 43k (T) → 44.6k (U)
- F-001 + F-003 merge candidate still maintainer-pending


## Batch 2026-05-20-V — P-02/P-03/P-04 surfaces: **P-02 + P-03 ANCHORED; F-027 LSN-001 canonical surface; F-004 5-SURFACE**

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 114 prior + 5 new = **119 total**; 0 deferred
- **Theme**: P-02 + P-03 + P-04 controller surfaces + F-019 association-request + F-004 attachment surface

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `QueryExampleController` | P-02 | 13 endpoints; **F-004 4th XSS surface CONFIRMED** (definition + query rendered via MDEditor.Markdown in 2 UI sites, no rehype-sanitize). 3-of-13 RBAC gating asymmetry. Permission grid splits across 3 controllers. Live docs reference Name field that doesn't exist. |
| `ReferenceDataController` | P-03 | **P-03 Master Data Management FIRST direct sidecar**. LookupCharValidator returns verbatim row values (F-004 sibling). buildTableName collision risk. **Cascade NOT enforced via FK** — parent DataEntity delete orphans lookup_tables_schema.n_*. Two-transaction split catalog DELETE + DDL DROP. updateLookupTableField discards lookupTableId (auth-scope bypass). Rename via ALTER TABLE breaks downstream SQL. |
| `OwnerAssociationRequestController` | P-09+P-08 | **REFACTOR-427 orphans CONFIRMED at controller layer**. DIRECT_OWNER_SYNC + getOrCreate compose privilege-escalation chain (HIGH). 3 endpoints NO SecurityRule. **POSITIVE-half of F-006 audit asymmetry** — this controller HAS a dedicated audit table (owner_association_request_activity). BIFURCATES F-006. |
| `DataEntityAttachmentController` | P-08 | **LSN-001 STRENGTHENS** with NEW in-code residue: CHUNK_BASE_PATH `/tmp/odd/chunks` hardcoded **regardless of attachment.storage mode** — REMOTE deployments still lose in-flight chunked uploads on container restart. **LSN-002 minio-region-unset CONFIRMED at MinioConfig.java:19-25**. Cross-entity escalation via discarded URL dataEntityId. Filename path-traversal + CRLF injection. |
| `DatasetFieldController` | P-01+P-05 | **3 SUPERSEDES (LSN-018 Rule 6 production fire)**: (1) batch-R DATASET_FIELD_DESCRIPTION_UPDATED never emitted = WRONG (@ActivityLog at DatasetFieldInternalInformationServiceImpl.java:28); (2) batch-R 200-on-missing-id = WRONG (.switchIfEmpty → 404); (3) F-006 audit-silence should NOT include dataset-field. **NEW: 2 SecurityConstants wiring bugs at lines 295-299** (alerts-status copy-paste + DATA_ENTITY_ADD_TERM mis-used for /terms POST) — strengthens SecurityConstants invariant scanner case to 5 failures. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 328 → **348 concepts** | +20 new (3 entities + 4 operations + 13 invariants) + 5 strengthened + 3 SUPERSEDED. New: CHUNK_BASE_PATH ephemeral residue, F-006 BIFURCATION, SecurityConstants 5-failure family, F-004 4th+5th surfaces, lookup-table rename breaks downstream SQL, filename-path-traversal+CRLF, DIRECT_OWNER_SYNC privilege escalation. |
| adr-archaeologist (ADRs) | 163 → **168** | +5 (164-168) + 3 strengthened (ADR-001 24-sidecar, ADR-002 23-sidecar, ADR-146). New: storage @ConditionalOnProperty, 3-step chunked upload, LookupTable physical Postgres, OwnerAssociationRequest dedicated audit, three-tier RBAC for LookupTable. |
| adr-archaeologist (scopes) | 480 → **486** | +6 (481-486) + 2 strengthened. NEW HIGH: chunk-staging /tmp residue; SecurityConstants wiring 295-299; DIRECT_OWNER_SYNC escalation chain; filename path-traversal CRLF. 3 SUPERSEDES applied. |
| doc-gap-finder | 210 → **217** | +7 (211-217) + 1 SUPERSEDED (DOC-195 positive corroboration on DATASET_FIELD_DESCRIPTION_UPDATED). 4 HIGH + 3 MEDIUM. DOC-211 QueryExample Name field doesn't exist (DOC-099 6th failure shape). DOC-217 F-004 5th surface. |
| test-coverage-mapper | 724 → **745 indexed** | +21 (728-748) + 1 strengthened + 2 SUPERSEDED (TEST-666 + TEST-679 batch-R DatasetField claims). **+4 CRITICAL → 125 CRITICAL**. Sites: TEST-728 SecurityConstants wiring; TEST for DIRECT_OWNER_SYNC escalation; TEST for chunk-staging residue; TEST for cross-entity escalation via discarded URL dataEntityId. |
| feature-flow-builder | 24 → **27 features** (+3 new, +4 extended) | **F-025 / P-02:F-001 Query Examples** (NEW — P-02 ANCHORED). **F-026 / P-03:F-001 Lookup Tables** (NEW — P-03 ANCHORED). **F-027 / P-08:F-005 Attachment Lifecycle** (NEW — LSN-001 canonical surface). F-019 + F-004 + F-006 + F-005 extended. F-004 stored-XSS now 5-SURFACE. F-006 BIFURCATED into POSITIVE/NEGATIVE halves. |

### Coverage state after batch V

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 119 | **30.1%** (was 28.9%) |
| Effective coverage | 257 | **65.1%** (was 54.4%) — **+10.7pp jump from 3 new features extending feature-flow reach** |
| Features discovered | 27 (was 24) | **+3 NEW** (F-025 P-02 + F-026 P-03 + F-027 P-08:F-005) |
| Total test-gaps | 745 indexed | 125 CRITICAL (was 121) |

### Cross-batch triangulation deltas

- **P-02 Data Modelling ANCHORED** with F-025 Query Examples (was empty)
- **P-03 Master Data Management ANCHORED** with F-026 Lookup Tables (was empty)
- **All 11 pillars now have at least one anchored feature** (after batch T added P-04)
- **F-004 stored-XSS surface count: 4 → 5** (entity desc + dataset-field desc + term-def + query-example + lookup-table)
- **F-006 audit-silence BIFURCATED** into POSITIVE-half (OwnerAssociationRequest dedicated audit table) vs NEGATIVE-half (RBAC mutations) — corrects scope; DatasetField is NOT in negative half (3 SUPERSEDES applied)
- **SecurityConstants wiring failures: 3 → 5** (alerts-status copy-paste + DATA_ENTITY_ADD_TERM mis-used + term-to-term no-rule + REFACTOR-217 path-mismatch + initial alert-status mis-permission = 5)
- **LSN-001 IN-CODE RESIDUE**: CHUNK_BASE_PATH `/tmp/odd/chunks` hardcoded — REMOTE deployments still lose chunked-upload state on container restart (doc-side healthy; code-side residue)
- **LSN-002 minio-region-unset PRIMARY-SOURCE CONFIRMED** at MinioConfig.java:19-25
- **getOrCreate side-door family**: now Owner + Term + Tag + Namespace + Datasource = 5 surfaces
- **3 SUPERSEDES applied** (LSN-018 Rule 6 production fire — strongest correction batch since batch O)

### Follow-ups (logged, not blocking)

- RelationshipController DEFERRED from batch T still pending (P-02 first sidecar — partially closed via F-025 minting from this batch's QueryExample anchoring; P-02 architecturally anchored even if RelationshipController not enriched)
- 2 broken-yaml from batches P+S persist; 3 from earlier
- 214 detail-without-index in refactoring-scopes; 90 in implicit-adrs; 37+4 in doc-gaps
- Coherence-sweep candidates: 44.6k (U) → 47.7k (V)


## Batch 2026-05-20-W — Management/admin tier: DataSource + Collector + Namespace + Tag + Dataset controllers (5/5)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 119 prior + 5 new = **124 total**; 0 deferred
- **Theme**: Management/admin tier — closes F-020 controller half, F-018 controller half, F-008 5-vertex triangulation, F-005 column-level read-side, namespace as new pillar feature

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `DataSourceController` | P-08+P-10 | 5-endpoint UI admin **DISJOINT from S2S** createDataSourceEntity (separate auth + service + mutation semantics). **5th vertex of ADR-142/143 triangulation closed**. NEW: implicit namespace creation bypasses NAMESPACE_CREATE; regenerateDataSourceToken missing @ReactiveTransactional; 201-vs-200 status drift. |
| `CollectorController` | P-08+P-10 | **End-to-end plaintext token chain CLOSED at controller tier** (register POST + regenerate-token PUT both return 40-char plaintext via showToken=true). GET unrestricted. **Orphan TOKEN row on delete CONFIRMED**. Zero audit logging. |
| `NamespaceController` | P-08 | **NAMESPACE_CREATE side-door confirmed at 4 sister services** (TermService + DataSourceService + CollectorService + DataEntityGroupService — 8 call sites bypass via getOrCreate). Partial-unique-index allows soft-delete reincarnation. TOCTOU between cascade-check and concurrent referent insert. |
| `TagController` | P-01+P-08 | REFACTOR-223 side-door is at SERVICE LAYER (TagServiceImpl.getOrCreateTagsByName invoked from 5 paths). This controller is the GATED path. **deleteTag cascade ASYMMETRIC** — cleans tag_to_data_entity + tag_to_term but NOT tag_to_dataset_field. getPopularTagList open-read + per-entity-tag-editors compose to write+read directory bypass without TAG_*. |
| `DatasetController` | P-01+P-05 | **HIGH: per-entity-scoping BYPASS** — dataEntityId URL parameter NOT enforced against version_id at SQL (ReactiveDatasetVersionRepositoryImpl filters on DATASET_VERSION.ID only). 4 endpoints NO SecurityRule. F-004 verbatim-description read-side surface at column level. Undocumented `dataSet` OpenAPI tag. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 348 → **367 concepts** | +19 new (13 invariants + 6 operations) + 8 strengthened. End-to-end plaintext token chain CLOSED across 5 tiers. NAMESPACE_CREATE side-door 4-sister closure. DatasetController scoping-bypass invariant. deleteTag asymmetric cascade. Soft-delete reincarnation general pattern. |
| adr-archaeologist (ADRs) | 168 → **171** | +3 (169-171) + 6 strengthened. 9 wisdom-test reclassifications → scopes. |
| adr-archaeologist (scopes) | 486 → **495** | +9 (487-495) + 4 strengthened. 4 HIGH new (NAMESPACE_CREATE side-door / deleteTag cascade asymmetric / getPopularTagList directory bypass / DatasetController per-entity-scoping bypass). |
| doc-gap-finder | 217 → **217 (in-memory)** | Reducer returned findings inline rather than writing files this batch (will reconcile in next batch). 7 candidate findings noted (DOC-218..224 candidates: F-020 docs split, datasource sub-page broken-URL, NAMESPACE side-door undocumented, getPopularTagList asymmetry, etc.). |
| test-coverage-mapper | 745 → **770 indexed** | +25 (749-773) + 1 strengthened (TEST-726). **5 NEW CRITICAL** → 130 CRITICAL. CRITICAL: regenerateDataSourceToken non-transactional, DataSource end-to-end plaintext token, Collector end-to-end plaintext token, DatasetController per-entity-scoping bypass at by-version + diff. |
| feature-flow-builder | 27 → **28 features** (+1 new, +4 extended) | **F-028 / P-08:F-006 Namespace Lifecycle Management** (NEW — distinct independent capability per pillar's sub-feature seed). F-020 + F-008 + F-018 + F-005 + F-004 extended. 24 new drift facets. |

### Coverage state after batch W

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 124 | **31.4%** (was 30.1%) |
| Effective coverage | 267 | **67.6%** (was 65.1%) |
| Features discovered | 28 (was 27) | +1 NEW (F-028 P-08:F-006 Namespace Lifecycle) |
| Total test-gaps | 770 indexed | 130 CRITICAL (was 125) |

### Cross-batch triangulation deltas

- **F-020 Collector Lifecycle** controller-tier closes end-to-end plaintext token chain (now 6-tier 5-controller picture)
- **F-018 Manual Object Tagging** controller-tier confirms side-door is SERVICE layer; introduces ASYMMETRIC cascade finding
- **F-008 Batch Ingestion** 5-vertex ADR-142/143 triangulation (UI admin counterfactual closes the picture)
- **NAMESPACE_CREATE side-door**: 4 sister services + 8 call sites → full side-door class confirmed
- **DatasetController per-entity-scoping bypass** — NEW HIGH class (dataEntityId URL parameter NOT enforced at SQL — by-version + diff endpoints)
- **deleteTag cascade asymmetric** — orphan tag_to_dataset_field invisible to reads (NEW HIGH bug)
- **End-to-end plaintext token chain** 6-tier: controller register + regenerate (THIS BATCH) + service + repo write + repo read + at-rest + UI render
- **Read-collaborative cross-owner enumeration**: 24 → **29 surfaces**

### Follow-ups (logged, not blocking)

- doc-gap-finder reducer returned findings inline (in-memory) rather than writing detail/ files; 7 candidate findings (DOC-218..224) noted in concept/scope evidence but NOT on disk as separate detail files — recover in next batch
- RelationshipController + DOC-216-batch-W-append still pending
- 2 broken-yaml from batches P+S persist; 3 from earlier
- 214 detail-without-index in refactoring-scopes; 90 in implicit-adrs; 37+4 in doc-gaps
- Coherence-sweep candidates: 47.7k (V) → 49.9k (W)


## Batch 2026-05-20-X — Config-properties sweep: LoginForm + Notification + Minio + Session + R2DBC (5/5; **LSN-002 PRIMARY SOURCE LOCKED**)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 124 prior + 5 new = **129 total**; 0 deferred
- **Theme**: Operator-config surface — auth-mode + notification + storage + session + DB config

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `LoginFormSecurityConfiguration` | P-09 | **LOAD-BEARING SECURITY**: AuthorizationCustomizer NOT wired (lines 55-57). **Every form-authenticated user is hard-coded ADMIN at line 81.** Policies/Permissions/Roles framework INERT. SECURITY_RULES bypassed. CSRF disabled. **REFACTOR-185 now 24-SIDECAR** (LOGIN_FORM facet). |
| `NotificationConfiguration` | P-07 | F-009 config-tier closure. **SMTP case-sensitivity trap at L63** ('smtp' lowercase code vs 'SMTP' uppercase docs — silent STARTTLS bypass). No URI scheme allowlist (SSRF class). |
| `MinioConfig` | P-08 | **LSN-002 PRIMARY SOURCE LOCKED at MinioConfig.java:21-24** (.endpoint + .credentials + .build; no .region(...)). @ConditionalOnProperty REMOTE opt-in. Gate-5 unset-parameter audit: 3 of 5 builder params caveat-defaulted. |
| `SessionConfiguration` | P-08 | **REFACTOR-419 cluster-fragility now 3-SIDECAR TRIANGULATION CLOSED** (controller + filter + config). IN_MEMORY default. spring.session.timeout=-1 makes housekeeping NO-OP. **Zero cookie-security-attribute config** (HttpOnly/Secure/SameSite). PostgreSQLSessionHousekeepingJob NO @SchedulerLock. |
| `R2DBCConfiguration` | P-08+P-03 | 6 beans (primary + custom). customConnectionPool SOLELY for Lookup Tables (P-03) with ?schema=lookup_tables_schema query-param injection. ALL 10 R2dbcProperties.Pool settings framework defaults (zero overrides). Plaintext creds + /actuator/env default exposure. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 367 → **375 concepts** | +8 new + 6 strengthened + 2 superseded (canonicalisation candidates promoted to invariants). NEW HIGH: login-form-admin-for-every-user; session-cookie-security-attributes-unset; spring-session-timeout-minus-one-housekeeping-noop; smtp-protocol-case-sensitivity-trap. STRENGTHENED: LSN-002 primary-source confirmed; REFACTOR-419 3-sidecar; REFACTOR-185 24-sidecar; provider-null bleed 5-vertex pentagon. |
| adr-archaeologist (ADRs) | 171 → **177** | +6 (172-177) + 2 strengthened. ADR-172 LOGIN_FORM-dev-demo HIGH; ADR-173..176 channel-presence/REMOTE-opt-in/3-provider-session/custom-R2DBC-pool MEDIUM; ADR-177 IN_MEMORY-default borderline. |
| adr-archaeologist (scopes) | 495 → **507** | +12 (496-507) + 5 strengthened. 4 HIGH: LOGIN_FORM ADMIN-for-all; cookie-security-attributes; spring.session.timeout=-1 housekeeping no-op; SMTP case-sensitivity. 5 MEDIUM. 3 LOW. |
| doc-gap-finder | 217 → **232** | +15 (218-232) + 5 META strengthened (DOC-082/006/038/053/197). 6 HIGH + 9 MEDIUM. **WROTE FILES** (recovered from batch W's in-memory miss). |
| test-coverage-mapper | 770 → **790 indexed** | +20 (774-793) + 10 strengthened. **5 NEW CRITICAL → 135 CRITICAL**: LOGIN_FORM admin-hardcode; SMTP case-sensitivity; LSN-002 region unset; cookie-security unset; auth-mode quartet RBAC contract. |
| feature-flow-builder | 28 → **28 features** (+0 new, +7 extended) | F-011 + F-009 + F-027 + F-008 + F-020 + F-010 + F-026 all extended. 26 new drift facets. Auth-mode quartet closed. REFACTOR-419 3-SIDECAR triangulation. |

### Coverage state after batch X

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 129 | **32.7%** (was 31.4%) |
| Effective coverage | 273 | **69.1%** (was 67.6%) |
| Features discovered | 28 (unchanged) | config-tier extends existing pillar features |
| Total test-gaps | 790 indexed | 135 CRITICAL (was 130) |

### Cross-batch triangulation deltas

- **LSN-002 PRIMARY SOURCE LOCKED** at MinioConfig.java:21-24 (Gate-5 unset-parameter audit canonical test case closed)
- **REFACTOR-419 cluster-fragility 3-SIDECAR TRIANGULATION** (controller + filter + config)
- **REFACTOR-185 DISABLED-mode bypass** now 24-SIDECAR (LOGIN_FORM facet — ADMIN-for-all is a second-mode bypass)
- **Provider-null cross-mode bleed**: 4-vertex → 5-vertex PENTAGON (auth-config layer root cause anchor added)
- **Auth-mode quartet picture CLOSED**: DISABLED + LOGIN_FORM + OAUTH2 + LDAP all have config sidecars
- **5 canonical "default ships operator-invisible failure" instances** (LOGIN_FORM-ADMIN / DISABLED-permitAll / MinIO-region-default / IN_MEMORY-session / spring.session.timeout=-1)
- **Coherence-sweep candidates**: 49.9k (W) → 53.1k (X)
- **Doc-gap recovery**: batch W's in-memory findings written to disk this batch

### Follow-ups (logged, not blocking)

- doc-gap-finder writing-files protocol RECOVERED (was in-memory only in batch W)
- 2 broken-yaml from batches P+S persist; 3 from earlier
- 214 detail-without-index in refactoring-scopes; 90 in implicit-adrs; 52+4 in doc-gaps (grew due to batch X writing append files but not index lines)
- RelationshipController still pending (P-02 first sidecar; now somewhat redundant since P-02 anchored via F-025)
- Coherence-sweep candidates linear growth continues


## Batch 2026-05-20-Y — F-009 Notification delivery 5-LAYER CLOSURE: Subscriber + 3 Senders + WAL Processor (5/5; 4 path corrections per LSN-018)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 129 prior + 5 new = **134 total**; 0 deferred
- **Theme**: F-009 P-07:F-002 WAL-driven Notification Delivery — was uncovered until batch X config-tier; this batch closes 5-LAYER full picture

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `NotificationSubscriber` | P-07 | F-009 PRIMARY SURFACE — leader-elected single-thread WAL consumer. 8 ADRs (pgoutput hardcoded / lazy-create-no-drop / leader-elected / LSN-advance-after-process at-least-once / single-table publication / polling not event-driven / 10s retry cadence). **HIGH: poison-message WAL replay loop**; **HIGH: WAL-retention disk-exhaustion under poison-replay**; **MEDIUM: publication-name DDL-injection at line 151**. NotificationSubscriberStarter no-thread-death-detection. |
| `EmailNotificationSender` | P-07 | F-009 Email channel. 6 ADRs (Freemarker template / per-recipient fail-stop / HTML-only / MimeMessage reuse / manual subject string-replace / ALERT_PATH hard-coded). **HIGH: RuntimeException bypass at L58-60 aborts cross-channel fan-out**. Live-doc bullets 2-3 promise owners+downstream BUT template OMITS them. No setFrom allowlist (spoofing). |
| `SlackNotificationSender` | P-07 | F-009 Slack channel. 4 ADRs + 10 corner cases. **HIGH: 429-Retry-After IGNORED**; **HIGH: mrkdwn-injection via AlertChunkPojo.description** (F-004 6th surface). No connect-timeout blocks subscriber. Unconditional cross-team broadcast. |
| `WebhookNotificationSender` | P-07 | F-009 generic webhook channel. **HIGH: NO HMAC / NO signature / NO retry / NO timeout (dispatcher stall)**; **HIGH: cross-tenant exposure** (one URL per deployment → every alert across every Owner). 200-only HTTP accept. Latent JsonProcessingException → RuntimeException extension. |
| `PostgresWALMessageProcessor` | P-07 | F-009 BRIDGE SPI interface (7 lines). **LOAD-BEARING structural root** of F-009's no-retry/no-DLQ/no-audit class (void return + unconditional LSN advance). **F-006 ENUM-ROOTED corroboration**: ActivityEventTypeDto has ZERO NOTIFICATION_* constants. Cross-channel RuntimeException abort undocumented. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 375 → **386 concepts** | +7 new + 4 strengthened. NEW HIGH: WAL-retention disk exhaustion / mrkdwn-injection / webhook no-HMAC / webhook cross-tenant exposure / cross-channel RuntimeException abort. STRENGTHENED: F-006 ENUM-ROOTED (12 categories with notification-delivery) / lazy-create-no-drop primary source / poison-message WAL replay loop 4-layer architecture / exception-type-asymmetry-notification-senders 4-part picture. |
| adr-archaeologist (ADRs) | 177 → **188** | +11 (178-188) + 1 strengthened (ADR-146 F-006 ENUM-ROOTED gains 3rd structural barrier via SPI seam). 6 HIGH + 4 MEDIUM + 1 LOW. |
| adr-archaeologist (scopes) | 507 → **538** | +31 (508-538) + 2 strengthened (REFACTOR-085 now 5-sidecar / REFACTOR-183 4-sidecar). 18 wisdom-test reclassifications. |
| doc-gap-finder | 232 → **237** | +5 (233-237) + 5 META strengthened (DOC-143/147/057/054/083). 3 HIGH + 2 MEDIUM. **WROTE FILES** (recovered from batch W's miss). |
| test-coverage-mapper | 790 → **811 indexed** | +21 (794-814) + 6 strengthened. **3 NEW CRITICAL → 138 CRITICAL**: poison-message WAL replay loop / WAL-retention disk-exhaustion / publication-name DDL-injection / Email RuntimeException cross-channel. |
| feature-flow-builder | 28 → **28 features** (+0 new, +4 extended) | F-009 5-LAYER CLOSURE (18 new drift facets). F-004 6-SURFACE (Slack mrkdwn cross-channel render). F-006 10-SIDECAR pattern. F-007 → F-009 downstream chain primary-source complete (forged AlertManager amplifies through F-009 with mrkdwn). |

### Coverage state after batch Y

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 134 | **33.9%** (was 32.7%) |
| Effective coverage | 278 | **70.4%** (was 69.1%) |
| Features discovered | 28 (unchanged) | F-009 EXTEND completes 5-LAYER closure |
| Total test-gaps | 811 indexed | 138 CRITICAL (was 135) |

### Cross-batch triangulation deltas

- **F-009 P-07:F-002 WAL-driven Notification Delivery CLOSED at 5-LAYER** (subscriber + processor + 3 senders + config-tier from batch X)
- **F-004 stored-XSS surface count: 5 → 6** (added Slack mrkdwn-injection via AlertChunkPojo.description — DIFFERENT rendering pipeline from web rehype-raw, requires SECOND fix-point)
- **F-006 audit-silence ENUM-ROOTED**: now 12 categories with notification-delivery (was 11); Layer 6 (SPI tier) added — 10-SIDECAR pattern
- **lazy-create-no-drop replication artefacts**: now 3-sidecar with primary source at NotificationSubscriber
- **F-007 → F-009 downstream chain PRIMARY-SOURCE COMPLETE**: forged AlertManager (batch P unauthenticated payload) amplifies through F-009 outbound to every channel with mrkdwn injection → 4-surface compound (F-007 → F-009 + F-004 → F-014 → F-022)
- **NotificationSubscriber thread-death-detection** absent — NotificationSubscriberStarter inert if thread dies
- **Cross-channel RuntimeException abort** — Email RuntimeException stops Slack + Webhook for the SAME alert (void-return root cause at SPI seam)
- **Coherence-sweep candidates**: 53.1k (X) → 55.1k (Y)

### Follow-ups (logged, not blocking)

- doc-gap-finder file-writing protocol RECOVERED (was in-memory in batch W; restored in X + Y)
- 2 broken-yaml from batches P+S persist; 3 from earlier
- 247 detail-without-index in refactoring-scopes; 102 in implicit-adrs; 57+4 in doc-gaps
- 5 probe candidates logged (P-W-1..P-W-5) — local docker-compose feasible (PG + WireMock + MailHog + injected ALERT row)


## Batch 2026-05-20-Z — P-11 Platform API closure: IngestionController methods + openapi.yaml + IngestionServiceImpl (5/5; retry after API 529 overload)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 134 prior + 5 new = **139 total**; 0 deferred; **retry #1 after API 529 overload on first attempt**
- **Theme**: P-11 Platform API & Developer Surface — THE LAST UNCOVERED PILLAR

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `IngestionController.getDataEntitiesByDEGOddrn` | P-10+P-11 | **GET /ingestion/entities/{degOddrn} is UNAUTHENTICATED in EVERY shipped deployment mode** — SecurityConstants.WHITELIST_PATHS exempts /ingestion/**, IngestionDataEntitiesFilter binds only POST /ingestion/entities, no @PreAuthorize anywhere. Sequential-ID enumeration. Cross-owner DEG-member enumeration. F-016 sibling empty-200-vs-404 contract asymmetry. **REFACTOR-185 17th sidecar**. |
| `IngestionController.postDataSetStatsList` | P-10 | Existing sidecar already enriched (verified intact). UNAUTHENTICATED stats write. Cross-dataset stats write (no parent-child consistency). TAG_CREATE-permission bypass via tagService.getOrCreateTagsByName side-effect. F-008 silent_destruction_replace_not_merge family. |
| `IngestionController.ingestMetrics` | P-07+P-10 | 4-line proxy → mirrored beans. **UNAUTHENTICATED in every deployment posture**. **INTERNAL_POSTGRES path has NO tenant_id column — tenant isolation NONEXISTENT on default backend**. Path correction: /ingestion/metric_sets → /ingestion/metrics. |
| `odd-platform-specification/openapi.yaml` | P-11 | **P-11 CLOSED at canonical contract layer**. 4212 + 2937 lines (spec + components). 194 operations across 35 tags. **ZERO securitySchemes / ZERO security: declarations** — spec doesn't model auth. **REFACTOR-217 path-mismatch confirmed**: spec at openapi.yaml:973,1042 is CORRECT, SecurityConstants is WRONG. 9+ status-code-drift instances enumerated. |
| `IngestionServiceImpl` | P-10 | **F-008 5-VERTEX closure** (filter + controller + service + repo + SQL). @ReactiveTransactional outer-txn binding 14-processor chain. Establisher-keyed lineage replacement. 3 NEW F-008 drift facet candidates. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 386 → **399 concepts** | +13 new (11 invariants + 1 entity + 1 canonicalisation candidate) + 3 strengthened + 1 SUPERSEDED (metrics-ingestion path /metric_sets→/metrics). NEW: 3-unauth-ingestion-endpoints; tenant_id absent INTERNAL_POSTGRES; openapi ZERO securitySchemes; platform-api-architectural-shape META; F-016 contract asymmetry; 3 IngestionServiceImpl drift facets. |
| adr-archaeologist (ADRs) | 188 → **192** | +4 (189-192) + 4 strengthened (ADR-001/003/026/027). ADR-189 OpenAPI-as-SoT / ADR-190 @ReactiveTransactional outer-txn / ADR-191 establisher-keyed lineage / ADR-192 S2S read AUTH-MODE-ORTHOGONAL (borderline_flag). |
| adr-archaeologist (scopes) | 538 → **545** | +7 (539-545) + 2 strengthened. 5 HIGH: 3 unauth endpoints / tenant_id absent / cross-dataset stats / TAG_CREATE bypass / spec ZERO securitySchemes. 2 MEDIUM. REFACTOR-185 → 17+18-SIDECAR with AUTH-MODE-ORTHOGONAL property. REFACTOR-217 direction-of-fix PINNED. |
| doc-gap-finder | 237 → **245** | +8 (238-245) + 7 META strengthened (DOC-001/009/018/038/074/099/107). 5 HIGH + 2 MEDIUM + 1 LOW. |
| test-coverage-mapper | 811 → **832 indexed** | +21 (815-835) + 7 strengthened. **5 NEW CRITICAL → 143 CRITICAL**: unauth-everywhere ingestion endpoints (3); tenant_id absent; cross-dataset stats write. |
| feature-flow-builder | 28 → **30 features** (+2 new, +3 extended) | **F-029 / P-11:F-001 Platform Public API Contract** (NEW — **CLOSES THE LAST UNCOVERED PILLAR**). **F-030 / P-07:F-005 Metrics Ingestion** (NEW). F-008 + F-016 + F-018 extended. 41 new drift facets. **ALL 11 PILLARS NOW HAVE MINTED FEATURES.** |

### Coverage state after batch Z

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 139 | **35.2%** (was 33.9%) |
| Effective coverage | 286 | **72.4%** (was 70.4%) |
| Features discovered | 30 (was 28) | **+2 NEW** (F-029 P-11:F-001 + F-030 P-07:F-005) |
| Total test-gaps | 832 indexed | 143 CRITICAL (was 138) |

### Cross-batch triangulation deltas

- **🎯 ALL 11 PILLARS NOW HAVE MINTED FEATURES** — P-11 closed by F-029
- **REFACTOR-185 DISABLED-mode bypass now 17+18-SIDECAR** with NEW AUTH-MODE-ORTHOGONAL read-side property
- **REFACTOR-217 path-mismatch direction-of-fix PINNED**: spec is correct, SecurityConstants is wrong
- **F-008 5-VERTEX closure** with IngestionServiceImpl service-tier vertex
- **3 unauthenticated /ingestion/** endpoints exposed in EVERY deployment mode (not just DISABLED — REFACTOR-185 extends to AUTH-MODE-ORTHOGONAL class)
- **Tenant isolation NONEXISTENT** on INTERNAL_POSTGRES metrics backend
- **OpenAPI spec ZERO securitySchemes** — platform's auth posture is illegible to its own contract
- **F-016 DEG-Anchored Lineage** sibling-endpoint contract asymmetry (empty-200 vs 404)
- **Concept-catalog SUPERSEDE** applied: metrics-ingestion path corrected /metric_sets → /metrics (LSN-018 Rule 6)
- **Coherence-sweep candidates**: 55.1k (Y) → 60.5k (Z)

### Follow-ups (logged, not blocking)

- 1 transient failure mode learned: API 529 overload mid-batch — retry-after-30s + retry-after-loop-tick both viable recovery paths
- 2 broken-yaml from batches P+S persist; 3 from earlier
- 256 detail-without-index in refactoring-scopes; 110 in implicit-adrs; 65+4 in doc-gaps
- ZA still pending — UI canonical surface (LSN-017 region)


## Batch 2026-05-20-ZA — UI canonical surface: DataEntityDetails + Lineage + Search + Directory + Overview (5/5; **FINAL batch of finalization sprint**)

- **Date**: 2026-05-20
- **Branch**: `feature/ontology-finalize-2026-05-20`
- **Substrate**: 139 prior + 5 new = **143 total**; 0 deferred
- **Theme**: UI canonical surface — closes LSN-017 PRIMARY-SOURCE LOCK + 9-shell negative cluster + F-001 inflation loop traced end-to-end

### Sidecars added (5)

| Sidecar | Pillar | Headline |
|---|---|---|
| `DataEntityDetails` | P-01 | **LSN-017 PRIMARY-SOURCE LOCKED** at lines 56-64 (re-verified — bug intact). F-001 chain formulation: hop-1 multiplicity=2 × hops 2-4=1 × +1 UPDATE = +2 per page-open. **SOLE platform-wide canonical instance** of response-derived-dep-array bug. |
| `Lineage` (substituted from phantom LineageInteractive) | P-05 | 5-line pure dispatcher (DEGLineage vs HierarchyLineage by isDEG). LSN-017 NOT applicable. F-005 + F-016 UI realization chokepoint. UI-layer defense-in-depth absent (chokepoint identified). |
| `Search` | P-01 | Catalog page root. 12 bugs. 3 LSN-017-class dep-array smells. **IDENTICAL broken-debouncer to TermSearch (clone propagation)**. **REFACTOR-229 now 3-invocation-site** (UI zero mitigation). REFACTOR-425 page-vs-count blind trust. Bearer-token UUID propagation. |
| `Directory` (corrected from Directory/Directory.tsx) | P-01 | F-023 P-01:F-007 Level-1 root. **LSN-017 NOT APPLICABLE** (TanStack useQuery NOT useEffect — explicit negative). **REFACTOR-024 now 4-tier UI confirmation**. F-023 facets 1+5 confirmed at UI tier. No authType gate (anonymous DISABLED reach). |
| `Overview` | P-01 | **OwnerAssociation mis-gating ROOT-CAUSE LOCKED at lines 25-27** (string-equality predicate; 4 failure scenarios documented). **LSN-017 ABSENT here** (no useEffect; only useMemo). **HOME-PAGE MOUNT for F-001 inflation loop**. Cross-owner enumeration via Popular column for authenticated users. 5 doc-drift findings. |

### Reducer diffs

| Reducer | Before → After | Highlights |
|---|---|---|
| concept-merger | 399 → **399 (UNCHANGED)** | **FAILED** (socket error) — concepts/ index not updated this batch. Backfill candidate for next batch. |
| adr-archaeologist (ADRs) | 192 → **197** | +5 (193-197) + 4 strengthened (ADR-003 / 114 / 122 / 185). |
| adr-archaeologist (scopes) | 545 → **551** | +6 (546-551) + 4 strengthened (REFACTOR-024 / 073 / 185 / 229). |
| doc-gap-finder | 245 → **254 (unique)** | +9 (246-254) + 5 META strengthened (DOC-082 / 083 / 099 / 130 / 137). |
| test-coverage-mapper | 832 → **851 indexed** | +19 (836-854) + 3 strengthened. **1 NEW CRITICAL → 144 CRITICAL**: LSN-017 view_count doubling regression-pin (TEST-836). |
| feature-flow-builder | 30 → **30 features** (+0 new, +8 extended) | F-001 + F-003 + F-005 + F-011 + F-016 + F-017 + F-018 + F-023 ALL extended. LSN-017 chain composition complete. 8-feature extension breadth. |

### Coverage state after batch ZA (FINAL SPRINT STATE)

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment | 143 | **36.2%** (was 35.2%) |
| Effective coverage | 295 | **74.7%** (was 72.4%) |
| Features discovered | 30 (unchanged) | UI extends existing pillar features |
| Total test-gaps | 851 indexed | 144 CRITICAL (was 143) |

### Sprint final summary (T-ZA, 8 batches on finalization branch)

| Metric | At sprint start (post-S) | Final (after ZA) | Delta |
|---|---|---|---|
| Direct sidecars | 106 / 395 (26.8%) | **143 / 395 (36.2%)** | +37 sidecars |
| Effective coverage | 198 / 395 (50.1%) | **295 / 395 (74.7%)** | +97 nodes / **+24.6pp** |
| Features | 21 | **30** | +9 features |
| Test-gaps | 631 | **851** | +220 test-gaps |
| CRITICAL test-gaps | 107 | **144** | +37 CRITICAL |
| Pillars anchored | 9/11 | **11/11** | P-06 + P-11 closed |

### Cross-batch triangulation deltas (cumulative)

- **🎯 ALL 11 PILLARS HAVE MINTED FEATURES** (P-06 closed batch U, P-11 closed batch Z)
- **LSN-017 PRIMARY-SOURCE LOCKED** at DataEntityDetails.tsx:56-64 with 9-shell negative cluster
- **REFACTOR-185 DISABLED-mode bypass**: 19-SIDECAR → 24-SIDECAR (LOGIN_FORM facet) → 17+18-SIDECAR AUTH-MODE-ORTHOGONAL (3 unauth /ingestion/** endpoints in EVERY mode)
- **REFACTOR-024 cross-owner enumeration family**: 4-tier UI confirmation
- **REFACTOR-229 FTS injection**: 3-invocation-site
- **REFACTOR-217 path-mismatch DIRECTION-OF-FIX PINNED** (spec correct, SecurityConstants wrong)
- **F-006 audit-silence pattern**: 6-SIDECAR → 7 → 8 → 9 → 10 → ENUM-ROOTED (notification-delivery extension)
- **F-004 stored-XSS surfaces**: 3 → 4 → 5 → 6 surfaces (data-entity / dataset-field / term / query-example / lookup-table / Slack-mrkdwn)
- **F-008 5-VERTEX closure** (filter + controller + service + repo + SQL)
- **F-009 5-LAYER closure** (subscriber + processor + 3 senders + config)
- **End-to-end plaintext collector token chain 6-tier**
- **LSN-001 + LSN-002 PRIMARY-SOURCED** (CHUNK_BASE_PATH residue + MinioConfig.java:21-24)
- **OwnerAssociation mis-gating ROOT-CAUSE LOCKED** at Overview.tsx:25-27
- **SecurityConstants wiring failures**: 5 total (3 path-mismatch + 2 mis-permission)

### Sprint methodology lessons reinforced

- **LSN-018 phantom-node prevention** fired across **6 batches** (Q + S + V + W + X + Y + ZA) — 18+ path corrections caught before file-analysers wasted cycles
- **LSN-018 Rule 6 supersedes**: 10+ across batch O / Q / V / Y / Z (canonical wrong-claim corrections)
- **API resilience**: 2 transient failures (rate-limit batch S; 529 overload batch Z) — both recovered via retry
- **Doc-gap reducer file-writing protocol**: lost in batch W (in-memory only) → recovered in batches X+Y+Z+ZA
- **concept-merger** socket-errored in batch ZA (final) — backfill candidate

### Follow-ups (logged, not blocking)

- concept-merger socket-failure backfill needed (batch ZA additions not in concepts/ index)
- 2 broken-yaml from batches P+S persist; 3 from earlier
- 256 detail-without-index in refactoring-scopes; 110 in implicit-adrs; 74+4 in doc-gaps
- F-001 + F-003 merge candidate still maintainer-pending


---

## Batch VAL-LSN-019 — 2026-05-20 — LSN-019 Stress Protocol validation canary

**The first run of file-analyser/0.4.0 (Rule 9 — Stress Protocol) on real production nodes.** The methodology change shipped 2026-05-20 was validated end-to-end: 3 sidecars enriched, 27 stress questions answered (22 STATIC-INFERRED + 3 PROBE-NEEDED → ~88% stress_verified_pct on the canary surface), 10 probe-skeletons emitted, all 5 reducers consumed the new sidecars correctly. The previously-wrong "orders by descending count" claim on `listMostPopular` is now corrected through the methodology — not by hand-patching.

### Sidecars (3)

- `odd-platform__java__TagController__controller-class__TagController.md` — REWRITE under file-analyser/0.4.0. Stress Protocol emitted 8 triggers / 27 questions / 26 STATIC-INFERRED + 1 PROBE-NEEDED. LSN-019 drift VERIFIED via JOOQ static trace; P-010 emitted (also referenced by Repository sidecar).
- `odd-platform__java__repository__reactive__repository__ReactiveTagRepositoryImpl.md` — REWRITE under file-analyser/0.4.0. Stress Protocol emitted 17 stress_findings across 5 categories. SMOKING-GUN trace: `paginate(homogeneousQuery, [OrderByField(TAG.ID, ASC)], (page-1)*size, size)` at `ReactiveTagRepositoryImpl.java:148` inside the CTE → the outer `cteSelect.orderBy(COUNT_FIELD.desc())` at line 158 only re-ranks the already-truncated window. Confidence: HIGH.
- `odd-platform__java__service__TagServiceImpl.md` — FRESH enrichment. Stress Protocol emitted 18 stress_findings across all categories. Service-tier auth verdict: **ZERO `@PreAuthorize` / ZERO `permissionService.*` / ZERO `SecurityContextHolder` reads** across all 9 public methods + 2 private helpers; 5 of 9 methods mint directory rows via side-doors bypassing `TAG_CREATE`. Emitted 8 narrative probe-skeletons in `.md` format (deviation from the canonical `P-NNN.yaml` shape — see Follow-ups).

### Probe-skeletons emitted (analyser-authored, Type-8 per APPROACH.md §7)

- `lineage/odd-platform/probes/P-010.yaml` — Repository smoking-gun probe (35 equally-tagged tags → assert response = set([1009..1038])). Canonical YAML format, runnable by probe-runner.
- `lineage/odd-platform/probes/P-LSN019-{listMostPopular-drift, updateRelations-external-preserve, divide-case-sensitive, getOrCreate-vs-getOrInject-toctou, deleteRelationsWithTerm-case, updateRelations-empty-deletes-all, service-auth-zero, createRelationsWithTerm-tx-propagation}.md` (8 files) — narrative skeletons emitted by the TagServiceImpl agent. Each carries concrete arrange/act/observe/assert content in markdown form. **Format-deviation follow-up:** convert to `P-NNN.yaml` shape so probe-runner can execute.

### Reducer outputs

- **concept-merger** — 7 new concept entries + 6 existing concepts strengthened + 4 concepts CORRECTED with `superseded_in_batch: VAL-LSN-019` (the wrong "popularity-ranked" framing on `get-popular-tag-list` operation + Tag entity is now corrected). New dedicated invariant `lsn-019-listmostpopular-name-vs-behavior-drift-pagination-precedes-ranking`. New canonicalisation candidate `top-tags-ui-label-vs-implementation-drift-operator-visible` (the operator-visible UI lie).
- **adr-archaeologist** — 2 new ADRs (ADR-CANDIDATE-193 `!external` guard pattern + ADR-CANDIDATE-194 dual-method create design) + 2 ADR strengthens (065, 067) + 9 new REFACTORs (REFACTOR-546..554). Headline: REFACTOR-546 (HIGH — name-behaviour-drift, LSN-019 listMostPopular) + REFACTOR-547 (HIGH — missing-authz-gate, service-tier zero-auth) + REFACTOR-552 (size-limit-silent-trunc).
- **doc-gap-finder** — 2 new DOC-GAPs (DOC-GAP-255 OpenAPI-spec drift + DOC-GAP-256 published-docs propagation across 3 live pages) + 3 existing DOC-GAPs strengthened. WebFetch SUCCEEDED on `/features/data-discovery/tagging`, `/features/data-discovery/catalog-overview`, `/features/data-discovery` (status 200).
- **test-coverage-mapper** — 13 new TEST-GAPs (TEST-GAP-855..867); 2 CRITICAL + 6 HIGH + 5 MEDIUM. Headline: TEST-GAP-855 (CRITICAL — repository-tier listMostPopular drift) + TEST-GAP-856 (CRITICAL — HTTP-boundary sister via WebTestClient) + TEST-GAP-867 (HIGH — tie-break-absence at equal counts).
- **feature-flow-builder** — F-018 Manual Object Tagging extended with 5 net-new drift_facets + 6 strengthens + 1 supersedes (batch-W TagController "orders by descending count" mistranscription superseded). Headline: F-018-DRIFT-LSN019-listMostPopular-ranking codifies the smoking-gun trace.

### Coverage (the honest axes, post-rev-4)

Static enrichment coverage (vanity, kept for trend continuity):
- nodes_with_sidecar: 146 / 395 = **37.0%** direct (+1 vs ZA — 3 sidecars; 2 rewrites + 1 new)
- effective: 295+ / 395 = **74.7%+** (same; F-018 already touched these nodes via prior batches)

**Stress Protocol coverage** (the rev-4 honest axis):
- stress_questions_total: **25** (TagController + Repository + Service contribute 8 + 9 + 8 = 25 questions; pre-Rule-9 sidecars contribute 0)
- stress_verified_pct: **88.0%** (22 STATIC-INFERRED + 0 PROBE-VERIFIED out of 25)
- stress_unanswered_pct: **12.0%** (3 PROBE-NEEDED; will flip to PROBE-VERIFIED when probe-runner consumes the analyser-emitted probes)
- sidecars_with_stress_section: 3 / 146 = **2.1%** (the canary trio)
- sidecars_pre_stress_protocol: 143 / 146 = **97.9%** (awaiting backfill)

### Coherence sweep

`state/coherence-sweep-batch-VAL-LSN-019.md` — 67,718 raw anchor-overlap candidates from a registry of 1281+ artefacts. Top candidate (F-002 ↔ TEST-GAP-725 about ActivityEventTypeDto.java:3-31) is unrelated to the canary batch — pre-existing noise. The batch's own artefacts (REFACTOR-546..554, TEST-GAP-855..867, DOC-GAP-255..256, the F-018 drift_facets) cross-reference each other and LSN-019 consistently; no new contradictions surfaced.

### What was validated

The Stress Protocol mechanically generated questions that the prior file-analyser/0.3.0 never asked:
- "Method name `listMostPopular` promises popularity ordering. Does the SQL deliver it? Trace the JOOQ chain end-to-end." → STATIC-INFERRED trace caught the paginate-inside-CTE pattern at line 148.
- "What does the operator see when 35 tags are equally popular?" → PROBE-NEEDED, P-010 emitted with concrete fixture and assertion.
- "What does TagServiceImpl return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?" → STATIC-INFERRED: identical (zero `@PreAuthorize`, zero permissionService calls → auth lives at controller perimeter only).

Each of these would have been a maintainer's empirical-test discovery under the old methodology (the LSN-019 incident itself was the canonical example). Now they are autonomous emit-time findings.

### Follow-ups

- **8 narrative probe-skeletons in .md format** (P-LSN019-*.md emitted by TagServiceImpl agent) need structural conversion to canonical `P-NNN.yaml` format so probe-runner can execute. The content is concrete (arrange/act/observe/assert all present in prose); the work is reformatting. Either renumber to P-011..P-018 with YAML structure, or update probe-runner to accept the narrative shape — maintainer judgment.
- **Stress Protocol filename guardrail** — the file-analyser system prompt says "Pick the next free `P-NNN` by Glob/grep against the existing `probes/` directory" but did not strictly enforce filename pattern in the canary. Strengthen Rule 9 / workflow step 6.5 with an explicit `MUST match regex ^P-\\d{3}\\.yaml$` constraint and reject the sidecar if any probe-skeleton path violates it.
- **P-010 reference collision** — both TagController and Repository sidecars reference P-010; the actual file on disk is the Repository's version. Sidecars are internally consistent (both point at the same drift) but the methodology should clarify which agent owns the probe-ID allocation when multiple analysers fire in the same batch. (Likely fix: each analyser reserves IDs at the start of its run by appending an empty placeholder.)
- **Reducer prompt updates for stress_findings consumption** — current reducers consumed the new sidecars correctly via their normal sections; the explicit `stress_findings.name_behavior_pairs[].drift: DRIFT_NAME_VS_BEHAVIOR` channel into refactoring-scopes worked (adr-archaeologist surfaced REFACTOR-546). Make this explicit in the next-round update of `.claude/agents/adr-archaeologist.md` and `test-coverage-mapper.md`.
- **143-sidecar backfill** — queued as a future batch theme. Stress Protocol coverage starts at 2.1% sidecar-adoption; backfilling the existing pile is the path to full rev-4 compliance.
- **3 new broken-yaml-pending-fix files** (from concept-merger output containing backticks in non-block-scalar contexts). Preserved per SKILL phase 3 step 8; recoverable next batch when the reducer prompt's YAML-safe rule applies.
- **265 detail-without-index in refactoring-scopes / 114 in implicit-adrs / 76+4 in doc-gaps** — known pre-existing reducer noise, not a regression from this batch.

---

## Batch X-TAGGING (2026-05-21) — full tagging-surface coverage

A maintainer-directed batch (not a `sprint-themes.yaml` pick) to fully cover the **tagging** functionality, scoped with the new graph query layer.

### Scope (via the graph query layer)

The tag surface was partially enriched — `TagController` (class), `TagServiceImpl`, `ReactiveTagRepositoryImpl`, `createDataEntityTagsRelations`, and ~12 tag concepts already existed. A catalog query over `nodes.jsonl` + `understanding/` found the gap: **7 un-enriched tag-surface nodes** — the four `TagController` methods (createTag / deleteTag / getPopularTagList / updateTag), `TermController.createTermTagsRelations`, `DatasetFieldController.updateDatasetFieldTags`, and the `openapi-tag:tag` rollup.

### Phase 1 — enrichment

7 file-analyser subagents (one socket-failed mid-run, retried clean) → 7 new sidecars, 9 probe-skeletons (P-025..P-033). Headline findings:
- **getPopularTagList** is misnamed at all three layers — the SQL truncates by `TAG.ID ASC` before counting, returning the OLDEST `size` tags, not the most popular (LSN-019; pinned by P-010). No `SecurityRule` → any authenticated user enumerates the whole global tag directory.
- **deleteTag** is asymmetric — soft-deletes the tag row, hard-deletes only 2 of 3 relation tables (`tag_to_dataset_field` orphaned), refreshes 1 FTS vector vs update's 3, and that single refresh runs *after* its source rows are deleted.
- **createTag / createTermTagsRelations / updateDatasetFieldTags** auto-create global tag rows, side-dooring past the MANAGEMENT-scoped `TAG_CREATE` permission.
- **updateDatasetFieldTags** INSERTs the relation with `origin` unset, relying on the DB column default — possibly dead for any non-empty payload (P-030).
- createTag / updateTag carry a 200-vs-201 status-code drift.

### Phase 2 — reducers (5, parallel)

- concept-merger: 6 new concepts (4 operations + 2 invariants) + 4 strengthened.
- adr-archaeologist: 4 ADR candidates (ADR-CANDIDATE-203..206) + 9 strengthened; 12 refactoring scopes (REFACTOR-487..498, 2 HIGH) + 2 strengthened.
- doc-gap-finder: 1 new (DOC-GAP-260) + 6 strengthened.
- test-coverage-mapper: 15 new TEST-GAPs (TEST-GAP-883..897 — 1 CRITICAL, 9 HIGH) + 5 strengthened.
- feature-flow-builder: F-018 (Manual Object Tagging) recomposed — +7 contributing nodes, +11 drift facets, +7 strengthens.

### Phase 3 — merge

`yaml_safe_fix.py` then `rebuild_indexes.py all` — the YAML indexes (test-map 894, concepts 421, feature-flows 30) regenerated cleanly from `detail/`. `coverage.py` refreshed `manifest.yaml`.

### Follow-ups

- **Markdown-index merge deferred.** The implicit-adrs / refactoring-scopes / doc-gaps `index.md` headline merge is left as `index-batch-X-TAGGING-append` files (the rev-2 append-file convention). `rebuild_indexes.py` only *verifies* the markdown indexes (too prose-heavy to rebuild blindly); the drift is systemic and pre-existing (135 / 305 / 93 detail-without-index across the three). A markdown-index reconciliation tool is the proper fix — tracked, not this batch.
- **3 `likely` Gate-9 warnings** in createTermTagsRelations + 2 sibling sidecars — the file-analysers documented each as honest-uncertainty paired with a probe (probe-needed resolution), not lazy hedging. `validate-sidecar`: 7 ok, 0 failed.
- **Pre-existing broken YAML** — `feature-reflections/detail/F-021.yaml`, `test-map/detail/TEST-GAP-363.yaml`, `TEST-GAP-687.yaml` + 5 concept files remain `yaml_safe_fix`-unfixable (backed up). Not a regression from this batch.
- **Probe-id collision** — 7 parallel analysers raced on `P-NNN` allocation; the openapi-tag analyser's placeholder was renumbered to P-031, and P-027's broken YAML was auto-fixed. The known fix (analysers reserve ids up-front) is already logged from the VAL-LSN-019 batch.


## Batch 2026-05-21-ZB — DataSource controller method surface (5/5) — method-level deepening of the batch-W class sidecar

- **Date**: 2026-05-21
- **Branch**: `feature/ontology-batch-2026-05-21` (fresh branch off `main` — the 2026-05-19 sprint branch `feature/ontology-finalize-2026-05-20` was merged to main via PR 145 with its theme queue fully drained; ZB is a maintainer-directed post-merge continuation batch)
- **Substrate**: 154 prior sidecars + 5 new = **159 total** (40.3% direct); 0 deferred, 0 file-analyser failures
- **Theme**: DataSourceController endpoint surface — the 5 controller-method nodes (`getDataSourceList` / `registerDataSource` / `updateDataSource` / `deleteDataSource` / `regenerateDataSourceToken`) left un-enriched when batch W enriched only the controller CLASS node. Established class→methods deepening pattern (cf. batch G DataEntity, batch L DataEntityController, batch X-TAGGING).
- **Driver**: maintainer ran `/next-batch` manually; the skill's queue was empty + its branch merged, so the batch was bootstrapped on a fresh branch + theme per the maintainer's "queue a new batch" choice.

### Sidecars added (5)

| Sidecar | Headline finding |
|---|---|
| `getDataSourceList` | `GET /api/datasources` has **NO SecurityRule** — any authenticated user lists the full data-source catalog. The list projection carries collector token material, masked API-side via `TokenMapper.mapValue` gated by `TokenDto.showToken` — `false` on the list path (`ReactiveDataSourceRepositoryImpl.java:167`), `true` on register/regenerate. A one-line flip at :167 would leak every plaintext token to every authenticated user. 30 stress questions; probes P-034..P-037. |
| `registerDataSource` | `POST /api/datasources` gated only by `DATA_SOURCE_CREATE`, yet the `namespace_name` field silently calls `namespaceService.getOrCreate` (`NamespaceServiceImpl.java:37-40`) — a least-privilege operator mints namespace directory rows **bypassing `NAMESPACE_CREATE`** (batch-W flag PRIMARY-SOURCE confirmed). Confirmed 200-not-201 status drift (`DataSourceController.java:35` vs `openapi.yaml:454`); plaintext token in the create response. 30 stress questions; probes P-038..P-041. |
| `updateDataSource` | Does NOT share batch-I's silent-UPDATE-on-missing pattern — `getDto(id).switchIfEmpty(NotFoundException)` + `getDto` filters `deleted_at IS NULL` → clean 404 on missing/soft-deleted. BUT a full-form **REPLACE-not-MERGE**: `MapperConfig` sets no `nullValuePropertyMappingStrategy`, so MapStruct's `SET_TO_NULL` default nulls any omitted field — editing only `name` silently wipes `description` + detaches the namespace. `DataSourceUpdateFormData` has exactly 3 fields (corrects the class sidecar's stale `connectionUrl` claim — that column was dropped by V0_0_71). 25 stress questions; probes P-042..P-044. |
| `deleteDataSource` | Guarded **SOFT-delete** that drifts from its name — BLOCKS with HTTP 400 if any live `data_entity` child exists (an actively-ingested source is effectively undeletable; collector re-ingest re-creates children; undocumented). On success it orphans the `token` row (no `deleted_at`, no GC — same pattern batch W confirmed for Collector delete) and leaves the FTS `search_entrypoint` vector uncleared. 16 stress questions; probes P-046..P-048. |
| `regenerateDataSourceToken` | **CROSS-BATCH CORRECTION** — confirmed primary-source MISSING `@ReactiveTransactional` (`DataSourceServiceImpl.java:99`, vs annotated siblings 52/69/86) but this is a LOW code-smell, NOT the atomicity bug batch-W's TEST-GAP-749 framed it as: the only DB write is a single atomic `UPDATE` and token generation is in-memory — no partial-write window. The genuine HIGH findings: destructive in-place rotation with no grace period (collector locked out the instant the UPDATE commits), plaintext token returned + stored unhashed, `RandomStringUtils` not `SecureRandom`, no audit log, `auth.type=DISABLED` bypass = credential-rotation-hijack. 22 stress questions; probes P-050..P-052. |

### Reducer diffs (all 5 ran; rev-7.1 graph-search dedup UNAVAILABLE — see Follow-ups #1 — all 5 fell back to grep dedup per `registry-search-spawn.md` §Fallback)

| Reducer | Before → After | Delta |
|---|---|---|
| concept-merger | 421 → **427 concepts** | +6 net-new (1 entity / 2 invariants / 3 operations) + 7 strengthened. New invariants: `datasource-update-replace-not-merge-mapstruct-set-to-null`, `datasource-delete-incomplete-cleanup-orphan-token-uncleared-fts`. `collector-token` strengthened — the DataSource token IS A Collector Token; API-side-vs-UI-side redaction ambiguity RESOLVED (API-side). |
| adr-archaeologist (ADRs) | **0 new ADR candidates** | 9 candidates failed the 3-question wisdom test → reclassified to scopes. 2 existing ADRs strengthened (ADR-CANDIDATE-017 token model, ADR-CANDIDATE-068 soft-delete taxonomy). |
| adr-archaeologist (scopes) | 532 → **543 scopes** | +11 (REFACTOR-581..591: 1 HIGH / 6 MEDIUM / 4 LOW) + 8 strengthened. HIGH REFACTOR-581: `deleteDataSource` orphans the plaintext-credential `token` row. |
| doc-gap-finder | 266 → **268 findings** | +2 (DOC-GAP-261 delete-semantics undocumented HIGH; DOC-GAP-262 namespace-bypass undocumented MEDIUM) + 3 strengthened (034 token-rotation, 074 201-vs-200, 022 unbounded `size`). 3 live URLs WebFetch-verified status 200. |
| test-coverage-mapper | 894 → **906 test-gaps** | +12 (TEST-GAP-898..909: 2 CRITICAL / 5 HIGH / 5 MEDIUM) + 7 strengthened (advisory — see Follow-ups #2). 0 sidecar-quality findings — all 5 sidecars' test-file claims Glob+Grep-verified. CRITICAL 898 (token-rotation binary-cutover), 899 (DISABLED-bypass credential-rotation-hijack). |
| feature-flow-builder | 30 → **31 features** | +1 — **F-031 / P-08:F-007 Data Source Lifecycle Management** (the 4th P-08 UI-admin lifecycle sibling, alongside F-019 Owner / F-020 Collector / F-028 Namespace). 19 drift facets; all 4 test-matrix cells GAP. F-031 is DISJOINT from F-008 (S2S `/ingestion/datasources`). |

### Coverage state after batch ZB

| Dimension | Count | of 395 |
|---|---|---|
| Direct enrichment (nodes with own sidecar) | 159 | **40.3%** (was 39.0%) |
| Effective coverage (touched by any feature-flow OR own sidecar) | 313 | **79.2%** (was 77.5%) |
| Features discovered | 31 | +1 (F-031) |
| Stress questions total | 379 | 335 STATIC-INFERRED / 32 PROBE-NEEDED / 12 REFERENCE |
| Stress verified % | 88.4% | (was 91.5% — the 5 ZB sidecars honestly emitted 20 new PROBE-NEEDED skeletons; not a regression) |
| Test-gaps | 906 | 151 CRITICAL / 294 HIGH / 338 MEDIUM / 123 LOW |

### Cross-batch triangulation deltas

- **DataSourceController is now fully covered** at class (batch W) + 5-method (batch ZB) granularity; F-031 composes the lifecycle.
- **End-to-end plaintext-token chain** — the DataSource token surface is structurally identical to the Collector token surface (batch W F-020): shared `TokenGeneratorImpl` + `ReactiveTokenRepositoryImpl` + `TokenMapper`. A `SecureRandom` / hash-at-rest / grace-period fix applies to both.
- **NAMESPACE_CREATE side-door** — `registerDataSource` + `updateDataSource` are the DataSource vertices of the side-door cluster (batch W: 4 sister services / 8 call sites). REFACTOR-584 + DOC-GAP-262.
- **CROSS-BATCH CORRECTION** — TEST-GAP-749's CRITICAL "split-state atomicity" framing of `regenerateDataSourceToken` is refuted by the method-level read; `state/coherence-conflicts-batch-ZB.md` SUPERSEDES-1.
- **`auth.type=DISABLED` bypass cluster** — +4 surfaces (the 4 DataSource mutating verbs); REFACTOR-185 cluster, DOC-GAP-082 META.

### Follow-ups (logged, not blocking)

1. **[HIGH — methodology] The rev-7.1 semantic-dedup cutover is non-functional — all 5 reducers fell back to grep dedup.** The 5 reducer agent defs (`.claude/agents/{concept-merger,adr-archaeologist,doc-gap-finder,test-coverage-mapper,feature-flow-builder}.md`) grant only `Read, Glob, Grep, Write` — NO `Bash`. The rev-7.1 cutover (commit `c255473`) routes dedup through `lineage-extractor graph-search` (a Bash CLI call) and updated `playbooks/registry-search-spawn.md` + the 5 agent defs' "Rule 7 / rev 7.1" prose — but did NOT add the `Bash` tool grant. Every reducer this batch hit the playbook's §Fallback path (`dedup_fallback: grep`). The batch is sound (grep dedup worked) but rev-7.1's promise — catching synonym-phrased duplicates by meaning — was not delivered. Fix: add `Bash` to the 5 reducer agent defs (precedent: `graph-retriever`, `probe-runner` carry scoped Bash) + the matching `lineage-extractor` permission allowlist. NOT auto-fixed this batch — granting Bash is a security-posture decision for the maintainer (cf. the deliberately-narrow `probe-runner` Bash scope).
2. **[MEDIUM — methodology] Reducers cannot do cross-file edits → 3 delta files carry un-applied reverse-back-links.** Same root cause as #1 (no `Edit` tool). `test-map/index.delta.batch-ZB.pending-merge.yaml` (7 strengthen annotations to TEST-GAP-749/750/751/752/753/098/659), `feature-flows/batch-ZB-delta.yaml` (F-008←F-031 reciprocal back-link + batch_discovery_delta + frontmatter), `concepts/concepts.delta.batch-ZB.pending-merge.yaml` (processed_node_ids + batch_history). The new detail files carry FORWARD cross-references inline; only reverse links are pending. Preserved on disk (NOT deleted — the skill's Phase-3 delete was skipped) for a reconciliation pass once #1 is fixed.
3. **[MEDIUM — maintainer-triage] TEST-GAP-749 stale CRITICAL framing.** `state/coherence-conflicts-batch-ZB.md` SUPERSEDES-1 — adr-archaeologist recommends CRITICAL→LOW (the atomicity premise is refuted); test-coverage-mapper's strengthen note argues keep-CRITICAL via the plaintext-token compound. The `TEST-GAP-749.yaml` detail file was NOT modified this batch (test-coverage-mapper has no Edit). Maintainer picks the disposition + corrects the behaviour text.
4. **[LOW — methodology-tool] `coherence_sweep.py` cross-product explosion.** 84575 candidates (49.9k at batch W) — an O(anchors²) cross-product dominated by single-anchor fan-outs (one `ActivityEventTypeDto` negation × hundreds of artefacts). Only 1 of 84575 touches a ZB artefact; the real ZB coherence finding was caught by the adr-archaeologist's per-finding semantic Rule-6 check, not the sweep. The sweep needs a fan-out cap or a top-tier ranking to stay useful.
5. **[LOW — pre-existing] Markdown-index systemic staleness.** `implicit-adrs` / `refactoring-scopes` / `doc-gaps` `index.md` frontmatter counts are stale by ~100s (`sidecar_count: 55` vs 159; `total_scopes: 227` vs 543); detail-without-index drift 135/305/93. Flagged across prior batches (X-TAGGING). ZB merged its own 13 new headlines (drift unchanged) but did not touch the stale frontmatter — a one-off markdown-index reconciliation tool is the proper fix.
6. **[LOW — pre-existing, not a ZB regression] Unfixable broken YAML.** `yaml_safe_fix.py` reports unfixable: probes P-011/012/013/015/017/024, `test-map/detail/TEST-GAP-363.yaml` + `TEST-GAP-687.yaml`, 5 concept detail files — all pre-existing (X-TAGGING flagged the same set). No ZB-authored file is broken (rebuild_indexes skipped 0 ZB files; F-031.yaml + all 12 TEST-GAP yaml parse clean).
7. **[LOW — methodology] `/next-batch` skill is stale post-merge.** Pre-flight hardcodes `feature/ontology-finalize-2026-05-20` (merged via PR 145 — a dead branch); `state/sprint-themes.yaml` `policy.push_target_branch` was likewise stale. The skill needs a branch argument or a current-sprint-branch pointer. (`policy.push_target_branch` updated to `feature/ontology-batch-2026-05-21` this batch.)
8. **[LOW — state hygiene] VAL-LSN-019-B stale lock.** `sprint-themes.yaml` shows theme VAL-LSN-019-B `in_progress` although the sprint branch's final commit `d495119` is titled "theme VAL-LSN-019-B done" and it is absent from `batch_history` — a Phase-4 flip that didn't land. Left as-is (pre-ZB; not on this branch's critical path).

### Next-batch planning notes

DataSourceController is now class+method complete. High-value fully-dark controller surfaces remaining (by un-enriched method count): `ReferenceDataController` (16), `QueryExampleController` (12), `OwnerAssociationRequestController` (7 — class enriched), `DataQualityController` (5), `NamespaceController` (5 — class enriched batch W). The token-rotation hardening surfaced here (REFACTOR-581 family) + the Collector twin is a coherent cross-controller REFACTOR sprint candidate.


## Batch 2026-05-22-ZC — Data Quality Dashboard (5/5) — the standalone `/data-quality` UI surface (P-04:F-002)

- **Date**: 2026-05-22 (Phase 1 + initial Phase 2 spawn) + 2026-05-25 (Phase 2 re-spawn after weekly-limit reset + Phase 3-4 close)
- **Branch**: `feature/ontology-batch-dq-dashboard` (fresh branch off `main` per the ZB post-merge-continuation precedent; `state/sprint-themes.yaml policy.push_target_branch` updated to match)
- **Substrate**: 164 prior sidecars + 5 new = **169 total** (42.8% direct); 0 deferred, 0 file-analyser failures
- **Theme**: ZC — Data Quality Dashboard / `/data-quality` UI page surface. Pillar feature P-04:F-002 "Quality Dashboard" had been *forward-declared* in the batch-T DataQualityController sidecar's `related_pillar_features` ("Quality Dashboard — sibling read surface (not this controller)") but had ZERO sidecars — a total coverage gap that `navigation/domains/data-quality.md` flagged explicitly ("Not documented: DQ dashboard page"). The 5 UI-axis nodes close that gap.
- **Driver**: maintainer-directed batch (`run ontology rebuild for batch that describes Data Quality Dashboard`); the sprint-themes queue had been drained at ZB. Theme ZC inserted + batch executed manually per the ZB precedent. Mid-Phase-2 the weekly Anthropic rate limit fired (5/5 reducers returned "you've hit your weekly limit · resets May 25, 11am Europe/Warsaw"); the 4 unfinished reducers were re-spawned post-reset on 2026-05-25 and completed cleanly. F-032 was the lone reducer that finished on the first attempt.

### Sidecars added (5)

| Sidecar | Headline finding |
|---|---|
| `DataQuality` (`/data-quality` route entry, 20 LOC) | **HIGH-confidence: `/data-quality` is mounted UNGATED at `App.tsx:73`** — bare `<Route>`, no `WithPermissionsProvider` wrapper, in direct contrast to `/lookup-tables` at `App.tsx:75-88` which IS wrapped. The top-bar "Data Quality" tab is also rendered unconditionally. Any authenticated user can open the catalog-wide aggregate quality view. The live `dashboard.md` doc page accurately describes the structure; every DQ doc page is SILENT on access control. 13 stress questions; probe P-090 pins whether the backend endpoint compensates. |
| `DataQualityContent` (the dashboard body, 147 LOC) | **HIGH-severity latent crash at line 48** — `palette.runStatus[status].color` throws an uncaught TypeError that blanks the *whole* dashboard if the backend ever returns a `DataEntityRunStatus` value outside the 6-member enum; the `?? palette.dataQualityDashboard.unknown` fallback is mis-written (it guards a missing `.color` on a *present* entry, never a missing entry) and is therefore DEAD. Plus 4 doc-drift findings: Table Health label drift (`success/failed/broken` in docs vs `Healthy/Warning/Error` in UI), breakdown ring 3-vs-6 statuses, silent on category-ordering + empty-state. 19 stress questions; probes P-100 (category ordering), P-101 (fetch multiplicity). |
| `DataQualityFilters` (the sticky-sidebar filter panel, 93 LOC) | **LSN-020 class headline** — the dashboard's "Title" sidebar filter: bare label `t('Title')` reads as "filter by dataset name", but `titleIds` / `deTitleIds` bind at the SQL layer to `OWNERSHIP.TITLE_ID` (ownership *role*, e.g. "Data Steward") — traced end-to-end DataQualityFilters → filtersAtom → DataQualityRunsController → DataQualityTestFiltersMapper → `ReactiveDataQualityRunsRepositoryImpl.java:301,309`. Secondary: the "Namespace" filter silently widens to datasource-inherited namespaces (`...:288-293`). 43 stress questions; 3 drift flags; probes P-110, P-111. |
| `DataQualityStore` (jotai atom store, 66 LOC) | **jotai-vs-redux verdict: implicit_adr, NOT a bug.** 26 files import `jotai` across 4 distinct feature areas (OwnerAssociations / DEGLineage / DatasetStructure ×2 / DataQuality), each with an identical `*Store/*Atoms.ts` + `*Provider.tsx`-wrapper pattern. The intent_anchor is decisive: `OwnerAssociationsAtomProvider` is byte-for-byte identical to `DataQualityAtomProvider` — a convention copied verbatim across features is intentional. **MEDIUM corner-case**: the dashboard filter store is per-Provider-mount, not global — navigating away unmounts the Provider and resets all 10 filters; only URL params persist. 11 stress questions; probe P-120. |
| `TestCategoryResults` (leaf result row, 48 LOC) | **Doc gap/drift pair** — the live `data-quality/dashboard` page documents the breakdown as 3 statuses ("passed / failed / skipped"), but code renders a tile for every value of the 6-valued `DataEntityRunStatus` enum (SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN); the per-category result row this component renders is undocumented entirely. **Undocumented cross-tier coupling**: column alignment depends on backend `DataQualityCategoryMapperImpl.addMissingStatuses` six-status guarantee that nothing in the UI asserts. 11 stress questions; 0 probes (all STATIC-INFERRED). |

### Reducer diffs (5/5 succeeded; **first batch with fully-functional rev-7.1 semantic graph-search dedup** — all 5 reducers used graph-search successfully on the warm graph, post-`dbbb9a9` cutover)

| Reducer | Before → After | Delta |
|---|---|---|
| concept-merger | 427 → **450 concepts** | +23 net-new (5 entities / 4 operations / 13 invariants / 1 audience) + 2 strengthened (`data-quality-test`, `odd-platform-ui-end-user`). New entities: Data Quality Dashboard, Data Quality Test Category, DataEntityRunStatus, Dashboard Filter Panel, Jotai Feature-Scoped Store. New audience: Data Quality Engineer (`canonical_in_docs: true`). |
| adr-archaeologist (ADRs) | 209 → **211 candidates** | +2 NEW (both `promote`): **ADR-CANDIDATE-207 (HIGH)** — jotai per-feature-store / two-store-system (redux global + jotai per-feature; intent: copied-verbatim Provider pattern across 4 feature areas); **ADR-CANDIDATE-208 (LOW)** — enum-order run-status tile re-sort for cross-panel comparability. + 2 STRENGTHENED: **ADR-CANDIDATE-003** (ungated `/data-quality` route = **14th read-collaborative-GET surface; 1st frontend-route-layer primary source**); **ADR-CANDIDATE-091** (Quality Dashboard URL filter round-trip = 2nd URL-source-of-truth surface, now cross-pillar P-04 + P-05). |
| adr-archaeologist (scopes) | 543 → **557 scopes** | +14 NEW (REFACTOR-592..605: 2 HIGH / 8 MEDIUM / 4 LOW). HIGH: REFACTOR-592 (line-48 status-color TypeError blanks whole dashboard), REFACTOR-593 (LSN-020 Title-filter binds OWNERSHIP.TITLE_ID). MEDIUM family: Namespace-widening, per-mount filter reset, no error UI, autocomplete no-debounce / first-30-only, no Apply gate (refetch per chip), alphabetical category panels, 9-facet consolidated doc-drift, zero test coverage META. 10 sidecar findings reclassified from `implicit_adrs`/`bugs_limitations` via the 3-question wisdom test. |
| doc-gap-finder | 268 → **278 findings** | +10 NEW (DOC-GAP-263..272: 2 HIGH / 6 MEDIUM / 2 LOW). HIGH: 263 access-control silence (every DQ page silent on `/data-quality` route auth), 264 LSN-020 Title-filter unwarned. MEDIUM: 265 3-vs-6 statuses doc drift, 266 Table Health vocab drift, 267 filter-sidebar interaction model undocumented, 268 per-category row undocumented, 271 OpenAPI 10-param no-description, 272 Namespace silent-widening. 2 live URLs WebFetch-verified status 200 (2026-05-25): `docs.opendatadiscovery.org/features/data-quality/dashboard` + `/features/data-quality`. |
| test-coverage-mapper | 909 → **927 test-gaps** | +18 NEW (TEST-GAP-910..927: 0 CRITICAL / 5 HIGH / 12 MEDIUM / 1 LOW). HIGH: 910 latent-crash (no test asserts dashboard survives unknown enum value), 911 `/data-quality` ungated-route auth posture, 912 LSN-020 Title-filter integration, 913 URL deep-link round-trip, **927 META — the ENTIRE `components/DataQuality/` subtree has ZERO test files** (21 source files / 0 tests; the whole odd-platform-ui has only 7 test files total). |
| feature-flow-builder | 31 → **32 features** | +1 — **F-032 / P-04:F-002 Catalog-wide Data Quality Dashboard** — the `/data-quality` page (Table Health / Monitored Tables / Test Results Breakdown rings + per-category cards + two-set filter sidebar). 6 contributing nodes (5 ZC sidecars + REFERENCE to `DataQualityRunsController`, unenriched). 15 drift facets. 4-cell test matrix all GAP. DISTINCT from F-022 (per-dataset Test reports tab + SLA badge). Cross-pillar: feeds_from P-10 (ingestion), feeds P-07 (alerting via `FAILED_DQ_TEST`). |

### Coverage state after batch ZC

| Dimension | Count | Of 395 (substrate) |
|---|---|---|
| Direct enrichment (own sidecar) | 169 | **42.8%** (was 40.3%) |
| Effective coverage (touched by any feature-flow OR own sidecar) | 324 | **82.0%** (was 79.2%) |
| Features discovered | 32 | +1 (F-032) |
| Concepts | 450 | +23 |
| ADR candidates | 211 | +2 |
| Refactoring scopes | 557 | +14 |
| Doc-gaps | 278 | +10 |
| Test-gaps | 927 | +18 (5 HIGH; META "entire UI subtree zero coverage") |
| Probes emitted (analyser-side) | 6 this batch (95 cumulative) | P-090, P-100, P-101, P-110, P-111, P-120 |
| Stress verified % | 87.4% | (was 88.4%; the 5 ZC sidecars honestly emitted 6 PROBE-NEEDED) |

### Cross-batch triangulation deltas

- **`/data-quality` route ungated** strengthens ADR-CANDIDATE-003 (read-collaborative-GET cluster) to a 14-sidecar primary source set — and is the **first frontend-route-layer primary source** for that cluster (the prior 13 were all backend GET endpoints). Same architectural posture, observed from a different layer.
- **REFACTOR-185 (DISABLED-mode bypass)** gains the `/data-quality` route — a new vertex in the cross-cutting cluster (was 24-sidecar via batch X; now extended to UI surfaces).
- **F-032 cross-pillar relationships**: feeds_from P-10 Integrations & Ingestion (DQ test runs arrive via S2S ingestion → `DataQualityRunsController` reads them); feeds P-07 Alerting & Notifications (failed DQ runs emit `FAILED_DQ_TEST` alerts via the AlertActionResolver chain — F-007). Reciprocal back-link to F-022 (sibling P-04 read surface — per-dataset Test reports + SLA badge) logged to `feature-flows/detail/batch-ZC-delta.yaml` (the Edit-less reducer cannot update both sides; ZB Follow-up #2 same root cause).
- **Methodology milestone**: this is the FIRST batch with **fully-functional rev-7.1 semantic graph-search dedup** — all 5 reducers ran graph-search successfully on the warm graph layer (3740 nodes, 4780 vectors, BAAI/bge-small-en-v1.5). The ZB cutover commit `dbbb9a9` added Bash to all 5 reducer agent defs; ZC is the first batch to exercise it end-to-end. ZB's Follow-up #1 (the rev-7.1 promise undelivered) is **CLOSED**.

### Follow-ups (logged, not blocking)

1. **[HIGH — security/maintainer-triage] `/data-quality` route ungated** — REFACTOR-592 + REFACTOR-593 + DOC-GAP-263 + DOC-GAP-264 + TEST-GAP-911. Wisdom-test verdict was *deliberate read-collaborative posture* (strengthening ADR-003), but the **maintainer must decide** whether to (a) keep the posture and document it explicitly (DOC-GAP-263 resolved), (b) gate the route with a new `DATA_QUALITY_READ`-class permission (refactor), or (c) gate only specific filter parameters (the LSN-020 Title-filter would otherwise leak ownership-role inference to any authenticated user). Cross-references the 4-auth-mode matrix (REFACTOR-185 — DISABLED-mode anonymous reach extends to `/data-quality`).
2. **[HIGH — code/maintainer-triage] Dashboard latent crash on out-of-enum status** — REFACTOR-592 + TEST-GAP-910. One-line fix at `DataQualityContent.tsx:48`: change `palette.runStatus[status].color` to `palette.runStatus[status]?.color ?? palette.dataQualityDashboard.unknown` (the optional-chain the `??` currently relies on is missing). The current dead-fallback gives the impression of defensive coding without the defence — a tired-maintainer trap. A unit test asserting the dashboard survives an unknown enum value would catch any future drift.
3. **[HIGH — maintainer-triage] LSN-020 Title-filter drift** — REFACTOR-593 + DOC-GAP-264 + TEST-GAP-912. The "Title" sidebar filter's UI label promises a name-filter; the SQL binds an ownership-role-filter. Two viable fixes: (a) rename the filter label to "Owner Role" (matches the implementation, breaks user mental-model continuity), (b) implement a true title/name filter and migrate the existing ownership-role filter to a separate "Owner Role" filter (matches user expectation, requires DTO + repository changes). LSN-020 case-law applies.
4. **[MEDIUM — maintainer-triage] DataQualityRunsController not enriched** — referenced by F-032 + DataQualityContent + DataQualityFilters sidecars as `unresolved: true`. The dashboard's SQL Category-F trace exits scope at this unenriched controller. Candidate next-batch target — a single-node enrichment resolves all three REFERENCEs at once.
5. **[MEDIUM — ZB-recurring] Reducer Edit-less delta files preserved** — `test-map/index.delta.batch-ZC.pending-merge.yaml` carries the cross-file strengthen annotations test-coverage-mapper could not apply (no Edit tool). Same root cause as ZB Follow-up #2; a reconciliation pass once the reducer-Edit gap is closed.
6. **[MEDIUM — methodology] Coherence sweep cross-product noise** — `coherence_sweep.py` reported 88747 candidates (ZB: 84575); the top candidates are pre-existing F-002 / `ActivityEventTypeDto` fan-out, NOT ZC findings. The sweep needs a fan-out cap / top-tier ranking; ZB Follow-up #4 unchanged.
7. **[LOW — pre-existing] Markdown-index systemic staleness** — `implicit-adrs` (137 detail-without-index), `refactoring-scopes` (319), `doc-gaps` (103) detail-without-index drift; same as ZB Follow-up #5. ZC merged its own 26 new headlines (drift unchanged) but did not touch the stale frontmatter — a one-off markdown-index reconciliation tool is the proper fix.
8. **[LOW — pre-existing, not a ZC regression] Unfixable broken YAML** — `yaml_safe_fix.py` reports unfixable: probes `P-011/012/013/015/017/024`, `test-map/detail/TEST-GAP-363.yaml` + `TEST-GAP-687.yaml`, 5 concept detail files (same set as ZB / X-TAGGING). No ZC-authored file is broken (all 23 new concept yamls + all 14 REFACTOR yamls + all 10 DOC-GAP md + all 18 TEST-GAP yamls + F-032.yaml + the 6 probe yamls parse clean).
9. **[INFO — capacity] Anthropic weekly-limit mid-batch fire (2026-05-22).** The 5/5 reducers all returned `you've hit your weekly limit · resets May 25, 11am Europe/Warsaw` after consuming 13-23 tool uses each on the first attempt. F-032.yaml + 1 concept detail file landed; the other 4 reducers re-spawned cleanly on 2026-05-25 post-reset. No state corruption; net cost of the limit-fire = 4 reducer cold-restarts (~50-150k tokens × 4). Surface: under capacity pressure, prefer reducer-resumption via SendMessage (not available in this environment but contractually supported by the Agent tool) over re-spawn. Recorded as informational; not a methodology gap.

### Next-batch planning notes

- **`DataQualityRunsController`** is the obvious next single-node enrichment (5 controller methods un-enriched; resolves 3 F-032 / Content / Filters REFERENCEs).
- **High-value fully-dark controller surfaces remaining** (un-enriched method count, post-ZC): `ReferenceDataController` (16), `QueryExampleController` (12), `OwnerAssociationRequestController` (7 — class enriched), `DataQualityController` (5 methods un-enriched), `NamespaceController` (5 methods un-enriched), `DataQualityRunsController` (5).
- **UI dark surfaces remaining** — the DataQuality batch demonstrated that UI-axis batches surface DIFFERENT classes of finding (route auth, latent UI crash, filter-name drift) than backend batches. Candidate UI batches: `LookupTables` (the gated counter-example to `/data-quality` — would close the auth-posture wisdom-test by showing both poles in one ontology view); the OwnerAssociations / DEGLineage / DatasetStructure jotai-using feature areas (each gets +1 verdict on ADR-CANDIDATE-207's pattern-evidence count).
- **Cross-cutting REFACTOR sprint candidates**: (1) the **UI test-pillar activation** (TEST-GAP-927 META — the whole odd-platform-ui has 7 test files; activating React Testing Library on the 5 ZC sidecars would be a coherent introduction batch); (2) the **read-collaborative posture documentation** (ADR-003 now has 14 sidecars and 1st frontend-route-layer evidence — promote to a real `adrs/` ADR + document the posture in `docs/architecture` so DOC-GAP-263 is resolved by docs alone rather than per-feature); (3) the **autocomplete debounce + pagination** family (REFACTOR-597/598/602 — same `MultipleFilterItemAutocomplete` component, shared fix).

---

## Batch ZD — 2026-05-25 (RBAC + Integration controllers)

**Sprint**: feature/ontology-finalize-2026-05-25 (sprint-close window — last day of the 2026-05-19 → 2026-05-25 ontology sprint).

**Sidecars added** (5/5): IdentityController + PermissionController + RoleController + PolicyController + IntegrationController — every uncovered RBAC/integration controller class-level node closed in one batch.

### Phase 1 — file-analyser results
| Node | Wall clock | Headline finding |
|---|---|---|
| IdentityController | ~12 min | DISABLED mode returns `username=admin` + ALL 70+ Permission enum values to ANONYMOUS callers — IDENTITY-LAYER FACET of REFACTOR-185 (17th sidecar); P-122/123/124 probes emitted |
| PermissionController | ~22 min | Class is the smallest in the package (single-method `getResourcePermissions`) — confirms batch-P PHANTOM (no getPolicyPermissions); MANAGEMENT enum spec-vs-runtime asymmetric rejection; P-125 emitted |
| RoleController | ~30 min | F-006 audit-silence pattern → 7-sidecar; status-code drift on 2/4 endpoints (POST + PUT return 200 vs spec 201); ADMIN/non-ADMIN principal-fork content drift on GET /api/roles; P-127 emitted |
| PolicyController | ~13 min | 9th corroborating sidecar in cross-batch RBAC audit-silence pattern; class-wide read-side auth gap on getPolicyDetails/getPolicyList/getPolicySchema; P-121 emitted |
| IntegrationController | ~24 min | NO RBAC permission for /api/integrations + DISABLED-mode anonymous reachability + `installed:false` hardcoded dead-field + `platform_url` substitution leak; P-126 emitted |

### Phase 2 — reducer deltas
- **concept-merger**: +14 new concepts (3 operations / 2 entities / 9 invariants) + 3 extended (controllers-as-pass-through-delegates → 11-sidecar; no-audit-log-on-rbac-mutations → 8-tier; 200-vs-201-status-code-drift → 13-endpoint); 0 supersedes.
- **adr-archaeologist**: +3 new ADR candidates (ADR-CANDIDATE-209 wizard registry HIGH, ADR-CANDIDATE-210 whoami dummyOwner HIGH IDENTITY-LAYER FACET of ADR-CANDIDATE-029, ADR-CANDIDATE-211 permission read-surface split MEDIUM) + 6 strengthened (-001 controllers-as-delegates → 23-sidecar; -002 SECURITY_RULES → 23-sidecar; -003 read-collaborative GET → 17-sidecar; -029 DISABLED-as-default; -051 PolicyTypeDto discriminator; -189 OpenAPI spec source-of-truth); +14 new scopes (REFACTOR-606..619: 4 HIGH / 7 MEDIUM / 3 LOW) + 7 strengthened (including REFACTOR-185 → **24-sidecar — strongest single triangulation in catalog**, REFACTOR-188 → 6-sidecar grid SCHEMA-ROOTED).
- **doc-gap-finder**: +9 new DOC-GAPs (273-281; 0 HIGH / 7 MEDIUM / 2 LOW) + 7 strengthens (DOC-GAP-082 META → 35-sidecar across 9 tiers — complete anonymous-fingerprint kill chain anchored; DOC-GAP-083 META → 17-sidecar / 7 tiers / 6 pillars); **1 framing-reversal conflict surfaced** (DOC-GAP-187 prior batch-Q UI tier said "UI looks LOCKED-DOWN under DISABLED" — controller-class primary source REVERSES the direction: UI looks FULLY UNLOCKED admin under DISABLED; META composition intact, prose flagged for maintainer triage).
- **test-coverage-mapper**: +18 new TEST-GAPs (928-945) — 5 CRITICAL (928/929/932/934/941) + 7 HIGH + 5 MEDIUM + 1 LOW; 12 strengthens; 6 double-jeopardy with doc-gaps.
- **feature-flow-builder**: +1 new feature (F-033 Integration Wizard P-08:F-008) + 2 extended (F-006 +3 contributing nodes; F-011 +1); REFACTOR-185 cluster 21 → 24-sidecar; 31 drift facets added (11+8+12); no 4-cell matrix transitions.

### Phase 3 — pipeline state
- YAML safe-fix: `ok: 1538, fixed: 0` — no new YAML breakage this batch.
- Rebuild indexes: concepts (464) / test-map (942) / feature-flows (33).
- Coherence sweep: 90509 generic back-link-missing candidates (regex-noise baseline); per-reducer coherence reported 1 real conflict (DOC-GAP-187 framing-reversal, already triage-flagged).
- Markdown-index appends merged (implicit-adrs + refactoring-scopes + doc-gaps).

### Cumulative state after ZD
- Direct enrichment: 169 → **174/395 (44.1%)**
- Effective coverage: 324 → **333/395 (84.3%)**
- Features discovered: 32 → **33**
- Stress-verified pct: 87.4% → **88.8%**
- All 11 pillars still anchored; 33rd feature minted from this batch's IntegrationController surface.

### Headline architectural signals
1. **REFACTOR-185 → 24-sidecar**: the DISABLED-mode bypass is now the strongest single triangulation in the catalog. Each ZD sidecar added a new facet (identity / permission / role / policy / integration / wizard / info-disclosure / open-read).
2. **F-006 audit-silence → 11-sidecar at controller-class tier**: every RBAC mutation controller forensically confirmed silent at line:1-N. The pattern is SCHEMA-ROOTED (V0_0_48 NOT NULL FK on activity table).
3. **REFACTOR-188 → 6-sidecar grid**: the full Policy × Role × controller × service × repository mutation grid is now triangulated at all 6 cells.
4. **F-033 Integration Wizard minted**: new P-08:F-008 pillar feature anchored on IntegrationController; 12 drift facets enumerated.
5. **Framing-reversal conflict (DOC-GAP-187)**: cross-batch dissonance correctly surfaced — batch-Q UI-tier framing inverted by ZD's IdentityController primary source.

### Follow-ups
- Pre-existing baseline: 90509 coherence-sweep generic back-link-missing candidates (regex-noise; non-blocking; pattern visible across previous batch sweeps too).
- Markdown-index frontmatter drift: implicit-adrs / refactoring-scopes / doc-gaps index.md frontmatter total counts have been stale since batch H (only batches H/ABCDEFGH summary keys present). Rev-7.1 graph-search dedup queries detail/ directly so this drift does not affect reducer correctness; frontmatter remains a vanity counter. Out-of-scope for sprint close.
- Pre-existing quarantined YAML: 5 entries (TEST-GAP-363/687 + 3 concept invariants) — present from before ZD; no new breakage from this batch.
- 5 "sidecars referencing nodes NOT in substrate" + 5 "feature-flow chains referencing obsolete IDs" — pre-existing substrate-staleness, candidate for full re-scan after sprint close.


---

## Batch ZE — 2026-05-25 (Discovery + Search + Title + Feature + Relationship + Links controllers)

**Sprint**: feature/ontology-finalize-2026-05-25 (sprint-close, 2nd batch).
**Network state**: full outage at completion time — push deferred again (caught up on next successful push).

**Sidecars added** (5/5): SearchController + TitleController + FeatureController + RelationshipController + LinksController.

### Phase 1 — file-analyser results
| Node | Headline finding |
|---|---|
| SearchController | **TRUE SQL injection** in highlightDataEntity at ReactiveDataEntityRepositoryImpl.java:798-806 via `String.formatted` direct interpolation; `hasNext:true` hardcoded contract bug at DataEntityServiceImpl.java:192; P-134/135/136 probes |
| TitleController | Title is free-text catalogue auto-created by OwnershipServiceImpl with NO permission gate, NO normalisation; policies on `:owner:title` silently leak via case variants; P-129 |
| FeatureController | `getActiveFeatures` is boot-immutable (cached in `private final Set<Feature>`); runtime YAML changes invisible until restart; PROVIDER-NULL-BLEED-LIMITED-RISK facet of REFACTOR-185; P-132/133 |
| RelationshipController | Zero authz at any layer; `relationshipId` path-param binds to wrong table (data_entity.id vs relationships.id, spec drift); P-130/131 |
| LinksController | Name reuse + URL-scheme + boot-time bind warnings absent; AppInfoMenu reverse-tabnabbing via target=_blank without rel=noopener; P-128 |

### Phase 2 — reducer deltas
- **concept-merger**: +21 new + 7 extended / 0 supersedes. STRENGTHENS controllers-as-pass-through-delegates → 16-sidecar; rbac-read-endpoints-no-securityrule → 12-surfaces; REFACTOR-185 → 4 LIMITED-RISK facets + 1 HIGH IDENTITY-LAYER.
- **adr-archaeologist**: +4 new ADRs (-212/-213/-214/-215; 3 HIGH + 1 MEDIUM) + 6 strengthened; +13 new scopes (REFACTOR-620..632; 3 HIGH + 7 MEDIUM + 3 LOW) + 5 strengthened — REFACTOR-229 third-invocation site (FTS injection family).
- **doc-gap-finder**: +8 new DOC-GAPs (282-289; 3 HIGH + 5 MEDIUM) + 8 strengthens. **Network DOWN — inherited URL verifications per LSN-018 stale-probe cadence** (11-day window). 4 Category-drift findings. 0 contradicts surfaced.
- **test-coverage-mapper**: +12 new TEST-GAPs (946-957; 1 CRITICAL — TEST-GAP-946 HTTP-entry SQL-injection chain) + 3 strengthens.
- **feature-flow-builder**: returned ANALYSIS in-chat without writing detail files (mis-applied "minimal resources" framing). **Orchestrator wrote 4 new F-NNN.yaml files directly** from the agent's analysis: F-034 Platform Feature-Flag Exposure (P-09:F-006), F-035 Operator-Configured Additional Links (P-08:F-009), F-036 Owner-Relationship Title Directory (P-08:F-010), F-037 ERD/Graph Relationships Listing (P-02:F-001 — FIRST P-02 feature). Also flagged 1 NAVIGATION-PILLAR coherence contradiction: navigation/domains/relationships.md:20 claims `Documentation: None` while two doc pages exist; surfaced as nav-update follow-up.

### Phase 3 — pipeline state
- YAML safe-fix: `ok: 1579, fixed: 0`.
- Rebuild indexes: concepts 485 / test-map 954 / feature-flows 37 (added F-034..F-037).
- Coherence sweep: 95588 generic regex-noise candidates (baseline).
- 4 orchestrator-written feature-flow detail files required test_matrix + terminal_side_effect shape fixups (string → object) after first rebuild attempt.

### Cumulative state after ZE
- Direct enrichment: 174 → **179/395 (45.3%)**
- Effective coverage: 333 → **338/395 (85.6%)**
- Features discovered: 33 → **37** (+4 net new pillar-anchored features in one batch — most since batch V)
- Stress-verified pct: 88.8% → **88.5%** (slight decrease — more probe-needed in this batch)
- P-02 Data Modelling pillar GAINS its first feature (F-037). All 11 pillars now have ≥1 feature minted (P-02 was the last empty one until ZE).

### Headline architectural signals
1. **TRUE SQL injection at highlightDataEntity** — third invocation site for REFACTOR-229 family; first time confirmed as HTTP entry point (controller-method chain), not just repository-tier bug.
2. **F-037 RelationshipController zero-authz** — every authenticated caller sees every relationship in the catalog including hidden + cross-tenant; asymmetric to /api/dataentities EXCLUDE_FROM_SEARCH posture; first P-02 feature.
3. **F-034 boot-immutable cached feature flags** — runtime YAML mutation silent; same root pattern as F-009 (notification flags) and LSN-001 (attachment-default) — boot-time-only configuration capture across multiple feature surfaces.
4. **F-036 Title directory silent policy leak** — typing 'Data Steward' / 'data steward' / 'DATA STEWARD' creates 3 DISTINCT directory rows; Policy `:owner:title == 'X'` matches only one variant; LSN-020 input-name-alignment class extended into auto-created vocabulary.
5. **Network outage stress-tested LSN-018 inheritance** — doc-gap-finder degraded gracefully via stale-probe cadence inheritance from sibling sidecars (all URLs verified within 11-day window).

### Follow-ups
- Orchestrator-written feature-flow detail files: F-034..F-037. The feature-flow-builder agent returned analysis in chat without emitting files; the orchestrator materialised the 4 features directly from the agent's narrative. Maintainer review of these 4 files (against agent transcript in this log entry) at next session.
- Coherence-conflict surfaced for navigation/domains/relationships.md:20 (stale `Documentation: None` claim while 2 doc pages exist). State-file: state/coherence-conflicts-batch-ZE.md NOT WRITTEN this batch (the agent suggested writing it but I prioritised getting through Phase 3 — log as follow-up).
- 12 unfixable YAML quarantines surfaced this batch (up from 5 pre-ZE) — investigate next session whether the quarantine count grew due to ZE artifacts or due to a yaml_safe_fix.py false-positive widening.
- Network outage during ZD + ZE push window — when network recovers, the next successful push will catch up commits d500330 (ZD batch) + 25e66b1 (ZD done) + 3dd0a63 (ZE in_progress) + (this ZE batch commit) + (next ZE done commit).


---

## Batch ZF — 2026-05-25 (Ingestion + Owner + MetadataField + DataCollaboration + EventApi)

**Sprint**: feature/ontology-finalize-2026-05-25 (3rd batch).
**Sidecars added** (5/5): IngestionController + OwnerController + MetadataFieldController + DataCollaborationController + EventApiController class-level — security goldmine batch.

### Headlines
1. **EventApiController** — Slack events endpoint UNAUTHENTICATED in all 4 auth modes + NO X-Slack-Signature verification + NO idempotency on at-least-once delivery. Forgeable, replayable, internet-reachable webhook. Operator-facing CRITICAL.
2. **IngestionController class** — 4 of 5 endpoints unauthenticated in default deployment; even with `auth.ingestion.filter.enabled=true` 3 of 5 endpoints REMAIN unauthenticated due to filter exact-literal `/ingestion/entities` POST vs `/ingestion/**` in WHITELIST_PATHS.
3. **DataCollaborationController** — redirect endpoint trusts Slack chat.getPermalink as 302 Location header (open-redirect class); returns 200/empty on missing messageId (message-existence oracle).
4. **OwnerController** — GET /api/owners unauthenticated-read (no SecurityRule entry); OwnerService.getOrCreate BYPASSES OWNER_CREATE permission via 3 service-tier callsites (OwnerAssociationRequestServiceImpl + OwnershipServiceImpl + TermOwnershipServiceImpl).
5. **MetadataFieldController** — PageInfo theatre (hasNext=false, total=size, no LIMIT) + cross-data-entity vocabulary leak (any authenticated user enumerates full custom-metadata schema).

### Phase 2 reducer deltas
- concept-merger: +4 NEW + 8 extended; 0 supersedes. Slack-events-no-signature-verification + open-redirect + slack-channels-cache + pageinfo-theatre concepts minted.
- adr-archaeologist: +4 new ADRs (-216 Slack webhook unconditional whitelist BY DESIGN / -217 UUIDv1 message IDs / -218 PATH-anchored RBAC + getOrCreate side-channels / -219 metadata_field INTERNAL/EXTERNAL bifurcation) + 10 strengthened. +16 new REFACTORs (REFACTOR-633..648; 6 HIGH/7 MEDIUM/3 LOW). REFACTOR-636 strongest batch-ZF refactor (leverage 12).
- doc-gap-finder: +3 new HIGH DOC-GAPs (290 Slack webhook security gap / 291 redirect compound defects / 292 PageInfo theatre — inverse of DOC-GAP-282) + 7 strengthens.
- test-coverage-mapper: +18 new TEST-GAPs (958-975); **4 CRITICAL** (958 ingestion auth matrix / 959 Slack signature verification / 960 Slack idempotency / 961 URL challenge handshake). 30 strengthens.
- feature-flow-builder: +1 NEW feature **F-038 Data Collaboration (P-07:F-006)** anchored on DataCollab + EventApi controllers, 15 drift facets across security/redirect/dedup/200-conflations/UX/doc — Slack webhook unsigned is the headline; +3 extended (F-008 ingestion 7 findings, F-019 owner 4 findings incl. getOrCreate side-door, F-013 custom-metadata 4 findings). Reducer WROTE files this time (orchestrator's explicit instruction landed).

### Cumulative state after ZF
- Direct enrichment: 179 → **184/395 (46.6%)**
- Effective coverage: 338 → **353/395 (89.4%)** ← broke 89%
- Features discovered: 37 → **38**
- Stress-verified pct: 88.5% → tracked next pass
- Total test-gaps: 957 → **972** (CRITICAL: 158 → **161**)
- All 11 pillars feature-anchored; P-07 (Collaboration) now has F-038 + F-007 + F-009 + F-021 (4 features).

### Follow-ups
- Probe-id collision class continues (P-128 ZE; this batch had careful coordination but still drift-prone). Maintainer review of probe registry numbering at next session.
- 16 unfixable YAML quarantines (unchanged from ZE).
- Coherence sweep: 98677 generic candidates (regex-noise baseline; per-reducer coherence already vetted).

