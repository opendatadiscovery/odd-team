---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-25T00:00:00Z
consulted_by: maintainer-direct
consultation_question: For CTRIB-035 (#1762), is the issue's class-wide IllegalArgumentException→400 mapping product-correct, or should genuine user-input validation raise the platform's BadUserRequestException while server-fault IAEs stay 5xx — and what is the right HTTP code + info-disclosure posture for the missing-bean and invalid-policy-JSON cases?
slug: ctrib035-illegalargument-http-contract
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# CTRIB-035 (#1762): the IllegalArgumentException → HTTP 400 change request

## TL;DR

The issue is right that today's behaviour is a defect (a mistyped policy permission returns `500 / "Internal Server Error"` with the real reason hidden in the server log), but its *fix* — a class-wide `@ExceptionHandler(IllegalArgumentException.class) → 400` — is an industry anti-pattern: `IllegalArgumentException` (IAE) is a broad JVM superclass thrown overwhelmingly for **server-side invariant/config faults** (43 of your 45 sites), and a 4xx blanket would (a) lie to clients about who erred, (b) silence the 5xx alerts operators rely on, and (c) leak internal fault messages to callers. **Recommend Option B**: route the one genuinely user-reachable path (`PolicyJSONValidator`) through the platform's existing `BadUserRequestException → 400` and leave every server-fault IAE as 5xx. This conforms to odd-platform's own typed-exception convention — the strongest in-repo signal — rather than papering over it. The missing-permission-extractor-bean case is a **5xx (a deployment/wiring fault), not a 4xx**: the client cannot fix it by changing the request, which is the RFC test for 4xx.

## Question scope

Four sub-questions (archetype: **comparative + implicit-requirements**, with a security/info-disclosure axis):
1. HTTP class (4xx vs 5xx) for a "valid resource type whose permission-extractor bean was not deployed."
2. Is "all IAE → 400" an industry-accepted REST pattern or an anti-pattern?
3. For the invalid-policy-JSON path: is 400-with-validation-detail correct, and is there an info-disclosure concern surfacing JSON-Schema errors?
4. Recommendation among (A) class-wide IAE→400, (B) targeted `BadUserRequestException`, (C) full 45-site audit.

Out of scope: the exact one-line code edit, the test names to add, and whether the validation detail should be wrapped in a structured `ProblemDetail`/RFC 9457 body vs a plain string (a separate, smaller call the caller can make at implementation). The 45-site enumeration and the live 500 reproduction are taken as given from the caller.

## Domain plausibility

This maps cleanly to a recognizable operator workflow, which is why the *symptom* the issue reports is a real defect:

- **Operator workflow — "author an RBAC policy" (P-08 Management → Policies tab; `system-mission.md:243`).** A data steward writes a policy granting permissions on an ODDRN pattern, mistypes one permission enum value, and POSTs. The expected outcome is a 4xx telling them *which* field is wrong so they can fix it in the UI. Today they get an opaque 500 and must have server-log access — which a steward authoring policies in the UI generally does not. **Verdict: HIGH-PLAUSIBILITY that a fix is warranted** — but the plausibility attaches to fixing the *user-input* path, not to blanket-remapping a JVM superclass.

The issue's headline case (a valid resource type whose permission-extractor bean was not deployed) is a **different animal**: it is not an operator authoring mistake, it is a platform that shipped without a bean it needed. That belongs to no operator workflow — it is a deployment/packaging fault. Treating it as a client error (400) would tell the operator "you sent a bad request" when the truth is "this build is mis-wired." That is a NOT-A-CLIENT-ERROR case.

## Implicit requirements (functional / security / performance / reliability)

- **Functional — the response code must name the right party.** A 4xx asserts the client can fix it by changing the request; a 5xx asserts the server is at fault and the request was reasonable. MDN, verbatim: a 400 client should "expect that repeating the request without modification will fail with the same error" (MDN 400, fetched 2026-06-25). For the invalid-policy-JSON case this holds (fix the JSON → it succeeds → correctly 4xx). For the missing-bean case it is **false** (re-POSTing the identical valid request will keep failing until the *server* is redeployed with the bean) → correctly 5xx. The RFC test cleanly separates your two cases. *Citation: MDN 400. Confidence: HIGH.*
- **Security — do not leak internal fault text to clients.** 43 of the 45 IAE sites carry server-internal messages ("Slack OAuth token is empty", jOOQ query-building failures, WAL-decode failures, internal mapper failures). A class-wide IAE→400 that echoes `ex.getMessage()` would surface those to any caller — config hints, internal class/query structure, and the existence of un-deployed beans. ODD's catch-all already does the safe thing here: it returns a generic `"Internal Server Error"` body and `log.error`s the detail server-side (caller-supplied; corroborated at `ControllerAdvice.java:61-66` per the PolicyServiceImpl sidecar, `PolicyServiceImpl.md:213`). A blanket remap would *regress* that posture. *Citation: in-repo sidecar + caller-verified ControllerAdvice. Confidence: HIGH.*
- **Reliability — preserve the 5xx alerting signal.** Operators of a data platform alert on 5xx rate as the "something is broken server-side" signal and treat 4xx as "clients are sending bad input" (a different, lower-urgency dashboard). Folding server faults (un-deployed bean, WAL-decode failure, config-empty) into 4xx would make a genuinely broken deployment *invisible* to the 5xx alert that should page someone. This is the same failure-class as the LSN-001/LSN-002 "silent" defects this workspace exists to prevent — a real fault dressed up as benign. *No citation — domain knowledge; the underlying 4xx/5xx semantics are RFC-anchored above. Confidence: HIGH.*
- **Functional — info disclosure for the *intended* validation path is acceptable and expected.** Surfacing JSON-Schema validation errors (field paths + the allowed permission enum values) on the policy-authoring path is *the point* — the steward needs to know which field failed and what the legal values are. The allowed permission set is not a secret: it is already returned to any authenticated user by `GET /api/policies/schema` (the live JSON Schema endpoint; PolicyServiceImpl `getPolicySchema`, `PolicyServiceImpl.md:224`), and policy authoring is gated by `POLICY_CREATE`/`POLICY_UPDATE` permissions anyway. So echoing the validator's detail on this one path discloses nothing the caller cannot already fetch. *Citation: in-repo sidecar. Confidence: HIGH.*

## Industry vocabulary alignment

- **Is "all IAE → 400" a sanctioned pattern? No — Spring itself declines to do it.** Spring's reference docs state Spring provides **no automatic mapping** for generic exceptions like `IllegalArgumentException` (they "are not Spring MVC exceptions, so they're not handled by the framework's built-in mechanisms"), and an unhandled exception "typically results in a 500 Internal Server Error by servlet container defaults" (docs.spring.io mvc-ann-rest-exceptions, fetched 2026-06-25). Spring deliberately leaves IAE→4xx as an *opt-in per-application* choice precisely because IAE is too broad to map globally. odd-platform already follows the sanctioned pattern: a **typed** exception hierarchy (`BadUserRequestException → 400`, `NotFoundException → 404`, `CascadeDeleteException → 400`, etc.) where each type encodes the intended HTTP contract. The issue's blanket-IAE handler abandons that typed convention.
- **The semantic axis: syntactic vs semantic invalidity.** If the caller later wants to be precise: 400 is "malformed request syntax, invalid request message framing" (MDN 400), whereas **422 Unprocessable Content** is "the syntax of the request content was correct, but it was unable to process the contained instructions" — i.e. well-formed JSON that fails business/schema validation (MDN 422). A policy whose JSON parses but names an illegal permission is textbook 422. **However**, odd-platform's established convention is `BadUserRequestException → 400` for all user-input rejection (it has no 422 in its `ControllerAdvice`), so the **conformant** choice is 400 via `BadUserRequestException` — consistency with the in-repo pattern outranks the 422 nicety. Flagging 422 only so the caller can make the call deliberately, not by omission.
- **Recommended alignment: preserve** odd-platform's typed-exception vocabulary; **do not** introduce a broad-superclass catch that bypasses it.

## Operator workflows this feature participates in

- **Author an RBAC policy (P-08 Management):** the steward must get an actionable 4xx with the offending field — Option B delivers exactly this by routing `PolicyJSONValidator` through `BadUserRequestException`.
- **Diagnose a broken deployment (platform-operator):** when a permission-extractor bean is missing, the operator needs a 5xx on their error dashboard + the full stack trace in the log (which the catch-all already does) — NOT a 400 that hides the wiring fault as "client sent something odd."
- **Integrate against `/api/*` programmatically (odd-api-consumer):** an SDK/script author relies on 4xx-means-fix-your-payload, 5xx-means-retry-or-page-the-operator. The blanket remap breaks that contract for the 43 server-fault sites.

## Competitor comparison

Limited, because the question is a general HTTP-contract question and the most authoritative sources are the HTTP spec + the framework odd-platform runs on (both cited above). The one data-catalog API-error page I could verify did not cover error semantics, recorded honestly:

| System | Equivalent area | Notable behaviour | URL (verified) |
|---|---|---|---|
| Spring Framework (odd-platform's stack) | REST exception handling | No auto-map of `IllegalArgumentException`; unhandled → 500; per-app `@ExceptionHandler` required; `ProblemDetail` example surfaces `ex.getMessage()` | docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html (200) |
| DataHub | Rest.li API overview | Page does **not** document error/status-code mapping — could not verify DataHub's IAE/4xx/5xx posture | docs.datahub.com/docs/api/restli/restli-overview (200, but silent on errors) |

I did not burn further budget hunting competitor error tables: the RFC/MDN semantics + Spring's explicit "we don't auto-map IAE" + odd-platform's own typed-exception convention already settle the question with HIGH confidence. A competitor survey would not change the recommendation.

## Recommended framing for the caller

**Ship Option B: make the one genuine user-input validator throw `BadUserRequestException` (→ 400, surfacing its detail), and leave all server-fault IAEs as 5xx. Reject Option A. Skip Option C as a blocker (log it as a follow-up).**

Why B over A: A maps a broad JVM superclass — thrown 43:2 for server/config/invariant faults — to a client-error code, which simultaneously (1) misattributes server faults as client errors against the RFC test (MDN 400/500), (2) suppresses the 5xx signal operators page on, and (3) risks leaking internal fault messages ("Slack OAuth token is empty", jOOQ internals) to any caller. B fixes the *actual* reported defect (the opaque 500 on a mistyped policy) at its source by conforming to odd-platform's existing typed-exception contract — `BadUserRequestException` is already imported and used in the very same `PolicyServiceImpl` class (`PolicyServiceImpl.md:265`), so the change is idiomatic, one-line at the validator, and self-documenting.

Why not C as a blocker: a full 45-site audit is valuable but is a separate, larger piece of work — and crucially, the *other 44 sites are behaving correctly today* (server faults → 5xx is the right answer). Auditing them is a hygiene pass, not a bug fix; making CTRIB-035 wait on it would hold a correct one-line fix hostage to a sweep. Recommend: ship B now, and log a follow-up backlog item ("audit the remaining IAE sites; confirm each is a genuine server-fault that should stay 5xx, or reclassify any further user-input paths to `BadUserRequestException`") on disk per `follow-up-on-disk` — do not narrate it only.

One caveat to fold into the implementation: confirm `PolicyJSONValidator`'s message is safe to surface (it lists field paths + allowed permission enum values — verified non-secret above, since `GET /api/policies/schema` already exposes the same schema). If any future validator carries internal detail, wrap the client-facing message rather than echoing `ex.getMessage()` wholesale.

## Caveats and uncertainty

- **45-site classification is the caller's, taken as given.** I did not independently re-walk all 45 `throw new IllegalArgumentException` sites; the 43:2 server-fault:user-input split is the caller's enumeration. The PolicyServiceImpl sidecar independently corroborates the one user-input site (`PolicyJSONValidator` throwing IAE, the IAE→500 fallthrough, the handler set in `ControllerAdvice`) — `PolicyServiceImpl.md:78,109,213,265` — which raises my confidence in the caller's framing to HIGH for the load-bearing path. If the audit (Option-B follow-up) surfaces a *second* genuine user-input IAE site, it gets the same `BadUserRequestException` treatment.
- **422 vs 400 is a deliberate-choice flag, not a defect.** I recommend 400 (via `BadUserRequestException`) for in-repo consistency, while noting 422 is the technically-tighter code for well-formed-but-invalid content (MDN 422). The caller should pick 400 *deliberately* (it is the conformant choice), not be unaware of 422.
- **No data-catalog competitor error-table verified.** DataHub's Rest.li page is silent on error semantics; I did not substitute a guessed page. This does not weaken the recommendation — the RFC + Spring + in-repo convention are the authoritative anchors for an HTTP-contract question.
- **RFC 9110 §15 not quoted verbatim** — the IETF page truncated before the status-code section; I anchored the 4xx/5xx and 400/500/422 definitions on MDN, which restates RFC 9110 normatively. The decisive 400 test ("repeating the request without modification will fail with the same error") is quoted from MDN verbatim.

## Citations

- `lineage/odd-platform/understanding/odd-platform__java__service__service__PolicyServiceImpl.md` (read 2026-06-25) — independent in-repo corroboration of every code fact the caller supplied: line 78 (validator throws `IllegalArgumentException`; no `@ExceptionHandler`, falls through catch-all → HTTP 500 not 400), line 109 (validator's exception-class choice vs project-standard `BadUserRequestException`), line 213 (catch-all returns `"Internal Server Error"` + the validator's real message hidden), line 224 (`GET /api/policies/schema` exposes the schema to authenticated users — info-disclosure baseline), line 265 (`BadUserRequestException` already imported/used in the same class; "the fix is … one-line").
- `lineage/odd-platform/system-mission.md:243` (read 2026-06-25) — P-08 Management → Policies tab; the operator-authoring workflow the user-input path serves.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400 — last_verified_status: **200** (fetched 2026-06-25). Quote: "indicates that the server would not process the request due to something the server considered to be a client error … typically due to malformed request syntax, invalid request message framing, or deceptive request routing." Decisive test, quote: "Clients that receive a `400` response should expect that repeating the request without modification will fail with the same error."
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/500 — last_verified_status: **200** (fetched 2026-06-25). Quote: "indicates that the server encountered an unexpected condition that prevented it from fulfilling the request … a generic 'catch-all' response to server issues." Lists "Unhandled exceptions" as a 500 cause; "these issues require investigation by server owners or administrators."
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/422 — last_verified_status: **200** (fetched 2026-06-25). Quote: "the server understood the content type of the request content, and the syntax of the request content was correct, but it was unable to process the contained instructions" — the well-formed-but-semantically-invalid case (vs 400's malformed-syntax case).
- https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html — last_verified_status: **200** (fetched 2026-06-25). Spring provides no automatic mapping for `IllegalArgumentException`/`IllegalStateException` (not Spring MVC exceptions); unhandled → "500 Internal Server Error by servlet container defaults"; per-app `@ExceptionHandler` required; `ProblemDetail` example surfaces `ex.getMessage()`.
- https://datatracker.ietf.org/doc/html/rfc9110 — last_verified_status: **200 but §15 status-code text truncated** (fetched 2026-06-25) — could not quote 4xx/5xx verbatim from source; definitions anchored on MDN (normative restatement of RFC 9110) instead.
- https://docs.datahub.com/docs/api/restli/restli-overview — last_verified_status: **200 but silent on error/status-code semantics** (fetched 2026-06-25) — recorded honestly; not used as a load-bearing citation.
- https://restfulapi.net/http-status-codes/ — last_verified_status: **403 Forbidden** (fetched 2026-06-25) — recorded as failed; not used.
