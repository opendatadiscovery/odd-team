---
adr_slug: ingestion-auth-filter-coverage
title: "Ingestion authentication is a single /ingestion/** gate, not per-route exact-path filters"
status: proposed
date: "2026-06-22"
ctrib: CTRIB-029
github_issue: https://github.com/opendatadiscovery/odd-platform/issues/1740
milestone: "0.29.0"
extends: [ADR-0002 (centralised path-matcher authorization), ADR-0003 (read-collaborative authorization)]
description: "When auth.ingestion.filter.enabled=true, the whole /ingestion/** write surface must require a registered collector/datasource Bearer token — enforced by one uniform authentication filter, not a growing set of exact-path WebFilters."
---

# ADR (proposed): Ingestion authentication is a single `/ingestion/**` gate, not per-route exact-path filters

> **Status: PROPOSED — GATE 1 / human approval pending (G-C7).** This is an auth/security-posture
> change; per the contributor pillar no code is written until a human approves this ADR + the
> CTRIB-029 plan. The live reproduction and the implementation are additionally blocked on the shared
> odd-platform working tree (see CTRIB-029 § Parallel coordination).

## Context

ODD Platform has **two independent authentication surfaces** (documented at
`documentation/docs/configuration-and-deployment/enable-security/README.md:7-14`):

| Surface | Protects | Flag |
|---|---|---|
| UI / API (`/api/**`) | human + programmatic catalog clients | `auth.type` (DISABLED/LOGIN_FORM/OAUTH2/LDAP) |
| Ingestion (`/ingestion/**`) | collectors / push adapters | `auth.ingestion.filter.enabled` (default `false`) |

`/ingestion/**` is in `SecurityConstants.WHITELIST_PATHS` (`SecurityConstants.java:95-96`), so it
**never traverses** the UI auth chain or the central `SECURITY_RULES` table that ADR-0002 / ADR-0003
govern (`AuthorizationCustomizer` permits the whitelist, applies `SECURITY_RULES`, then closes with
`pathMatchers("/**").authenticated()`). The ingestion surface is instead protected by **dedicated
`WebFilter`s** — and that sub-system is exactly what ADR-0002/0003 leave undecided. This ADR fills
that gap, in their spirit (one auditable place, not scattered guards).

**The two existing filters use exact-path matchers** (`AbstractIngestionFilter implements WebFilter`;
a non-matching path falls straight through with **no auth** — `AbstractIngestionFilter.java:36-40`):

- `IngestionDataSourceFilter` — **always on**, matches exact `POST /ingestion/datasources`; resolves the
  Bearer token to a **collector** (`collectorRepository.getByToken`) and binds the collector id into the
  session (`IngestionDataSourceFilter.java:20,31-39`).
- `IngestionDataEntitiesFilter` — `@ConditionalOnProperty("auth.ingestion.filter.enabled"=="true")`,
  matches exact `POST /ingestion/entities`; parses the `DataEntityList` body, resolves the **datasource**
  by its oddrn, and requires the Bearer token to **match that datasource's** (or its collector's) token —
  per-resource *authorization* (`IngestionDataEntitiesFilter.java:20,28,43-58`).

### The gap (verified live on `origin/main` fb597e04)

Every other `/ingestion/*` route has **no** filter, so it is reachable with no token even when
`auth.ingestion.filter.enabled=true` and `auth.type` is OAUTH2/LDAP/DISABLED:

| Route (verified against the spec) | Method | Handler | Risk |
|---|---|---|---|
| `/ingestion/entities/datasets/stats` | POST `DatasetStatisticsList` | `IngestionController.postDataSetStatsList` (`:82`) | poison any field's statistics (DQ dashboards, BI) |
| `/ingestion/metrics` | POST `MetricSetList` | `IngestionController.ingestMetrics` (`:90`) | inject fake metric values |
| `/ingestion/alert/alertmanager` | POST (webhook) | `AlertManagerController.alertManagerWebhook` (`:21`) | inject external alerts (alert fatigue / mask real incidents) |
| `/ingestion/entities/degs/children` | **GET** `oddrn` query param | `IngestionController.getDataEntitiesByDEGOddrn` (`:76`) | **read** — enumerate any DEG's membership (information disclosure) |

Two corrections to issue #1740's framing (the issue is data, not spec — G-C8):
1. `degs/children` is a **GET read**, not the "POST attach arbitrary child entities" the issue states —
   its risk is *information disclosure*, not mutation (spec `odd_api.yaml:76-95`).
2. `POST /ingestion/alerts` (`createAlerts`, `IngestionAlertList`) is **declared in the spec but has no
   controller implementation** (`IngestionController` overrides every other op but not `createAlerts`); the
   *implemented* alert-write vector is the unlisted `POST /ingestion/alert/alertmanager` webhook, which the
   issue does not mention.

This is **already documented** as a known limitation (the `enable-security` deployment matrix,
`README.md:99-109`); `README.md:62` — *"A platform-side fix to broaden the ingestion filter's coverage is
tracked upstream"* — points at this very issue. The docs are ahead of the code; closing the gap makes the
flag finally mean what the matrix says it should.

### Why this is not a one-line matcher widen

The issue's Option 1 ("widen `IngestionDataEntitiesFilter` to `/ingestion/entities/**` + add filters for
alerts/metrics") is a trap: that filter's `getRequestDecorator` **parses the body as `DataEntityList`** to
extract the datasource oddrn. The sibling routes carry *different* body shapes (`DatasetStatisticsList`,
`MetricSetList`) — and `degs/children` is a GET with no body at all — so one decorator cannot serve them,
and "add a filter per route" scatters the auth model across N exact-path beans (the opposite of ADR-0002's
single auditable place, and the exact pattern that let four routes silently ship unprotected).

## Decision

**Introduce one uniform `IngestionAuthenticationFilter` that matches `/ingestion/**` and enforces
*authentication* — a valid, registered collector- or datasource-Bearer token — body-shape-agnostically,
gated by `auth.ingestion.filter.enabled`. Keep the existing per-resource *authorization* on
`/ingestion/entities` and the always-on collector binding on `/ingestion/datasources` unchanged.**

Mechanics:

1. The new filter validates the `Authorization: Bearer <token>` resolves to a **known** collector token
   **or** datasource token — *without parsing the body* (it generalises `IngestionDataSourceFilter`'s
   token-lookup, which already needs no body). Missing/unknown token → `401` (the existing
   `AbstractIngestionFilter.writeResponse` shape). Because it never inspects the body, it covers stats,
   metrics, the GET read, and any future `/ingestion/*` route uniformly.
2. Its matcher **excludes the two paths that already have a dedicated filter** (`/ingestion/entities`,
   `/ingestion/datasources`), so every ingestion path is guarded by **exactly one** filter — no double
   gate, each filter single-responsibility (ADR-0002 ethos).
3. It is `@ConditionalOnProperty("auth.ingestion.filter.enabled"=="true")`, mirroring the entities filter.
   So the flag's meaning becomes coherent end-to-end:
   - **flag ON** → entities = per-datasource authz (unchanged); datasources = collector binding
     (unchanged, always-on); **every other `/ingestion/**` route = "must present a registered token."**
   - **flag OFF (default)** → unchanged from today (entities + siblings OPEN; datasources still always-on).
     This ADR does **not** change the shipped default (see Scope boundaries).

This is *authentication parity* across the surface (the property operators expect from the flag — "turn it
on, the ingestion surface needs a token"), achieved without fragile per-body-shape oddrn extraction.
Per-resource *authorization* on stats/metrics (token must own the specific dataset) is a strictly stronger
property deferred as a follow-up (below) — it is independent of, and unblocked by, this change.

### Alternatives considered

- **Option 1 — widen the entities matcher + add per-route filters.** Rejected: body-shape coupling
  (above) + scatters the model across N beans (anti-ADR-0002); a future route still ships unprotected unless
  someone remembers to add its filter.
- **Option 2-strong — one `/ingestion/**` filter doing full per-resource authorization.** Rejected *for
  this PR*: requires a per-body-shape oddrn-extraction registry (stats/metrics/alerts each differ; GET has
  no body), which is a larger, separately-testable design. The recommended filter is the authentication
  floor of this same idea; the authorization layer lands as the follow-up without rework.
- **Reuse `S2sAuthenticationFilter`.** Rejected: S2S authenticates an `X-API-Key` and grants **ADMIN**
  (`S2sAuthenticationFilter.java:20,31-39`) — the wrong identity model for ingestion (a collector is not an
  admin) and orthogonal to the collector/datasource token the SDK already sends.

## Scope boundaries (what this decision does NOT do — G-C5)

1. **The Alertmanager webhook (`POST /ingestion/alert/alertmanager`) IS covered** by the uniform filter
   (maintainer decision 2026-06-22): with the flag on it requires a registered collector/datasource token like
   every other ingestion route. Prometheus Alertmanager's `http_config` can send the Bearer token, so the
   integration is not broken — the operator configures it. **Because the shipped default stays `false` (boundary
   2 below), the webhook — like every ingestion route — is OPEN by default; that caveat is articulated
   explicitly** on the operator-facing pages: `active-platform-features/notifications`,
   `configuration-and-deployment/odd-platform` (Prometheus AlertManager Integration), and
   `integrations/integrations`, plus the `enable-security` matrix.
2. **The shipped default is not flipped.** Issue #1740's "Additional notes" suggests making
   `auth.ingestion.filter.enabled=true` implicit when `auth.type != DISABLED`. Changing a shipped security
   default is itself a G-C7 change that can break existing deployments whose collectors are not yet sending
   tokens — it deserves its own ADR + migration note. This PR makes the flag *correct*; whether to change its
   default is the next decision. → **follow-up item.**
3. **Per-resource authorization on stats/metrics is deferred** (this PR delivers authentication for them).
   The documented cross-dataset stats-write surface (`enable-security/README.md:64-89`) is a *separate*
   data-integrity bug, not an auth-coverage gap. → **follow-up item.**
4. **`POST /ingestion/alerts` (`createAlerts`) has no handler** — nothing to protect today. When implemented
   it falls under the uniform filter automatically (the benefit Option 2 buys). No action now.

## Consequences

- The flag finally protects the **whole** ingestion write surface; the `enable-security` deployment matrix
  rows for stats / metrics / degs-children flip from OPEN to AUTH-token under flag-ON (docs update, routed to
  the `release/0.29.0` train — G-C11).
- **One place** answers "what protects ingestion route X" — the uniform filter (catch-all) plus the two
  resource-specific filters; a future `/ingestion/*` route is authenticated by default, never silently open.
- **Backward-compatible for compliant collectors.** `odd-collector-sdk` sets `Authorization: Bearer <token>`
  on **every** ingestion call (a shared `PlatformApi.headers`, `datasource_api.py:21-24`), so flag-ON keeps
  working for any collector whose token is registered — verified, not assumed.
- **A token unknown to the platform now gets 401 where it previously succeeded** under flag-ON — intended,
  and the whole point; called out in the docs + PR body so operators flipping the flag expect it.
- Filter ordering / matcher-exclusion is the one implementation subtlety (avoid double-gating
  `/ingestion/entities`); covered by the CTRIB-029 plan + an integration assertion per affected route.

## Evidence

- `odd-platform-api/.../auth/util/SecurityConstants.java:95-96` — `/ingestion/**` in `WHITELIST_PATHS`.
- `odd-platform-api/.../auth/filter/AbstractIngestionFilter.java:36-40,45-51,66-72` — `WebFilter`; non-match
  → `chain.filter` (no auth); `resolveToken`; `401` on `AccessDeniedException`.
- `odd-platform-api/.../auth/filter/IngestionDataSourceFilter.java:20,31-39` — always-on exact
  `/ingestion/datasources`; token→collector; session binding.
- `odd-platform-api/.../auth/filter/IngestionDataEntitiesFilter.java:20,28,43-58` — conditional exact
  `/ingestion/entities`; token→datasource(body oddrn) per-resource authz.
- `odd-platform-api/.../auth/filter/S2sAuthenticationFilter.java:20,31-39` — the rejected reuse (X-API-Key → ADMIN).
- `odd-platform-api/.../controller/IngestionController.java:76,82,90` — degs-children (GET), stats, metrics handlers.
- `odd-platform-api/.../controller/AlertManagerController.java:21` — the implemented `ingestion/alert/alertmanager` webhook.
- spec `opendatadiscovery-specification/specification/odd_api.yaml:10,27,44,60,76,97` — the six `/ingestion/*` routes + methods + bodies.
- `odd-collectors/odd-collector-sdk/odd_collector_sdk/api/datasource_api.py:21-24` — SDK Bearer header (backward-compat).
- `documentation/docs/configuration-and-deployment/enable-security/README.md:7-14,49-62,99-109` — the two-surface model, the uncovered-paths section, the deployment matrix, the "tracked upstream" note.
- Governing ADRs: `documentation/docs/developer-guides/architecture-decision-log/ADR-0002-centralised-path-matcher-authorization.md`; backlog `ADR-0003` (read-collaborative authorization).

## Follow-ups to log on approval (G-C5 / follow-up-on-disk)

- **ADR/CTRIB — flip `auth.ingestion.filter.enabled` default** (implicit-true when `auth.type != DISABLED`) + migration note.
- **CTRIB/PLT — per-resource authorization for stats/metrics** (token must own the dataset/datasource in the body).
- **DOC (release/0.29.0 train)** — update the `enable-security` deployment matrix (OPEN→AUTH-token rows incl. the
  webhook) + retire the "tracked upstream" note when the fix ships; add the "open by default" caveat to
  `active-platform-features/notifications`, `configuration-and-deployment/odd-platform` (Prometheus AlertManager
  Integration), and `integrations/integrations`.

Sources: all citations above were read on 2026-06-22 from the working trees at `odd-platform@fb597e04`
(auth files unmodified vs origin/main — verified via `git show origin/main:…`), the spec repo, the
odd-collectors SDK, and the documentation repo. No claim rests on memory.
