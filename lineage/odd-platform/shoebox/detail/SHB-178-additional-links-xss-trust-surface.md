# SHB-178 — Operator-Configured Additional Links — URL scheme unvalidated + reverse-tabnabbing (enricher of F-035)

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators who use the `odd.links[]` feature (F-035) to surface internal wikis / dashboards / runbooks in the App Info menu have no platform-side validation that link URLs are http(s) URLs to non-malicious destinations. The `AdditionalLinkProperties` record (`title, url`) has NO `@URL` constraint, NO `@Pattern` scheme allowlist, NO `@NotBlank` on either field; the controller passes the operator-configured strings through verbatim to the React UI; the UI renders them as `<a target="_blank">` WITHOUT `rel="noopener noreferrer"`. This produces three operator-trust failures: (a) `javascript:` and `data:text/html` URLs MAY render (React 17+ neutralises `javascript:` in `<a href>` but `data:` URI scheme depends on the browser), (b) every operator-configured page can call `window.opener.location` to navigate the parent ODD tab to a phishing page (reverse tabnabbing), (c) operator config supplied with a typo'd field (`url` set but `title` unset) renders as a broken `<a href>` with no label. The feature surface is global — every authenticated user (and under DISABLED auth, every network caller) sees the full link catalog including any internal-network URLs the operator configured.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/properties/AdditionalLinkProperties.java:7-9` — `record AdditionalLinkProperties(List<Link> links) { record Link(String title, String url) {} }` — no JSR-303 annotations on either field.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/LinksController.java:25-36` — passthrough mapper `linkProperties.links().stream().map(l -> new Link().title(l.title()).url(l.url())).toList()` — no scheme normalisation, no XSS scrub.
- `odd-platform-ui/src/components/shared/elements/AppToolbar/AppInfoMenu/AppInfoMenu.tsx:60-66` — `<Link key={link.url} to={link.url} target='_blank'>{link.title}</Link>` — `target='_blank'` is set but no `rel='noopener noreferrer'` attribute; React 17+'s default `<a>` rendering of `javascript:` URLs is neutralised at runtime, but `data:` is not.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `/api/links` is NOT in `WHITELIST_PATHS` but also not in `SECURITY_RULES`; the controller relies on the framework-default `pathMatchers("/**").authenticated()` (AuthorizationCustomizer.java:29-30). Under DISABLED mode, the endpoint is reachable unauthenticated.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (verified 2026-05-25 status 200) — page describes `odd.links` as "absolute URL opening in a new tab" but does NOT warn about scheme validation, does NOT warn about reverse tabnabbing, does NOT warn about the no-RBAC / global-visibility posture.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/LinksController.java:3` — unused `import java.util.Collections` (the file uses static `Collections.emptyList()` import — dead import is a cosmetic but suggests low maintenance attention on this file).
- `application.yml:11-20` (the `odd.links` block is COMMENTED OUT in the shipped config — operators are expected to write it themselves with no template-side validation).

## Notes

- **This is an ENRICHER of F-035** (Operator-Configured Additional Links — odd.links[] menu). F-035 names WHAT the feature does; this thread names the OPERATOR-TRUST SURFACE shape — URL validation gap + reverse tabnabbing + global visibility + boot-time-immutable binding. F-035's facet enumeration probably names these as drift_class but does not have file:line evidence on the rel-noopener gap or the scheme allowlist gap.
- **Reverse tabnabbing is the realistic threat.** The threat scenario: an operator configures `odd.links[0].url=https://internal-wiki.example.com`. An attacker who controls a page at that URL (compromised internal wiki, third-party content-injection) calls `window.opener.location = "https://phishing.example.com"` from JavaScript. The parent ODD tab navigates to the phishing page; the user's ODD session is replaced by an attacker-controlled login page that captures the next credentials. The MITRE-defined `noopener` keyword in `rel` is the standard mitigation; React's auto-defence depends on React-Router-specific link rendering, but the toolbar's plain `<a>` element bypasses this.
- **The boot-time-immutable surface is an operator-surprise risk.** `@ConfigurationProperties` binding is one-shot at application context startup. An operator who edits `application.yml` to add a new link in a running container expects the change to take effect on next page-load; it does not until the platform restarts. The docs don't mention this.
- **The no-RBAC / global-visibility posture leaks internal-network URLs.** Operators who configure internal wiki / runbook / Grafana URLs (the documented use case) expose those URLs to every authenticated user including read-only / zero-owner users. Per-role visibility would require per-link role tagging (`odd.links[].roles: [ADMIN]`) — not currently supported.
- **The "two scopes for /api/links" defect (path-namespace collision).** `/api/links` (this controller — global operator-configured catalog) and `/api/dataentities/{id}/links` (per-entity attachments) reuse the word "links" for semantically different concepts. The OpenAPI tags (`links` vs `dataEntityAttachment`) disambiguate at spec layer; the URL space alone is confusing.
- This is a `clustering` thread — evidence is across the YAML namespace + the Properties class + the controller + the UI consumer + the live docs + the security constants. Graduation gate met; the call is whether to (a) graduate as a sibling feature `F-NNN — Additional Links Operator-Trust Surface` or (b) FOLD as a comprehensive facet update of F-035. Recommend (b) — F-035's anchor is the right home; this thread fills in the operator-trust drift class.

## Next

1. **Fold into F-035** — feature-flow-builder should pull this thread's evidence into F-035's `drift_classes` enumeration: `[url_scheme_not_validated_javascript_data_passthrough, reverse_tabnabbing_no_rel_noopener, no_per_role_visibility_internal_url_leak_to_all_auth_users, boot_time_immutable_binding_no_runtime_refresh, public_under_disabled_mode]`. Update F-035's primary_subject list to include AppInfoMenu.tsx:60-66.
2. **Open follow-ups**:
   - SEC-NNN — UI fix: add `rel='noopener noreferrer'` to the AppInfoMenu link rendering (one-line change in AppInfoMenu.tsx).
   - SEC-NNN — backend fix: add `@Pattern("^https?://")` or `@URL` constraint on `Link.url`, and add `@PostConstruct validate()` to `AdditionalLinkProperties` rejecting javascript:/data:/file:/vbscript: schemes.
   - DOC-NNN — operator page should add an admonition: "Operator-configured `odd.links` URLs are visible to every authenticated user and rendered in `<a target='_blank'>` elements. Restrict configured URLs to trusted internal services."
3. **Probe** — manually test a `data:text/html,<script>alert(1)</script>` URL in a `odd.links` entry against the current React 18-based UI; confirm whether modern Chrome / Firefox renders or rejects `data:` URLs in `<a href>` contexts.
4. **Confirm if intentional** — the "global visibility" semantic is probably deliberate (operator-curated links should be visible to all users by design); the missing rel-noopener and scheme allowlist are likely unintentional.

## Links

- cluster_with: [F-035]
- merged_into: (open — feature-flow-builder to fold into F-035)
- supersedes: []
