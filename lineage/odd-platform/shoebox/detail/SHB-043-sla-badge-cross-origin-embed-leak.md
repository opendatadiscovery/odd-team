# SHB-043 — SLA badge PNG endpoint leaks per-dataset health colour cross-origin via cookie-bearing `<img>` embed

**Category**: open
**Severity**: MEDIUM

## Hypothesis

The `/api/datasets/{id}/sla` endpoint is the documented BI-embeddable SLA badge — it returns `image/png` and is explicitly designed to be loaded as `<img src="{platform_url}/api/datasets/{id}/sla">` from external dashboards, Confluence pages, Excel cells, and Notion docs (per `documentation/docs/data-quality/sla-statuses.md` 2026-05-20: "BI tools can fetch this endpoint per dataset and render the colour as a one-glance trust signal"). Because (a) the response sets no `Cache-Control: private`, no `X-Frame-Options`, no `Cross-Origin-Resource-Policy: same-origin`, no `Vary: Cookie`, and (b) the platform uses cookie-based session auth under `LOGIN_FORM`, an arbitrary attacker-controlled page rendered in a victim operator's browser can embed `<img src="https://{platform_url}/api/datasets/123/sla">`; the browser attaches the session cookie; the platform returns the PNG (cookie-bearing read); the attacker page observes the image dimensions / load-success to enumerate per-dataset SLA colour for every dataset id. The leak is bounded (the operator's eyes don't expose JSON metrics, only RED / YELLOW / GREEN), but a competitor / disgruntled internal user / phishing landing page can fingerprint the operator's entire DQ posture for any dataset id they can guess (sequential integers — trivially enumerable).

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataQualityController.java:41-48` — the `getSLA` method body: returns `Mono<ResponseEntity<Resource>>` with no `Cache-Control`, no `X-Frame-Options`, no `Cross-Origin-Resource-Policy` header manipulation. Just `.map(ResponseEntity::ok)`.
- `odd-platform-specification/openapi.yaml:1880-1896` — the operationId `getSLA` declares only `produces: image/png`; no security extensions, no CORS hints.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/sla/CachingByteArraySLAResourceResolver.java:44-49` — three hardcoded classpath PNGs are mapped from the `SLA` enum result; the bytes are 1-2 KB and visually identical for every dataset sharing a colour, so cross-tab inference is trivial.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/security/constants/SecurityConstants.java:243-246` — only the `setDataQATestSeverity` PUT carries a SecurityRule with `DATA_ENTITY` resource type; the four read endpoints (including `/api/datasets/{id}/sla`) fall through to `.pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`).
- `documentation/docs/data-quality/sla-statuses.md` (WebFetched 2026-05-20 status 200, quoted in DataQualityController sidecar `inferred_docs[1]`) — "BI tools can fetch this endpoint per dataset and render the colour as a one-glance trust signal next to dashboard tiles or report sections." The doc encourages cross-origin embed without naming a CORS / SameSite caveat.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/sla/SLACalculator.java:80-100` — the colour algorithm; the surface that leaks (3-valued ordinal) is bounded but ordered, so it directly reveals "this dataset's tests are failing."

## Notes

- The attack surface is real-world (this is the same shape as the "embed an image to fingerprint user state" CSRF-image-side-channel pattern). The mitigation is to set `Cross-Origin-Resource-Policy: same-origin` (or `same-site`) on the response — a single header that blocks the cross-origin embed unless explicitly served from a `<crossorigin>` attribute. Doing so would BREAK the documented BI-tool integration unless the embedding tool can present the cookie / a token (it usually cannot from a third-party browser context). The right fix is a token-bearing variant: `/api/datasets/{id}/sla?token={signed_token}` for the BI use case, and `Cross-Origin-Resource-Policy: same-origin` for the cookie-auth path.
- The badge is not in any F-NNN's scope explicitly — F-022 (Per-Dataset DQ Test Reports & SLA) describes the badge but as a feature, not as a cross-origin leak surface. This thread enriches F-022 with the security-boundary lens that the existing flow misses.
- A defence in depth would also include `Cache-Control: private` (otherwise an upstream cache could serve a victim's badge to another user — a documented WCAG / CWE-525 pattern), and a `Vary: Cookie` header (in case any reverse-proxy is in front).
- Under `auth.type=DISABLED` the entire concern moot — but DISABLED is dev-only; the concern is `LOGIN_FORM` / `OAUTH2` / `LDAP` deployments with cookie or session-bearer auth.
- The 1-2 KB byte budget per request makes the endpoint trivially enumerable — a malicious page embedding 1000 `<img>` tags (datasets 1..1000) costs ~2 MB; the leaks happen synchronously and an attacker can read `img.naturalWidth` / `img.complete` to confirm a successful (cookie-bearing) load.

## Next

1. **Probe**: write a small static HTML page that embeds `<img src="http://localhost:8080/api/datasets/{1..N}/sla">`, render it in a browser logged into a local ODD with cookie auth, observe whether the badges load.
2. **Decide**: is this a SEC-NNN refactor (set CORP header + provide a token-bearing BI variant) or a documentation caveat ("if you deploy on a shared subdomain with cookie auth, the badge is fingerprintable cross-origin")?
3. **Cross-reference**: do other PNG / file-serving endpoints (attachments, owner avatars, collector logos) share the same surface? `find odd-platform-api -name '*.java' -path '*Controller*' | xargs grep -l 'image/png\|application/octet-stream'` to enumerate.
4. **Promote OR enrich**: if probe confirms, this becomes F-022's security caveat (enricher) or a standalone F-NNN ("BI-embed surface — cross-origin governance"). Without a probe, defer.

## Links

- cluster_with: [F-022]
- merged_into: (open)
- supersedes: []

## evaluation

(feature-flow-builder will append a dated entry here on its next run.)
