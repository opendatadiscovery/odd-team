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
