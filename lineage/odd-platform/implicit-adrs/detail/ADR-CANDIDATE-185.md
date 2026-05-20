## ADR-CANDIDATE-185 — Same MimeMessage instance reused across recipients via mutating `setTo(...)` — memory-efficiency over per-recipient envelope independence; subject template is hard-coded via `String.replace` (not Freemarker)

**Severity**: LOW
**Classification**: promote (NEW ADR; deliberate memory-pattern + subject-template choice)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature email channel)]
**Support count**: 1 sidecar primary source (batch Y EmailNotificationSender)
**Axes present**: notification.sender
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `EmailNotificationSender.md:implicit_adrs.[3]` (HIGH) — "**Same MimeMessage reused across recipients via mutation** — the for-loop creates ONE MimeMessage (line 46) and mutates its To header per iteration (line 55 `helper.setTo(notificationsEmail)`). This encodes a memory-efficiency stance (avoid N MimeMessage allocations + N template renders), but TIES the per-recipient envelope to whatever MimeMessageHelper's `setTo` does internally. Spring's MimeMessageHelper.setTo replaces (rather than appends) — verified by Spring docs (referenced indirectly via the contract that subsequent calls overwrite); this code RELIES on that semantic." — intent_anchor: Single `createMimeMessage()` outside the loop + mutating `setTo` inside the loop (EmailNotificationSender.java:46-57)
- `EmailNotificationSender.md:implicit_adrs.[4]` (MEDIUM) — "**Subject is built by manual string-replace, NOT by Freemarker** — line 51 uses `EMAIL_SUBJECT_TEMPLATE.replace(\"${alertType}\", ...)` (Java's String.replace) rather than running the subject through the Freemarker engine. This avoids the cost of a second template-engine invocation for a single-variable subject, and avoids a separate `email.subject.ftlh` template file." — intent_anchor: `EMAIL_SUBJECT_TEMPLATE.replace("${alertType}", message.getAlertType().name());` (EmailNotificationSender.java:21, 51)

**Decision statement**: ODD's email notification has TWO complementary efficiency commitments in the send path:

1. **Same MimeMessage instance reused across recipients.** `EmailNotificationSender.java:46` creates ONE `MimeMessage` outside the per-recipient loop. The loop (lines 54-57) mutates the message's To header per iteration via `helper.setTo(notificationsEmail)` and re-sends through `emailSender.send(mimeMessage)`. The pattern relies on Spring's `MimeMessageHelper.setTo(...)` REPLACING (not appending) the To header per call. The subject (set at L51 BEFORE the loop) and body (set at L52 BEFORE the loop) persist unchanged across iterations.

2. **Subject is built by manual `String.replace`, NOT by Freemarker.** The constant `EMAIL_SUBJECT_TEMPLATE = "ODD Platform - ${alertType} Alert"` at line 21 is a Java string literal. Line 51 invokes `EMAIL_SUBJECT_TEMPLATE.replace("${alertType}", message.getAlertType().name())` — Java's `String.replace(CharSequence, CharSequence)`, NOT Freemarker's template engine. The choice avoids: (a) a second `configuration.getTemplate("email.subject.ftlh").process(...)` engine invocation per send, (b) a separate `email.subject.ftlh` template file. The trade-off: the subject template lives in the .java file as a constant (operator-non-tunable, maintainer-visible) rather than alongside the body template.

The architectural commitments:
- **(a) Memory efficiency over per-recipient envelope independence.** Allocating N MimeMessages + N template renders per alert (for N recipients) would be wasteful when the body content is identical. The single-allocation pattern halves the per-send heap pressure. Trade-off: any header mutation INSIDE the loop other than `setTo` would compound across recipients (e.g. setting a custom header that varies per recipient would require the maintainer to also reset it per iteration).
- **(b) Subject template is small enough to not warrant Freemarker.** The subject has one variable (`${alertType}`) and renders an uppercase enum name. The cost of Freemarker engine invocation (template lookup + parse + process + StringWriter) for a 1-variable substitution is disproportionate. `String.replace` is constant-time and allocation-light.
- **(c) The two choices are paired.** Both are about minimising per-send allocation: one MimeMessage + one subject String + one body String + (in the loop) one `setTo` call + one `send`. The pattern is internally consistent.
- **(d) Subject is operator-non-tunable.** The `ODD Platform - ` prefix is baked into the Java constant. Operators wanting to remove the prefix (e.g. for "stealth" deployments) or change the language (i18n) cannot do so without source change.
- **(e) Future per-recipient customisation is blocked structurally.** The MimeMessage-reuse pattern means per-recipient subject lines or per-recipient body content (e.g. recipient-aware greeting) cannot be added without breaking the reuse — a future per-recipient-customisation feature would require restructuring the loop.

**Wisdom test**: PASS on all three questions (LOW severity).
1. **Intentional?** YES — three independent commitments:
   - Single `createMimeMessage()` OUTSIDE the loop + mutating `setTo` INSIDE the loop is a deliberate sequencing choice (the obvious alternative is `for (recipient) { MimeMessage m = createMimeMessage(); helper(m).setTo(recipient).setText(body); send(m); }` — N allocations).
   - The `String.replace` choice over the engine — the maintainer could have made the subject a separate template; the choice not to is deliberate.
   - The hard-coded "ODD Platform - " prefix encodes "every alert subject starts with the platform name" as an intentional convention, not as an oversight.
2. **Structural impact?** LIMITED — the pattern is per-call efficiency; the impact is per-send memory + CPU, not architectural extension. But the pattern blocks future per-recipient customisation without restructuring.
3. **Refactoring or structural?** Structural on the per-recipient-customisation blockage. The MimeMessage-reuse pattern is an explicit design choice that future features must work around.

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-183 (Freemarker `.ftlh` for body — the maintainer chose the engine for body but NOT for subject) and ADR-CANDIDATE-186 (per-recipient fail-stop — same loop body; the fail-stop semantic interacts with the MimeMessage-reuse pattern because the message that propagates upward as `cause` in the wrapped RuntimeException carries only the LAST recipient's `To` header).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-538 NEW batch Y (Subject String.replace fragility — if future AlertTypeEnum value contains `${...}` text it could re-render incorrectly; LOW)
- (No new scope for the MimeMessage-reuse pattern itself; the corner case at sidecar `bugs_limitations_corner_cases.[2]` is operationally-invisible today)

**Proposed action**: Promote to `adrs/drafts/email-mimemessage-reuse-and-subject-pattern.md` (new ADR). Document the two paired efficiency commitments + the blockage of per-recipient customisation. Doc-side: not needed for operators (the pattern is invisible at the operational layer).

**Severity rationale**: LOW — the pattern is a per-call efficiency choice + a future-feature blockage; not security-critical; not operator-visible; relevant for future maintainers contemplating per-recipient customisation.

---
