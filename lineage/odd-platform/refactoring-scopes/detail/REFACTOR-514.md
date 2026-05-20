## REFACTOR-514 — Cross-tenant data exposure across ALL THREE notification channels — single Slack URL + single Webhook URL + single email recipient list receives every alert regardless of `dataEntity.owners[]` / `namespaceName` / tenant; full PII payload (entity name, owners, lineage, descriptions) leaks across team boundaries

**Severity**: HIGH
**Category**: pii-disclosure + missing-scoping + cross-tenant-data-exposure
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications all 3 channels), P-09-security-access-control (data-residency boundary)]

**Surfaced by**:
- `SlackNotificationSender.md:security.known_security_gaps.[3]` (MEDIUM) — "Unconditional broadcast to single Slack channel — every alert reaches every viewer of the configured channel regardless of which Owner / Namespace / Tenant the data entity belongs to. For multi-team deployments, cross-team alert leakage is structural."
- `WebhookNotificationSender.md:bugs_limitations_corner_cases.[5]` (HIGH) — "**Cross-tenant data exposure: ONE URL receives ALL alerts regardless of which Owner is attached.** The class binds one URL per platform deployment; the dispatcher feeds it every `AlertNotificationMessage` produced by every alert across every namespace, owner, data source. In a multi-tenant deployment, every tenant's alerts flow to the one operator-configured URL — the receiver cannot route to per-tenant destinations without parsing the payload's `dataEntity.namespaceName` / `dataEntity.owners[]` and routing receiver-side. This is the channel-level structural reason F-009's `pii_passthrough_to_every_channel` drift exists for the webhook channel."
- `WebhookNotificationSender.md:security.known_security_gaps.[3]` (HIGH) — "**Full PII payload to one URL across all owners / namespaces / tenants** — there is no per-tenant URL config, no per-owner filter, no PII-tag-aware redaction. A multi-tenant deployment leaks every tenant's alerts (dataset name + owners[] + downstream lineage) to one URL."
- `EmailNotificationSender.md:bugs_limitations_corner_cases.[11]` (MEDIUM) — "**Owner-scoping is not enforced — all configured recipients see all alerts regardless of entity ownership**. The `notificationsEmails` list is a single global list bound at bean construction. An alert on an entity owned by Team A is delivered to EVERY address in the global list — including any operator on Team B's distribution list."
- `NotificationSubscriber.md:security.known_security_gaps.[4]` (MEDIUM) — "No fan-out scoping by data-entity owner / namespace / tenant — every WAL ALERT INSERT/UPDATE is broadcast to every configured channel."
- `PostgresWALMessageProcessor.md:security.owner_scoping` (HIGH) — "BYPASSES — the seam carries a `DecodedWALMessage` with no owner / namespace / principal context."

**Statement**: All three notification channels in ODD broadcast every alert to every configured destination. The architectural commitment per ADR-CANDIDATE-187 (single-destination-per-deployment) and ADR-CANDIDATE-182 (narrow SPI seam with no owner context) is the STRUCTURAL ENABLER; this scope is the OPERATOR-VISIBLE CONSEQUENCE.

**Payload exposed across boundaries**:
- `AlertNotificationMessage` carries:
   - `dataEntity.id, name, dataSourceName, namespaceName, type` — including potentially PII-bearing dataset names (e.g. `customers_2024_eu_gdpr_subjects`, `payroll_q3_2024_employee_id_map`)
   - `dataEntity.owners[]` — full owner Set (name + title)
   - `downstream[]` — lineage entities to configured depth (default 1) — entire reachable subgraph including downstream-team-owned entities
   - `alertChunks[]` — alert reason / lastReason text (free-form ingestion-supplied — see REFACTOR-512 for mrkdwn-injection compounding)
   - `updatedBy` — platform user identifier (LDAP/OAUTH2 username/email)
- The translator at `AlertNotificationMessageTranslator` materialises `owners[]` from the alert's `data_entity` row but the dispatcher (`AlertNotificationMessageProcessor.process` at lines 25-36) does NOT consult them. The for-loop iterates senders unconditionally; each sender broadcasts.

**Multi-team / multi-tenant deployment scenarios**:
- **Team A's failed DQ test on `team_a_revenue_dashboard` alerts Team B's Slack channel** — because the Slack URL is global. Team B sees Team A's dataset name + owners + lineage.
- **Customer-tier-encoded dataset names leak** — `customers_premium_eu_kyc_data` appears in every recipient's email inbox; the dataset name itself is PII.
- **Downstream-lineage discloses team boundaries** — Team A's `customer_data -> Team B's enrichment_pipeline -> Team C's dashboards` lineage chain reaches the one Slack channel; Team A sees Team C's dashboards exist + are downstream of their data.

**Architectural commitment vs. operator expectation gap**:
- ADR-CANDIDATE-187 (single-destination-per-deployment) IS the design choice. Operators wanting per-team routing must deploy multiple ODD instances OR run a fan-out gateway in front of the URL.
- The live doc framing "An alert dispatched to multiple channels is delivered to every channel that is enabled" (verified 2026-05-20 status 200) does NOT explain that this means "every channel sees every alert regardless of which team's data triggered it."
- Operators evaluating ODD for multi-tenant deployments may not realise the structural cross-team leakage until production.

**Evidence**:
- `SlackNotificationSender.java:27` — single URI bound at boot
- `WebhookNotificationSender.java:11` — single URI bound at boot
- `EmailNotificationSender.java:36` — single global recipient list
- `AlertNotificationMessageProcessor.java:25-36` — unconditional sender iteration; no owner filter
- `AlertNotificationMessage.java:22-37` — full PII-bearing DTO
- `PostgresWALMessageProcessor.java:6` — SPI shape with no owner context
- Live doc page (silent on cross-tenant consequence)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-187 NEW batch Y codifies the single-destination design — this scope is the operator-visible consequence the ADR's stance produces.
- ADR-CANDIDATE-182 NEW batch Y codifies the narrow SPI — the structural enabler.
- F-009 drift facet `pii_passthrough_to_every_channel` (verified live in F-009.yaml feature-flow).

**Proposed remedy**:

1. **Path A (doc surfacing — minimum)** — Update the live notifications page to surface the cross-tenant exposure consequence: explicit operator guidance that multi-team / multi-tenant deployments REQUIRE one ODD instance per team OR a fan-out gateway with per-team routing. No code change.

2. **Path B (per-owner channel routing — structural)** — Add `notifications.receivers.slack.channels: Map<OwnerName, URI>` config. At dispatch time, look up the alert's owners + route to matching channel URLs (multiple deliveries if multi-owner). Requires extending the SPI per ADR-CANDIDATE-182 (correlation between alert owners and channel destination).

3. **Path C (per-namespace routing — alternative)** — Same as Path B but scoping is `dataEntity.namespaceName` not `owners`. Simpler (one route per namespace, namespace is platform-managed) but coarser (a team owning multiple namespaces gets multiple channels).

4. **Path D (PII-aware redaction)** — Add a `notifications.payload.redaction` policy: if `dataEntity.tags` contains a PII tag, the channel payload renders `<REDACTED>` for `dataEntity.name`. Requires PII tag taxonomy + per-channel redaction policy.

Path A is the MINIMUM (doc transparency). Path B is the STRUCTURAL fix. Path C is the simpler structural fix. Path D is the orthogonal hardening.

**Severity rationale**: HIGH — cross-tenant PII leakage in multi-team deployments; structural decision per ADR-CANDIDATE-187 means doc transparency at minimum; operators evaluating ODD for regulated industries may eliminate the platform on this basis without realising the workaround (multiple deployments).

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family) + `Multi-tenancy architecture review`.

---
