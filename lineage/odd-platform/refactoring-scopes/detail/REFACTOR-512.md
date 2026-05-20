## REFACTOR-512 — Slack mrkdwn-injection via AlertChunkPojo.description — ingestion-supplied strings rendered as `markdownText(...)` without escaping; `@channel` / `@here` / fake `<url|text>` links can be injected by upstream actors with control over alert descriptions (F-004 6th surface)

**Severity**: HIGH
**Category**: missing-sanitisation + injection + upstream-trust-boundary
**Batch**: Y (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Notifications Slack channel), P-09-security-access-control, F-004-injection-surface-family]

**Surfaced by**:
- `SlackNotificationSender.md:bugs_limitations_corner_cases.[2]` (HIGH) — "**Mrkdwn injection via AlertChunkPojo.description.** AlertChunkPojo.description strings flow into Slack as `markdownText(...)` at SlackMessageGenerator.java:77 (lines 95-101 build the description block from the latest 3 chunks). Slack interprets `*bold*`, `_italic_`, `~strikethrough~`, `<url|text>`, `@channel`, `@here`, `<!channel>`, `<!here>` as mrkdwn markup. AlertChunkPojo populates `.description` from ingestion-side `AlertActionResolverImpl.java:162` which sets it from upstream collector-supplied content (e.g. a dbt test description, a Great Expectations expectation result string, a schema-diff narrative). An upstream-side actor with control over the description string can inject `@channel` to broadcast-notify the entire Slack channel membership, inject `<https://attacker.example/|click here>` to render a fake-link, or inject `<!here>` to alert online users — all rendered as Slack-side markup with NO platform-side escaping."
- `SlackNotificationSender.md:security.known_security_gaps.[0]` (HIGH) — "Mrkdwn injection via AlertChunkPojo.description — ingestion-supplied strings rendered as Slack markdownText without escaping; `@channel` / `@here` / fake `<url|text>` links can be injected. — evidence: SlackNotificationSender.java:41 + SlackMessageGenerator.java:77 + MrkdwnUtils.java (no escape helper) — severity: HIGH"

**Statement**: Slack interprets specific characters as mrkdwn markup:
- `*bold*` / `_italic_` / `~strikethrough~` — text formatting
- `<https://example.com|link text>` — hyperlinks
- `@channel` / `@here` — broadcast-notifications to ALL channel members / online members
- `<!channel>` / `<!here>` — same as above with explicit broadcast syntax
- `<@U12345>` — direct-mention specific user

When `SlackMessageGenerator.java:77` calls `markdownText(chunk.getDescription())` to render an alert chunk's description, the description string is passed VERBATIM into the Slack block-kit's `mrkdwn` payload type. Slack's renderer interprets ALL of the above markup syntax in that string. There is NO escape function applied — `MrkdwnUtils.java:1-14` provides only `bold(...)` and `buildLink(...)` for platform-controlled strings; there is NO `MrkdwnUtils.escape(...)` for user/ingestion-supplied strings.

**Injection vector chain**:
1. `AlertChunkPojo.description` is populated at `AlertActionResolverImpl.java:162` from upstream collector-supplied content.
2. Collector ingestion accepts arbitrary `String` descriptions (dbt test descriptions, Great Expectations expectation result strings, schema-diff narratives — all upstream-defined).
3. An upstream actor with control over the description text can inject:
   - `@channel\nSecurity breach detected, contact admin@attacker.example` — broadcasts to entire Slack channel + injects social-engineering content
   - `<https://phishing.example.com/?token=stolen|Click here to view the alert details>` — fake-link rendering an attacker-controlled URL with ODD-branded link text
   - `<!here>\nAll engineers, click <https://attacker.example|HERE> immediately` — combines broadcast-notify + fake-link
4. The Slack channel receives the alert with embedded mentions / fake links / fabricated content; channel members are notified + see attacker-controlled content.

**Cross-feature implication (F-004 6th surface)**:
F-004's injection-surface family (per system-mission.md / feature-flows/F-004.yaml) catalogues injection vectors across the platform. The slack mrkdwn injection is the SIXTH surface in this family — joining (1) SQL injection via search query (REFACTOR-192 from batch E), (2) tsquery injection at JooqFTSHelper (REFACTOR-192 batch E), (3) XSS via entity-name rendered to UI (covered in DOC-LINEAGE-substrate UI sidecars), (4) HTML injection via email body (the latent gap in REFACTOR-211 from batch F), (5) DDL injection via publication-name (REFACTOR-510 NEW batch Y), and now (6) this — mrkdwn injection via alert description.

**Live doc says NOTHING about this**. The live `features/active-platform-features/notifications` page is silent on mrkdwn metacharacter handling.

**Evidence**:
- `SlackNotificationSender.java:41` — calls `messageBuilder.generateAlertMessage(message)`
- `SlackMessageGenerator.java:77, 95-101` — the description block uses `markdownText(chunk.getDescription())` without escape
- `MrkdwnUtils.java:1-14` — has `bold(...)` and `buildLink(...)` but NO `escape(...)`
- `AlertActionResolverImpl.java:162` — ingestion-side population from upstream content
- Slack Block Kit documentation on mrkdwn syntax (the markup the platform fails to escape)
- F-004.yaml drift facet `mrkdwn_injection_via_alert_description` (NEW)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-188 NEW batch Y codifies the Webhook thin-proxy stance — explicitly says "thin proxy stance does NOT defend the absence of features" — and the same framing applies here for Slack (which is NOT thin-proxy but the absence of escaping has no rationale).
- ADR-CANDIDATE-005 (GenAI thin-proxy) — same family of "no input sanitisation" defaults; gap noted similarly.
- No ADR defends absence of mrkdwn escape; this is a refactoring gap.

**Proposed remedy**:

1. **Path A (escape function)** — Add `MrkdwnUtils.escape(String) -> String` that escapes Slack's mrkdwn metacharacters (`*`, `_`, `~`, `<`, `>`, `@`, `!`) using backslash. Apply at `SlackMessageGenerator.java:77` to every user/ingestion-supplied string (`chunk.getDescription()`, `dataEntity.getName()`, owner names if mention syntax is concerned).

2. **Path B (Slack-side mitigation via `text` type)** — Use `plain_text` block type for ingestion-supplied content instead of `mrkdwn` — Slack does NOT interpret markup in `plain_text` blocks. Trade-off: cannot use bold/italic for the platform's own formatting; would require splitting the message into platform-controlled `mrkdwn` portions + ingestion-supplied `plain_text` portions.

3. **Path C (ingestion-side validation)** — Reject or sanitize description strings at ingestion time (when collector POSTs to `/ingestion/entities`). Mrkdwn metacharacters in descriptions are rejected with a 400. Trade-off: breaks legitimate descriptions containing `*` / `_` characters.

Path A is the SHIP-FAST minimum. Path B is the structurally-stronger mitigation. Path C is the defence-in-depth at the entry point.

Doc-side: update `features/active-platform-features/notifications` to surface the mrkdwn-injection risk + the operator-side mitigation (use a dedicated Slack channel that ONLY ODD posts to; restrict channel membership to alert-recipient audiences).

**Severity rationale**: HIGH — broadcast-notification injection is a social-engineering vector; fake-link injection is a phishing vector; the attack surface is upstream-collector (ODD's trust boundary toward collectors is intentionally broad — see ADR-CANDIDATE-027 ingestion trust gradient — but collector-side authentication does NOT prevent a compromised collector from injecting mrkdwn); cross-references F-004 family — the 6th surface.

**Suggested backlog grouping**: `Notifications hardening sprint` (per REFACTOR-508 family) + `F-004 injection surface family hardening`.

---
