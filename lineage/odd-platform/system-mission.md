---
artefact: system-mission
project: odd-platform
generated_at: 2026-05-19T00:00:00Z
generated_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
prompt_version: domain-extractor/0.1.0
docs_site_anchor: https://docs.opendatadiscovery.org/
live_url_verifications:
  - url: https://docs.opendatadiscovery.org/
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/introduction/main-concepts
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/introduction/architecture
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/data-discovery
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/data-modelling
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/master-data-management
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/data-quality
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/data-lineage
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/data-glossary
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/active-platform-features
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/features/management
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/integrations
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
  - url: https://docs.opendatadiscovery.org/developer-guides/api-reference
    status: pending-WebFetch-session
    fetched_at: 2026-05-19T00:00:00Z
maintainer_curated: false
confidence_overall: MEDIUM
confidence_overall_justification: |
  Local-docs-anchored (the `documentation/` repo at `/home/raman/work/odd/documentation/`
  is the canonical content source per CLAUDE.md: "The source of truth for everything
  the public reads (vision, ADRs, features, API descriptions, guides) is →
  https://github.com/opendatadiscovery/documentation (local: ../documentation)").
  Live-URL rendering verification is pending — the maintainer will run a WebFetch
  pass over each pillar's URL in a session with WebFetch permission. This is logged
  as a known follow-up consistent with batches D-I.
---

# odd-platform — system mission + feature pillars

## Mission statement

ODD Platform is the central server of the Open Data Discovery project — "the open-source Data Discovery Platform [that] improves productivity, collaboration, and governance of modern data products and teams" — built around five claimed differentiators: "Free open-source and community-driven · ML first citizen · End-to-end microservices lineage support · Flexible data quality integration options · Auto-generated ML experiment lineage and metadata" (`documentation/docs/README.md` lines 3-9). The platform "stores the metadata, provides search, lineage, ownership, alerts, DQ dashboards, and the UI" — the receiving end of metadata flowing from data systems along two paths: **pull** (a collector polls the source) and **push** (an adapter embedded inside the source's runtime emits directly to the platform) (`documentation/docs/main-concepts.md` "The architecture chain" section).

The target audience is "any data team regardless of its size … enterprises or large-scale companies challenging data mesh concept, small and mid-scale companies seeking OSS data catalogue solution and also DS teams aiming at better data governance" (`documentation/docs/README.md` lines 13-17). "Platform functionality covers requirements of Data Scientists and Engineers, Product and Project Managers as well as Data Analysts, Architects, QA and BI Engineers" (`documentation/docs/README.md` line 19). The three pain points the platform addresses are stated directly: **onboarding to data** (new joiners learning data-management processes), **data discovery** (finding entities as connections multiply), and **data observability** (irrelevant data appearing in production with lineage + alerts as the diagnostic surface) (`documentation/docs/README.md` lines 26-32).

**Source**: `documentation/docs/README.md` (local clone of `https://docs.opendatadiscovery.org/`), read 2026-05-19; live-site verification pending WebFetch session.

## Primary feature pillars

A pillar is a user-observable surface delivering a coherent capability. Sub-features fill in below from code-walks; here we declare the SHAPE. The docs anchor the pillar count at 6 governance pillars (Data Discovery / Data Modelling / Master Data Management / Data Quality / Data Lineage / Data Glossary) + Active-platform-features + Management + Integrations + cross-cutting Security + a developer surface — yielding 11 user-observable surfaces. We keep "Active platform features" folded (per docs IA) rather than splitting its 5 sub-features into separate pillars.

### Pillar P-01 — Data Discovery

- **One-line capability**: Find existing data entities in the catalog — by typing a term (Search), walking a structure (Directory), or landing on the home page (Catalog Overview) — and annotate them with tags, statuses, descriptions, and groupings.
- **Primary user actions**: search the catalog with free text + 7 facets; drill the source-type → datasource → entity-type → entity Directory; browse the Catalog Overview home page; apply / curate tags; flag entity statuses (`UNASSIGNED` / `DRAFT` / `STABLE` / `DEPRECATED` / `DELETED`); group entities into DEGs; flag DEGs as Domains; attach business names; attach files / link URLs; view per-dataset schema-diff against revisions; spot stale entities by the orange-clock icon.
- **Data entities operated on**: Data Entity (incl. DEG / Domain), Tag, Status, Business Name, Attachment, Schema-version diff, Stale flag, Vector-typed dataset.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Data Discovery** section of ODD Platform is the home for finding entities in the catalog. The role is durable: anything that helps a user **locate** existing data — by typing a term, by walking a known structure, or by landing on the home page — belongs here." (`documentation/docs/data-discovery.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/data-discovery` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-05, P-06]  # discovered entities are the substrate for lineage walks + glossary linking
  - feeds_from: [P-10]   # integrations push the entities discovered here
  - shares_data_with: [P-07, P-08, P-09] # alerts/activity + management + security all operate on these same entities
- **Sub-feature seed**:
  - Catalog Overview page (unified home page surfacing the other entry paths inline)
  - Search and Filtering (POST `/api/search` create-session pattern; 7 facets; FTS-vector ranking)
  - Directory (4-level drill-down `/api/directory`)
  - Manual Object Tagging (3 `TAG_*` permissions)
  - Data Entity Groups & Domains (DEG primitive; Domain flag; relationship to ML Experiments)
  - Data Entity Statuses (`UNASSIGNED`/`DRAFT`/`STABLE`/`DEPRECATED`/`DELETED` + soft-delete TTL)
  - Data Entity Attachments (files + links; LOCAL vs REMOTE storage; LSN-001 caveat)
  - Business names for data entities and dataset fields
  - Vector Store metadata (`Vector Store` dataset type + `Vector` column type; pgvector adapter)
  - Dataset schema diff (revision-pair visual diff)
  - Metadata stale indicator (orange clock; `odd.data-entity-stale-period` default 7 days)
  - Recommended panel (sub-surface of Catalog Overview)
- **Audiences served**: [odd-platform-ui-end-user, data-engineer-analyst, data-quality-engineer, data-scientist-ml-engineer, viz-bi-engineer]
- **Maintainer notes**:
- **Confidence**: HIGH

### Pillar P-02 — Data Modelling

- **One-line capability**: Capture the *contract* of a dataset — how it's queried (Query Examples) and how it's connected to other entities (Relationships / ERDs).
- **Primary user actions**: author SQL / KQL / Spark snippets attached to a dataset or term; link a snippet to multiple datasets and terms; faceted-search the Query Examples catalog; browse the cross-source Relationships list filtered by ERD vs graph.
- **Data entities operated on**: Query Example, Entity Relationship (ERD edge, foreign-key derived), Graph Relationship.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Data Modelling** section of ODD Platform is the home for operator-curated artefacts that describe how data is *intended* to be used: canonical query examples and the entity-to-entity relationships that collectors extract or that operators define explicitly." (`documentation/docs/data-modelling.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/data-modelling` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-05]  # ERD edges contribute to the connection graph alongside lineage
  - feeds_from: [P-01, P-06, P-10]  # queries link to entities (P-01), terms (P-06); ERDs are extracted by Postgres / Snowflake collectors (P-10)
  - shares_data_with: [P-09]
- **Sub-feature seed**:
  - Query Examples (CRUD, faceted search, 7 `QUERY_EXAMPLE_*` permissions, 16-endpoint API surface)
  - Relationships and ERDs (`ENTITY_RELATIONSHIP` / `GRAPH_RELATIONSHIP`; 4 cardinality values; per-adapter ingestion coverage)
- **Audiences served**: [odd-platform-ui-end-user, data-engineer-analyst, viz-bi-engineer]
- **Maintainer notes**:
- **Confidence**: HIGH

### Pillar P-03 — Master Data Management

- **One-line capability**: Manage operator-curated reference data (Lookup Tables) as first-class catalog entities living inside the platform itself.
- **Primary user actions**: create / edit a Lookup Table (schema, RBAC); add / update / delete rows in the Data tab; query rows directly via PostgreSQL's `lookup_tables_schema` or the `/api/referencedata/` API.
- **Data entities operated on**: Lookup Table (Data Entity of type `LOOKUP_TABLE`), Lookup-Table Definition, Lookup-Table Row, Lookup-Table Column.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Master Data Management** section of ODD Platform is the home for operator-curated reference data — the canonical lists, lookup values, and code tables that downstream pipelines and BI tools join against. The section is intentionally narrow today (one child surface — Lookup Tables), but the role is durable: anything that documents *authoritative reference data managed inside the platform itself* (rather than ingested from an external source) belongs here." (`documentation/docs/master-data-management.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/master-data-management` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-05]  # Lookup Tables are themselves Data Entities — show up in Discovery, participate in lineage
  - feeds_from: []  # operator-curated; no external producer pushes Lookup Tables
  - shares_data_with: [P-09]
- **Sub-feature seed**:
  - Lookup Tables (9 PostgreSQL field types; 3 RBAC surfaces × 9 `LOOKUP_TABLE_*` permissions; PostgreSQL direct access)
- **Audiences served**: [odd-platform-ui-end-user, data-engineer-analyst, platform-operator]
- **Maintainer notes**: Partial-MDM scope explicitly stated by docs (`main-concepts.md` Data Governance map: "Full MDM semantics (golden records, survivorship rules, stewardship workflows) are not part of ODD today — what ships is reference-data management"). Pillar is intentionally narrow.
- **Confidence**: HIGH

### Pillar P-04 — Data Quality

- **One-line capability**: Aggregate per-dataset quality signals from external frameworks (Great Expectations, dbt, custom) and expose them at three granularities — per-entity test results, the catalog-wide Quality Dashboard, and operator-set dataset SLA statuses for downstream BI consumption.
- **Primary user actions**: push test results via `POST /ingestion/entities/datasets/stats`; view per-entity Test reports tab; browse the catalog-wide `/data-quality` dashboard with 3 rings + 6 anomaly classes; set Minor / Major / Critical statuses; consume `/api/datasets/{id}/sla` from BI tools.
- **Data entities operated on**: Quality Test (entity class), Quality Test Run, Test Result, Statistical Profile, Dataset SLA (Minor/Major/Critical → Green/Yellow/Red aggregate).
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "ODD covers Data Quality fully *as an aggregator*. Quality checks are not performed inside ODD Platform — the platform integrates with leading tools in the field and surfaces their results in one operator-friendly view." (`documentation/docs/data-quality.md` line 9)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/data-quality` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-05, P-07]  # quality-test entities participate in lineage; failed tests raise alerts
  - feeds_from: [P-10]   # results pushed by GE / dbt / profiler / custom push adapters
  - shares_data_with: [P-01, P-09]
- **Sub-feature seed**:
  - Test Results Import (Great Expectations + dbt push adapters; `odd-collector-profiler`; custom via `/ingestion/entities/datasets/stats`)
  - Quality Dashboard (`/data-quality`; Table Health / Test Results / Monitored Tables rings; 6 anomaly classes; AND-only two-side filters)
  - Dataset Quality Statuses (SLA) (Minor / Major / Critical → Green/Yellow/Red; `SLACalculator` aggregate-weight computation; `/api/datasets/{id}/sla` for BI import)
- **Audiences served**: [data-quality-engineer, data-engineer-analyst, viz-bi-engineer, odd-platform-ui-end-user]
- **Maintainer notes**: "Aggregator only — checks are not performed inside ODD" is the pillar's load-bearing constraint; explicit in the doc landing page.
- **Confidence**: HIGH

### Pillar P-05 — Data Lineage

- **One-line capability**: Render upstream / downstream traceability across the full ODD entity model (data-object lineage) plus microservices traced through OpenTelemetry (microservices lineage) — entity-level, group-level, and graph-level.
- **Primary user actions**: open the Lineage tab on any entity detail page; open Group lineage on a DEG detail page; navigate Microservices lineage from a microservice entity; tune `lineage_depth` and `expanded_entity_ids` query parameters; ingest microservice traces via `odd-tracing-gateway`.
- **Data entities operated on**: Data Entity (any class — datasets, transformers + runs, quality tests + runs, consumers, inputs, DEGs incl. ML experiments, entity relationships), Lineage Edge (parent_oddrn / child_oddrn / establisher_oddrn), Microservice entity.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Data Lineage** section of ODD Platform is the home for upstream and downstream traceability across the catalog. The role is durable: anything that documents *how entities are connected* — which dataset was read by which job, which job produced which model, which microservice traced which call — belongs here." (`documentation/docs/data-lineage.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/data-lineage` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-07]  # lineage neighbours surface in Recommended; lineage feeds the "Dependents" alerts tab
  - feeds_from: [P-01, P-02, P-04, P-10]  # entities (P-01), ERD edges (P-02), DQ-test edges (P-04), trace-emitted edges (P-10)
  - shares_data_with: [P-09]
- **Sub-feature seed**:
  - Data Objects Lineage (per-entity `/api/dataentity/{id}/lineage`; group-lineage endpoint; recursive-CTE walk with depth-1 expansion fan-out)
  - Microservices Lineage (sourced from OpenTelemetry traces via `odd-tracing-gateway`; the platform's only standalone-gateway push adapter today)
- **Audiences served**: [odd-platform-ui-end-user, data-engineer-analyst, data-quality-engineer, data-scientist-ml-engineer]
- **Maintainer notes**: Lineage is "the cross-pillar record because every entity has a structure, a meaning, a location, a quality signal, *and* a lineage" (per `main-concepts.md` Pillar differentiation). REFACTOR-203 cross-owner enumeration is a known LineageServiceImpl issue.
- **Confidence**: HIGH

### Pillar P-06 — Data Glossary

- **One-line capability**: Operator-curated term entities ("the catalog's vocabulary") — name and describe the concepts your data represents; link terms to each other and to data entities; surface as first-class catalog citizens with their own RBAC and lifecycle.
- **Primary user actions**: create a Term; assign owner / namespace; author rich description; link Term → Term; link Term → Data Entity via descriptive text mentions or direct relations; search Terms; reverse-look-up every entity tied to a Term.
- **Data entities operated on**: Term (first-class entity), Term-to-Term link, Term-to-Entity descriptive association, Term ownership / namespace / tag.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Data Glossary** section of ODD Platform is the home for the in-app **Business Glossary** — operator-curated term entities that name and describe the concepts your data represents. The role is durable: anything that captures the *meaning* of an entity (what `Customer` means in your taxonomy, how `Order` relates to `Line Item`, who owns each definition) belongs here." (`documentation/docs/data-glossary.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/data-glossary` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-02]  # terms surface alongside entities + queries
  - feeds_from: []  # operator-authored; no external producer
  - shares_data_with: [P-09]
- **Sub-feature seed**:
  - Business Glossary (terms-as-entities; 7 `TERM_*` permissions; term-to-term linking via description-text mentions and direct links; Wikipedia-About-style entity associations)
- **Audiences served**: [data-engineer-analyst, data-scientist-ml-engineer, odd-platform-ui-end-user, data-steward-owner]
- **Maintainer notes**: Explicit disambiguation in `main-concepts.md`: "Not the Business Glossary" — the docs page is project vocabulary, the in-app feature is catalog vocabulary.
- **Confidence**: HIGH

### Pillar P-07 — Active Platform Features

- **One-line capability**: Event-driven, opt-in subsystems where the platform is itself an actor — detect conditions and raise alerts, deliver notifications, record activity, host in-app discussions, broker AI questions to an external service.
- **Primary user actions**: configure each subsystem independently; receive alerts on failed jobs / failed DQ / schema breaks / external anomalies; configure Slack / email / webhook receivers; audit metadata changes on the global Activity feed or per-entity tab; start a Discussions thread anchored to a data entity; opt-in to GenAI by enabling `genai.enabled` + pointing at an external `genai.url`.
- **Data entities operated on**: Alert (4 types, OPEN→RESOLVED lifecycle), Activity Event, Discussion Thread, AlertNotificationMessage, GenAI question/answer.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Active platform features** section is the home for ODD Platform's event-driven, opt-in behaviours — the features where the platform is itself an actor in the data lifecycle rather than a passive system of record. The role is durable: anything the platform **does** on the operator's behalf (detect a condition and raise an alert, deliver a notification through Slack or email, record a change to an entity, host a discussion thread, broker a question to an external AI service) belongs here." (`documentation/docs/active-platform-features.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/active-platform-features` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01]   # activity feed feeds change-driven discovery; alerts feed Catalog Overview's per-entity surfaces
  - feeds_from: [P-04, P-05, P-10]  # alerts triggered by DQ failures (P-04), schema-diff drift on lineage-participating datasets (P-05), AlertManager push (P-10)
  - shares_data_with: [P-08, P-09]
- **Sub-feature seed**:
  - Alerting (4 types: Failed-job / Failed-DQ-test / Backwards-incompatible-schema / Distribution-anomaly; OPEN→RESOLVED lifecycle; per-entity halt config; All/My/Dependents tabs)
  - Notifications (Slack incoming webhook, generic webhook, SMTP email; the `notifications.*` config namespace; AlertManager inbound webhook `/ingestion/alert/alertmanager`)
  - Activity Feed (global page + per-entity tab; 7 filter facets; partition-period via `odd.activity.partition-period`)
  - Data Collaboration (Slack OAuth + Events API webhook; disabled by default `datacollaboration.enabled=false`; bidirectional; distinct from the Slack alert webhook)
  - GenAI assistant (`POST /api/genai/ask` → forwards to operator-run `genai.url`; disabled by default; API-only today)
- **Audiences served**: [odd-platform-ui-end-user, platform-operator, data-engineer-analyst, data-quality-engineer, notification-recipient, slack-workspace-bot-installed, external-llm-service, prometheus-alertmanager]
- **Maintainer notes**: All 5 sub-features are opt-in per-subsystem. Doc-product editorial framing: "A deployment can run with all five off and still serve the catalog — none is required." (`active-platform-features.md` line 31). Sidecars span this whole pillar: AlertController + AlertController.getAllAlerts + AlertController.changeAlertStatus + AlertServiceImpl + ReactiveAlertRepositoryImpl + AlertManagerController + ActivityController + ActivityTablePartitionManager + DataCollaborationController + DataCollaborationProperties + GenAIController + GenAIProperties + NotificationsProperties + EmailSenderProperties.
- **Confidence**: HIGH

### Pillar P-08 — Management & Administration

- **One-line capability**: Operator-facing UI for everything an operator configures inside the running platform — namespaces, datasources, integrations, collectors and their tokens, owners, tags, RBAC roles and policies, and user-owner association requests.
- **Primary user actions**: create / edit / delete namespaces; audit and edit registered datasources; generate `collector_config.yaml` snippets via the Integration Wizard; issue / rotate collector tokens; create owners and attach roles; curate the tag taxonomy; process owner-association requests; author RBAC policies + roles.
- **Data entities operated on**: Namespace, Datasource (registered), Collector (with token), Owner, Tag, Role, Policy, Owner-association Request.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "The **Management** section is the operator-facing surface inside the platform UI: every tab here lets an operator add, edit, or remove a piece of catalog configuration. Where the Catalog and the Directory are read-oriented (a user finds an existing entity), Management is mutating (an operator changes how the catalog is wired)." (`documentation/docs/management.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/features/management` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-09, P-10]  # tags + namespaces feed Discovery; roles/policies feed Security; collector tokens feed Integrations
  - feeds_from: []  # operator-curated only
  - shares_data_with: [P-01, P-06, P-09, P-10]
- **Sub-feature seed**:
  - Namespaces (label-dimension scoping for tags / terms)
  - Datasources tab (audit, edit, link Collector + Namespace)
  - Integrations tab (Integration Wizard surface — `META-INF/wizard/*.yaml`; `GET /api/integrations`, `GET /api/integrations/{id}`)
  - Collectors tab (issue + rotate tokens; OwnerController#createOwner sidecar evidence)
  - Owners tab (create catalog-side owners, attach to entities)
  - Tags tab (curate stable tag vocabulary)
  - Associations tab (owner-association requests; gated by `OWNER_ASSOCIATION_MANAGE` permission)
  - Roles tab (RBAC role bundles)
  - Policies tab (ODDRN-pattern-matched permission rules)
  - Other Management surfaces: M2M tokens (S2S), Custom navigation links (`odd.links[]`), Alternative Secrets Backend, Integration Wizard (UI)
- **Audiences served**: [platform-operator, data-steward-owner, odd-platform-ui-end-user]
- **Maintainer notes**: Daily-ops sequence (`management.md` lines 42-53) is a canonical operator workflow worth preserving. Custom-nav-links, M2M tokens, and Alternative-Secrets-Backend are "Other Management surfaces" (`management.md` lines 33-38) — operationally part of Management even though not rendered as tabs.
- **Confidence**: HIGH

### Pillar P-09 — Security & Access Control

- **One-line capability**: Three independently-configured authentication surfaces (UI / S2S / Ingestion) plus an RBAC model (Policies × Permissions × Roles × Owners × User-owner association) gating mutations across the catalog. "Enabling one does not protect the other."
- **Primary user actions**: pick a UI auth mode (`auth.type` = DISABLED / LOGIN_FORM / OAUTH2 / LDAP); enable S2S for non-UI programmatic callers (`X-API-Key` header); enable the Ingestion filter for production deployments (`auth.ingestion.filter.enabled=true`); author Policies + Roles; attach Roles to Owners; process User-owner associations.
- **Data entities operated on**: Permission, Policy, Role, Owner (RBAC binding), User-owner mapping, S2S API key, Auth Mode (the `auth.type` config knob), Ingestion filter, Collector token.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "ODD Platform has **two independent authentication surfaces**, each governed by its own configuration flag. Enabling one does not protect the other. … A platform with OAuth2 enabled for the UI but the ingestion filter disabled is a platform with a protected catalog UI and an open write endpoint. Operators must configure both." (`documentation/docs/configuration-and-deployment/enable-security/README.md` lines 3-10)
- **Doc URL**: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-10]  # security gates every other pillar's mutations
  - feeds_from: [P-08]  # Management UI authors the RBAC bundles
  - shares_data_with: [P-08]
- **Sub-feature seed**:
  - UI authentication (4 modes: DISABLED / LOGIN_FORM / OAUTH2 / LDAP; `SecurityConstants.SECURITY_RULES` is the central wiring)
  - Server-to-Server (S2S) authentication (`auth.s2s.enabled`; `X-API-Key` header; grants ADMIN; orthogonal to the 4 UI modes)
  - Ingestion authentication filter (`auth.ingestion.filter.enabled` default `false`; `IngestionDataEntitiesFilter` on `POST /ingestion/entities`; sibling `/ingestion/*` paths NOT covered — known gap)
  - Authorization model: Policies (ODDRN-pattern matchers + permission keys), Permissions (per-feature `*_*` permission verbs), Roles (named bundles attached to Owners), Owners (catalog-side identity), User-owner association (the link from a logged-in user to one or more Owners)
- **Audiences served**: [platform-operator, odd-platform-ui-end-user, odd-api-consumer, odd-collector-runtime, spring-container]
- **Maintainer notes**: Read-collaborative posture (REFACTOR-024, REFACTOR-203, REFACTOR-201 across batches D/F/H/I) is a load-bearing implicit ADR — every authenticated user can enumerate the entire catalog. Live-doc-side silence on the read-collaborative posture is a separately-tracked DOC-NNN follow-up. Three "soft-delete mechanisms" (deleted_at / is_deleted / STATUS) across the persistence layer are an architectural-hygiene observation from batch I.
- **Confidence**: HIGH

### Pillar P-10 — Integrations & Ingestion

- **One-line capability**: Two ingest strategies (pull / push) and three push deployment shapes (in-process plugin / standalone gateway / direct SDK-CLI) for getting metadata from a source system into the platform's PostgreSQL catalog via the ODD-Specification-defined Ingestion API.
- **Primary user actions**: deploy a pull Collector (`odd-collector` and cloud variants) with multiple plugins; install push adapters into source runtimes (`odd-airflow-2`, `odd-dbt`, `odd-spark-adapter`, `odd-great-expectations`); deploy the OpenTelemetry-tracing standalone gateway (`odd-tracing-gateway`); use the `odd-cli` direct SDK; scope a plugin via per-adapter Ingestion filters; bootstrap configuration via the Integration Wizard; store collector secrets in AWS SSM via the Alternative Secrets Backend; rotate collector tokens.
- **Data entities operated on**: Collector (runtime), Pull adapter, Push adapter, Plugin (configured pull-adapter instance), Datasource (registered), Ingestion request (`DataEntityList`), Lineage edge, Quality test result, ODDRN, Ingestion filter rules.
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "An **integration** is any path metadata takes from a source system into the ODD Platform. ODD ships two strategies — **pull** (a collector polls the source on a schedule) and **push** (a push adapter lives inside or alongside the source and emits as the source runs). Pick by where the work happens: pull when the source is a passive data store you want snapshotted on a cadence, push when the source is an application or a stream you want reporting per-run lineage and results in real time." (`documentation/docs/integrations/README.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/integrations` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-04, P-05, P-07]  # entities (P-01), DQ test results (P-04), lineage edges (P-05), trigger alerts (P-07)
  - feeds_from: [P-08, P-09]  # tokens issued via Management; gated by S2S Ingestion filter (P-09)
  - shares_data_with: [P-09]
- **Sub-feature seed**:
  - `odd-collector` (generic, 41 pull adapters)
  - `odd-collector-aws` / `odd-collector-azure` / `odd-collector-gcp` (cloud-specific pull collectors)
  - `odd-collector-profiler` (statistical profiling via Capital One's DataProfiler)
  - `odd-airflow-2` (push, in-process Listener plugin)
  - `odd-dbt` (push, in-process plugin)
  - `odd-spark-adapter` (push, in-process Spark listener)
  - `odd-great-expectations` (push, in-process Checkpoint action)
  - `odd-cli` (push, direct SDK / CLI)
  - `odd-tracing-gateway` (push, standalone OTel/OTLP gateway; the platform's only standalone-gateway today)
  - Ingestion filters (per-adapter regex include/exclude — `schemas_filter`, `filename_filter`, `datasets_filter`, `pipeline_filter`)
  - Integration Wizard (in-app YAML-snippet generator; `META-INF/wizard/*.yaml` registry; `platform_url` substitution context)
  - Alternative Secrets Backend (AWS SSM Parameter Store; only `odd-collector` ships the hook today)
  - Token + datasource registration flow (`POST /ingestion/datasources` + per-integration token-passing conventions)
- **Audiences served**: [platform-operator, odd-collector-runtime, odd-api-consumer, integration-author, data-engineer-analyst, data-quality-engineer]
- **Maintainer notes**: This is the platform's largest surface boundary by code (`IngestionService` + 14 `IngestionRequestProcessor` chain across INITIAL→MAIN→FINALIZING phases inside one transaction). Per `IngestionService` sidecar: "datasource scoping is **payload-driven, NOT principal-driven**" — security-relevant implicit ADR. `odd-tracing-gateway` is the bridge into Microservices Lineage (P-05).
- **Confidence**: HIGH

### Pillar P-11 — Platform API & Developer Surface

- **One-line capability**: Two OpenAPI specifications (Ingestion API + Platform API) plus an interactive Swagger UI on every running deployment, with per-feature API-reference sub-pages and a developer guide for building custom collectors against the SDK.
- **Primary user actions**: read per-feature API-reference sub-pages (Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships); interact via the running platform's Swagger UI at `{platform-base-url}/api/v3/api-docs`; build a custom collector against `odd-collector-sdk` using the [Build a custom collector](https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors) guide.
- **Data entities operated on**: OpenAPI specification (Ingestion / Platform), HTTP endpoint, ODDRN (the stable string), Generator (Python / Java oddrn-generator libraries).
- **Doc-side narrative excerpt** (verbatim, from local doc):
  > "This page is the canonical reference hub for every HTTP endpoint exposed by the ODD Platform. Each feature area has its own sub-page below with operation IDs, paths, and a back-link to the feature documentation that explains the behaviour." (`documentation/docs/developer-guides/api-reference.md` line 7)
- **Doc URL**: `https://docs.opendatadiscovery.org/developer-guides/api-reference` · last_verified_status: pending-WebFetch-session
- **Cross-pillar relationships**:
  - feeds: [P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10]  # the API surfaces every other pillar
  - feeds_from: []
  - shares_data_with: []
- **Sub-feature seed**:
  - API Reference hub (9 per-feature sub-pages: Alerts, Data Collaboration, Directory, Glossary, Integrations, Lineage, Query Examples, Reference Data, Relationships)
  - Ingestion API specification (the wire contract — `https://github.com/opendatadiscovery/opendatadiscovery-specification`)
  - Platform API specification (`odd-platform-specification/openapi.yaml`)
  - Swagger UI per deployment (`{platform-base-url}/api/v3/api-docs`; demo at `https://demo.oddp.io/api/v3/api-docs`)
  - Build a custom collector developer guide (ODDRN generator libraries Python / Java; `odd-collector-sdk`)
  - How-to-contribute (PR / issue flow; 20+ ODD repos; GitHub org overview)
  - Build & run guides (Platform / Collectors / custom collector)
- **Audiences served**: [odd-api-consumer, integration-author, custom-collector-developer, platform-operator]
- **Maintainer notes**: This pillar is the developer-facing surface — distinct from end-user-facing Pillars P-01..P-08 and from operator-facing P-09. Pillar 10's "Build a custom collector" cross-link belongs here. ODDRN format / generator libraries / API conventions live here.
- **Confidence**: HIGH

## Audiences

The audiences span the README's "all data team members" + the five named use cases + the operator/developer audiences observable in sidecars + the external system audiences (LLM, Prometheus, Slack, Notification Recipient) the concept catalog already tracks.

- **odd-platform-ui-end-user**: Authenticated platform users browsing the catalog, navigating entities, viewing alerts, downloading attachments, switching languages, posing GenAI questions, posting in-app Slack discussions, auditing platform activity. · primarily uses: [P-01, P-02, P-03, P-04, P-05, P-06, P-07]
- **data-engineer-analyst**: The "Deprecation for Data Engineer / Analyst" use-case audience — controls dramatic changes to data, drives the deprecation process across stakeholders. · primarily uses: [P-01, P-02, P-04, P-05, P-06]
- **data-quality-engineer**: The "Visibility for Data Quality Engineer" use-case audience — imports test suite results, shares them with team + stakeholders to build trustworthy communication about data health. · primarily uses: [P-04, P-05, P-07, P-10]
- **data-scientist-ml-engineer**: The "Data compliance for Data Scientists" use-case audience — develops ML models meeting compliance standards, manages PII properly. ML experiments + ML model lineage are first-class. · primarily uses: [P-01, P-05, P-06]
- **viz-bi-engineer**: The "Data preparation for Visualization Engineer" use-case audience — examines data sources, metadata, tags using ODD Platform to predict BI tool performance and set dashboard security levels. · primarily uses: [P-01, P-02, P-04]
- **service-presales**: The "Service Provider and Pre-Sales" use-case audience — manages customer expectations by examining the architectural landscape + gathering info on toolset for project-scope planning. · primarily uses: [P-01, P-05, P-08, P-11]
- **platform-operator**: Engineers deploying and configuring ODD Platform — set values in `application.yml` / env vars / Helm values; pick auth mode + S2S composition; enable GenAI / configure attachment storage; deploy AlertManager network controls; rotate collector tokens; tune partition cadence. · primarily uses: [P-07, P-08, P-09, P-10]
- **data-steward-owner**: Catalog-side Owner entities representing teams / individuals — recipients of Roles, attached to Data Entities for stewardship. · primarily uses: [P-06, P-08, P-09]
- **odd-api-consumer**: Programmatic clients building integrations against `/api/*` (OpenAPI-generated SDKs, custom curl/scripts, third-party tooling) — distinct from UI end-user in cadence and testing posture. · primarily uses: [P-11, plus selectively P-01..P-10]
- **integration-author / custom-collector-developer**: Contributors building a new pull adapter or push adapter against `odd-collector-sdk` + the ODD Specification; authoring an ODDRN generator subclass per source family. · primarily uses: [P-10, P-11]
- **notification-recipient**: Downstream consumer of ODD's outbound alert notifications — a Slack channel, a generic webhook endpoint, or an SMTP email inbox. · primarily uses: [P-07]
- **external-systems** (composite: external-llm-service / prometheus-alertmanager / slack-workspace-bot-installed / external-prometheus-instance): External actors the platform writes to or reads from — operator-run LLM endpoint, operator-run Prometheus, Slack workspace bot, Prometheus instance for metrics. · primarily uses: [P-07, P-10]

## Architectural pillars

Orthogonal to feature pillars — these are the SHAPES the platform takes (UI, REST API, S2S, scheduled jobs, etc.).

- **platform-server**: Spring Boot 3 / WebFlux reactive Java 17 application — REST API surface, ingestion pipeline, scheduled jobs (housekeeping, alerting, data-collaboration sender, partition manager). One process plus PostgreSQL. · sidecar axes: [controllers, services, config_prefixes, openapi_tags]
- **producer-ecosystem**: Pull Collectors + Push Adapters (3 shapes: in-process plugin / standalone gateway / direct SDK-CLI) — distributed by design; one Platform + many producers is the canonical deployment. · sidecar axes: [external — `odd-collectors`, `odd-airflow-2`, `odd-dbt`, `odd-spark-adapter`, `odd-great-expectations`, `odd-cli`, `odd-tracing-gateway`]
- **ui-spa**: React + TypeScript single-page application served from the Platform process at `/`. Operators do not deploy the UI separately. · sidecar axes: [ui_routes, ui_shell]
- **metadata-store**: Single PostgreSQL database holding every catalog entity, every lineage edge, every term, plus the full-text-search index. No Elasticsearch / Solr / Neo4j services to deploy. Storage capacity scales with PG cluster. · sidecar axes: [repositories]
- **ingestion-api-wire-contract**: ODD Specification — the OpenAPI-defined contract between every producer (pull or push) and the platform. Decouples producer / platform implementations. · sidecar axes: [openapi_paths]
- **ingestion-pipeline**: Single-transaction-per-batch pipeline (`IngestionService` + 14 `IngestionRequestProcessor` chain across INITIAL→MAIN→FINALIZING phases) processing inbound `DataEntityList` payloads — datasource resolution, entity partitioning, bulk INSERT/UPDATE, lineage / metadata / dataset-structure / FTS / alerts / activity-log materialisation, OTLP metric export. · sidecar axes: [services, controllers, openapi_paths]

## Canonicalisation candidates

Pillars or audiences the maintainer should confirm — anchored on either thin doc coverage OR multi-sidecar code signal without doc backing. Reflects what the maintainer's `concepts/index.yaml` already surfaces as `canonical_candidate: true`.

- name: "Platform-Internal Operational Infrastructure (housekeeping, partitioning, advisory-locks, leader-election)"
  evidence:
    - "lineage/odd-platform/concepts/index.yaml — `activity-table-partitioning`, `housekeeping-ttl-retention`, `202-queue-postgres-advisory-lock-single-sender-pattern`, `advisory-lock-id-collision-risk-across-subsystems`"
    - "lineage/odd-platform/understanding/odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md"
    - "lineage/odd-platform/understanding/odd-platform__java__ActivityTablePartitionManager__config-key-consumer__odd_activity_partition-period@L11.md"
  maintainer_question: |
    The docs frame partitioning + housekeeping as "PostgreSQL Configuration" detail under
    `configuration-and-deployment/odd-platform.md`. Sidecars treat them as a distinct
    operational architecture with cross-cutting concerns (TTL drift, advisory-lock-id
    collision risk, leader-election via Postgres advisory locks, ShedLock). Should this
    surface as a pillar of its own ("Operational Infrastructure"), as sub-features
    inside P-08 Management & Administration (operator-facing knobs), or stay in the
    architectural-pillar slot under platform-server?
  status: pending-maintainer-decision

- name: "Multi-Tenant Metrics Storage (`odd.tenant-id` + Prometheus / In-Memory storage modes)"
  evidence:
    - "lineage/odd-platform/concepts/index.yaml — `metrics-ingestion`, `multi-tenant-configuration-odd-tenant-id`, `external-prometheus-instance`"
    - "lineage/odd-platform/understanding/odd-platform__java__CounterTimeSeriesExtractor__config-key-consumer__metrics_storage@L20.md"
  maintainer_question: |
    Multi-tenant via `odd.tenant-id` + a Prometheus / In-Memory metrics-storage switch
    is a real architectural concern visible across multiple sidecars + 2 distinct
    config-properties classes + an explicit "external-prometheus-instance" audience.
    Live docs do not name a multi-tenant pillar. Surface as a sub-feature of P-09
    Security & Access Control (the `tenant_id` label is the ONLY isolation mechanism
    in shared-Prometheus deployments)? Or fold under "metrics export" inside P-07
    Active Platform Features? Or surface as its own pillar P-12?
  status: pending-maintainer-decision

- name: "Audit-log Presence Asymmetry (2-tier audit story)"
  evidence:
    - "lineage/odd-platform/concepts/index.yaml — `no-audit-log-on-rbac-mutations-audit-log-presence-asymmetry-refined-in-batch-f`, `audit-log-presence-asymmetry-2-tier-audit-story`"
  maintainer_question: |
    The Activity Feed records entity-side metadata changes (description edits, tag
    assignments, ownership changes); RBAC mutations (role create, policy edit, owner
    role-attach) have NO audit log. This is an implicit ADR in the concept catalog —
    is the cross-pillar audit story a P-07-internal sub-feature ("Activity Feed
    covers entity metadata only") or should it surface separately as a Security &
    Access Control gap inside P-09 (with a backlog-tracked DOC-NNN follow-up)?
  status: pending-maintainer-decision

- name: "Service Provider / Pre-Sales as a distinct audience"
  evidence:
    - "documentation/docs/use-cases.md lines 11-12 — explicit use case"
    - "no sidecar references this audience"
  maintainer_question: |
    The docs include "Service Provider and Pre-Sales" as one of the five named use
    cases. No sidecar evidence ties this to a specific code path. Keep it in the
    audience taxonomy as a documented-but-thin audience, or drop from the audience
    list since the platform's behaviour for this audience is not feature-shaped (it's
    a presales-workflow audience, not a runtime audience)?
  status: pending-maintainer-decision

## Cross-pillar relationships (graph view)

A compact map for the feature-flow-builder: which pillars FEED others, which SHARE data, which COMPOSE into higher-order capabilities.

```yaml
relationships:
  - from: P-10
    to: P-01
    kind: feeds
    via: "Ingestion API receives DataEntityList payloads; new + restored Data Entities surface in Discovery search, directory drill-down, and Catalog Overview's per-class Entities report (IngestionService sidecar; ReactiveDataEntityRepositoryImpl sidecar)"
  - from: P-10
    to: P-04
    kind: feeds
    via: "DQ-test-result payloads via `POST /ingestion/entities/datasets/stats` and `DataEntityList` items with DataQualityTest entity-class — surface in per-entity Test reports tab and Quality Dashboard rings"
  - from: P-10
    to: P-05
    kind: feeds
    via: "Lineage edges extracted from `dataSet.parentDatasetOddrn`, `dataTransformer.sourceList/targetList`, `dataConsumer.inputList` during ingestion (IngestionService sidecar invariants) + microservice edges via odd-tracing-gateway (the only standalone gateway today)"
  - from: P-10
    to: P-07
    kind: feeds
    via: "Schema-diff drift + DQ-test failures detected at ingestion → AlertIngestionRequestProcessor (FINALIZING phase) raises BACKWARDS_INCOMPATIBLE_SCHEMA + FAILED_DQ_TEST alerts; Prometheus AlertManager pushes DISTRIBUTION_ANOMALY alerts via `/ingestion/alert/alertmanager`"
  - from: P-04
    to: P-07
    kind: feeds
    via: "Failed DQ test runs raise `FAILED_DQ_TEST` alerts via AlertActionResolver (concepts.yaml — alert-action-resolver)"
  - from: P-05
    to: P-07
    kind: feeds
    via: "Backwards-incompatible schema changes on lineage-participating datasets raise schema-diff alerts (DatasetStructureIngestionRequestProcessor + IngestionRequest.getChangedDatasetOddrns per IngestionService sidecar)"
  - from: P-02
    to: P-05
    kind: feeds
    via: "ERD edges (ENTITY_RELATIONSHIP entities from Postgres/Snowflake collectors) contribute to the connection graph alongside lineage edges"
  - from: P-06
    to: P-01
    kind: shares_data_with
    via: "Term-to-entity descriptive associations surface inline on every data-entity detail page in the Terms section; Term linkage is queryable from both sides (Term page + Data Entity page)"
  - from: P-09
    to: P-01
    kind: feeds
    via: "Authorization gates every mutation in Discovery (tag-assign, description-edit, status-change, attachment-upload, business-name-set); the read-collaborative posture means READS bypass per-owner scoping (explicit at P-09)"
  - from: P-09
    to: P-10
    kind: feeds
    via: "S2S Ingestion filter `auth.ingestion.filter.enabled` gates `POST /ingestion/entities`; collector tokens authenticate against the filter; per-datasource token override pattern"
  - from: P-08
    to: P-09
    kind: feeds
    via: "Management UI is the authoring surface for the Authorization model — Roles tab, Policies tab, Owners tab, Associations tab — and for the collector tokens that S2S consumes"
  - from: P-08
    to: P-10
    kind: feeds
    via: "Integration Wizard generates collector_config.yaml snippets; Collectors tab issues + rotates tokens; Datasources tab is the post-registration audit surface"
  - from: P-07
    to: P-01
    kind: feeds
    via: "Activity feed is the change-driven discovery surface — events on entities are visible alongside the entity itself"
  - from: P-11
    to: P-01
    kind: feeds
    via: "API Reference per-feature pages back every UI affordance; Swagger UI provides interactive testing of the same endpoints"
  - from: P-11
    to: P-10
    kind: feeds
    via: "Build a custom collector + ODDRN generator libraries (Python / Java) enable extension of the producer ecosystem (P-10 P-10)"
  - from: P-03
    to: P-01
    kind: feeds
    via: "Lookup Tables are themselves Data Entities of type `LOOKUP_TABLE` — surface in Discovery's search, directory, and Catalog Overview entity report"
```

## Sources

- doc-URL — pillar mission statement ← `documentation/docs/README.md` (local clone) read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-01 Data Discovery ← `documentation/docs/data-discovery.md` lines 5-53 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-02 Data Modelling ← `documentation/docs/data-modelling.md` lines 5-33 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-03 Master Data Management ← `documentation/docs/master-data-management.md` lines 5-23 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-04 Data Quality ← `documentation/docs/data-quality.md` lines 5-31 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-05 Data Lineage ← `documentation/docs/data-lineage.md` lines 5-29 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-06 Data Glossary ← `documentation/docs/data-glossary.md` lines 5-29 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-07 Active Platform Features ← `documentation/docs/active-platform-features.md` lines 5-41 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-08 Management & Administration ← `documentation/docs/management.md` lines 5-61 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-09 Security & Access Control ← `documentation/docs/configuration-and-deployment/enable-security/README.md` lines 1-53 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-10 Integrations & Ingestion ← `documentation/docs/integrations/README.md` lines 5-142 read 2026-05-19 · live-URL verification pending
- doc-URL — pillar P-11 Platform API & Developer Surface ← `documentation/docs/developer-guides/api-reference.md` lines 5-69 read 2026-05-19 · live-URL verification pending
- canonical-concepts ← `documentation/docs/main-concepts.md` (architecture chain + Data Governance map + Terms & Aliases table) read 2026-05-19 · live-URL verification pending
- doc-URL — Architecture page ← `documentation/docs/Architecture.md` lines 1-67 read 2026-05-19 · live-URL verification pending
- doc-URL — Features one-page index ← `documentation/docs/Features.md` lines 1-243 read 2026-05-19 · live-URL verification pending
- doc-URL — Use cases page ← `documentation/docs/use-cases.md` lines 1-13 read 2026-05-19 · live-URL verification pending
- maintainer-input — pillar shape cross-checked against ← `lineage/odd-platform/concepts/index.yaml` (catalog v9; 60 entities + 13 audiences + 51 canonicalisation_candidates)
- maintainer-input — sidecar-side evidence sampled across axes ← `lineage/odd-platform/understanding/` (60 sidecars; controllers + services + repositories + config-properties + UI shell sampled; SearchController#search + LineageServiceImpl + IngestionService + DataCollaborationProperties + GenAIProperties + AttachmentServiceImpl + OwnerController#createOwner + alerts route + ReactiveDataEntityRepositoryImpl read in full)
- methodology adjustment for this run — WebFetch permission-denied this session; local docs treated as canonical content source per CLAUDE.md ("source of truth for everything the public reads … is `../documentation` / `https://github.com/opendatadiscovery/documentation`"); live-URL rendering verification deferred to a WebFetch-permitted session and logged as pending in `live_url_verifications` frontmatter

## Confidence per pillar

- P-01 Data Discovery: HIGH (anchor doc landing reads cleanly; 11 sub-features all named in SUMMARY.md; multiple supporting sidecars — SearchController, DataEntityController × multiple methods, ReactiveDataEntityRepositoryImpl)
- P-02 Data Modelling: HIGH (anchor doc landing reads cleanly; both sub-features explicit; concept catalog has dedicated entries for query-example surface)
- P-03 Master Data Management: HIGH (single-sub-feature pillar; doc landing explicitly states the narrow scope; pillar's narrowness is itself load-bearing)
- P-04 Data Quality: HIGH (3-sub-feature pillar; "aggregator only" framing explicit in doc landing; sidecar evidence in `service_service__DataEntityServiceImpl.md` + `AlertServiceImpl.md`)
- P-05 Data Lineage: HIGH (anchor doc landing reads cleanly; LineageServiceImpl + ReactiveLineageRepositoryImpl sidecars provide deep code-side anchor; REFACTOR-203 is a real implicit-ADR cross-link)
- P-06 Data Glossary: HIGH (single-sub-feature pillar; explicit disambiguation from `main-concepts.md` page; concept catalog `term-linkage` is a corroborated entry)
- P-07 Active Platform Features: HIGH (5 sub-features doc-anchored; all 5 backed by multiple sidecars per audit + sidecar evidence enumeration; opt-in framing is consistent across docs and code)
- P-08 Management & Administration: HIGH (9 tabs explicit in `management.md`; sidecar evidence on OwnerController + RoleController + PolicyController + PermissionController + CollectorController; "Other Management surfaces" cross-cuts are well-documented)
- P-09 Security & Access Control: HIGH (anchor doc gives the load-bearing two-surfaces invariant verbatim; 4 auth-mode sidecars + S2S sidecar + IngestionDataEntitiesFilter sidecar + RBAC sidecars; concept catalog has dedicated entries for each)
- P-10 Integrations & Ingestion: HIGH (11-row pull-vs-push table at the doc landing; IngestionService sidecar carries the full ingest-pipeline anchor; Integration Wizard + Secrets Backend + Filters all documented and sidecar-backed)
- P-11 Platform API & Developer Surface: HIGH (9 per-feature API-reference sub-pages explicit; Swagger UI surface documented; Build-a-custom-collector + ODDRN generator libraries cross-linked; developer-guides subtree is its own SUMMARY section)

## Maintainer notes

This artefact preserves a `confidence_overall: MEDIUM` rather than HIGH explicitly because live-URL rendering verification has been deferred to a WebFetch-permitted session. The classification + pillar shape are HIGH-confidence per-pillar (anchored on doc-source + sidecar evidence); the rendering verification is the missing piece.

Open canonicalisation candidates (see §"Canonicalisation candidates") need maintainer decisions before downstream reducers commit to the pillar names:
1. Should "Platform-Internal Operational Infrastructure" surface as a pillar, a P-08 sub-feature, or stay architectural?
2. Should "Multi-Tenant Metrics Storage (`odd.tenant-id`)" be a pillar P-12, a P-09 sub-feature, or a P-07 sub-feature?
3. Does the "Audit-log presence asymmetry" surface as a Security gap inside P-09 (with a backlog DOC-NNN), or as a P-07 sub-feature stating the audit scope explicitly?
4. Keep "Service Provider / Pre-Sales" as a thin documented audience, or drop?

If the maintainer renames any pillar, the feature-flow-builder reducer should pick up the new name through this artefact's pillar IDs (P-01..P-11) — IDs are stable across renames, names are the maintainer's slot to refine.
