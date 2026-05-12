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
