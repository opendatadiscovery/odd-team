---
id: IT-071
title: "The SPA home page (/) composes the catalog-overview widgets — search box, per-class usage dashboard, directory strip"
gates:
  validates: [F-141]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/catalog-overview-home.spec.ts"
plan_ref: "I9"
status: ready
---

# IT-071 — Catalog Overview Home Page composition (F-141)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
`Overview.tsx` (the `/` route) composes the catalog-wide landing widgets — MainSearch + TopTagsList +
Domains + DataEntitiesUsageInfo + Directory (+ conditional OwnerAssociation) — into one route. The
skeleton lifts once identity + the popular-tags fetch resolve (`Overview.tsx:29-32`); the other widgets
self-load. This pins F-141-UC-01 (the composition smoke — previously **unverified**, no test existed):
landing on `/` renders a coherent composition. If it FAILS, the platform's first surface does not
compose. Source: feature-flow F-141 (UC-01).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Reuse the shared stack (`ODD_STACK_EXTERNAL=1`).
- **Seed data**: a searchable entity (id 20710) so the catalog is non-empty and the usage dashboard
  has a real count; for the corner, a tag with `usedCount>=1` on a searchable entity (id 20712) so it
  reaches the catalog-wide popular-tags list. Both via `seedSearchableEntity` + verified tag SQL.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Usage widget data: `curl -s http://localhost:18080/api/dataentities/usage` → `total_count` > 0.
- Skeleton-lift gate fires: `/` issues `GET /api/tags?page=1&size=30` (popular tags).

## 4. Run protocol
1. COMPOSITION: seed a searchable entity; open `/`; wait for the popular-tags fetch (`/api/tags?...`)
   that lifts the skeleton; observe (a) the MainSearch hero box, (b) the "Total entities" usage card,
   (c) the Directory strip.
2. TOP-TAGS: seed a used tag; open `/`; wait for the tags fetch; observe the tag chip in the strip.

**Automated rail**: `integration-tests/run-suite.sh IT-071` (Playwright `e2e/specs/catalog-overview-home.spec.ts`).

## 5. What it checks — assertions
- **COMPOSITION (PASS):** all three anchors render — the MainSearch box (home variant placeholder
  "Search data tables, …"), the "Total entities" card (DataEntitiesUsageInfo), and the "Directory"
  strip heading (Overview-side mini Directory — SINGULAR, distinct from the full-page "Directories").
- **TOP-TAGS (PASS):** a used tag chip surfaces in the home Top-Tags strip.
- **FAIL:** any anchor is missing → the home composition shell did not render that widget.

## 6. Result log
- 2026-06-07 — authored; home-page wire calls ground-truthed live (popular-tags = `GET /api/tags?page&size`;
  usage = `GET /api/dataentities/usage` total_count:20). Both tests PASS via Playwright
  (ODD_STACK_EXTERNAL=1). NB the home MainSearch placeholder + the SINGULAR "Directory" heading
  were corrected against primary source during authoring.
