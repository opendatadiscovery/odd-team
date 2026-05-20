## ADR-CANDIDATE-184 — Email body is HTML-only — `helper.setText(emailContent, true)` declares HTML mode; no plaintext alternative is generated; the `.ftlh` template ships HTML-only (no `.txt` companion)

**Severity**: LOW
**Classification**: promote (NEW ADR; deliberate-but-narrow design choice; could be considered for re-classification if maintainer regards as oversight)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature email channel)]
**Support count**: 1 sidecar primary source (batch Y EmailNotificationSender)
**Axes present**: notification.sender
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `EmailNotificationSender.md:implicit_adrs.[2]` (MEDIUM) — "**HTML-only body (no plaintext alternative)** — `helper.setText(emailContent, true)` (line 52) — the boolean `true` signals to MimeMessageHelper that the body is HTML. NO `helper.setText(plaintextAlternative, htmlBody)` overload is used. The template (`email.ftlh`) is HTML-only. The decision encodes 'every recipient mail client is HTML-capable' — true for corporate gmail/outlook, fragile for accessibility tooling or text-only mail clients." — intent_anchor: `helper.setText(emailContent, true);` (EmailNotificationSender.java:52)

**Decision statement**: ODD's email notification body is delivered as HTML-ONLY. The single `helper.setText(emailContent, true)` call at `EmailNotificationSender.java:52` passes the boolean `true` to MimeMessageHelper's 2-arg overload — declaring the content as HTML mode. The 3-arg overload `helper.setText(plain, html)` (which would set a multipart/alternative body with both plaintext and HTML parts) is NOT used. The `.ftlh` template renders HTML markup only; there is NO `email.txt.ftlh` plaintext companion template in `src/main/resources/templates/`. Recipients on text-only mail clients, accessibility-tooling-priority-plaintext clients, or mail clients that aggressively strip HTML for security receive raw HTML markup.

The architectural commitments:
- **(a) "Every recipient mail client is HTML-capable" is the assumption.** True for ~99% of corporate gmail / outlook / Apple Mail / mobile mail clients. Fragile for: terminal mail readers (mutt, alpine), accessibility-tooling defaults, security-paranoid clients that auto-strip HTML.
- **(b) No multipart/alternative envelope.** A standard email best-practice is to ship `multipart/alternative` with `text/plain` first and `text/html` second — the recipient client picks the best supported. ODD does NOT do this; the MimeMessage is `text/html` only.
- **(c) Operational simplicity over best-practice compliance.** The 3-arg overload would require either (a) maintaining two templates (`email.ftlh` + `email.txt.ftlh`) with content parity, or (b) HTML-to-text conversion at send time (e.g. Jsoup `.text()` call). The maintainer chose simplicity over compliance.
- **(d) The decision is REVERSIBLE without architectural change.** Switching to `helper.setText(plaintext, html)` is a one-line change + one template addition. The decision is structural enough to be ADR-codified (it's a deliberate stance, not an accident) but the reversal cost is bounded.

**Wisdom test**: PASS on all three questions (borderline LOW-severity).
1. **Intentional?** YES (borderline) — the choice is explicit (`true` boolean is unambiguous), but no comment in the code explains the choice. The intent is inferred from the explicit boolean + the absence of a `.txt` companion template. The `.ftlh` template's structure also signals intent — it carries HTML markup throughout, not "lowest-common-denominator-plaintext-with-optional-HTML-decoration."
2. **Structural impact?** LIMITED — every email notification's body is HTML-only; recipients in non-HTML-capable client environments see raw markup. The structural impact is real but bounded to one channel.
3. **Refactoring or structural?** This is borderline-structural — adding a plaintext alternative requires maintaining a second template (a design commitment, not just code). But the implementation cost is small. Classified as structural on the basis that the maintainer's deliberate omission is a design statement.

**Existing ADR**: none in `adrs/`. Composes with ADR-CANDIDATE-183 (Freemarker `.ftlh` template — the HTML-only template is the artefact this ADR depends on).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- (No new scope; the existing live-doc framing does not name HTML-only delivery — DOC-NNN candidate if maintainer wants to surface)

**Proposed action**: Promote to `adrs/drafts/email-html-only-body.md` (new ADR). Document the deliberate omission + the trade-off (accessibility-tooling-fragility) + the reversal path (a one-line `setText(plain, html)` change + one template addition). Doc-side: the live notifications page should mention HTML-only delivery so operators evaluating ODD against accessibility-compliance requirements can make an informed choice.

**Severity rationale**: LOW — the decision is real but bounded to one channel; the reversal cost is small; the operator-visible impact is limited to a thin segment of mail clients; not security-critical.

---
