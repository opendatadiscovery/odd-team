---
id: IT-132
title: "Search-as-you-type suggestions: the main-search autocomplete dropdown surfaces matching entities (UI e2e)"
gates:
  validates: [F-017]
  enforces: []
  regresses: []
test_class: e2e
stack: odd-minimal
automation: "e2e:specs/search-suggestions-autocomplete.spec.ts"
plan_ref: "Search-coverage build-out (2026-06-16) — the autocomplete dropdown was the one search affordance with no e2e (catalog-search IT-022 drives Enter->results, not the type-ahead)."
status: ready
---

# IT-132 — Search suggestions / autocomplete (F-017)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The home page's **main search box** is a search-as-you-type field: typing (without pressing Enter) fires a
debounced `GET /api/search/suggestions?query=...` and renders the matches in a dropdown the operator can
click to jump straight to an entity. This IT drives that real UI→backend flow: type a seeded entity's name
into the box and assert (a) the suggestions endpoint returns the match, and (b) the match renders in the
dropdown while a non-matching entity does not. It complements IT-022 (which drives the Enter→`/results`
catalog search) — the autocomplete dropdown is a distinct affordance (`SearchSuggestionsAutocomplete` +
`getQuerySuggestions`) and had no prior e2e. If it FAILS, search-as-you-type on the platform's primary
discovery surface (F-017) is broken.

> The suggestions query matches the FTS `search_entrypoint.data_entity_vector` — a raw `data_entity` INSERT
> is INVISIBLE to suggestions; the helper seeds the entrypoint vector (KEY LESSON 3, shared with IT-022).
> Stable selectors: the input carries `data-qa="search_string"`, the dropdown list `data-qa="search_dropdown"`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedSearchableEntity(id, name)` — a data entity (type TABLE, class DATA_SET)
  + its `search_entrypoint.data_entity_vector`. IT-132-specific ids (2132/2133) so it never clobbers shared rows.

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed searchable: `GET /api/search/suggestions?query=<name>` → a JSON array containing an entry whose
  `externalName` == `<name>`.

## 4. Run protocol
1. `seedSearchableEntity(2132,"IT132SuggestEntity")` + `seedSearchableEntity(2133,"IT132OtherEntity")`.
2. Open `/` (the Overview home page; it mounts `<MainSearch mainSearch />`).
3. Focus the main search box (`[data-qa="search_string"]`) and type `IT132SuggestEntity`.
4. Wait for `GET /api/search/suggestions` (HTTP 200); assert its body contains `IT132SuggestEntity`.
5. Observe the dropdown (`[data-qa="search_dropdown"]`): `IT132SuggestEntity` is listed; `IT132OtherEntity`
   is NOT.

## 5. Expected result
GREEN — the suggestions endpoint returns the match and the dropdown lists it (and only it). A non-matching
entity is absent. Characterises the working autocomplete on `odd-minimal`.
