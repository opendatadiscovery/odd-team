---
id: PLT-262
title: "Catalog search silently drops the Data-entity-type (entity class) filter whenever My Objects is on - the narrowing the user selected is ignored, with no signal"
target_repo: odd-platform
issue_type: bug
status: draft
severity: medium
discovered_during: "/contribute CTRIB-060 (#1840 ST-6) - ontology enrichment of JooqFTSHelper, then re-verified on the post-ST-8 tree"
github_issue_url:
github_issue_number:
found_date: "2026-09-01"
user_facing_verified: partial
---

## Summary

On the Catalog search, selecting **My Objects** together with a **Data entity type** narrowing makes the type
narrowing a no-op on the legacy `/api/search` result path. The user sees their objects unfiltered by class, with
no indication the selected filter was discarded.

## Where

`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/util/JooqFTSHelper.java`,
`resultFacetStateConditions`:

```java
.filter(e -> {
    if (state.isMyObjects()) {
        return !e.getKey().equals(FacetType.ENTITY_CLASSES);
    }
    return true;
})
```

The `ENTITY_CLASSES` facet condition is filtered out of the CTE conditions whenever `my_objects` is set. Neither
caller (`ReactiveDataEntityRepositoryImpl`, the `findByState` / `countByState` pair) adds a replacement
predicate, and no comment explains the exclusion. Verified on `origin/main` @ `82e7e70e` and again after ST-8
merged (`b5d9f150`) - unchanged.

## Why it is user-reachable

Before the #1825 overhaul the class tabs and My Objects were one mutually exclusive strip, so the combination
could not be expressed. That is no longer true: the tab strip is now only **All / My Objects**, and the class
narrowing lives in the sidebar Data-entity-type filter, selectable independently. The component says so itself
(`SearchResultsTabs.tsx`): *"My Objects is index 1; everything else - All, or an entity-class narrowing chosen
in the Asset-type filter - keeps the All tab (index 0) active (a class narrowing is a refinement of All, not of
My)."* So a user can hold both, and the platform quietly honours only one.

The unified `/api/search/assets` path is **not** affected - it applies the class refinement independently of
my-objects.

## Verification status - stated precisely

- **Code: VERIFIED** (read first-hand, twice, including after ST-8 reworked the My-data area).
- **Live user-facing repro: NOT obtained.** On the default `auth.type=DISABLED` posture the service
  short-circuits my-objects to an empty page when no owner resolves, so the drop is unreachable there. Confirmed
  on a live stack: `POST /api/search` with `my_objects:true` + `entity_classes:[1]` returns `200` and
  `{"items":[],"page_info":{"total":0}}` - empty for the my-objects reason, before the class filter matters.
  Reproducing the visible defect needs an auth-enabled deployment (LDAP/OAuth) where an owner resolves and
  my-objects returns rows. That stand was not built for this item.

This is filed as a code-verified finding with an explicit reachability analysis rather than a claimed
end-to-end repro.

## Suggested direction (not a spec)

Either apply the class predicate alongside my-objects (they compose - one narrows by ownership, the other by
class), or, if the exclusion is deliberate, make it visible: disable the type filter while My Objects is active
rather than accepting a selection and ignoring it. Silently discarding a filter the user set is the part worth
fixing regardless of which way the semantics go.
