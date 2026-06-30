# Research — Saved Search · Parametrised-URL state · Security (unified-asset-search ADR rev-3 delta)

Backs the rev-3 additions (D10 parametrised-URL state, D11 saved searches, the Security-first-class section,
#1705 default sort) to `adrs/drafts/unified-asset-search.md`. **Maintainer steer 2026-06-30:** Search must be a
*first-class* search "from performance, capabilities, security points of view among data governance tools and in
the future"; **Saved Search filters** must be saveable/named/editable/deletable per user and **shareable as a
link that is a parametrised URL, NOT a mutable session**; take perf/security/UI/UX into account. The ADR rev-2
core (unified index, polymorphic Asset, perf+UX first-class) is settled — this researches only the **delta**.

## TL;DR — recommendations (confidence)

1. **Encode the whole search state (query + filters + sort + page) in the URL as query params** — the Algolia
   `stateToRoute` / `routeToState` two-way pattern. A search becomes a **stateless, shareable, bookmarkable**
   link; the mutable `search_facets` **session is no longer the shared artifact**. **[HIGH]**
2. **A saved search = a named, per-user `saved_search` row holding that same param spec** (filter + sort), reusing
   the merged Favorites `Asset`/identity foundation; CRUD + select/edit/delete; **share = the URL**. Mirrors
   **DataHub Views**. **[HIGH]**
3. **Security-first-class: a shared/saved search is a QUERY SPEC, never a results snapshot.** Results are
   re-evaluated under the **requester's** identity/permissions on every run (query-time RBAC) — so a param-URL is
   *more* secure to share than a session. **[HIGH]**
4. **The URL/spec carries only non-sensitive catalog-metadata filter values + sort** — never identity, tokens, or
   result rows (URLs leak via history / server logs / `Referer`). **[HIGH]**
5. **#1705's status-priority order = the default option of the same sort model** (server-side). **[HIGH]**

---

## Thread 1 — Parametrised-URL search state (replaces the mutable session for sharing)

**Prior art — Algolia InstantSearch `routing`** ([React routing guide](https://www.algolia.com/doc/guides/building-search-ui/going-further/routing-urls/react)):
a two-way conversion — `stateToRoute` (uiState → URL params) / `routeToState` (URL → uiState) — syncs **query,
filter/facet selections, page, and sort** (only *modified* values, not defaults). The documented benefits, verbatim:
*"It lets your users take one of your results pages, copy the URL, and share it. It also improves the user
experience by enabling the use of the back and next browser buttons."* Best practice: **decide what goes in the
URL and rename params** for clarity (avoid noise), and **debounce URL writes (~400 ms)** so the search doesn't spam
browser history. Kibana/Elastic and most modern search UIs use the same URL-as-state model.

**ODD today (the thing this moves):** `POST /api/search` creates a **mutable, server-side, TTL-evicted**
`search_facets` session and the FE navigates to `/search/{searchId}`; `updateSearchFacets` mutates it. Sharing
`/search/{id}` therefore shares a **session that mutates and expires** — the `IT-125` / `#1760` "search session
expired" dead-link class is a *direct* symptom of using a session id as a shareable handle.

**Recommendation [HIGH]:** the FE owns the search state and **serialises it to URL query params** (the canonical
"what to search"); on load it parses the params and runs the search. Keep the server session **only** as an
internal FTS-execution detail **derivable from the params** — never the shared/saved handle. This:
- makes every search **bookmarkable + shareable + back/forward-correct** (Algolia's exact win),
- **eliminates the expired-session dead-link class** (a param URL never expires), and
- gives saved searches a trivial storage shape (persist the params).

**Rejected (status quo):** keep sharing `/search/{sessionId}` — it expires, mutates, can leak the sharer's
resolved state, and loses bookmark/back-forward. Documented failure surface: `IT-125`. **[rejected]**

## Thread 2 — Saved searches (named, persisted, per-user)

**Prior art — DataHub Views** ([DataHubView entity](https://docs.datahub.com/docs/generated/metamodel/entities/datahubview),
[Search overview](https://docs.datahub.com/docs/how/search)): *"DataHub Views let you save a set of filters and
reuse them across DataHub"* — a **first-class metamodel entity**. Atlan/Collibra frame **Collaboration / "shared
queries"** and **Security** as core catalog capabilities ([StackFYI 2026 comparison](https://www.stackfyi.com/guides/data-catalog-tools-atlan-collibra-datahub-openmetadata-2026),
[Atlan buyer's guide](https://atlan.com/data-catalog-tools/)). So saved + reusable searches are **table-stakes**
for a first-class catalog; ODD has **none** today.

**Recommendation [HIGH]:** a `saved_search(id, name, owner_identity, spec jsonb, is_default?, created_at,
updated_at)` row, reusing `CurrentUserIdentityResolver` (per-user; shared sentinel under `auth.type=DISABLED`,
exactly like the `favorite` table). The `spec` is **the same canonical param schema the URL encodes** (query,
`asset_kinds`, `entity_class_ids`, the categorical facets, `favorites`, `my_data` + depths, `popular` range,
`sort`) → **one spec, two surfaces (URL + saved row)**. Endpoints: list / create-from-current / get / update
(edit name + spec) / delete. FE: a "Saved searches" menu (select/edit/delete) + "Save current search" + a
**copy-share-link** affordance that emits the param URL.

## Thread 3 — Security (first-class — the maintainer's explicit bar)

**The cross-platform rule** — Azure AI Search **query-time ACL/RBAC** (*"users only retrieve results they're
authorized to access"*, [query-time RBAC](https://learn.microsoft.com/en-us/azure/search/search-query-access-control-rbac-enforcement)),
NetSuite (a shared search returns **zero rows** if the runner lacks view access,
[permissions for searches](https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N664557.html)),
RelativityOne (**permission-denied** on an unauthorized shared-search link,
[saved search](https://help.relativity.com/RelativityOne/Content/Relativity/Saved_search/Saved_search.htm)),
Splunk (regular users **can't even share**, [saved-search permissions](https://community.splunk.com/t5/Security/User-Role-Saved-Search-Permissions/m-p/39774)):
**a shared/saved search is a QUERY SPEC run AS the recipient — results are filtered by the *recipient's*
permissions, never the sharer's.**

**ODD fit [HIGH]:** ADR D2 resolves results by a **live semi-join that inherits each kind's visibility
predicate**. So a **param-URL shared search re-runs under the recipient's identity** → it can *never* surface a
row the recipient isn't authorized to see. **This is the security argument FOR param-URL over session-sharing**
(a session could carry the sharer's already-resolved page; a param-URL re-evaluates every time). Make this the
headline security property.

**URL/spec hygiene [HIGH]:** the spec carries only **non-sensitive catalog metadata** (filter values like
namespace/tag/owner *names or ids*, sort keys) — **never** identity, auth tokens, or result rows. URLs persist in
browser history, server access logs, and `Referer` headers, so the "no secrets in the URL" rule is a hard
constraint, satisfied by encoding only the query spec.

**Injection [MEDIUM — call out]:** filter/query values reach the FTS `to_tsquery` and SQL. The **tsquery-poisoning
class is already known** (`IT-003` / `PLT-090`: an unescaped metachar persisted into the session row 500s every
later read). The unified index + the param path **must** reuse the parameterised/escaped query path — and because
the param-URL is *user-authored and shareable*, a crafted shared link is an attack vector → escape on read, and
fail closed (a malformed spec → empty, never a 500). 

**Ownership / sharing model [HIGH + one deferral]:** a saved search is **private to its owner** by default;
"sharing" is **link-based** (bearer-of-link runs the query, sees their own authorized results — no server-side
grant needed). A future **team/org-published saved search** (RBAC on the `saved_search` entity, an audience like
NetSuite's) is a **separate later capability** — out of scope for the first slice. Under `auth.type=DISABLED`
saved searches are instance-shared (label it), exactly as Favorites degrade.

## Thread 4 — Competitor first-class benchmark (grounds "first-class among governance tools")

| Capability | DataHub | Atlan / Collibra | ODD today | ODD plan (this epic) |
|---|---|---|---|---|
| Cross-kind full-text + filter sidebar | ✅ (filters + advanced query) | ✅ | DE-only `/search`; per-kind silos | ✅ unified index (ADR D1) |
| Saved searches / Views | ✅ **Views** (first-class entity) | ✅ shared queries (Collaboration) | ❌ | ✅ **D11 saved searches** |
| Shareable search URL | partial | partial | ❌ (mutable, expiring session) | ✅ **D10 stateless param-URL** *(differentiator)* |
| Result-scoped security on share | ✅ query-time RBAC | ✅ | n/a | ✅ recipient-scoped re-eval (D2 + Security) |
| Numeric-range / popularity facet | filters | filters | ❌ | ✅ D5 Popular range + histogram |
| Configurable result columns | ✅ | ✅ | partial (`AddColNames`) | ✅ D7 column constructor |

Sources: [DataHub Views](https://docs.datahub.com/docs/generated/metamodel/entities/datahubview),
[DataHub search](https://docs.datahub.com/docs/how/search),
[DataHub advanced filters](https://support.datahub.com/hc/en-us/articles/41912177211035-Advanced-Search-Queries-and-Filters),
[StackFYI 2026](https://www.stackfyi.com/guides/data-catalog-tools-atlan-collibra-datahub-openmetadata-2026),
[Atlan guide](https://atlan.com/data-catalog-tools/). **Read:** ODD reaches the governance-tool bar with the
unified index + saved searches + configurable columns, and **exceeds** the common bar on *share* by making the
shared artifact a **stateless, recipient-permission-scoped URL** rather than a server session. **[HIGH for direction]**

## Confidence summary

| Decision | Recommendation | Confidence |
|---|---|---|
| Search state in URL params (not session) | Adopt (Algolia pattern) | **HIGH** |
| Saved search = per-user row of the param spec | Adopt (DataHub Views shape) | **HIGH** |
| Share link re-evaluates under recipient perms | Adopt (query-time RBAC) | **HIGH** |
| No secrets in URL / spec | Hard constraint | **HIGH** |
| tsquery escaping on the shareable path | Reuse the known guard (IT-003) | **MEDIUM (must verify in impl)** |
| Team/published saved searches | Defer (separate RBAC slice) | n/a (scoped out) |
| #1705 status-priority = default sort option | Adopt into the sort model | **HIGH** |

## Sources
- Algolia InstantSearch routing — <https://www.algolia.com/doc/guides/building-search-ui/going-further/routing-urls/react>
- DataHub Views — <https://docs.datahub.com/docs/generated/metamodel/entities/datahubview> · Search — <https://docs.datahub.com/docs/how/search> · Advanced filters — <https://support.datahub.com/hc/en-us/articles/41912177211035-Advanced-Search-Queries-and-Filters>
- Azure AI Search query-time RBAC — <https://learn.microsoft.com/en-us/azure/search/search-query-access-control-rbac-enforcement>
- NetSuite search permissions — <https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N664557.html>
- RelativityOne saved search — <https://help.relativity.com/RelativityOne/Content/Relativity/Saved_search/Saved_search.htm>
- Splunk saved-search permissions — <https://community.splunk.com/t5/Security/User-Role-Saved-Search-Permissions/m-p/39774>
- Catalog comparisons — <https://www.stackfyi.com/guides/data-catalog-tools-atlan-collibra-datahub-openmetadata-2026> · <https://atlan.com/data-catalog-tools/>
- ODD internal: `adrs/drafts/unified-asset-search.md` (rev 2), `prds/0003-unified-asset-search.md`, `integration-tests/protocols/IT-125-search-session-not-found.md`, `integration-tests/protocols/IT-003-search-tsquery-poisoning.md`.
