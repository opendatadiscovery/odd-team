---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-08-30T00:00:00Z
consulted_by: maintainer-direct (/contribute CTRIB-060, spec gate G-C17 for odd-platform #1840 / ADR D13)
consultation_question: Are Google-style query operators (quoted phrase / negation / or) a first-class expectation in data-catalog search, and is "operator-free = prefix, any operator = exact" the right product rule for ODD?
slug: search-query-operators
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# Query operators in catalog search — is the operator/prefix mode switch the right product rule?

## TL;DR

Documented query operators are **not universal table stakes** — the market has bifurcated: DataHub documents a full operator grammar, Secoda documents quotes-for-precision, **Atlan documents none** and leans on conversational + structured filters. But ODD competes in DataHub's tier, so operators are a legitimate parity play. **The proposed rule — any operator flips the whole query to exact — is not what the cited precedent does.** DataHub's quoting is explicitly **per-term** ("enforce exact matching on **these terms**"), and its prefix matching is an **explicit** `*` the user types, not a mode the system silently revokes. And ODD's *published, live* search page promises prefix matching in so many words. A per-query switch means `cust` finds "Customers Orders" but `cust -test` finds **nothing** — refinement destroys the result set, which is the one search behaviour operators cannot forgive.

## Question scope

Archetypes: **comparative** (Q1), **plausibility + implicit-requirements** (Q2, Q5), **workflow/UX** (Q3), **ODD-intent** (Q4).

In scope: competitor norms for query syntax; the prefix-vs-operator trade-off as a product rule; discoverability; ODD's stated search promise; negation-only behaviour.
Out of scope: the HOW (whether prefix can be re-attached to a `websearch_to_tsquery` output — see Caveats), the facet-logic half of D13, ranking/`ts_rank` changes.

Established inputs I did not re-derive (maintainer-measured on `postgres:13.2-alpine`): today every term is `token:*` AND-joined via the shared `JooqFTSHelper.tsQuery()` across ten repositories; `websearch_to_tsquery` does no prefix matching (`cust` → miss); quotes and `-` are silently ignored today; negation-only is a Seq Scan.

## Competitor comparison

| System | Documented query syntax | Notable behaviour | Status |
|---|---|---|---|
| **DataHub** | Full grammar: `"phrase"`, `-` NOT, `\|` OR, `+` AND, parentheses, `/q field: value`, `*` wildcard | *"The default boolean logic used to interpret text in a query string is `AND`."* · *"Enclosing one or more terms with double quotes will enforce exact matching on these terms, preventing further tokenization."* · Prefix/partial is an **explicit** wildcard the user types: *"Find a dataset with the word mask in the name: `/q name: *mask*`"* · Advanced syntax is behind a typed `/q` mode prefix | `https://docs.datahub.com/docs/how/search` — **200** |
| **Secoda** | Quotes only, framed as *ranking*, not filtering | *"Highest priority is given to resources with titles that exactly match the search term."* For precision, quote the term. Prefix and phrase are **ranking tiers** ("title prefix matches, phrase matches… wildcard matches"), not modes — nothing is excluded, things are re-ordered | `https://docs.secoda.co/features/search` — **200** |
| **Atlan** | **None** | The fetched page *"does not document any search query operators or syntax"* — discovery is conversational search + MCP + structured filtering | `https://docs.atlan.com/product/capabilities/discovery` — **200** |
| **Collibra** | UNVERIFIED | `productresources.collibra.com/.../co_search.htm` returned a 404 page verbatim: *"It looks like nothing was found at this location."* Second consecutive consult where Collibra's search docs 404 (prior: `sme-consultations/2026-06-30-first-class-search-sorting-design.md:66`). **No claim made.** | **404** |
| **Amundsen / Select Star** | Not re-fetched this session | Workspace-recorded prior verification only (`2026-06-30-first-class-search-sorting-design.md:63-64`): Amundsen usage/pagerank-ranked, user sort not mentioned; Select Star popularity-ordered default. Neither recorded as documenting operators. **MEDIUM confidence — secondary.** | prior-consult |

**Verdict on Q1:** documented operator syntax is **a DataHub-tier differentiator, not a category floor**. Two of the three tools I verified first-hand this session document essentially no operator grammar. What *is* table stakes across all of them is that the search box finds the right asset from a partial, half-remembered name — which is exactly what ODD's prefix matching does today.

## Domain plausibility — Q2, the core product question

**Verdict: HIGH-PLAUSIBILITY for shipping operators; LOW-PLAUSIBILITY for the per-query mode switch as specified.**

1. **The cited precedent is per-term, not per-query.** DataHub's own wording scopes strictness to the quoted tokens — *"enforce exact matching on **these terms**"* — leaving the rest of the query alone. Secoda's model is even softer: strictness is a *ranking* tier, never an exclusion. Neither product revokes matching behaviour for tokens the user did not mark.
2. **Nobody makes prefix implicit-and-revocable.** In DataHub the user *types* `*`; the system never takes wildcarding away as a side effect of an unrelated operator. ODD's prefix is implicit — which is friendlier — but that makes silent revocation strictly more surprising, because the user never asked for it and gets no signal that it happened.
3. **The failure is in the refinement gesture, and refinement is the whole point of operators.** Operators are typed *second*, on a query that already returned too much. Under the proposed rule, a user who found "Customers Orders table" by typing `cust`, then narrows to `cust -test`, gets **zero rows**. Adding a filter made results disappear. That reads as "the search is broken", not "my query is now stricter" — and it is unrecoverable without the user guessing the mechanism.

**Recommended rule instead — operators narrow, never replace:**
> Quoted terms match exactly (that is what quoting means, and it is the only capability facets cannot express). Negated terms exclude. **Bare, unmarked terms keep today's prefix semantics in every query, operator-bearing or not.**

If per-term prefix is not reachable in ST-6's slice, the per-query switch is acceptable only with both of: (a) a visible in-UI signal that the match mode changed, and (b) a **one-click zero-results recovery** ("no exact matches — search without operators?"). ODD already has this exact pattern published for the other degenerate search state: an expired session shows a notice *"with a one-click **Start new search** recovery"* (`documentation/docs/data-discovery/search.md:84`, live 200). Reuse it; do not invent a second recovery idiom.

**Scoping lever for the maintainer:** the three operators are not equally valuable. **Quoted phrase is the high-value one** — it is the only one facets cannot replace. `-negation` is the low-value, high-risk one: it both breaks prefix *and* duplicates the facet negation D13's second bullet is already shipping (`adrs/drafts/unified-asset-search.md:100`). In a catalog, "exclude the test copies" is more naturally a namespace/tag/status facet than a query token. If the mode-switch cost cannot be eliminated, spend it on quotes.

## Implicit requirements

**Functional**
- **Autocomplete must stay prefix, unconditionally.** `getQuerySuggestions` is one of the ten consumers of the shared helper; type-ahead that requires a whole word is not type-ahead. ODD publishes an as-you-type promise: *"As you type your search and adjust filters, ODD dynamically responds, delivering results in seconds"* (`search.md:53`, live 200). *(Citation for the promise; the autocomplete inference is domain judgment — HIGH.)*
- **One shared sink, ten consumers, not one product decision.** Term search, query-example search, lookup-table search, autocomplete and `ts_headline` highlighting have different tolerance for exactness than the Catalog box. A blanket swap at `JooqFTSHelper` changes five products at once. *(Maintainer-supplied consumer list — HIGH.)*
- **Highlighting must agree with matching.** `ts_headline` renders the "why you see it" answer ODD's docs advertise (`search.md:51-57`, live 200). If the query became exact but the highlighter still prefix-highlights (or vice versa), the explain affordance starts lying. *(HIGH.)*

**Security** — `websearch_to_tsquery`'s never-raises property is the *reason* D13 picked it (`adrs/drafts/unified-asset-search.md:99`) and it closes the IT-003/PLT-090 fail-closed mandate. Note the published caveat records the pre-0.28.0 behaviour where a metacharacter query *"failed with HTTP 500 and persisted a broken `/search/{uuid}` session"* (`search.md:93`) — the injection-safety win is real and already has scar tissue. *(HIGH.)*

**Performance / Reliability** — a negation-only query is unindexable (maintainer-measured Seq Scan); it must be rejected at parse time, before it reaches the planner, not merely tolerated. Any exactness change also needs a stated answer for what a *saved* search (D11) does when its stored query string changes meaning across the upgrade. *(Saved-search interaction: no citation — domain judgment, MEDIUM.)*

## Operator workflows this feature participates in

- **Discover a dataset for a new analysis** (analyst, new project). The user types a fragment of a half-remembered name. **Prefix is the load-bearing behaviour**; this is the single most common catalog search and the one the proposed rule can break.
- **Refine an over-broad result set** *(new workflow; the one operators actually serve)*. Role: analyst or steward. Trigger: a query returns dozens of near-duplicates — `orders`, `orders_test`, `orders_bkp`, `orders_v2_staging`. Expected outcome: isolate the production asset. This is where `"exact phrase"` and `-test` earn their keep — and where a silent prefix revocation turns refinement into a dead end.
- **Diagnose a stale dashboard / find an owner.** Entered by pasting a known full name; largely indifferent to the operator decision.

## ODD's own stated promise — Q4

ODD **does** publish a query-syntax promise today, and ST-6 contradicts it twice. From `https://docs.opendatadiscovery.org/features/data-discovery/search` (**200**, verbatim):

> "PostgreSQL full-text search parses the query as a `tsquery`, so characters such as `( ) : & | ! '` are not searchable literals — the search box strips them and matches the remaining words **as prefixes**."

> "Type what you are looking for, and ODD finds entities matching across names, descriptions, and metadata."

So: (1) the *stripping* half is contradicted the moment operators become meaningful — the page must change on the same release train; (2) the *prefix* half is a published promise that a per-query switch silently revokes for operator-bearing queries. Fulfilment vs contradiction depends entirely on which rule you pick: **per-term operators fulfil the mission** (system-mission P-01: *"Find existing data entities in the catalog — by typing a term"*, `lineage/odd-platform/system-mission.md:79`); **per-query exactness contradicts a live published promise** and needs a public amendment, not just a new sentence.

**Separate doc-accuracy finding, independent of ST-6's outcome:** the published caveat enumerates `( ) : & | ! '` but does not mention `"` or `-`, which the maintainer measured as *also* silently ignored — with `-test` today doing the **opposite** of the user's intent. The page under-describes current behaviour. Worth a DOC-NNN via `playbooks/follow-up-on-disk.md` whether or not #1840 ships.

## Negation-only queries — Q5

Returning nothing for a query with no positive term is **the right and expectable behaviour**, and ODD has already published the precedent for its own product: *"a query made up of only these characters returns **No matches found**."* (`search.md:93`, live 200). A user typing only exclusions has stated what they do not want and nothing they do want; "everything in the catalog except X" is a *browse-with-a-filter* intent, and ODD's answer for it is the facet sidebar, not the search box.

Two requirements attach: return the empty state **fast** (reject at parse, never Seq Scan the catalog), and make the empty state *explain itself* — "Add at least one term to search for" beats a bare "No matches found". I have **no citation** that Google or other search products refuse bare-negation queries; that claim was in the question and I could not verify it within budget, so I am not resting the verdict on it. *(Verdict rests on ODD's own published precedent + the measured Seq Scan — HIGH.)*

## Discoverability — Q3

Cited competitor behaviour: DataHub puts advanced syntax behind an explicit typed `/q` mode and sends users to docs for the field list (*"The sample queries here are non exhaustive"*); Secoda documents quotes in its search docs and offers a `/` quick-access hotkey; Atlan documents nothing because it has nothing.

For ODD, **reuse before invention** (workspace memory: *search existing UI pattern before building*):
1. **Docs are necessary but never sufficient** — nobody reads docs mid-search.
2. **`InformationIcon` + `AppTooltip` on the search bar** — the pattern already in the codebase — listing three operators with one example each. This is the right primary affordance.
3. **The result-row "question icon" already exists**: ODD publishes that each result carries an information icon and a question icon showing *"why you see it in your search results"* (`search.md:51-57`, live 200). That explain surface is the natural home for "matched exactly because you quoted it".
4. Placeholder text alone is the weakest option — it disappears on first keystroke, which is exactly when the user needs it.

**Discoverability need is a function of the rule you pick.** Per-term operators are safely discoverable by experimentation — a wrong guess still returns sensible results. A per-query mode switch makes discoverability *load-bearing*: the user must understand the mechanism to explain why their results vanished, and a tooltip is a thin thing to hang that on.

## Recommended framing for the caller

> Ship quoted-phrase and negation as **per-term** modifiers — quoted terms match exactly, negated terms exclude, and every bare term keeps today's prefix matching — because ODD's live documentation promises prefix search, DataHub's own precedent scopes exactness to the quoted terms only, and a per-query switch turns the refinement gesture (`cust` → `cust -test`) into an unexplained zero-result page. If per-term is out of reach in this slice, ship quotes first, gate the switch behind a visible mode signal plus the one-click "search without operators" recovery ODD already publishes for expired sessions, and amend the search doc's prefix promise on the same release train.

## Caveats and uncertainty

- **The per-term recommendation is a product position, not an implementation claim.** Whether prefix can be re-attached to what `websearch_to_tsquery` produces is unverified by me and belongs to the HOW phase. If it is genuinely impossible, that is a real constraint — but it should be *established*, not assumed, before the per-query switch is accepted, because the product cost is high.
- **Collibra unverified** for the second consecutive consult (404 recorded verbatim). Amundsen and Select Star are cited from a prior workspace consult, not re-fetched — MEDIUM.
- **"Google refuses negation-only queries"** — no citation found within budget; not relied on.
- Adjacent question worth its own consult: whether query-string negation is worth shipping *at all* once D13's facet negation lands, and how a saved search (D11) survives a change in query-string semantics across an upgrade.

## Citations

| Source | Status | Fetched |
|---|---|---|
| `https://docs.opendatadiscovery.org/features/data-discovery/search` — "matches the remaining words as prefixes"; "Type what you are looking for…"; "a query made up of only these characters returns No matches found"; "As you type… ODD dynamically responds"; "one-click Start new search recovery"; information/question icons | **200** | 2026-08-30 |
| `https://docs.opendatadiscovery.org/features/data-discovery/search-and-filtering` (first guess at the slug) | **404** | 2026-08-30 |
| `https://docs.datahub.com/docs/how/search` — default `AND`; "enforce exact matching on these terms, preventing further tokenization"; `-` negation (`logging -snowflake`); `\|`/`+`/parentheses; `/q name: *mask*`; "sample queries here are non exhaustive" | **200** | 2026-08-30 |
| `https://docs.datahub.com/docs/features/feature-guides/search` | **404** | 2026-08-30 |
| `https://docs.secoda.co/features/search` — exact-title-match highest priority; quotations for precision; prefix/phrase/wildcard as ranking tiers; `/` hotkey | **200** | 2026-08-30 |
| `https://docs.atlan.com/product/capabilities/discovery` — no documented query operators; conversational + MCP + structured filtering | **200** | 2026-08-30 |
| `https://productresources.collibra.com/docs/collibra/latest/Content/Search/co_search.htm` — "It looks like nothing was found at this location." | **404** | 2026-08-30 |
| `documentation/docs/data-discovery/search.md:7,53,51-57,84,93` (local canonical source of the live page) | read | 2026-08-30 |
| `adrs/drafts/unified-asset-search.md:97-100` (D13) | read | 2026-08-30 |
| `adrs/drafts/research/unified-asset-search/SEARCH-CAPABILITIES-DESIGN.md:146-151,171-183,191` (§3, §6 capability bar) | read | 2026-08-30 |
| `lineage/odd-platform/sme-consultations/2026-06-30-first-class-search-sorting-design.md:52,60-68` (prior verification record for Amundsen / Select Star / Collibra) | read | 2026-08-30 |
| `lineage/odd-platform/system-mission.md:79` (P-01 Data Discovery capability line) | read | 2026-08-30 |
