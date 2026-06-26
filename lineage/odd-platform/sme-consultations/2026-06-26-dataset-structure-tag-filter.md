---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-26T00:00:00Z
consulted_by: contribute-run (odd-platform#1679)
consultation_question: Is column/field-level tag filtering on a dataset's Structure tab (tag chips at top, click to filter, same for type chips) the product-right shape, and what are the implicit defaults (multi-select, count badges, semantics, important/system-tag ordering) an operator would expect?
slug: dataset-structure-tag-filter
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# Dataset Structure tab — column-level tag filtering (issue #1679)

## TL;DR

**Ship it — the issue's WHAT is product-right.** Column/field-level tagging is a mature, standard capability (DataHub ships column tags with an "Edit Dataset Column Tags" privilege and lets users "filter entities by the presence of a specific tag"; Microsoft Purview ships column classifications whose stated purpose is to "narrow down the search"). More decisively, the feature **mirrors ODD's own existing mental model**: ODD already filters *entities* by tag via the global Search Tag facet ("Tags drive the Tag facet on Search"), and the Structure tab **already** shows clickable-feeling type-count chips plus a name-Search box. So this extends an established in-tab pattern rather than inventing one. Minimal refinements to specify: **multi-select** chips, a **per-tag column-count badge** (the type chips already carry counts — a tag chip without one would be inconsistent), a **clear-all** affordance, **OR-within / AND-across** semantics that compose with the name search, **important-tags-first** ordering (ODD's `Tag.important` is an admin-curated flag), and an **empty-result** state. Keep it **client-side** over the already-loaded structure payload — no new endpoint, no new load on the hot detail path.

## Question scope

Archetype: **mixed** (plausibility + comparative + implicit-requirements + ODD-consistency + workflow + verdict). Caller-verified anchors are treated as given and not re-derived: the Structure tab today shows a column count, data-**type** count chips, and a name Search box; each `DataSetField` carries `Tag` = {name, important?, external/system?}; the structure payload already includes field tags (so filtering is client-side). Out of scope: the React component tree, the jOOQ/repository layer, and the exact tag-chip render order beyond the important-first principle.

## Domain plausibility

- **Operator workflow match (strong).** Maps cleanly to a recognizable workflow — *navigate a wide table's schema* (see below). A 150-column table where the user wants "just the PII columns" or "just the `dimension` columns" is exactly what column-tag filtering serves.
- **Published ODD surface (verified).** The Structure tab already hosts per-column tags: "the column-level counterparts to the entity-level annotation surfaces on a dataset's Structure tab — description, tags, glossary terms, enum values, and business name editors per column" (data-discovery, 200). The data the filter needs is already there and already user-editable.
- **Competitor parallel (verified, 2 of 5).** DataHub and Purview both confirm column-level tags/classifications as filter-driving capabilities (citations below). Atlan, Collibra, Alation were **not** verified this pass (JS doc-shell / doc-index / paywall) — not asserted.
- **Verdict: HIGH-PLAUSIBILITY.** The one nuance: no competitor doc I reached describes the *exact* "click a chip inside the schema view to narrow the column list" UX — they document column tags + *catalog-level* filtering. That gap is covered by a stronger argument than a competitor citation would be: **ODD's own Structure tab already ships the in-tab chip + search pattern** (type chips, name search), so the issue extends a local precedent.

## Industry vocabulary alignment

- **ODD term (verbatim):** `Tag` — "Global, cross-tenant directory entry for taxonomic labelling of data entities. Schema: (id, name UNIQUE …, important boolean, deleted_at)" (concepts.yaml:3270). Tags split **internal** (operator-managed) vs **external/system** (`TagToDataEntityPojo.external=true`, ingestion-managed, protected from UI replace-all — concepts.yaml:3293,5819).
- **Competitor variants:** DataHub calls them **Tags** (column-level); Microsoft Purview calls them **Classifications** ("unique logical tags or classes," 200+ system + custom). Same concept, different noun.
- **Recommendation: preserve "Tag".** No vocabulary change — the feature filters existing `Tag` rows; the chips should display the tag name verbatim. Do not introduce "classification" or "label" as a new ODD noun.

## Implicit requirements

- **Functional — semantics (Q2).** Multi-select with default = *All*. Within the tag-chip facet, selecting two tags = **OR** (show columns carrying tag A *or* B). Across facets — tag-set **AND** type-set **AND** name-search — combine with **AND**. ODD's own precedent supports AND-across: the Quality Dashboard uses AND-only "per-side filter sets" (data-quality, 200) and global Search composes its seven facets. The within-facet-OR + multi-select-default is the standard faceted-filtering convention (domain knowledge — no external citation secured this pass; Baymard 404). Confidence: HIGH on AND-across (ODD-anchored), MEDIUM-HIGH on OR-within (convention).
- **Functional — count badge (Q4, must-have).** Each tag chip shows how many columns carry it. The type chips on this exact tab already carry counts (`128 Str 83.66%`); a tag chip without a count is locally inconsistent and hides whether a click is worthwhile. (No citation — consistency with caller-verified existing UI.)
- **Functional — clear/reset (Q4, must-have).** Multi-select filters need a one-click route back to all columns.
- **Functional — empty-result state (Q4, must-have).** A zero-match combo shows "No columns match" + clear-filters CTA, not a blank table.
- **Security.** None new — tags are already visible on the Structure tab to every reader (ODD's read-collaborative posture, system-mission.md:267). Filtering is read-only over already-loaded data; no mutation, no new permission. Confidence: HIGH.
- **Performance (SRE lens, load-bearing).** Keep filtering **client-side** over the structure payload the caller confirmed already includes field tags. A server-side "filter via API" variant would add round-trips onto `getDataEntityDetails`, which is already a write-on-read / no-cache hot path (concepts.yaml:566). Client-side is both simpler and avoids the hot path entirely. Confidence: HIGH.
- **Reliability.** Schema revisions change the column set, so a tag present in revision N may be absent in N+1 — reset the filter on revision/navigation change rather than carrying a now-dangling selection.

## ODD-specific consistency (Q3)

- **Yes — ODD already filters entities by tag.** The global Search Tag facet is live: "Tags drive the Tag facet on Search" (data-discovery, 200). The in-dataset column filter should **mirror that mental model**: same `Tag` entity, same click-to-narrow gesture, but scoped to one dataset's columns and computed client-side. A user who knows the Search Tag facet will read the Structure-tab chips the same way. *(Note: the question hypothesised a Data Quality "tag filter" precedent — I could not confirm one; the verified DQ dashboard text names only "per-side filter sets (tables vs tests)." The load-bearing ODD precedent is the **Search Tag facet**, which is confirmed.)*
- **important vs external/system ordering.** `Tag.important` is an **admin-curated** high-signal flag ("admin-curated 'important' distinction preserved," concepts.yaml:3292). Honour it: **render important tags first** in the chip row. External/system tags (ingestion-managed, e.g. a classifier collector's `PII` tag) are often the *most* useful filter targets — keep them filterable, do not hide them; an optional subtle marker can distinguish system tags, but ordering, not exclusion, is the lever. Confidence: HIGH that `important` exists and is curated (schema-anchored); MEDIUM that important-first is the right chip order (UX judgment).

## Operator workflows this participates in

- **Navigate a wide table's schema (new named workflow).** *Who:* data engineer / analyst / steward. *Trigger:* opened the Structure tab of a wide (50–500 column) dataset. *Outcome:* click the `PII` (or `deprecated`, or `dimension`) tag chip → the column list narrows to the tagged fields; combine with the type chip or name search to narrow further. Today the fallback is browser Ctrl-F or scrolling.
- **PII / sensitivity audit before a schema change** — a steward checking which columns carry a sensitivity tag is a direct instance; ties into the Rule-4 seed *Trace blast radius before a schema change*.

## Competitor comparison

| System | Equivalent feature | Notable behaviour | URL (status) |
|---|---|---|---|
| DataHub | Column-level **Tags** | "Edit Dataset Column Tags" privilege; users "can search for a tag … and even filter entities by the presence of a specific tag" (in-schema-view column filtering not documented on the pages reached) | docs.datahub.com/docs/tags (200) |
| Microsoft Purview | Column-level **Classifications** | 200+ system + custom classifications applied to columns during scan; stated purpose is to "Narrow down the search for data assets" | learn.microsoft.com/en-us/purview/data-map-classification (200) |
| Atlan / Collibra / Alation | (column tags exist in-product) | **Not verified** this pass — JS doc-shell / paywall / doc-index landing only; not asserted | — |

## Recommended framing for the caller

**Approve the issue as proposed; refine, do not reshape.** Column-level tag filtering on the Structure tab is a standard catalog capability (DataHub, Purview) and — more importantly — it mirrors ODD's own live Tag-facet-on-Search mental model while extending the Structure tab's existing type-chip + name-search pattern. Specify six refinements: **(1)** multi-select chips; **(2)** a per-tag column-**count badge** (matching the type chips already shown); **(3)** a **clear-all** affordance; **(4)** **OR-within / AND-across** semantics that compose with the existing name search; **(5)** **important-tags-first** ordering (honouring `Tag.important`); **(6)** an **empty-result** state. Make the existing display-only type chips **clickable** as the issue asks (small, consistent add). Keep everything **client-side** over the already-loaded structure payload — no new endpoint, no new load on `getDataEntityDetails`. **Defer** (nice-to-have): filter persistence across navigation/revision (reset-on-change is the safe MVP default) and any saved-filter-combo feature.

## Caveats and uncertainty

- **No competitor citation for the exact in-schema "click chip → filter columns" UX.** DataHub/Purview confirm column tags + *catalog-level* filtering, not in-schema-view click-to-filter. The justification rests on ODD's **own** existing type-chips + name-search on the same tab (caller-verified) — a stronger consistency argument than a competitor citation, but the maintainer should know the competitor pages stop at "column tags exist + drive search."
- **Atlan, Collibra, Alation not verified** (shells / paywall / doc-index). Not asserted.
- **OR-within / AND-across convention:** no external UX citation secured (Baymard URL 404). AND-across is ODD-anchored (DQ dashboard, Search); OR-within is flagged domain knowledge.
- **DQ-dashboard tag filter not confirmed** — the question's hypothesised precedent there is unverified; the confirmed precedent is the Search Tag facet.

## Citations

**Live (fetched 2026-06-26):**
- docs.opendatadiscovery.org/features/data-discovery — **200**. "the column-level counterparts to the entity-level annotation surfaces on a dataset's Structure tab — description, tags, glossary terms, enum values, and business name editors per column"; "Free-text search across entity names plus seven facets (Datasource / Type / Namespace / Owner / Tag / Groups / Statuses)"; "Tags drive the Tag facet on Search"; manual tagging applies to "data entities and columns".
- docs.opendatadiscovery.org/features/data-quality — **200**. Quality Dashboard has "per-side filter sets (tables vs tests)"; no Tag/Namespace/Owner filter enumerated (tag-filter precedent **not** confirmed).
- docs.datahub.com/docs/tags — **200**. Column-level tags via the schema view; "Edit Dataset Column Tags" privilege; users "can search for a tag in the search bar, and even filter entities by the presence of a specific tag"; in-schema-view column filtering not detailed.
- docs.datahub.com/docs/features — **200**. No schema-view column search/filter detail (recorded as not-found, not absent).
- learn.microsoft.com/en-us/purview/concept-classification → canonical learn.microsoft.com/en-us/purview/data-map-classification — **200**. Classification = "assigning unique logical tags or classes to the data assets"; example "classification applied while scanning on the Customer table"; 200+ system + custom classifications; classification helps "Narrow down the search for data assets that you're interested in."
- docs.alation.com/en/latest/ — **200 but doc-index/shell** — no column-tag-filter detail surfaced; not asserted.
- baymard.com/learn/ecommerce-filtering — **404** (no faceted-filter-semantics citation secured).

**Workspace:**
- `lineage/odd-platform/concepts.yaml` — :3270 (`Tag` schema, `important boolean`, internal vs side-door create), :3292 (`important=false` for auto-created; "admin-curated 'important' distinction preserved"), :3293/:5819 (external/system tag = `TagToDataEntityPojo.external=true`, ingestion-managed, protected from UI replace-all), :566 (`getDataEntityDetails` write-on-read / no-cache hot path).
- `lineage/odd-platform/system-mission.md` — :80-81 (entity-class / Type facet values), :158 (DQ dashboard AND-only two-side filters), :267 (read-collaborative posture), P-01 Manual Object Tagging.
- `prds/0001-favorites-and-recently-viewed.md` — §3 non-goal "Favoriting sub-objects (dataset fields, columns)" confirms field/column is a recognised sub-object granularity in the workspace (distinct feature: that excludes *favoriting* columns; this issue is *filtering* columns).
- Caller-verified anchors (not re-derived): Structure tab shows column count + type-count chips + name Search; each `DataSetField` carries `Tag`; structure payload already includes field tags (client-side filtering viable).
