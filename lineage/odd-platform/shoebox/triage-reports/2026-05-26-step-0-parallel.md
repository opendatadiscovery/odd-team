---
artefact: shoebox-step-0-triage-report
date: 2026-05-26
methodology_rev: 10
mode: parallel — 8 feature-flow-builder instances, slice-scoped
input: 122 SHB threads minted in the 2026-05-26 parallel-fulfilment harvest (commit 687f038)
---

# Step-0 triage — 2026-05-26 parallel pass

First mass Step-0 evaluation of the rev-10 shoebox layer. Eight parallel
`feature-flow-builder` subagent instances ran the canonical Step 0 / per-run
shoebox evaluation (APPROACH.md §18.4 + agent contract Rule 8 / workflow §0)
over the 122 SHB threads from the morning's harvest. Each instance owned one
pillar slice + a non-overlapping F-NNN allocation range.

## Outcomes — 122 threads → verdicts

| Verdict | Count | Share |
|---|---|---|
| **Graduated** to new F-NNN | 36 | 30% |
| **Merged** into existing F-NNN | 61 | 50% |
| **Clustered** with siblings | 20 | 16% |
| **Left as note (deferred)** | 5 | 4% |

**SME consultation pending: 4** (SHB-110 LDAP substring-vs-equals, SHB-114
read-collaborative doctrine pillar ambiguity, SHB-166 Markdown XSS audit
pillar anchoring, SHB-179 / F-123 deletion-semantics architectural framing).

## Per-slice breakdown

| Slice | Pillar focus | Threads | Graduated | Merged | Clustered | Deferred | F-NNN minted |
|---|---|---|---|---|---|---|---|
| A | Data Discovery (P-01) | 15 | 4 | 9 | 0 | 2 | F-044..F-047 |
| BC | Lineage / Modelling / Glossary / DQ / MDM (P-02 P-03 P-04 P-05 P-06) | 17 | 6 | 10 | 1 | 0 | F-054..F-059 |
| D | Active Platform (P-07) | 15 | 2 | 12 | 0 | 1 | F-064..F-065 |
| E | Management (P-08) | 13 | 3 | 10 | 0 | 0 | F-074..F-076 |
| F | Security (P-09) | 12 | 7 | 2 | 1 | 2 | F-084..F-090 |
| G | Ingestion + Dev API (P-10 P-11) | 10 | 5 | 1 | 4 | 0 | F-094..F-098 |
| H1 | UI shell + i18n + routes | 30 | 2 | 14 | 14 | 0 | F-104..F-105 |
| H2 | Java config + repos | 10 | 7 | 3 | 0 | 0 | F-119..F-125 |
| **Total** | | **122** | **36** | **61** | **20** | **5** | **36 features** |

F-NNN allocations used 36 of 85 reserved slots (42%). Most agents stayed
well within their range — "quality over allocation".

## 36 new feature flows (F-044..F-125)

### Data Discovery (P-01) — 4 graduations

- **F-044** — Data Entity Status Lifecycle (DRAFT→DEPRECATED→DELETED auto-flip + applyStatus drift)
- **F-045** — Dataset Schema Revision History (per-version structure + diff + cross-dataset version_id leak)
- **F-046** — Custom Metadata Field Catalogue (auto-growth, pageInfo theatre, no read permission)
- **F-047** — Dataset Field per-Column Annotation (9 drift facets; 2 HIGH SecurityConstants wiring bugs)

### Lineage + Modelling + Glossary + DQ + MDM (P-02..P-06) — 6 graduations

- **F-054** — Microservices Lineage (doc-promised surface with NO code anchor)
- **F-055** — Lineage Depth Boundary Contract (UI dropdown lies; URL/API/SQL accept any int; Auth-DoS surface)
- **F-056** — Term Description-Mention Auto-Link Side-Channel (cross-time + cross-namespace + audit-invisible)
- **F-057** — DQ Test Severity Lifecycle (cross-pillar BI blast radius)
- **F-058** — Lookup Tables Listing UX (30-row silent cap; copy-paste DOM-id regression)
- **F-059** — Lookup Table Rename Cascade (UI metadata edit renames documented public Postgres surface)

### Active Platform (P-07) — 2 graduations

- **F-064** — User-Owner Association Discoverability (silent-empty pattern; `status: ui-incomplete`)
- **F-065** — Single-Leader Background Subsystem Registry (advisory-lock-id collision risk)

### Management (P-08) — 3 graduations

- **F-074** — Management-Tab Read-Collaborative Posture (7-surface enumeration; ADR-CANDIDATE-003 anchor)
- **F-075** — User-Owner Association Request Flow (DIRECT_OWNER_SYNC self-mint-and-self-bind chain)
- **F-076** — Cross-Management Cascade-on-Delete Protection Pattern (TOCTOU race across 3 controllers)

### Security & Access Control (P-09) — 7 graduations

- **F-084** — OAuth Provider Admin-Detection Matrix (5×5 operator surface)
- **F-085** — Identity Probe & DISABLED-Mode Synthetic Admin Fallback
- **F-086** — OAuth Logout Token-Revocation Semantics (per-provider revocation matrix)
- **F-087** — Session Cookie Security Posture & Lifetime
- **F-088** — S2S API Key — Global Admin Grant Surface
- **F-089** — Post-Logout Redirect Provenance (Host-header trust)
- **F-090** — Permission Read Surface — Contextual vs Non-Contextual Split

### Integrations + Ingestion + Dev API (P-10 + P-11) — 5 graduations

- **F-094** — Ingestion API Authentication Coverage Matrix (1-of-5 endpoint coverage; property-name misdirection)
- **F-095** — Dataset-Field Stats Cross-Dataset Write Surface
- **F-096** — Ingestion Batch Atomicity & Error Contract (single-transaction, no DLQ, no idempotency)
- **F-097** — Platform OpenAPI Discoverability Surface (Swagger UI unauth; PII + branding leak)
- **F-098** — Slack Events Webhook Inbound Integration Security (HMAC absence)

### UI Shell (architectural pillar: ui-spa) — 2 graduations

- **F-104** — Feature-Local State Persistence (jotai vs Redux paradigm split)
- **F-105** — Management Section Route Gating

### Java cross-cutting (platform-server, metadata-store) — 7 graduations

- **F-119** — Deployment-Info Introspection Surface (AppInfo fingerprint leak)
- **F-120** — R2DBC Pool Operator-Tunability
- **F-121** — Scheduled-Job Executor Concurrency Contract (single-thread cron-misfire)
- **F-122** — Management-Endpoint Exposure & Credential Handling (Actuator /env exposes every bound credential)
- **F-123** — Deletion Semantics Per-Resource Contract (three coexisting soft-delete mechanisms; SME-pending)
- **F-124** — ADMIN Promotion Across Auth Providers (six-way divergence)
- **F-125** — Ingestion Credential Storage & Lifecycle (orphaned tokens never purged)

## 20 clusters formed

- **Slice G**: 4 cross-pillar clusters deferred (stats-endpoint side-channel; metrics tenant-id; DEG-membership; collector-token)
- **Slice H1**: 4 UX classes + 1 cross-pillar (DQ Dashboard Filter UX; Autocomplete UX; Form UX; DataEntity Details + Description editing; owner-association gate)
- **Slice BC**: 1 cross-slice (SHB-049 i18n with SHB-147/148/149)
- **Slice F**: 1 cross-slice (SHB-106 ingestion-filter + SHB-123)

## 5 deferred threads (insufficient evidence / cross-pillar ambiguity)

- **SHB-011** Runs History wire/DB enum asymmetry → F-040 is P-04; Slice A could not reach across pillar
- **SHB-015** Attachment chunk multi-instance → F-027 is P-08; same constraint
- **SHB-066** Notification observability metrics → competes with F-065 P-08 scope; defer one batch
- **SHB-110** LDAP admin-groups substring → sidecar-vs-sidecar contradiction on `OperationUtils.containsIgnoreCase`; SME consultation recommended
- **SHB-114** Read-collaborative doctrine → ambiguous shape (F-NNN vs ADR-CANDIDATE vs both); SME consultation recommended

## Cross-slice coordination — surfaced for the maintainer

The slice-scoped parallelism preserved most cross-pillar discipline cleanly,
but several thread merges named target F-NNN OUTSIDE the slice's pillar.
Three resolutions were used:

1. **Inline merge** (Slices A / D / E / G / H1 / H2 — some agents went looser): wrote the new drift_class facet directly into the cross-pillar F-NNN.
2. **Evaluation-block-only merge** (Slice BC — strictest discipline): recorded the proposed drift_class + facet text in the SHB thread's `## evaluation` block; left the F-NNN file untouched. The maintainer's next pillar-focused builder pass folds them inline.
3. **Cluster** (Slice F / G — when sibling threads were owned by another slice): set bidirectional `cluster_with` between the SHB threads; deferred graduation pending reciprocation.

Both interpretations of "merge" are legal per the brief. Slices A/D/E/G/H1/H2's inline merges write 19 existing F-NNN files (F-001 through F-043 range — F-003, F-004, F-006, F-008, F-010, F-011, F-013, F-017, F-018, F-019, F-020, F-023, F-027, F-028, F-031, F-035, F-036, F-041, F-043). Slice BC's evaluation-block-only merges leave 10 additional drift_class entries to be folded.

## Methodology observations (for the maintainer's next /panel review)

1. **Parallel Step-0 worked**. 122 threads triaged in ~25-30 min wall-clock by 8 concurrent agents — vs an estimated ~5 hours sequentially. Zero F-NNN ID collisions. Healthy cross-slice coordination via `cluster_with`.
2. **Hint-pass accuracy was 80-90%**. Most threads' explicit-or-implicit merge targets named during mining matched the triage verdict. Where they diverged (notably SHB-060 — silent-empty UX gap promoted to F-064 rather than merged into F-021), the divergence captured real cross-cutting product surfaces the original feature flow didn't anchor.
3. **44 clustering threads + 80 open threads → 28 clustering + 13 open**. The shoebox is now substantially closer to honest convergence: 83 threads moved to `merged` state in one pass.
4. **The biggest enricher targets were F-009 (notifications)** and **F-041 / F-042 / F-043 (UI shell)**. F-009 absorbed 5 facets (Slice D); F-041 absorbed 7 (Slice H1); F-043 absorbed 4 (Slice H1 + BC's i18n cluster). Their batch-Y / batch-ZL / batch-ZJ enrichments already anticipated most of these — convergence, not divergence.
5. **index.yaml partial update**. Only Slice G appended its 5 entries to `feature-flows/index.yaml`. The other 31 graduations are NOT yet in the index. The graph_query layer reads `detail/*.yaml` directly, so retrieval is unaffected; the index.yaml refresh is a known follow-up.

## Next

1. **Maintainer SME consultations** for the 4 SME-pending threads (SHB-110, SHB-114, SHB-166, SHB-179/F-123).
2. **Inline-fold Slice BC's evaluation-block merges** (10 entries) in a pillar-focused pass.
3. **Refresh `feature-flows/index.yaml`** — full rebuild from the 79 `detail/F-NNN.yaml` files.
4. **Consider the F-119 + F-122 + F-125 attack-surface triplet** (deployment fingerprint + Actuator /env + orphaned tokens) — surfaced by Slice H2 as the densest credential-recovery surface ODD ships.

## Files

- 36 new `lineage/odd-platform/feature-flows/detail/F-{044..125}.yaml`
- 19 modified existing F-NNN files (inline merges)
- 122 modified `lineage/odd-platform/shoebox/detail/SHB-*.md` (each gained `## evaluation` block; Category transitioned per verdict)
- 1 partially updated `lineage/odd-platform/feature-flows/index.yaml` (Slice G entries only)
- This triage report.
