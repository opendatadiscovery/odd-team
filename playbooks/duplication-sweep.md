---
playbook: duplication-sweep
status: active
since: 2026-05-01
applies_to: universal
---

# PROTOCOL duplication-sweep

Bi-directional sweep — existing content the change might collide with, **and** new content (terms, URLs, repos, aliases) the change is about to introduce. Both directions matter; introducing an unregistered alias is just as bad as missing an existing duplicate.

## trigger

Any change that adds a new page, a new term, a new outbound URL, a new repo reference, or new content of any recognisable type to the active pillar's source tree.

## inputs

- proposed new content — every term, config key, URL, repo name, alias, page-title keyword the change is about to introduce
- target repo + target file(s)
- the active pillar's canonical-homes file (e.g., `pillars/documentation/canonical-homes.md`)
- the backlog directory (`backlog/`)

## procedure

1. **Existing-content sweep** (catches: parallel pages, redundant copies, mis-named duplicates).

   - Build the search surface: each canonical term + each known alias matching the topic, each config key / env var the change touches, each proposed page-title keyword.
   - Grep the target repo's content tree for that surface (`docs/` for documentation pillar; future pillars name their own content tree).
   - For every hit outside the change's `affected_files`, classify and decide before authoring:
     - **Link** — existing mention stays, new content links to it (or vice versa).
     - **Expand-in-place** — existing mention is the right home; grow it there instead of creating a new page. Update `affected_files`.
     - **Consolidate** — existing mention is a redundant copy; collapse into a teaser pointing to the canonical page. Update `affected_files`.
     - **New alias entry** — existing mention uses a different name for the same thing; the item must also add a row to the alias table (for documentation: `docs/main-concepts.md` Terms & Aliases).
   - Record each decision in the item's Context: `- {file:line} — {classification} — {brief reason}`.

2. **New-content sweep** (catches: unverified URLs, terminology collisions, unregistered aliases).

   For every term, config key, URL, alias, repo name the change is about to introduce:

   - **Term / alias** — if not already in the alias table, the item must add a row in this PR. Log the intended row now.
   - **Outbound URL** — name the SoT that justifies the link target (repo README / owner's docs). Plan a `playbooks/claim-inventory.md` verification (WebFetch / `gh repo view`).
   - **Repo name** — classify against `navigation/architecture.md` integration patterns (collector / push-client / SDK / platform / spec). If the architecture map doesn't list it, that is a navigation gap — log a discovered finding via `playbooks/follow-up-on-disk.md`.

3. **Backlog-internal sweep** (catches: parallel work items).

   Grep `backlog/{cat}/` for the topic's title keywords, affected files, and `scanner_source`. If an existing item already covers the concept (possibly in richer form), extend its acceptance criteria; do **not** create a parallel item.

4. **Mis-scope check**.

   If the sweep shows the item is mis-scoped (e.g., feature already fully documented elsewhere under a different name), update the work item, drop it from the batch, and **do not** author duplicate content.

## exit

- Every hit in steps 1, 2, 3 has a classification + decision recorded.
- Every new term / alias has an alias-table row planned.
- Every new URL / repo has a Gate 9 verification planned.
- The item's Context block contains the audit trail.

## on-fail

- If the sweep surfaces an unresolvable scope question (e.g., "should this be a new page or merged into an existing one?"), escalate to the user with the surfaced evidence.
- If the sweep takes longer than 5 minutes for a single item, the surface is too broad — narrow the search keywords, do not skip the sweep.

## case-law

- `retrospectives/LSN-003-dbt-wrong-repo-link.md` — new outbound URL authored from memory; the new-content sweep would have grepped `docs/` for `dbt` and found the correct target on `github-organization-overview.md`.
- `retrospectives/LSN-004-s2s-fallback-cache.md` — new term ("M2M") introduced without an alias-table row; the existing alias ("S2S") was the canonical name.
- `retrospectives/LSN-009-backlog-internal-duplication.md` — a proposed DOC-062 was already covered by DOC-042 in richer form; the backlog-internal sweep would have caught it before creation.
