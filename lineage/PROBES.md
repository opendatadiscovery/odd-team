---
artifact: PROBES (workspace-canonical, tracked with substrate)
date: 2026-05-08
mode: validation methodology + acceptance test list
overall_confidence: HIGH (methodology); MIXED (per-probe evidence)
seeded_from: adrs/drafts/research/code-lineage-substrate/PROBES.md
---

# PROBES — Probe-driven validation: how the substrate proves it covers the codebase

This is the workspace-canonical probe set, kept in sync with the substrate. The original research artefact lives at `adrs/drafts/research/code-lineage-substrate/PROBES.md`.

## Why this artifact exists

The i18n miss (2026-05-08) was discovered because the user picked a feature *they happened to know existed* and asked "what about this?" That probe is one of many. The user's framing was explicit: *"I don't care about i18n itself — it's just an example. I could pick another case and I will use them to check how the approach works whether or not it will cover all the parts of the code base."*

The substrate's MVP acceptance criterion **cannot** be a self-referential coverage % (the failure mode that produced the i18n miss in the first place). It must be **probe-driven**: a maintainer picks an arbitrary user-visible capability they know exists, runs it through the substrate, and verifies the substrate's enumeration finds it.

## Probe protocol

A probe is a four-step exercise:

1. **Name a user-visible capability.** Concrete, observable, the maintainer can describe in one sentence.
2. **Locate it in code.** Find the file or symbol that primarily implements it. (If the maintainer can't find it, that itself is a navigation gap — separate finding.)
3. **Run the substrate's enumeration query for that capability's expected axis.** E.g., for i18n, query `WHERE axis = 'ui_shell'`. For an SDK builder, `WHERE kind = 'spring-bean-factory'`.
4. **Pass / fail:**
   - **PASS** if the located code-location appears in the query result with a node of the expected kind, and the node carries doc-linkage metadata if a doc page exists, or `documents: null` if no doc page.
   - **FAIL** if the code-location is missing from results, or appears under the wrong kind, or carries wrong metadata.

A FAIL is one of three classes:
- **Axis gap** — the substrate's MVP doesn't have an axis for this kind of capability. Add the axis. Bump extractor version. Full rebuild.
- **Extractor bug** — the axis exists but the extractor's query missed the code-location. Patch the query. PATCH version bump.
- **Annotation gap** — the node exists but lacks `documents:`. Either add the annotation (if a doc page exists) or log the doc as missing.

## Seed probe set

These are the probes the user could pick on day one. Each is a real ODD platform/collector capability with known code-locations.

### Cross-cutting UI shell (the i18n class)

| Probe | What it tests | Expected axis | Expected node kind | Status today |
|---|---|---|---|---|
| **i18n / language switching** | Six-language UI bootstrap | `ui_shell` | `ui-shell-bootstrap` | UNDOCUMENTED — known gap (DOC-163 F-047) |
| **Theme switching / dark mode** | If MUI theme provider with theme toggle exists | `ui_shell` | `ui-shell-bootstrap` + `ui-shell-widget` | TODO — needs probe at MVP run |
| **Notifications bell (toolbar)** | The realtime/SSE-driven notification icon | `ui_shell` + `ws_sse_channels` (Phase 2) | `ui-shell-widget` + `ws-channel` | Partial — UI may be enumerated as a widget; backing channel needs Phase 2 |
| **App error pages (404 / 500 / unauthorized)** | The `AppErrorPage` component family | `ui_shell` | `ui-shell-widget` | UNDOCUMENTED (DOC-163 F-048) |
| **AppToolbar widget set** | Each individual toolbar widget (search, user menu, language, info menu) as a separately-addressable node | `ui_shell` | `ui-shell-widget` (one per widget) | UNDOCUMENTED (DOC-163 F-049) |
| **Auth login form** | The login page and its providers (form, OIDC, LDAP, S2S) | `ui_shell` + `controllers` | `ui-shell-bootstrap` + `controller` | Partial — controllers covered (`enable-security/authentication/`); UI shell side not |
| **Logout flow** | The logout button + auth.login-form-redirect | `ui_shell` + `config_prefixes` | `ui-shell-widget` + `config-key-consumer` | UNDOCUMENTED (DOC-163 F-051) |
| **Active-features toggle (`/api/features/active`)** | Runtime feature-flag surface | `ui_shell` + `controllers` | `ui-shell-bootstrap` (fetchActiveFeatures) + `controller` | UNDOCUMENTED (DOC-163 F-050) |
| **Keyboard shortcuts** | Any global hotkey registration (e.g., `Ctrl-K` for command palette) | `ui_shell` | `ui-shell-bootstrap` | TODO — may not exist; probe will tell |

### Backend surfaces invisible to the route-axis

| Probe | What it tests | Expected axis | Expected node kind | Status today |
|---|---|---|---|---|
| **WebSocket / SSE channels** | `@MessageMapping` handlers, SSE emitters | `ws_sse_channels` (Phase 2) | `ws-channel` | DEFERRED to Phase 2 — flag in MVP rollup |
| **Spring Bean factories with SDK builders** | The MinioConfig-class case (LSN-002) | `sdk_builders` (Phase 2) | `spring-bean-factory` with `sdk_class:` annotation | DEFERRED to Phase 2 |
| **Config prefixes (genai, attachments, datacollaboration, search)** | Top-level YAML namespaces with `@ConfigurationProperties` | `config_prefixes` | `config-properties-class` + `config-key-consumer` | MVP — must work |
| **String-keyed `@Value` consumers** | `@Value("${some.key}")` reads | `config_prefixes` | `config-key-consumer` | MVP — must work |
| **Async/scheduled jobs (`@Scheduled`)** | Background tasks not exposed via HTTP | (new axis: `scheduled_jobs`) | `scheduled-job` | LIKELY GAP — probe will surface; new axis if confirmed |
| **Database migrations (Flyway/Liquibase)** | Migration files as nodes for ordering / dependency analysis | (new axis: `db_migrations`) | `db-migration` | LIKELY GAP — Phase 2 candidate |
| **Spring Boot Actuator endpoints (`management.*`)** | health / prometheus / env / info exposures | `config_prefixes` | `config-properties-class` (Spring Boot owned) | UNDOCUMENTED (DOC-163 F-054) — security-relevant default |

### Collectors-side surfaces

| Probe | What it tests | Expected axis | Expected node kind | Status today |
|---|---|---|---|---|
| **Each collector adapter (Snowflake, Postgres, BigQuery, etc.)** | All 40+ adapters as individually-addressable nodes | (collectors-specific axis: `collector_adapters`) | `collector-adapter` | MVP — must work for all 40+ |
| **Adapter shared base classes** | The class N adapters inherit from | `collector_adapters` (template aggregation) | `collector-adapter-base` | MVP |
| **CLI entry points (`pyproject.toml` scripts)** | CLI commands surfaced as nodes | (collectors-specific axis: `cli_entrypoints`) | `cli-entrypoint` | MVP nice-to-have |
| **Adapter config schemas (typed-settings models)** | Pydantic / typed-settings models per adapter | `config_prefixes` | `config-properties-class` (Python flavour) | MVP |

### Documentation-side surfaces

| Probe | What it tests | Expected axis | Expected node kind | Status today |
|---|---|---|---|---|
| **Pages with no source-side `@docs` annotation pointing at them** | Doc pages orphaned from code | derived from `documents:` aggregation | (rollup: `orphan-docs.md`) | MVP must produce this rollup |
| **Source-side `@docs` annotations pointing at non-existent pages** | Broken doc links | extractor validation against SUMMARY.md | (validation finding: `doc_validation: broken-link`) | MVP must produce these findings |

## MVP acceptance criterion

MVP is accepted when:

1. **Every probe in the "Cross-cutting UI shell" + "Backend surfaces invisible to the route-axis (MVP-marked rows)" + "Collectors-side surfaces (MVP-marked rows)" tables passes.** That's ~12 probes.
2. **For each PASS probe, the rollup file lists the expected node, its kind, its `documents:` field (or null), and the doc-link validation status.**
3. **For each FAIL probe, the failure is classified (axis gap / extractor bug / annotation gap) and a follow-up is logged on disk per `playbooks/follow-up-on-disk.md`.** Phase 2 / Phase 3-deferred probes count as classified — not as MVP-blocking failures.
4. **Adversarial probe round.** The maintainer (not the implementer) picks **3 unannounced probes** from outside this seed list (capabilities they know exist but didn't write down). MVP acceptance requires at least 2 of 3 PASS; the third can be a classified FAIL if the failure is a coherent axis gap with a follow-up logged.

## Anti-pattern: probe-list-as-coverage

The probe list does **not** define the universe of features. It is a **floor**, not a ceiling. A passing probe round means the substrate handles the categories of capability we knew to test for; it does not mean the substrate is exhaustive across the codebase. Future probes (especially adversarial ones from the maintainer) will continue to surface axis gaps. That is the design — gaps surface as bumps to `extractor_version` followed by full rebuilds.

## Probe-set ownership

- **The probe list lives in this file** (workspace-canonical) and gets updated as new probes are added.
- **Each scanner's test suite imports relevant probes** as integration tests against the lineage. A regression where the substrate stops finding `i18n.ts` becomes a failing test.
- **New probes are added on every blind-spot incident.** When a future LSN-NNN documents a feature the substrate failed to surface, a probe is added to this list as part of the LSN's "rule that emerged" — codifying the case-law into a continuously-runnable test.

## Cross-validation against DOC-163 findings (2026-05-08)

The DOC-163 manual re-enumeration (`findings/docs-coverage-undocumented-features/2026-05-08.md`) surfaced 14 findings (F-047..F-060) under the `ui_shell` + `config_prefixes` axes. **Each F-NNN is a seed probe for the substrate's first run.** When the substrate's `ui_shell` axis runs against `odd-platform`, the produced node set MUST include nodes whose paths match every F-047..F-051 evidence file. Same for F-052..F-060 against the `config_prefixes` axis.

A substrate run that misses any F-NNN evidence file is a FAIL classified as **extractor bug**.
