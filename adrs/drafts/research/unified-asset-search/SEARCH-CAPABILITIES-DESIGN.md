# Search capabilities — the comprehensive design (sorting-centric)

The detailed design behind `adrs/drafts/unified-asset-search.md` (rev 3) — the "how" for every search capability,
SRE-grounded and cited. Centre of gravity: **sorting**, per the maintainer's 2026-06-30 steer ("per-column,
per-column-TYPE, full option matrices, consult SRE — maximum effort"). Backing: the `odd-sme` SRE/PO consultation
(`lineage/odd-platform/sme-consultations/2026-06-30-first-class-search-sorting-design.md`), the rev-3 research
(`SAVED-SEARCH-URL-SECURITY.md`), Postgres docs, and the ODD code (status enum, the `Results.styles` column
catalog, the FTS-rank-only current ordering).

## The unifying principle — sorting is a property of a *typed column*

The single idea that makes the whole sort surface coherent **and** resolves the maintainer's sequencing point
("implement sort AFTER the column constructor"): the column constructor's **field catalog** (ADR D7) carries each
field's `data_type`, and a **type → sort-options registry** *derives* the sort menu. Sorting is not a global
`sort` string bolted on — it is what each typed column *affords*.

```
field-catalog entry := { field, kind_applicability, data_type, sortable, default_sort, nullable }
data_type ∈ { status-categorical | datetime | alphanumeric | numeric | list }
```

| `data_type` | Sort options exposed (UX labels) | Default | ODD columns |
|---|---|---|---|
| `status-categorical` | **"Maturity (stable first)"** · **"Needs attention"** *(named orderings, never asc/desc)* | Maturity | Status |
| `datetime` | "Newest first" · "Oldest first" · ▸"Show unknown first" | Newest, **nulls last** | Created, Updated, Last-ingested, Recently-viewed |
| `alphanumeric` | "A→Z" · "Z→A" *(case-insensitive, locale-aware)* | A→Z, nulls last | Name, Namespace, Datasource, Owner, Group, Suite URL |
| `numeric` | "Highest first" · "Lowest first" | Highest, nulls last | Popularity, Rows, Columns, #Entities |
| `list` | *(not sortable, or sort by count — deferred)* | — | Sources, Targets, Entities |

This split lets the two sort deliverables land without contradiction:
- **ST-2 (P0, now):** the **server-side `sort` contract** (`[{field, direction, nulls}]` + named semantic orderings
  `relevance`/`status-priority`) + the **default-order model** + a **global sort dropdown** of the ~5 canonical
  sorts. **Closes #1705.** No per-column UI yet — it rides the ST-1 URL spec + the ST-3 saved spec.
- **ST-7 (P3, with the column constructor):** the **per-column ▾ sort menu** that reads its options from each
  displayed column's `data_type`. *This* is the rich matrix — and it can only exist once columns are
  user-configurable. **That is exactly "sorting ships with/after the column constructor."**

## 1. Sorting — the per-type design

### 1A. Status (semantic categorical) — **named orderings, not asc/desc**
"Ascending status" is meaningless and alphabetical is noise. Two orderings are load-bearing (ship both); the rest
aren't worth UI:

| Named ordering | Encoded order | Audience / when | Verdict |
|---|---|---|---|
| **Maturity (stable first)** = **#1705** | STABLE → DEPRECATED → DRAFT → UNASSIGNED → DELETED | consumer browsing for trustworthy data | **default browse** |
| **Needs attention** | UNASSIGNED → DRAFT → DEPRECATED → STABLE → DELETED | steward catalog-hygiene (un-triaged to the top) | **ship (2nd preset)** |

Note: the ODD enum is *declared* `UNASSIGNED, DRAFT, STABLE, DEPRECATED, DELETED` (`components.yaml:937`) — neither
ordering is the enum order, so both need an explicit priority mapping. **"Needs attention" is *not* the reverse of
#1705** (reverse would lead with DELETED) → it needs its own mapping, not a backward scan (SRE §2).

### 1B. Datetime (nullable — the 4-way matrix)
Cross-kind datetimes are heavily NULL (`last_ingested` null for terms/QE; `last_viewed` null for never-viewed), so
null placement is a real product choice. The matrix, with the right reading of each:

| Combo | Reads as | Right for |
|---|---|---|
| **DESC NULLS LAST** | newest first, unknowns sink | **the default** (consumer "freshest first") |
| DESC NULLS FIRST | newest first, unknowns float up | steward: "what was **never** ingested/viewed?" |
| ASC NULLS FIRST | oldest + never-touched together | steward deprecation hunt |
| ASC NULLS LAST | oldest *known* first | "oldest real data" |

**UX:** expose only **"Newest / Oldest first"** with **nulls-last invariant**, plus a single advanced
**"Show unknown first"** toggle on nullable columns. **Never render the raw 4-way matrix** — it is an
implementation capability, not a control.

### 1C. Alphanumeric
- **Default A→Z, case-INSENSITIVE, locale-aware.** The trap: Postgres `C` collation is ASCII-betical (`"Zebra"` <
  `"apple"`) → looks broken. Use an **ICU case-insensitive collation** or a `lower(name)` functional index — correct
  given ODD's 7-locale i18n.
- `namespace`/`owner` are frequently null → **nulls last**; the steward inversion finds the gaps.
- **Owner is multi-valued** → "sort by owner" is *ambiguous*. **Decision needed:** key on `min(owner_name)` or a
  designated primary owner. (Flagged for a code-read — see §11.)

### 1D. Numeric
- **Default DESC (highest first)** ("most popular/biggest"); **ASC** = the steward "find unused/dead assets" view
  (low popularity → deprecation candidate) — ship it.
- **Cross-kind NULL behaviour (state it):** popularity/rows/columns are **DE-only** → in a mixed-kind result they
  are NULL for Terms/QE, so **sorting a mixed result by a kind-specific column segregates by kind** (DEs first,
  the rest in the nulls-last tail). Correct, but a documented behaviour. Generalises to *any* kind-specific sort key.

### 1E. Multi-column sort — **don't build a builder**
No governance tool documents a user-facing multi-key sort builder. Instead:
1. **Always append the unique `asset id` tiebreaker to *every* sort** — non-negotiable for keyset-pagination
   stability (§2); equal-key rows otherwise duplicate/skip across pages.
2. Support exactly **one fixed composite** governance wants: **status-priority (primary) → {popularity | name |
   updated} (secondary)** — "group by maturity, most-used within." A two-level model, not a builder.

### 1F. Default sort per context — **a deliberate product fork**
- **Active text query → relevance (`ts_rank`) DESC** (universal; DataHub/Secoda).
- **Empty query / browse →** the fork the maintainer should make consciously:
  - **#1705 = trust-first** (status-priority) — governance-specific; no competitor does it.
  - **Market norm = usage-first** (Select Star + Amundsen default to popularity; Secoda offers it).
  - **Recommended hybrid (ship):** `status-priority (primary) → popularity_score DESC (secondary)` —
    "most-trustworthy, most-used within each tier." Honours #1705 *and* the usage-first instinct.

### 1G. The sort-control UX (no clutter)
- **Reject** column-header click-cycle as the *sole* mechanism — it can't express status' named orderings (it would
  alphabetise the enum — wrong) and hides null-handling.
- **Global dropdown** (Secoda's model) — the ~5 canonical sorts, always present:
  *Relevance · Status priority · Recently updated · Most popular · Name (A→Z)*.
- **Per-column ▾ menu** — the type-derived matrix, **on-demand → progressive disclosure → no clutter**; the
  attachment point to the column constructor (ST-7). Null-handling = an advanced per-column toggle (default
  nulls-last), never top-level.
- Both stay in sync and serialise to the URL `sort` param (D10) + the saved spec (D11).

## 2. SRE / performance — sorting + pagination at 100k+ assets

- **NULLS-aligned btree indexes.** Postgres btree default is `ASC NULLS LAST` / `DESC NULLS FIRST`
  ([indexes-ordering](https://www.postgresql.org/docs/current/indexes-ordering.html)). So the product default
  **`updated_at DESC NULLS LAST` is the one combo a plain index does *not* satisfy** → it needs an explicit
  `CREATE INDEX … (updated_at DESC NULLS LAST)`, else the planner adds a sort node. **Elegant payoff:** that one
  index *also* serves the steward inversion (`ASC NULLS FIRST`) by backward scan — choose each column's index
  nulls-direction so its mirror is the *other* useful sort.
- **Status-priority: a denormalised `status_priority smallint` (STABLE=0…DELETED=4), btree-indexed**, maintained
  on the status write-path — the browse query is the most-run query, so make it index-backed (not a `CASE` sort
  node at scale). **"Needs attention" is not its mirror** → its own (rarer) CASE-sort, acceptable.
  - ⚠ **Bug to fix while there (§11):** the status write-path (`DataEntityMapperImpl.applyStatus`) sets status
    *before* the prior-status check, so `status_updated_at` never bumps. Whoever adds `status_priority` edits that
    exact code and must fix the ordering, not inherit it.
- **Keyset/seek pagination, not OFFSET, for stored-column sorts.** OFFSET is O(n) (walks the skipped rows —
  ~17× slower at deep pages, [use-the-index-luke](https://use-the-index-luke.com/no-offset)); keyset is
  `WHERE (sort_key, id) > (?, ?) ORDER BY sort_key, id LIMIT n`, index-backed + stable under concurrent writes.
  Caveats (engineering judgment — the cited keyset source omits ties/nulls): keyset needs the **unique `id`
  tiebreaker** (§1E) and **nullable keys complicate the cursor** (switch comparison form at the null boundary) →
  another reason nulls-last is an invariant and we keyset only the index-backed common sorts.
- **Relevance is the exception:** `ts_rank` is computed per query, not a stored seekable column → the *default
  query sort* can't be cleanly keyset-paginated. **Use OFFSET-with-a-depth-cap for relevance**, keyset for the
  stored-column sorts.
- **Bound everything else.** `sortable: true` is a field-catalog flag; **sortable-at-depth** is a narrower
  index-backed subset (`status_priority`, `updated_at DESC NULLS LAST`, `created_at`, `name` ci, `popularity_score`).
  Arbitrary kind-specific columns get sort-node + OFFSET + a **hard global depth cap** (row ~10k → "refine your
  filters").
- **This is a fresh argument *for* the unified index (D1) over the federated fallback:** federated would have to
  application-merge-sort four streams to honour a cross-kind sort — exactly the deep-pagination pain; the unified
  btree makes cross-kind sort index-backable at all.

### ⚠ Correction to ADR D5 — index a *snapshotted* popularity, not the live `view_count`
`view_count` is a **known write-contention hotspot** (`concepts.yaml:564` — the UPDATE on the hottest read is
write-bound, defeats read replicas). **Denormalising the *live* counter into the search index (current D5)
couples search-index writes to read volume** — every page-view dirties an index row. **Index a snapshotted /
bucketed `popularity_score`** (rank or `width_bucket`), refreshed on a cadence — approximate popularity ordering is
fine for catalog browse and removes the write-amplification. *(Folds into ST-4/ST-7a; D5 is amended below.)*

## 3. Query semantics — close the operator gap (DataHub parity)
DataHub leads on query operators (AND default, `OR`/`|`, `-` NOT, `"phrase"`, `*` wildcard, `field:value`); ODD
today is plain tsvector FTS, AND-only. **Recommendation: adopt Postgres `websearch_to_tsquery`** — it gives
Google-style operators (quoted phrases, `-` negation, `or`) and is **injection-safe by construction** (it never
raises on metacharacters), so it serves operator-parity **and** the IT-003/PLT-090 fail-closed mandate in one move.
*(MEDIUM — verify the operator surface + the IT-003 interaction in implementation; not a fetched citation.)*

## 4. Faceted filtering — depth (the other must-match gap)
Beyond today's 7 AND-only categorical facets:
- **AND/OR within a facet + negation** (DataHub's "match any" + "should not match") — the clearest filtering gap to close.
- **Numeric-range** facet (Popular — D5) with a histogram; the first non-categorical facet type.
- **Datetime-range** (created/updated/recently-viewed) — pairs with the datetime sort.
- **Boolean** (Favorites All/Yes/No — D3).
- **Hierarchical** (Asset-type → DE class — D3).

## 5. Columns, presentation, saved-search, security (recap — detailed elsewhere)
- **Columns:** the field catalog (the `data_type` carrier above) + add/remove/reorder + per-kind degradation +
  client-first persistence (ADR D7).
- **Presentation:** one cross-kind row; "why-it-matched" highlights with per-kind parity staged (D6).
- **Saved search + param-URL:** the spec = `query + filters + sort + columns`; one canonical spec, two surfaces
  (URL + saved row); CRUD + share (ADR D10/D11; `SAVED-SEARCH-URL-SECURITY.md`).
- **Security (first-class):** a shared/saved search re-evaluates under the recipient's permissions; no secrets in
  the URL; the **user-authored sort/query/filter path is injection-safe + fails closed** (`websearch_to_tsquery`
  + escaped facet values — §3, IT-003).

## 6. First-class capability bar (cited; `n/m` = not in the page fetched)
| Capability | DataHub | Atlan | Amundsen | Select Star | Secoda | ODD today | ODD target |
|---|---|---|---|---|---|---|---|
| FTS operators | **leads** (AND/OR/NOT/phrase/wildcard/fielded) | n/m | usage-ranked | n/m | quotes | AND-only | match via `websearch_to_tsquery` (§3) |
| Facet logic | **leads** (AND/OR/negation) | source/owner/tag… | n/m | n/m | type+granular | AND-only categorical | +range/datetime/**OR+negation** (§4) |
| Sorting | relevance | n/m | usage/pagerank | popularity default | **4 named sorts** | none | **per-column-TYPE matrix + status-priority (exceeds)** |
| Saved views | **Views** | save+share views | n/m | n/m | Search views | none | D11 (parity) |
| Shareable URL | partial | partial | n/m | n/m | n/m | mutable session ❌ | **D10 recipient-scoped param-URL (exceeds)** |
| Pagination | n/m | n/m | n/m | n/m | n/m | offset | keyset-at-scale (invisible quality) |

**Collibra: UNVERIFIED** — its three doc URLs 404'd in the consult; no claim made (supply a current URL to fold in).
**Read:** ODD's gaps to *close* for first-class = DataHub-grade **query operators + facet logic**; ODD's room to
*lead* = lifecycle-status sorting, per-column-type sorting, recipient-scoped param-URL.

## 7. Decomposition implications (feeds the refined subtasks)
- **ST-2 (now):** sort **contract** + default-order model (browse=status-priority→popularity hybrid; query=relevance)
  + **global dropdown** of the canonical sorts. **Closes #1705.** *(No per-column UI.)*
- **ST-4 core add — "ST-7a":** the **NULLS-aligned btree sort indexes** + the **denormalised `status_priority`** +
  the **snapshotted `popularity_score`** + **keyset pagination** — the index/contract shape must land *before* the
  UI needs it (and the unified index is what makes cross-kind sort index-backable).
- **ST-5/ST-4 add:** **`websearch_to_tsquery` operators** (§3) + **OR/negation facet logic** (§4) — the must-match gaps.
- **ST-7 (with the constructor):** the **per-column ▾ type-derived sort menu** (status named-orderings; datetime
  newest/oldest + "show unknown first"; text A→Z; numeric high/low), wired to the field catalog.
- The browse-default **fork (§1F)** is a maintainer decision to confirm at ST-2's GATE 1.

## 8. Code issues discovered (log as follow-ups — §11)
1. **`status_updated_at` never bumps** — `DataEntityMapperImpl.applyStatus` sets status before the prior-status
   check (`concepts.yaml:123-127`). Fix when adding `status_priority` (ST-7a). → backlog item.
2. **Sort-key code-reads needed:** `view_count` NULL-vs-0 semantics + the **multi-owner** sort key
   (`min(owner_name)` vs primary) — a focused file-analyser pass before ST-7. → backlog item.

## Sources
- `odd-sme` consult — `lineage/odd-platform/sme-consultations/2026-06-30-first-class-search-sorting-design.md` (DataHub/Atlan/Amundsen/Select Star/Secoda + Postgres + keyset, all cited there; Collibra 404).
- Postgres: <https://www.postgresql.org/docs/current/indexes-ordering.html> · <https://www.postgresql.org/docs/current/queries-order.html> · keyset: <https://use-the-index-luke.com/no-offset>
- ODD code: `odd-platform-specification/components.yaml:937` (status enum) · `odd-platform-ui/.../Search/Results/Results.styles.ts` (column catalog) · `ReactiveDataEntityRepositoryImpl` (`RANK_FIELD_ALIAS.desc()` — FTS-rank-only today) · `lineage/odd-platform/concepts.yaml:123-127,564`.
- Internal: `adrs/drafts/unified-asset-search.md` (rev 3) · `SAVED-SEARCH-URL-SECURITY.md` · `prds/0003-unified-asset-search.md`.
