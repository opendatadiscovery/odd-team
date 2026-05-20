## ADR-CANDIDATE-188 — Generic Webhook is a THIN PROXY over `java.net.http.HttpClient` — no transport adapter, no per-message middleware, no signing / no auth headers / no retry / no batching; operator owns ALL receiver-side concerns

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate-simplicity stance; mirrors GenAI thin-proxy ADR-CANDIDATE-005)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature webhook channel)]
**Support count**: 1 sidecar primary source (batch Y WebhookNotificationSender) + cross-batch corroboration with ADR-CANDIDATE-005 (GenAI thin-proxy — sibling stance for a different outbound HTTP feature) + live-doc anchor at `https://docs.opendatadiscovery.org/features/active-platform-features/notifications` (verified 2026-05-20 status 200) naming "The receiver is expected to extract any URLs it needs from the alert payload itself"
**Axes present**: notification.sender
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `WebhookNotificationSender.md:implicit_adrs.[0]` (HIGH) — "**Thin proxy over `java.net.http.HttpClient` — no transport adapter, no per-message middleware.** The sender is a 30-line subclass that sets URI, sets POST body, and delegates to the parent's `sendAndValidate`. Encodes the deliberate-simplicity stance for the generic-webhook channel: ODD is the data producer, the operator's webhook endpoint is the data consumer, and the wire format is verbatim JSON with no interposing transform. Any operator-side concern (signing, headers, retry, batching, fan-out, transformation) is the operator's to implement at the receiver." — intent_anchor: the class body literally builds the request with `.uri(webhookUrl).POST(BodyPublishers.ofString(serializeJson(message))).build()` and delegates to parent — no per-channel customisation hook (WebhookNotificationSender.java:10-30)

**Decision statement**: ODD's generic Webhook notification channel is a **30-LINE thin proxy** over `java.net.http.HttpClient`. The entire `WebhookNotificationSender` class consists of:
- Constructor (3 lines) storing the URL + delegating HttpClient to parent
- `send(AlertNotificationMessage)` (5 lines) — `HttpRequest.newBuilder().uri(webhookUrl).POST(BodyPublishers.ofString(JSONSerDeUtils.serializeJson(message))).build()` + parent's `sendAndValidate(request)` call
- `receiverId()` (3 lines) returning the literal `"Generic webhook"`

No middleware, no transform, no signing, no custom headers, no retry, no batching, no buffering, no per-call configuration, no auth headers, no Content-Type setting, no idempotency-key generation, no message-id assignment, no payload filtering, no PII redaction. The payload is `JSONSerDeUtils.serializeJson(AlertNotificationMessage)` verbatim — every field that exists on the DTO reaches the receiver.

The architectural commitments:
- **(a) "ODD is the data producer; the receiver is the data consumer."** The thin-proxy stance encodes a deliberate scope boundary. The platform's responsibility ends at "POST the JSON to the URL." The receiver's responsibility includes: authentication (HMAC verification, IP allowlisting, mTLS), retry / DLQ / idempotency, payload validation, PII redaction, fan-out to per-team destinations, custom header generation, format transformation. The live doc states this verbatim: "The receiver is expected to extract any URLs it needs from the alert payload itself."
- **(b) Symmetric with the GenAI thin-proxy stance.** ADR-CANDIDATE-005 (GenAI thin proxy) captures the SAME architectural posture for the GenAI feature — "forward question text, return answer text" with no prompt construction, no retrieval-augmentation, no caching, no rate-limiting. The platform has a consistent stance: outbound HTTP integrations are thin proxies. Operators who need richer integration semantics deploy a gateway in front of the URL.
- **(c) Operator deployment burden is REAL but explicit.** A platform with strict-receiver requirements (HMAC signing, Authorization header, rate-limiting, retry on 5xx) must run an HTTP gateway (nginx, envoy, traefik) in front of the receiver. The doc burden is real — operators reading the live doc need to know they own the receiver-side concerns; REFACTOR-513 + REFACTOR-528 capture the doc gaps.
- **(d) The thin-proxy stance does NOT defend the absence of features.** Per the GenAI ADR's call-out ("'thin proxy' does NOT defend the absence of rate-limiting/sanitisation/audit"), this ADR explicitly does NOT defend: no HMAC (REFACTOR-513), no auth header (REFACTOR-528), no retry (REFACTOR-518), no audit (REFACTOR-518). Those gaps are operator-burden trade-offs surfaced explicitly under refactoring-scopes.md.
- **(e) Future "rich webhook" features are scope-expansion candidates.** A maintainer proposing "let's add HMAC signing to Webhook" or "let's add per-status-code Retry-After honoring" is making a scope-expansion the ADR would force them to confront — the question becomes "do we want to step out of the thin-proxy stance?" rather than "should we add a small feature?".

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments:
   - The 30-line class body — the file literally contains the minimum to make the contract work. No infrastructure (no header-builder, no signing-utility, no retry-loop). The maintainer chose minimalism.
   - The live-doc statement "The receiver is expected to extract any URLs it needs from the alert payload itself" — operator-facing documentation of the thin-proxy stance.
   - The symmetry with ADR-CANDIDATE-005 (GenAI thin proxy) — the same maintainer pattern across two outbound HTTP features signals a deliberate platform-wide architectural stance.
2. **Structural impact?** YES — every future "add receiver-side concern to ODD" feature must work AROUND the thin-proxy stance; every operator's deployment topology depends on this stance (run gateway in front OR pick a receiver compatible with thin proxying).
3. **Refactoring or structural?** STRUCTURAL — adding HMAC signing or custom auth headers requires extending the sender + the `@ConfigurationProperties` schema + the `@Bean` factory. Not a small refactor. The stance is the architectural choice; the absence of features is the consequence.

**Existing ADR**: none in `adrs/`. Composes deeply with ADR-CANDIDATE-005 (GenAI thin proxy — same architectural pattern for a different outbound HTTP feature), ADR-CANDIDATE-186 (one-shot fire-and-forget — the parent contract), ADR-CANDIDATE-187 (single-destination-per-deployment — the URL is bound once at construction).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-513 NEW batch Y (Webhook no HMAC / signature / shared-secret — operator's receiver cannot verify origin; HIGH)
- REFACTOR-514 NEW batch Y (cross-tenant data exposure — full payload to one URL across all owners/namespaces/tenants; HIGH)
- REFACTOR-515 NEW batch Y (no connect/request timeout — unreachable URL hangs WAL consumer thread; HIGH)
- REFACTOR-518 NEW batch Y (no retry/DLQ/audit — transient failure drops alerts permanently; HIGH)
- REFACTOR-521 NEW batch Y (200-only HTTP accept — common 2xx codes treated as failure; MEDIUM)
- REFACTOR-522 NEW batch Y (no Content-Type header — strict receivers reject the request; LOW)
- REFACTOR-528 NEW batch Y (no custom auth header support — deployment burden of running HTTP gateway; MEDIUM)
- REFACTOR-527 NEW batch Y (receiverId asymmetric label `"Generic webhook"` with capital G + space — log grep inconsistency; LOW)

**Proposed action**: Promote to `adrs/drafts/generic-webhook-thin-proxy.md` (new ADR). Document the thin-proxy stance + the explicit non-defended gaps (REFACTOR-513/518/528 are the price; operators evaluating ODD should see them as documented operator-burden, not as bugs). Doc-side: the live notifications page already states the stance for the Webhook channel ("The receiver is expected to extract any URLs..."); the ADR is the canonical source. Cross-link with ADR-CANDIDATE-005 (GenAI thin proxy) and surface the "thin proxy stance is platform-wide for outbound HTTP" framing.

**Severity rationale**: HIGH — defines the platform's outbound webhook integration architecture; serves as guard against scope-expansion ("let's add HMAC" requires re-evaluating the thin-proxy stance); cross-references the highest-severity operator-burden gaps (HMAC, retry, DLQ, timeout).

---
