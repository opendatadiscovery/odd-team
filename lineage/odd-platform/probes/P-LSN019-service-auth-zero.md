---
probe_id: P-LSN019-service-auth-zero
source_node: odd-platform java service:TagServiceImpl
source_finding: S-D-1 (Stress Protocol Category D — auth gates, CANARY HEADLINE: service-tier auth posture)
related_lsn: LSN-019
status: skeleton-emitted
canary_headline: true
---

# P-LSN019-service-auth-zero

## What we're testing

`TagServiceImpl` (`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:1-168`) — the entire class — has ZERO authorisation enforcement at the service tier. No `@PreAuthorize`, no `permissionService.hasPermission(...)`, no `SecurityContextHolder` read, no `OwnerAuthorizationFacade` call. The controller perimeter is the SOLE auth defence for HTTP traffic; the four side-door write paths apply their own per-feature permission and bypass `TAG_CREATE` entirely.

The empirical claim under test: a static `grep` confirms the absence; a dynamic invocation by-passing the controller (e.g. a unit test that wires `TagServiceImpl` directly without Spring Security) demonstrates the methods work without any auth context.

## Setup

### Static probe (no environment needed)

1. Clone `odd-platform` at the current commit.
2. Run grep for the absence patterns inside `TagServiceImpl.java`.

### Dynamic probe (integration test environment)

1. Spring Boot test environment with `@SpringBootTest` slice that includes `TagServiceImpl` and its R2DBC dependencies but explicitly EXCLUDES Spring Security autoconfiguration.
2. A Testcontainers Postgres instance.

## Procedure — static

```
# Absence of @PreAuthorize
grep -n '@PreAuthorize' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java
# Expected: zero output lines.

# Absence of permissionService usage
grep -n 'permissionService\.' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java
# Expected: zero output lines.

# Absence of OwnerAuthorizationFacade
grep -n 'OwnerAuthorization\|AuthorizationFacade' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java
# Expected: zero output lines.

# Absence of SecurityContextHolder
grep -n 'SecurityContextHolder\|SecurityContext\.' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java
# Expected: zero output lines.

# Absence of hasPermission / hasRole literal
grep -n 'hasPermission\|hasRole\|hasAuthority' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java
# Expected: zero output lines.
```

## Procedure — dynamic

1. Direct instantiate `TagServiceImpl` with mocked dependencies (or with real Testcontainers-backed repository) — bypassing the Spring Security filter chain entirely.
2. Invoke each of the 9 public methods (`bulkCreate`, `update`, `delete`, `listMostPopular`, `getOrCreateTagsByName`, `getOrInjectTagByName`, `updateRelationsWithDataEntity`, `deleteRelationsWithTerm`, `createRelationsWithTerm`) with valid input.
3. Assert that none of the methods throw `AccessDeniedException` or any auth-related exception.

## Expected behaviour

### Static

- All 5 grep commands return zero matches. The absence is total.

### Dynamic

- All 9 methods complete successfully against a freshly initialised tag table. The service-tier methods do not require any authentication / authorisation context to execute.

## Pass / fail criteria

- **CONFIRMED (the absence is total)**: all grep commands return zero matches; the dynamic test passes for all 9 methods without auth.
- **NOT CONFIRMED**: any grep finds an auth-related call OR the dynamic test fails with auth-related exception. This would mean a hidden auth check exists that this sidecar missed; the sidecar's S-D-1 finding would need amendment.

## On confirmation

This is the CANARY HEADLINE for the LSN-019 batch. The finding establishes that the Stress Protocol's Category D fires correctly on a node where the absence is the load-bearing observation (every method's auth posture maps to "inherited from controller perimeter" or "inherited from side-door caller"). The probe's primary value is regression protection: a future change that adds `@PreAuthorize` at the service tier (a reasonable defence-in-depth move) MUST be coordinated with the four side-door surfaces — adding `@PreAuthorize("hasPermission('TAG_CREATE')")` at `getOrCreateTagsByName` without changing the side-door callers' permissions would BREAK the Term/DataEntity/DatasetField/Collector write paths.

## References

- Source file: `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java`
- Sidecar finding: S-D-1 in `lineage/odd-platform/understanding/odd-platform__java__service__TagServiceImpl.md`
- Cross-references: REFACTOR-223 (side-door write surface) per the existing `TagController` sidecar
