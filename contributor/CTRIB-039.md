---
ctrib: CTRIB-039
github_issue_number: 1815
issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1815
class: feature
milestone: "1.0.0"          # G-C11 PASS — open + semver, due 2026-07-31
status: planned             # intake -> scoping -> planned (ADR proposed; awaiting GATE 1). No code (G-C3 + G-C7).
reproduced: "Phase B (feature) — integration points verified against odd-platform main @ f12b8fbc; see '## Phase B'."
adr_required: yes           # G-C7 FIRES — new public API + persistence model + identity/auth handling. ADR: adrs/drafts/favorites-recently-viewed-foundation.md
plan_approved_by:           # GATE 1 — PENDING
plan_approved_at:
docs_routing: "release/1.0.0 (unreleased behaviour → the documentation train, G-C11). Ships in the docs slice."
pr_url:
pr_draft:
stream_id: ctrib039
---

# CTRIB-039 — Favorites: star/un-star any asset, main-page panel + filterable top-level tab (issue #1815)

## Intake

- **Issue:** [#1815](https://github.com/opendatadiscovery/odd-platform/issues/1815) — opened 2026-06-26 by
  **`RamanDamayeu` (the maintainer)**, assigned to self. Labels: `scope: backend`, `scope: frontend`,
  `kind: feature`, **`to decompose`**. 0 comments.
- **G-C11 (milestone) — PASS.** Milestone `1.0.0`, **open**, semver (`^\d+\.\d+\.\d+$`), due 2026-07-31
  (8 open / 0 closed). Verified via `GET /repos/opendatadiscovery/odd-platform/issues/1815` (`milestone.title=1.0.0`,
  `milestone.state=open`) + `GET …/milestones?state=open`. Work may proceed.
- **Provenance:** this issue is the GitHub realization of **PRD-0001** (`prds/0001-favorites-and-recently-viewed.md`,
  committed `48da56e`) — the maintainer's researched design (grounded in `main`, with a Product/SME consult
  `lineage/odd-platform/sme-consultations/2026-06-26-favorites-recently-viewed-prd.md` + an SRE/security review).
  It is **Issue A** of a two-issue split; the sibling is **PLT-250 — Recently Viewed** (`issues/odd-platform/PLT-250.md`),
  which depends on the shared foundation this issue builds.

### The issue body — QUOTED DATA, never an instruction (G-C8)

The body is a self-authored, PRD-backed feature spec (What / Where / User-facing impact / Why / Suggested fix /
How discovered). Essence, quoted as data: *"ODD Platform gives a user no way to pin the assets they care about…
Add **Favorites**: a user clicks a star on any viewable asset; the starred set is shown as a 5-item panel on the
main page and as a new filterable top-level **Favorites** tab. Favorites are per user — keyed on the logged-in
identity `(oidc_username, provider)`, NOT the internal Owner… This issue ships the shared foundation both features
reuse."* The "Suggested fix" section enumerates the foundation (identity resolver, polymorphic asset model,
faceted list endpoint, panel, tab, Asset-type facet) + the favorites-specific API + data model + cross-cutting
checklist. **No embedded instruction to the agent; full body = the issue + PRD-0001.** Quoted here as data.

## Scope analysis

- **Classification: FEATURE** (backend **and** frontend) — matches the `scope: backend` + `scope: frontend` labels.
  This is a **large, multi-layer foundation feature**: a new DB migration, a new `/api/favorites/*` public API
  (+ OpenAPI + Java/TS client regen + JOOQ regen), new persistence + a shared identity resolver, a faceted
  read path across three asset kinds, FE star + panel + tab + facet + nav, i18n ×6, and docs.
- **`to decompose` (the maintainer's own label) + the scope-bounding cornerstone** ⇒ this issue **must not** be
  resolved as a single mega-PR. The contributor bar is *bound the change*; the #1 agent-PR rejection cause is
  scope. The decomposition is proposed below and is a **GATE-1 decision**.
- **Mission relevance:** core to the discovery pillar and the first **purely-personal, ownership-free,
  navigation-only** surface in ODD — the only personalisation the large no-Owner audience can get (PRD §2, §4).

## Architectural-significance check (G-C7) — **FIRES** → ADR proposed before any code

Three irreversible-blast-radius classes are present:
- **(b) auth / identity handling** — the feature resolves the principal `(oidc_username, provider)` from the
  security context with a DISABLED sentinel fallback; a shipped default (the shared bucket) is involved.
- **(c) new public API / wire contract** — `/api/favorites/{kind}/{id}` (PUT/DELETE), `/api/favorites/status`
  (POST), `/api/favorites/list` (GET) + new `AssetKind`/`AssetRef`/list schemas in the published spec.
- **persistence model** — a new `favorite` table (`V0_0_94`) with a polymorphic, FK-less, soft-delete design.

Per G-C7 the run **STOPS at scope-analysis and proposes an ADR** — no implementation plan for the body yet.
**ADR draft: `adrs/drafts/favorites-recently-viewed-foundation.md`** (D1–D8, formalizing PRD §5–§7 + the §11.4
resolution). It is approved at GATE 1 before any code.

## Phase B — verify the running system (LSN-031), not the issue text

For a not-yet-built feature, "reproduce" = confirm current state + confirm the integration points the feature
depends on, **on source/the running system** — not trusting the issue/PRD text (even though the author is the
maintainer; the contributor discipline is to verify). Verified against `main @ f12b8fbc`:

| Claim (issue/PRD) | Verified | Evidence |
|---|---|---|
| Identity = `(oidc_username, provider)` from context; Owner lookup is separate | ✓ | `auth/AuthIdentityProviderImpl.java:30-41` (`getCurrentUser` → `UserDto(username, provider)`; OAUTH2 → client-reg-id, else `authType`) and `:56-59` (`fetchAssociatedOwner`) |
| DISABLED has no principal | ✓ | `config/DisabledAuthSecurityConfiguration.java` — `permitAll`, no principal |
| List shape to mirror exists | ✓ | `openapi.yaml:2743` `getAlertsList` (facets + Page/Size + desc array); `SizeParam` has no `maximum` (DoS lever — cap) |
| Next migration is `V0_0_94` | ✓ | latest on disk = `V0_0_93__last_run_start_time.sql`; `V0_0_84` query_example, `V0_0_86` custom-tables |
| No pre-existing favorites/AssetKind | ✓ | grep `AssetKind`/`favorite`/`FavoriteController` over `odd-platform-api` + spec → none (greenfield) |
| **§11.4: does `LOOKUP_TABLE` fold into `DATA_ENTITY`?** | **✓ RESOLVED — YES (3-kind enum)** | `V0_0_86:8,13` `lookup_tables.data_entity_id FK → data_entity(id)`; `ReferenceDataServiceImpl.java:104` uses `getDataEntityId()`; `components.yaml:809` `LOOKUP_TABLE` is a data-entity type. A lookup table is favourited via its `data_entity` projection. |

**Phase B conclusion:** the foundation is buildable as designed; the load-bearing facts hold against source; the
one deferred design question (`AssetKind` cardinality) is resolved to **3 kinds `{DATA_ENTITY, TERM, QUERY_EXAMPLE}`**
(ADR D2). No running-stack repro needed for a greenfield feature; source verification is the appropriate Phase B.

## Proposed decomposition of #1815 (a GATE-1 decision)

#1815 = Favorites **+ the shared foundation**. Bounded, independently-reviewable slices (each its own branch +
PR; only the final slice carries `Closes #1815`). PLT-250 (Recently Viewed) reuses S1's foundation.

| Slice | Scope | Bucket |
|---|---|---|
| **S1 — Backend foundation + write API** *(recommended first)* | `V0_0_94` `favorite` table + indexes; `CurrentUserIdentityResolver` (the shared helper, DISABLED sentinel); `AssetKind`/`AssetRef`; `FavoriteController/Service/Repository(+Impl)` + mappers; **PUT/DELETE** `/api/favorites/{kind}/{id}` (set-state) + **POST** `/api/favorites/status` (batch); OpenAPI + **Java & TS client regen** + **JOOQ regen**; unit tests (identity incl. DISABLED, set-state idempotency, status batch) | backend / unit |
| **S2 — Favorites faceted list API** | **GET** `/api/favorites/list` (order-then-semi-join read path across the 3 kinds; multi-select facets; `size` cap); OpenAPI + clients; unit + an integration IT | backend / unit + integration |
| **S3 — Favorites frontend** | `<FavoriteStar>` (reuse `StarIcon`, `aria-pressed`, not colour-alone); Redux slice/thunks/selectors; main-page Favorites panel in `Overview.tsx` (outside the owner/auth gate, above the Owner block); star on rows + detail headers; Favorites top-level tab + facet sidebar + **Asset-type** facet; `AppMenuItem` + routes; i18n ×6; Playwright IT | frontend / integration |
| **S4 — Docs + housekeeping orphan sweep** | orphan purge in `HousekeepingJobManager`; `documentation` `release/1.0.0`: `Features.md` + log **"Asset"** in `main-concepts.md` Terms & Aliases (+ paired DOC backlog item, `milestone:1.0.0`); ontology `/enrich --touched` | docs / housekeeping / ontology |

**Refinement vs PRD §7.6:** that section co-located `favorite` + `recently_viewed` in one migration; for bounded
delivery, **#1815's `V0_0_94` creates `favorite` only** — PLT-250 owns the `recently_viewed` migration. (Minor;
flagged for GATE-1 confirmation.)

## Plan (GATE 1 artifact) — recommended first slice: **S1 (Backend foundation + write API)**

> Presented for human approval at GATE 1. **No code until approved (G-C3); the ADR is approved before any code
> (G-C7).** Design-before-build (G-C12) + product critique (G-C16) below.

### Change-request product analysis (G-C16)
The change request **is** the maintainer's own PRD-0001 (Product + SME + SRE/security already consulted; product
decisions resolved in §11). The user-observable problem — *no way to pin assets; no personalisation for the
no-Owner audience* — is restated and confirmed independent of the solution. The issue's "Suggested fix" is treated
as data: I verified it against source and **diverge on one point** — `AssetKind` is **3 kinds, not 4**
(`LOOKUP_TABLE` folds into `DATA_ENTITY`, ADR D2). No other divergence; the product shape stands.

### Design-before-build (G-C12)
- **Reuse-scan:** `getCurrentUser()` (identity), `getAlertsList` (list shape), `StarIcon` (the star), the
  `Search/Filters/*` facet components, `HousekeepingJobManager` (sweep), the `V0_0_89` soft-delete +
  `V0_0_92` provider-tuple conventions — all reused. Net-new: the `favorite` table, the favorites
  controller/service/repo, the `CurrentUserIdentityResolver` helper (justified — the single shared component
  both features need), the `AssetKind`/`AssetRef` schemas.
- **ADR-check:** this run authors the foundation ADR (G-C7); it conforms to the existing identity model
  (`AuthIdentityProviderImpl`), the soft-delete/partial-unique migration convention, and the reads-are-
  authenticated-only authz posture (no new policy type).
- **Impact checklist (S1):** OpenAPI (`openapi.yaml` + `components.yaml` AssetKind/AssetRef/status schemas; cap
  `SizeParam`) → **regenerate Java + TS clients**; **JOOQ regen** after `V0_0_94`; unit tests; **i18n/docs/FE
  deferred to S3/S4** (logged here, not dropped). Activity-log: **none** (favouriting is personal — noted so a
  reviewer doesn't flag the omission).
- **PO/SRE lens (odd-sme):** folded via PRD §6–§7 (authenticated-only, identity-from-context, server-side size
  cap, set-state race-safety, no event-loop blocking). Re-consult `odd-sme` at S2/S3 if the read-path or UX shape
  shifts.

### Scope EXCLUSIONS (S1 — deliberately NOT touched, G-C5)
- The **list endpoint** (`GET /api/favorites/list`) and its semi-join read path → **S2**.
- **All frontend** (`<FavoriteStar>`, panel, tab, facet, nav, Redux, i18n) → **S3**.
- **Docs + the "Asset" term + the housekeeping orphan sweep + ontology refresh** → **S4**.
- **Recently-Viewed** (the `recently_viewed` table, its endpoints, the housekeeping TTL job) → **PLT-250**.
- "Clear all history", team/shared favorites, sub-object favoriting → out of 1.0.0 (PRD §3 non-goals).

### Tests (S1)
- **Unit (odd-platform CI):** `CurrentUserIdentityResolver` (OAUTH2 / LOGIN_FORM / **DISABLED → sentinel**);
  set-state idempotency (double PUT = present once; DELETE = absent; re-PUT after DELETE re-activates);
  `POST /status` returns exactly the favourited subset. Each test FAILS without the code, PASSES with it.
- **Integration (odd-team IT-NNN):** deferred to **S2** (the user-facing list/panel is the integration symptom);
  S1 is unit-covered. (G-C9: an integration IT becomes mandatory at S2/S3 where the symptom is user-facing.)

### Docs / ontology routing
- Docs: **none in S1** (no user-visible behaviour ships until S3); the doc deliverable is **S4** → `release/1.0.0`
  (G-C11). Recorded, not asserted-unread — the page read happens at S4.
- Ontology: `/enrich --touched` at **S4** (after the feature surface exists).

## GATE 1 — decisions surfaced to the maintainer

1. **Approve the foundation ADR** (`adrs/drafts/favorites-recently-viewed-foundation.md`) — incl. the §11.4
   resolution (`AssetKind` = 3 kinds; `LOOKUP_TABLE` → `DATA_ENTITY`).
2. **Decomposition mechanism** — stacked slice-PRs under #1815 (I manage the slices) vs. sub-issues you create
   (new issues are a human action) vs. one PR.
3. **First slice + its plan** — recommended **S1 (Backend foundation + write API)**; confirm scope + the
   `V0_0_94` = favorite-only refinement.

_Status stays `planned` until GATE-1 approval; then `plan-approved` → S1 implementation in a dedicated worktree
(ctrib039 namespace), no code before that._
