---
doc_page: "docs/Features.md"
page_title: "Features"
live_url: "https://docs.opendatadiscovery.org/features/features.md"
live_url_verified_status: "200"
live_url_resolved_slug: "features/features"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Activity Feed"
    - "Attachment"
    - "Attachment Storage Backend"
    - "Directory"
    - "Ingestion Filter"
    - "GenAI Assistant"
    - "Notifications"
  features:
    - "F-039"
  code_nodes:
    - "odd-platform java FeatureController controller-class:FeatureController"
    - "odd-platform java GenAIController controller-class:GenAIController"
audience: [operator, developer]
doc_claim_vs_code:
  - "The Data-Collaboration hint block lists `genai.enabled` among the keys 'covered by this caveat … added under the same @Value boot-injection pattern' (boot-immutable + restart-required). Code: `genai.enabled` is NOT boot-snapshotted and NOT a @Value feature flag — it is re-read at the SERVICE layer on every call via `genAIProperties.isEnabled()` (GenAIServiceImpl.java:37), is NOT one of the two `Feature` enum values (components.yaml:115-119 = only DATA_COLLABORATION, ALERT_NOTIFICATIONS), and never flows through FeatureResolver/`GET /api/features/active`. The boot-immutable half of the caveat is therefore false for `genai.enabled`. Evidence: odd-platform java GenAIController controller-class:GenAIController / GenAIServiceImpl.java:37-39; odd-platform java FeatureController controller-class:FeatureController / FeatureResolverImpl.java:16-31, components.yaml:115-119."
  - "The chrome-invariant caveat names 'GenAI assistant' as one of the always-rendered top-level tabs governed by the feature-flag mechanism. Code: GenAI is not driven by a `WithFeature` wrapper at all (only the two `Feature` enum values feed `WithFeature`), so its tab visibility is not feature-gated client-side via the active-feature set the caveat describes. The 'tab always renders' direction is harmless, but the stated mechanism ('@Value boot-injection pattern' / active-feature set) does not apply to GenAI. Evidence: odd-platform java FeatureController controller-class:FeatureController / FeatureResolverImpl.java:16-31, App.tsx:46-51, WithFeature.tsx:15-36."
  - "The boot-immutable caveat is silent on the FeatureResolverImpl bare-SpEL boot-failure hazard: `${datacollaboration.enabled}` / `${notifications.enabled}` are bound WITHOUT a `:false` SpEL default (FeatureResolver.java:6-10, FeatureResolverImpl.java:16-31). An operator who writes a minimal externalised application.yml that omits either key — exactly the 'edit the configuration and restart the JVM' workflow the page recommends — bricks startup with an opaque `BeanCreationException: Could not resolve placeholder`. Stock installs are safe (bundled application.yml supplies the defaults). Surfaced as REFACTOR-625; a missing-caveat (LSN-001/002 class). Evidence: REFACTOR-625 / FeatureResolver.java:6-10, FeatureResolverImpl.java:16-31, application.yml:172-173, 200-205."
maintainer_curated: false
---

# Features — doc understanding

`docs/Features.md` is the platform's one-page **feature index**: a quick-scan H1 page whose ~38 H2 sections each give a 1-3 sentence description of a feature and then cross-link to its dedicated canonical page (the six governance pillars, `active-platform-features/*`, `developer-guides/api-reference`, or `configuration-and-deployment/odd-platform`). Most sections are pointer prose — the implementing detail (and the code↔doc binding) lives on the dedicated page each section links to, which carries its own `doc-understanding` sidecar — so this page's own confirmed bindings are deliberately few rather than padded to all 38 features.

The two sections with substantive, code-checkable original content are **Metadata Storage** (single-PostgreSQL claim) and the **boot-immutable / chrome-invariant** `{% hint warning %}` block under Data Collaboration. The caveat block is the page's only operator-critical original claim and binds directly to the feature resolver: `FeatureController` exposes `GET /api/features/active` as a boot-time-computed immutable view (`FeatureResolverImpl.java:16-31`, `private final Set<Feature>`), confirming both that the active feature set is frozen at JVM boot and that `/actuator/refresh` is not reflected (`invariant:feature-flag-boot-snapshot-immutable`). The drift is in the caveat's *scope*: it sweeps `genai.enabled` into the same boot-immutable `@Value` mechanism, but GenAI is gated at the service layer on every call (`GenAIServiceImpl.java:37`) and is not a `Feature` enum value — see `doc_claim_vs_code`. The block also omits the bare-SpEL boot-failure hazard (REFACTOR-625) that its own "edit config and restart" advice can trigger.

Live verification: `https://docs.opendatadiscovery.org/features/features` resolves 200 (final URL carries a `.md` suffix; the mechanical `doc-nodes.jsonl` guess of bare `/features` is a redirect target, not the canonical slug). GitBook renders the page H1 as "Overview" (the SUMMARY label) rather than the source H1 "Features". All 38 H2 anchors render.

## Maintainer notes
