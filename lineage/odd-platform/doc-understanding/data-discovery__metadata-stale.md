---
doc_page: "docs/data-discovery/metadata-stale.md"
page_title: "Metadata stale"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/metadata-stale"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/metadata-stale"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: ["F-208", "F-146"]
  code_nodes:
    - "odd-platform java DataEntityStaleDetector config-key-consumer:odd.data-entity-stale-period@L10"
audience: [operator, developer]
doc_claim_vs_code: []
maintainer_curated: false
---

# Metadata stale — doc understanding

This page documents the cross-cutting **Data Entity Staleness Indicator** (Feature
**F-208**, confirmed via graph-node; its own description cites the same predicate
and the `MetadataStale` widget). The page tells an operator that an entity is flagged
stale when its last ingestion is older than `odd.data-entity-stale-period` (default
7 days), how the orange clock icon + relative-time tooltip surface across catalog
surfaces (Search result rows map to Feature **F-146**), and five operator caveats
that all follow from the predicate's exact shape.

Every operator-critical claim was verified against source at `documentation` HEAD
`30795b4` / `odd-platform` HEAD `ede5d277`:

- **Config key + default + no-startup-validation footgun (the danger hint).** The
  predicate's `stalePeriod` binds via `@Value("${odd.data-entity-stale-period}")`
  with **no annotation default and no validator**
  (`odd-platform java DataEntityStaleDetector config-key-consumer:odd.data-entity-stale-period@L10`;
  `DataEntityStaleDetector.java:10`). The only `7` default is in `application.yml:211`
  (`data-entity-stale-period: 7 # days`). If an overlay drops the line, Spring resolves
  `stalePeriod = null`; the method's `stalePeriod != null` guard
  (`DataEntityStaleDetector.java:15`) then returns `false` for every entity — no throw,
  no startup log. The page's "treat as a required key, doc-side caveat is the only
  signal" framing is **exact**. This is the LSN-001/002-class silent-default footgun.
- **The predicate.** `isDataEntityStale` (`DataEntityStaleDetector.java:13-17`) is
  `lastIngestedAt != null && stalePeriod != null && now().isAfter(lastIngestedAt.plusDays(stalePeriod))`
  — i.e. `last_ingested_at + stalePeriod < now()`, with `last_ingested_at IS NOT NULL`
  as the **first** conjunct. Confirms both "no stale icon ≠ freshly ingested" (never-ingested
  → `is_stale=false`) and "globally-dead signal indistinguishable from healthy".
- **`now()` is per-replica JVM wall-clock.** `DateTimeUtil.generateNow()`
  (`DateTimeUtil.java:11-13`) is `OffsetDateTime.now().atZoneSameInstant(UTC).toLocalDateTime()`
  — timezone is normalised away, but the raw system-clock instant is read per JVM, and the
  predicate is computed per-row in the mapper at render time. The clock-skew flicker caveat
  is **accurate** (skew survives the UTC normalisation).
- **The UI widget renders nothing when fresh.** `MetadataStale.tsx:20-31` is
  `return isStale ? (<AppTooltip ...><StaleIcon/></AppTooltip>) : null;` — confirms
  "renders nothing — no DOM, no whitespace" verbatim. The tooltip text
  (`MetadataStale.tsx:13-18`) is `Ingested at {formatDistanceToNow(lastIngestedAt)}`,
  matching the "relative-time / last-refresh" tooltip claim.
- **`is_stale` is a backend boolean set per-row in the mapper** at four sites
  (`DataEntityMapperImpl.java:163,279,492,547`) and `LineageMapper.java:143` —
  `.isStale(dataEntityStaleDetector.isDataEntityStale(pojo))`. Consistent with F-208's
  "four mapper imprint sites + `is_stale: boolean` on three DTOs".

No doc-claim-vs-code drift. Two precision notes (not drift; both *strengthen* the
page): (a) the predicate is a **per-row Java computation** in the mappers, not a
set-based SQL `WHERE` — which is precisely *why* the clock-skew, null-render, and
"monitor the count outside the UI" caveats hold (the page's SQL-flavoured expressions
are explicitly framed as operator-side monitoring queries, not a description of the
backend). (b) The "trust-on-write / forgeable freshness" caveat is the write-side of
the documented read-collaborative posture — ingestion writes `last_ingested_at` with
no writer-authenticity gate; the nearest grounded concept invariant is
`invariant:external-metadata-overwrite-silent-no-origin-check`, but no
staleness-specific Concept node exists in the graph, so `describes.concepts` is left
empty rather than padded.

## Maintainer notes
