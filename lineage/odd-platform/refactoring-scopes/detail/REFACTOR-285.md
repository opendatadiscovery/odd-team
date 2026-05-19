## REFACTOR-285 — URL length grows with `?exd[]=` / `?exu[]=` array size on the Lineage canvas; Chrome's effective ~2K URL limit caps deep-linking at ~200 expanded leaves; no UI warning when approaching the cap

**Severity**: LOW
**Category**: no-upper-bound + ux-bug
**Pillars affected**: [P-05] — Data Lineage
**Surfaced by**:
- `LineageGraph.md:scaling_characteristics` (|-
    "URL-state-as-source-of-truth (constants.ts:74-84) means deep-linking is supported but URL length grows with `?exd[]=` array size. Chrome's URL limit is ~2K chars effective; a user expanding 200+ leaves hits the cap.")

**Description**: The Lineage canvas uses URL query params as the source of truth for view state (ADR-CANDIDATE-091). The expansion-id arrays `?exd[]=1,2,3,...` and `?exu[]=1,2,3,...` (downstream and upstream expanded node ids) grow as the user clicks LoadMore on each leaf. The serialisation uses `arrayFormat: 'bracket-separator'` + `arrayFormatSeparator: ','` (per `useQueryParams.ts:28-29`), so `exd=[1,2,3,4,5]` becomes `?exd[]=1,2,3,4,5` — relatively compact, but each id is 1-5 chars + 1 separator.

For ids up to ~1M (10 chars each), the URL hits Chrome's effective ~2K-char limit around 180-200 expanded leaves. Real-world usage:
- 5-10 leaves: easy.
- 50 leaves: comfortable.
- 200 leaves: at the edge.
- 300+ leaves: URL is truncated by Chrome (or rejected by some proxies / web servers).

There is NO UI warning, NO clamp on the array size, NO "URL is getting long, consider resetting view" prompt. A user incrementally expanding a hub-and-spoke lineage subgraph silently hits the cap and:
- Some routers strip the array when re-parsing.
- Some browsers refuse navigation.
- Cross-tab share-via-URL stops working.

**Primary source citations**:
- `useQueryParams.ts:28-36` — the array serialisation config
- `LineageGraph.md` documents the scaling cap

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-091 codifies URL-as-source-of-truth. The URL-length ceiling is a known caveat of the choice; the absence of a clamp is the gap.

**Proposed remedy**: Two options:
1. **Clamp + warn** — set a max array size (e.g. 100) at the URL serialisation layer; when exceeded, show a UI toast "Deep-linking unavailable for this view — too many expansions. Reset view to share."
2. **Switch to Redux UI slice for expansion state** — move `exd` / `exu` arrays out of the URL and into Redux state. Trade-off: lose deep-linking for that aspect; preserve it for `d`, `fn`, `full`, `eag`, `t`.

Option (1) preserves the ADR's URL-as-source-of-truth commitment; option (2) is a partial retreat. The lighter-weight option (1) is the recommended remedy.

**Severity rationale**: LOW — discoverability issue for power users; affects a small percentage of users (those expanding >100 leaves in one session). Fix is straightforward UI clamp + toast.

**Suggested backlog grouping**: `Lineage subsystem UX hardening sprint`.

---
