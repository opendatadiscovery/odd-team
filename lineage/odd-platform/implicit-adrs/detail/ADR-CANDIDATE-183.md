## ADR-CANDIDATE-183 — Email notification body rendered via Freemarker `.ftlh` template — engine-engine boundary chosen over Java string concatenation; per-recipient fail-stop loop is deliberate (live-doc-documented)

**Severity**: MEDIUM
**Classification**: promote (NEW ADR; mixed POSITIVE-INTENT — Freemarker template choice; per-recipient fail-stop is the live-doc-documented stance)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature email channel)]
**Support count**: 1 sidecar primary source (batch Y EmailNotificationSender) + live-doc anchor at `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (verified 2026-05-20 status 200) naming the per-recipient fail-stop verbatim
**Axes present**: notification.sender
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `EmailNotificationSender.md:implicit_adrs.[0]` (HIGH) — "**Email body is rendered via Freemarker, NOT via Java string concatenation** — the class injects `freemarker.template.Configuration` (line 24) and processes a template `email.ftlh` (line 79) rather than building HTML inline. This encodes a deliberate template-engine boundary: visual changes to the alert email (layout, styling, fields rendered) are operator-non-tunable but maintainer-tunable by editing the `.ftlh` file under `src/main/resources/templates/` without code recompilation in some deployment shapes." — intent_anchor: `configuration.getTemplate("email.ftlh").process(model, stringWriter);` (EmailNotificationSender.java:79)
- `EmailNotificationSender.md:implicit_adrs.[1]` (HIGH) — "**Per-recipient delivery loop with FAIL-STOP semantics is intentional** — the for-loop at lines 54-57 has NO inner try/catch; the FIRST recipient that throws MessagingException aborts ALL subsequent recipients. The live notifications doc page WebFetched 2026-05-20 explicitly documents this as 'silent partial delivery' with operator guidance ('keep recipient lists short and use distribution lists on the SMTP side for fan-out'). The decision to NOT add a per-recipient try/catch is therefore deliberate — the doc page explains the trade-off + names the workaround." — intent_anchor: Live-doc-published caveat verbatim + EmailNotificationSender.java:54-57 (no inner try/catch)

**Decision statement**: ODD's email notification body construction has TWO deliberate design commitments:

1. **Freemarker `.ftlh` template engine for the HTML body.** `EmailNotificationSender.java:24` injects `freemarker.template.Configuration` and L79 processes `email.ftlh` under `src/main/resources/templates/`. The maintainer chose template-engine rendering over Java string concatenation. The `.ftlh` extension is load-bearing: Freemarker 2.3+ auto-escapes interpolations in `.ftlh` files (this is the XSS defence — `${dataEntityName}` containing `<script>` renders as `&lt;script&gt;`). The decision composes with the template's classpath location: `src/main/resources/templates/email.ftlh` — operator-non-tunable (the template ships in the platform JAR), maintainer-tunable (a `.ftlh` edit + repackage changes layout without touching code).

2. **Per-recipient fail-stop delivery loop.** `EmailNotificationSender.java:54-57` iterates `for (final String notificationsEmail : notificationsEmails)`, sets the To header on a SHARED MimeMessage, then calls `emailSender.send(mimeMessage)`. The loop has NO INNER TRY/CATCH. The FIRST recipient that throws `MessagingException` aborts ALL subsequent recipients. The live notifications doc page (verified 2026-05-20 status 200) names this verbatim as the operator-facing trade-off: "If recipient N fails, the loop stops — recipients N+1, N+2, ... never receive the alert. There is no retry and no partial-failure metric. ... keep recipient lists short and use distribution lists on the SMTP side for fan-out." The maintainer's design choice IS deliberate (the doc explains the trade-off and names the workaround); the operator-visible behaviour ("silent partial delivery") is a documented trade-off, not a bug.

The architectural commitments:
- **(a) Template-engine boundary separates layout from code.** Visual changes (HTML structure, field ordering, styling) live in `email.ftlh`; Java code handles model construction + transport. The boundary is maintainer-tunable (edit `.ftlh` + repackage) but NOT operator-tunable. A future "operator-customisable email template" feature would require either (a) classpath override via Spring's `ResourceLoader` or (b) reading templates from a filesystem path — both structural changes.
- **(b) `.ftlh` extension is the XSS defence.** Freemarker's auto-escape policy for `.ftlh` (vs `.ftl` which does NOT auto-escape) means every `${variable}` interpolation in the template renders HTML-safe by default. The platform's data-entity / data-source / namespace names + alert descriptions reach the template via Lombok-generated getters on the AlertedDataEntity record; the auto-escape is the only defence against an upstream-controlled entity name containing `<script>...</script>`.
- **(c) Per-recipient fail-stop is the workaround.** Adding per-recipient try/catch (to deliver to remaining recipients on partial failure) would change operator-visible behaviour. The maintainer made the live-doc-documented choice: ODD does NOT do fan-out at the recipient level; operators wanting fan-out are explicitly directed to "distribution lists on the SMTP side" (use a mailing list address as the single recipient).
- **(d) The first-failure-aborts-rest semantics is paired with the cross-channel-abort RuntimeException.** Per `EmailNotificationSender.java:58-60`, MessagingException is wrapped as raw `RuntimeException` — which bypasses `AlertNotificationMessageProcessor.java:31`'s `catch (NotificationSenderException)` and aborts the OUTER fan-out across all channels (Slack + Webhook NOT delivered). The two design choices compose: a single bad recipient aborts (1) remaining email recipients AND (2) Slack channel AND (3) Webhook channel for THAT alert. This compound effect IS NOT in the live doc (REFACTOR-511 captures the doc gap).
- **(e) Subject is hard-coded; only body is template-driven.** `EMAIL_SUBJECT_TEMPLATE = "ODD Platform - ${alertType} Alert"` at line 21 uses Java's `String.replace(...)` (not Freemarker). The maintainer chose NOT to template the subject — there is no `email.subject.ftlh` template file. The subject prefix is operator-non-tunable.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - The Freemarker `.ftlh` choice over Java string-concat (could have been `String.format("<html><body><h1>%s</h1>...</body></html>", ...)` — the maintainer chose the engine).
   - The `.ftlh` extension specifically (the alternative `.ftl` would have disabled auto-escape; the maintainer chose the safer extension).
   - The per-recipient fail-stop is corroborated by the LIVE DOC PAGE explicitly naming the behaviour as a trade-off — three-way evidence (code + doc + sidecar quote) of intent.
2. **Structural impact?** YES — every future "customisable email template" feature must touch the templating-engine boundary; every future "deliver to remaining recipients on partial failure" change must touch the explicit live-doc commitment + add a per-recipient try/catch.
3. **Refactoring or structural?** Structural on the template-engine choice (swapping Freemarker for Thymeleaf/etc. requires substantive code change); structural on the per-recipient fail-stop (the live-doc commitment is the architectural contract — changing it requires updating both code AND docs).

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-184 (HTML-only body — no plaintext alternative; same channel) and ADR-CANDIDATE-185 (same-MimeMessage-mutation-across-recipients — the loop body's reuse pattern). The three together describe the email channel's full design.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-511 NEW batch Y (Email RuntimeException bypass aborts cross-channel fan-out — the OTHER half of the per-recipient fail-stop story; live doc names within-channel partial-delivery but NOT cross-channel abort; HIGH)
- REFACTOR-524 NEW batch Y (MimeMessageHelper no charset specified — JVM-default leak; the `.ftlh` template renders correctly but the SMTP envelope encoding can mangle non-ASCII content; MEDIUM)
- REFACTOR-525 NEW batch Y (ALERT_PATH hard-coded `/dataentities/{id}/alerts` — SPA-routing coupling; MEDIUM)
- REFACTOR-526 NEW batch Y (Subject template hard-coded — operator cannot remove "ODD Platform - " prefix; LOW)
- REFACTOR-538 NEW batch Y (AlertTypeEnum.name() embedded via Java String.replace — fragile if future enum value contains `${...}`; LOW)

**Proposed action**: Promote to `adrs/drafts/email-notification-template-and-fail-stop.md` (new ADR). Document the two commitments + the .ftlh extension as XSS defence + cross-link the live-doc per-recipient fail-stop documentation. Doc-side: the live doc should be extended to surface the COMPOUND effect — within-channel fail-stop + cross-channel-abort-via-RuntimeException is what operators experience (REFACTOR-511 is the doc gap).

**Severity rationale**: MEDIUM — defines the email channel's template + delivery story; operationally significant (operators tuning recipient lists rely on the documented behaviour); the cross-channel abort behaviour (per REFACTOR-511) elevates the operator impact but the underlying decision is a design choice, not a bug.

---
