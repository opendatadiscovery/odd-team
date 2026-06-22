---
id: ADR-ui-state-management
title: Frontend list-state management — redux-thunk → tanstack-query unification
status: draft (deferred — research pending)
date: 2026-06-22
deciders: maintainer (Raman)
relates:
  - issues/odd-platform/PLT-236.md (Defect 8 — three term tabs on two state stacks)
  - issues/odd-platform/PLT-058.md / odd-platform#1754 (parent epic)
  - contributor/CTRIB-028.md (resolved siblings 1,2,4,5,6,7; this ADR is the deferred D8)
---

# ADR — Frontend list-state management (redux-thunk → tanstack-query)

> **Status: DRAFT, DEFERRED.** This is a placeholder home for the Defect-8 decision (PLT-236), created so the
> deferred work is tracked. It is NOT decided. Before the Decision section is written, run
> `playbooks/deep-research.md` (CLAUDE.md ADR-drafting rule) over the odd-platform-ui state-management surface —
> do not punt the technical choice as "open questions".

## Context

`odd-platform-ui` is mid-migration from redux-toolkit thunks to `@tanstack/react-query`. The drift is visible in
one parent (the term detail page), where three sibling reverse-lookup list tabs run on two stacks:

- `LinkedEntitiesList` → redux thunks (`fetchTermLinkedList` + `getTermLinkedList*` selectors, honest BE pagination)
- `LinkedColumnsList` → tanstack `useQuery` (→ tanstack `useInfiniteQuery` after CTRIB-028)
- `LinkedTermsList` → tanstack `useInfiniteQuery`

CTRIB-028 fixed the user-visible defects (4/5/7) by conforming each component to its OWN sibling pattern, which
resolves the symptoms but does not remove the underlying state-pattern split — that removal is this ADR's subject.

## Decision

TODO (deferred — research first). The expected direction is to standardise on tanstack-query for server-state
list surfaces and define the redux→tanstack migration policy, but the scope (term tabs only vs. a platform-wide
policy), the shared-hook shape, and the cache-invalidation contract must be researched against the actual
codebase before deciding.

## Consequences

TODO (after the Decision).

## Scope when picked up (PLT-236)

Port `LinkedEntitiesList` (+ its thunk/selectors) to the chosen pattern; unify the three term tabs; no behaviour
regression (search/pagination/empty/error parity). Then broaden per the policy.
