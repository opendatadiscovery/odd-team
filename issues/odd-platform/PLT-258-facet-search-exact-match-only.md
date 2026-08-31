---
id: PLT-258
title: "Search sidebar facet dropdowns match EXACTLY: typing a prefix into 'Search by name' returns no options"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "Search filter dropdowns find nothing unless you type the option's full name"
filed_labels: "kind: bug, scope: backend, scope: frontend"
severity: medium   # a search box that only matches a value you already know defeats its own purpose
discovered_during: "CTRIB-062 / #1842 ST-8 - while making an e2e drive the Statuses sidebar facet"
found_date: "2026-08-31"
user_facing_verified: true   # measured on a running 1.0.0-line build; see the evidence below
suggested_milestone: ""      # SUGGESTED ONLY -- filed with NO milestone; the maintainer attaches one
---

## Summary

Every multi-select filter in the Catalog search sidebar (Owner, Tag, Groups, Statuses, Type) is an
autocomplete whose input is labelled **"Search by name"**. Typing a partial name into it returns **no options
at all**. Only the option's *complete* value matches.

That inverts the point of the control: you have to already know the exact value to find it, and a user who
types the first few letters of an owner or tag concludes the value does not exist.

## Steps to reproduce

1. Open the Catalog search page.
2. Click the **Statuses** filter in the left sidebar.
3. Type `STAB`.

**Expected:** the list narrows to `STABLE`.
**Actual:** the list is empty ("No options").

Type `STABLE` in full and the option appears.

## Evidence

Measured directly against the API the dropdown calls, on a running build:

```
GET /api/search/{searchId}/facet/STATUSES?page=1&size=30&query=<q>

  q=        -> ["DRAFT","STABLE","DEPRECATED","DELETED","UNASSIGNED"]
  q=STAB    -> []
  q=stab    -> []
  q=STABLE  -> ["STABLE"]
```

So the filtering is server-side and exact, not a front-end display issue. `q=stab` also returning `[]` shows
it is not merely case-sensitive.

## User-facing impact

The affected control is the primary way to apply an Owner, Tag or Group filter, and those option sets are
large on a real deployment - precisely the case where a user types a prefix rather than scrolling. The
placeholder text ("Search by name") promises search-as-you-type, so the empty result reads as "no such owner"
rather than "type it exactly". The likely outcomes are a user believing a tag or owner is missing from the
catalog, or abandoning the sidebar filters entirely.

Statuses is a five-item fixed list, so it is only mildly annoying there; Owner and Tag are where this bites.

## Suggested direction (not prescriptive)

Make the facet-option query a prefix or substring match (case-insensitive), the behaviour the placeholder
already implies. Note the main asset search itself already matches on word prefixes, so the two search
surfaces currently behave differently from each other.

## Notes

Found while writing an integration test that drives the Statuses facet for an unrelated feature (the ST-8
My-data filter, #1842). Not caused by that change - reproduced against the endpoint directly. Filed separately
rather than folded into that PR, which is scoped to the My-data scope filter.
