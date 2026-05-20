## REFACTOR-296 — DISABLED-mode rendering CONTRADICTION between docs and code: live doc says Recommended panel IS visible under DISABLED ("with the per-user filtering not applying"), code unconditionally HIDES the entire panel — file:line evidence on both sides

**Severity**: MEDIUM
**Category**: doc-code-drift + path-mismatch
**Pillars affected**: [P-01] — Data Discovery
**Surfaced by**:
- `PopularStrip.md:docs_link_semantic.doc_drift_findings[1]` (|-
    "**DISABLED-mode rendering mismatch — docs say Recommended panel IS visible under DISABLED, code hides it.** Live doc (catalog-overview.md:43): 'on auth-disabled deployments the panel is visible but the per-user filtering does not apply'. Code (Overview.tsx:25-27, :53-59): `isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')` — under DISABLED this is `false`, so the entire `WithPermissionsProvider(...Component={OwnerAssociation})` block does NOT render. **The published behaviour is unreachable** on a DISABLED deployment: a user on the home page sees Search + Top tags + Domains + DataEntitiesUsageInfo + Directory + (no Recommended panel). This is a direct factual contradiction between docs and code, file:line-anchored on both sides.")

**Description**: A clean factual contradiction:
- **Live doc** (`documentation/docs/data-discovery/catalog-overview.md:43`, mirrored to `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview`):
  > "The Recommended panel requires the signed-in user to be linked to an Owner; without the user-owner association in place, the Recommended panel is empty (and on auth-disabled deployments the panel is visible but the per-user filtering does not apply)."
  
  → Doc states: under DISABLED, panel IS visible.

- **Code** (`Overview.tsx:25-27, :53-59`):
  ```ts
  const isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED');
  // ...
  {isShowOwnerAssociation && (
    <WithPermissionsProvider ...>
      <OwnerAssociation />  // ← this wraps OwnerEntitiesList which renders the Recommended panel
    </WithPermissionsProvider>
  )}
  ```
  
  → Code states: under DISABLED, panel is NOT rendered.

The contradiction is direct and file:line-anchored on both sides. Either the doc is wrong (the more likely case given the code's clear evidence) or the code is wrong (a regression that diverged from the documented behaviour).

The decision is the maintainer's call:
- **If the code is correct** (DISABLED hides the panel — a safety-first choice): update the doc to say "on auth-disabled deployments the Recommended panel is hidden because per-user personalisation requires authentication." This is a clean factual statement matching the code.
- **If the doc is correct** (DISABLED should show the panel): update the code at `Overview.tsx:25-27` to remove the DISABLED branch from the gate. The Recommended panel would then render for anonymous users with the catalog-wide Popular (no per-user filtering) — matching the doc's "per-user filtering does not apply" framing.

The safety-first interpretation (current code) seems more defensible — anonymous users on a DISABLED deployment don't have a stable identity to drive personalisation, so the panel's value is limited. But this is a maintainer decision, not a doc-archaeologist decision.

**Primary source citations**:
- `documentation/docs/data-discovery/catalog-overview.md:43` (the doc statement)
- `odd-platform-ui/src/components/Overview/Overview.tsx:25-27, :53-59` (the code gate)
- `PopularStrip.md` documents the contradiction

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-096 (owner-association UI gate is UX-not-security) is silent on the DISABLED case. The contradiction is doc-debt of a maintainer decision yet to be made.

**Proposed remedy**: Maintainer decision required. The two options are documented in the Description above. Whichever is chosen, the doc + code must be aligned + the ADR-CANDIDATE-096 draft must enumerate the DISABLED case.

**Severity rationale**: MEDIUM — clean doc-code drift; observable to operators evaluating ODD on a DISABLED deployment; the decision is the maintainer's call, the fix is alignment.

**Suggested backlog grouping**: `Doc completeness sprint` + `Maintainer triage of doc-code drift findings`.

---
