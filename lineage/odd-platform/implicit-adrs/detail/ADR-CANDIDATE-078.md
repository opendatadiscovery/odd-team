## ADR-CANDIDATE-078 — Two alert-ingestion paths (in-platform `applyAlertActions` vs AlertManager webhook `handleExternalAlerts`) deliberately diverge on de-duplication semantics — the in-platform path has rich state context to dedup; the webhook path is a thin stateless adapter

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (AlertServiceImpl); composes with batch B AlertManager findings + ADR-CANDIDATE-006 (network-delegated AlertManager auth)
**Axes present**: services, ingestion pipeline

**Surfaced by**:
- `AlertServiceImpl.md:implicit_adrs[3]` ("The two ingestion paths (`handleExternalAlerts` for AlertManager, `applyAlertActions` for in-platform ingestion) deliberately diverge on de-duplication. `applyAlertActions` consumes `AlertAction` objects already pre-grouped by `AlertUniqueConstraint` from `AlertActionResolver`… `handleExternalAlerts` constructs `AlertPojo` directly from the webhook payload and skips the resolver… The intent: the in-platform ingestion path has a richer state context (open alerts already loaded via `getOpenAlertsForEntities` + halt configs via `AlertHaltConfigRepository`); the AlertManager webhook path is a thin adapter with no state context, so it cannot economically de-duplicate at the service layer.")

**Decision statement**: ODD's alert subsystem has TWO ingestion paths with DELIBERATELY DIFFERENT de-duplication semantics:

- **In-platform ingestion** (`AlertServiceImpl.applyAlertActions`, called from `AlertIngestionRequestProcessor` during the FINALIZING phase of `POST /ingestion/entities`): consumes `AlertAction` objects already pre-grouped by `AlertUniqueConstraint.fromAlert(...)` (lines 211-227). The `AlertActionResolver` (`AlertActionResolver.java` / `AlertActionResolverFactory.java`) computes the grouping by loading the **open-alerts snapshot** via `getOpenAlertsForEntities` (FOR UPDATE-locked, per ADR-CANDIDATE-073) + the **halt configs** via `AlertHaltConfigRepository`. The resolver knows which alerts already exist OPEN for each (data-entity, type) pair and emits `CreateAlertAction` / `ResolveAlertAction` / `NoOpAction` discriminators. The de-duplication is **economically expensive** but **structurally complete**: every entity-tick produces exactly the right alert delta.

- **AlertManager webhook** (`AlertServiceImpl.handleExternalAlerts`, called from `AlertManagerController` at `POST /ingestion/alert/alertmanager`): constructs `AlertPojo` directly from the webhook payload (lines 174-187), bypasses the resolver entirely, and delegates to the shared `createAlerts` helper. The helper is a bulk INSERT with NO `ON CONFLICT` clause (per batch H REFACTOR-234). Two POSTs of the same Prometheus payload produce TWO duplicate ALERT rows. The webhook is a **thin stateless adapter** — it has no state context (no open-alerts snapshot, no halt-config lookup), so the resolver cannot run.

The decision is visible in:
1. The **absence** of `AlertActionResolver` import in `AlertServiceImpl.handleExternalAlerts` (lines 154-191) vs its presence in `applyAlertActions` via the `AlertAction` discriminator dispatch.
2. The **explicit fork** at the service surface: `applyAlertActions(IngestionRequest)` is a separate method from `handleExternalAlerts(List<ExternalAlert>)`, deliberately accepting different input shapes.
3. The **single helper** `createAlerts` (lines 261-300) is shared by both paths — the helper itself is dedup-free; the resolver is the difference.

The rationale (sidecar's intent_anchor): "the in-platform ingestion path has a richer state context… the AlertManager webhook path is a thin adapter with no state context, so it cannot economically de-duplicate at the service layer. The alternative would be passing through the resolver for the webhook path too, but the resolver requires the open-alerts snapshot which is the expensive part — and the AlertManager webhook is low-frequency in production deployments."

The decision codifies:
- **(a)** Per-ingestion-source dedup semantics — the platform chooses dedup-by-source, not dedup-everywhere. The in-platform ingestion is the EXPENSIVE-DEDUP path; the webhook is the CHEAP-DUPLICATE-TOLERATING path.
- **(b)** Trust calculus alignment — the webhook is unauthenticated (per ADR-CANDIDATE-006, network-delegated auth); the in-platform path is authenticated via collector tokens (when filter-ON per ADR-CANDIDATE-027). The expensive dedup is appropriate for the authenticated trusted source; the unauth source gets simpler glue.
- **(c)** Frequency assumption — Prometheus AlertManager group_wait / group_interval batches alerts; the webhook fires once per batched-alert-group. The collector ingestion fires on every datasource scan tick. The two have very different cardinality, so the dedup pricing reflects that.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the two methods have different input shapes, different resolver-invocation patterns, and the sidecar's intent_anchor names the rationale explicitly ("richer state context… economically de-duplicate"). The absence of AlertActionResolver in handleExternalAlerts is a positive design choice, not omission.
2. *Structural impact?* YES — affects the alert subsystem's ingestion architecture (two paths with different semantics), the operator UX (Prometheus retry tolerance — duplicates appear in the alert feed), and the trust model (the two paths sit on different sides of the trust boundary per ADR-CANDIDATE-006).
3. *Refactoring or structural?* STRUCTURAL — unifying the two paths through one dedup mechanism would require either (a) adding stateful dedup to the webhook (which contradicts the "thin adapter" rationale), or (b) removing dedup from the in-platform path (which would compromise alert-feed integrity for trusted ingestion). Either way, a redesign.
→ ADR-CANDIDATE.

**Evidence**:
- `AlertServiceImpl.md` says: "`alertToChunks.put(AlertUniqueConstraint.fromAlert(alert), singletonList(chunk));` (line 187 — handleExternalAlerts builds the unique-constraint key locally but never consults an open-alerts snapshot) vs `if (action instanceof AlertAction.CreateAlertAction a) { alertsToCreate.add(a.getAlertPojo()); alertToChunks.putAll(a.getChunks()); }` (lines 223-226 — applyAlertActions trusts the resolver-produced AlertAction)"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-006** (AlertManager Webhook Receiver auth is operator-delegated to network layer) — the auth-side of this split.
- **ADR-CANDIDATE-014** (AlertManager controller is hand-coded, not OpenAPI-generated) — the controller-side of the split.
- **ADR-CANDIDATE-027** (Ingestion-token verification opt-in) — the auth-side of the in-platform ingestion path.
- **ADR-CANDIDATE-067** (Service-tier @ReactiveTransactional boundary) — both paths carry @ReactiveTransactional; the resolver runs INSIDE the transaction on the in-platform side.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-234 (existing — `createAlerts` no idempotency on AlertManager webhook retries; the absence of ON CONFLICT is the consequence of the thin-adapter stance)
- REFACTOR-231 (existing — AlertManager webhook payload-driven alert creation with no caller-ID check; same thin-adapter stance produces the spoofing surface)
- REFACTOR-037 (existing — reopen-conflict race; the in-platform path's resolver mitigates partially via `getOpenAlertsForEntities` FOR UPDATE)

**Proposed action**: Promote to `adrs/drafts/alert-ingestion-dual-path.md` (new ADR). Document:
- The TWO ingestion paths and their input shapes (in-platform IngestionRequest with AlertActionResolver vs webhook ExternalAlert list with direct construction).
- The dedup-by-source rationale (rich state vs thin adapter).
- The frequency assumption (Prometheus AlertManager batching vs per-tick collector scans).
- The consequence chain: webhook duplicates are tolerated; collector duplicates are prevented via the resolver.
- The trust calculus: webhook is unauth (per ADR-CANDIDATE-006), in-platform is collector-token auth (per ADR-CANDIDATE-027).
- The operator-facing UX: Prometheus-retry-during-network-flake produces duplicate alerts in the All-tab; this is a known consequence of the architecture, not a bug.
- Cross-link with ADR-CANDIDATE-006, ADR-CANDIDATE-014, ADR-CANDIDATE-027, ADR-CANDIDATE-067, ADR-CANDIDATE-073.

**Severity rationale**: MEDIUM — pattern-shaping decision for the entire alert subsystem; affects ingestion architecture, operator UX, and trust model. Composes with several existing ADR-CANDIDATEs and helps frame the AlertManager-vs-ingestion gradient.

---
