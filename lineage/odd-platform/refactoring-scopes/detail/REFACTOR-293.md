## REFACTOR-293 — Generic empty-state placeholder under every Recommended column ("No information to display") gives operators no hint as to WHY the list is empty (zero traffic vs no entities ingested vs view_count column never written-to)

**Severity**: LOW
**Category**: missing-doc + ux-bug
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:bugs_limitations_corner_cases[6]` (|-
    "**The Empty-state placeholder under a Popular column says generic 'No information to display' — operators get no hint as to WHY there are no popular entities (zero traffic, no entities ingested, view_count column never written-to, etc.).** EmptyContentPlaceholder.tsx:46 defaults `text` to `t('No information to display')` — DataEntityList.tsx:65-67 invokes it with no custom text. A fresh ODD deployment with entities ingested but zero user traffic shows 'No information to display' under Popular, which suggests broken data rather than 'view_count is still all zero, the ranking degenerates to id DESC, but the tiebreaker is still showing newest entities — why is the list empty?'.")

**Description**: When a Recommended column has no data, the cluster renders `<EmptyContentPlaceholder fullPage={false}/>` (`DataEntityList.tsx:65-67`). `EmptyContentPlaceholder.tsx:46` defaults the displayed text to `t('No information to display')`. DataEntityList does NOT override this default for any of the four columns.

For each column, the actual reason for emptiness varies:
- **Popular empty** — likely "view_count is still all zero" (fresh deployment, no traffic). The ranking degenerates to id DESC but the tiebreaker showing newest entities is itself the result; for a truly fresh DB with zero entities, the list is empty. Operators on day-1 deployments see "No information to display" under Popular and worry data is broken.
- **My Objects empty** — the user has no owner-associated entities. The remedy is "associate yourself with an Owner via the management panel." The generic message gives no hint.
- **Upstream / Downstream empty** — the user's owned entities have no upstream/downstream lineage. The remedy is "ingest lineage edges or check your collector." The generic message gives no hint.

A column-specific empty-state copy would surface the remedy. Today, every column says the same opaque thing.

**Primary source citations**:
- `DataEntityList.tsx:65-67` — no text override
- `EmptyContentPlaceholder.tsx:46` — the default text
- `PopularStrip.md` documents the gap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-095 codifies the uniform-treatment pattern. Per-column empty-state messaging breaks the uniform-treatment but improves UX; the ADR's framing accepts this as a trade-off the operator-tuning would need to address.

**Proposed remedy**: Add per-column `emptyText` prop to `DataEntityList`:
- Popular → "No popular entities yet. Visit some catalogue pages to start seeing them here."
- My Objects → "You are not associated with any Owner. Visit Management → Associations to start."
- Upstream → "Your owned entities have no upstream lineage yet. Check your collector configuration."
- Downstream → "Your owned entities have no downstream lineage yet."

Each text is i18n-keyed. The change is non-invasive (additive prop).

**Severity rationale**: LOW — UX polish; operator-friendliness improvement; trivially fixable.

**Suggested backlog grouping**: `UI UX polish sprint`.

---
