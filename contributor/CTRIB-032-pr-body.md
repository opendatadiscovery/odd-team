# Propagate a lookup-table description to its catalog entity (external description)

Closes #1781

## Problem

The Lookup-Table create/edit form has a **Description** field saved to `lookup_tables.description`, but it was
**never propagated to the associated catalog Data Entity**, so the entity overview showed nothing — a quiet waste
of the operator's curation effort on a surface (master-data reference tables) where description quality matters.

Reproduced on `main` (auth disabled): `POST /api/referencedata/table {description:"…"}` stores the description on
the lookup table, but `GET /api/dataentities/{id}` returns an empty `internal_description` **and**
`external_description`; editing the lookup-table description does not change that either.

## Root cause

`DataEntityMapperImpl.mapCreatedLookupTablePojo` (create) and the `applyToPojo(DataEntityPojo, ReferenceTableDto)`
it calls on update build the catalog entity but never set a description, although the form value is carried that far
(`ReferenceTableDto.tableDescription`, set in `ReferenceDataServiceImpl` on both paths).

## Change

A lookup table is a **source** the platform auto-ingests into the catalog, so its description is the entity's
**external (source) description**. Both mapper methods now
`.setExternalDescription(tableDto.getTableDescription())`. The entity overview already renders
`external_description` (read-only, below the internal description), so the description now appears with no
front-end change. The catalog's own **internal** description (the *About* editor, with `[[term]]` live links)
is intentionally left untouched, so a lookup-table edit never clobbers a manually-curated catalog description.

Two descriptions therefore coexist for a lookup-table entity — **internal** = catalog curation, **external** =
the lookup source. This is a deliberate, backward-compatible shape; a future release may consolidate them into a
single description.

**Deliberately not in this PR (scope):** no change to the lookup-table form, the OpenAPI contract, or the DB
schema (fully backward-compatible); `internal_description` untouched; no term-linker wiring for the external
description; the future single-description consolidation is tracked separately.

## Tests

- **Unit (`DataEntityMapperImplTest`)** — added two tests asserting the propagation on create and update, and that
  the entity's `internal_description` is **not** clobbered by a lookup-table edit. RED on `main` (description was
  `null`), GREEN with the fix. The full `:odd-platform-api:build` (test + checkstyle + assemble + Testcontainers
  integration tests) passes.
- **End-to-end (browser)** — a new integration test creates a lookup table with a description and asserts it
  renders on the entity overview, that editing it updates the overview, and that a table with no description
  renders nothing. Verified against a System-Under-Test built from this branch: **3/3 pass**; the same test
  **fails on `main`** (create + edit assertions red — the description was not rendered), so it genuinely guards
  the fix. The full integration regression (feature-complete / multi-stack / known-bugs / ingestion-e2e) is
  green with no new failures introduced by this change (the only feature-complete reds are tests for other,
  unrelated in-flight fixes, which fail identically on `main`).

## Docs

`Docs: documentation@release/0.29.0 — publishes with the 0.29.0 release.` The Lookup Tables page's
"description not propagated" operator caveat is replaced with a note describing where the description appears
(external vs internal) and the future consolidation.

Milestone: 0.29.0
