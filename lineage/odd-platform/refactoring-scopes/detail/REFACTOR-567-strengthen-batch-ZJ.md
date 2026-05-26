## STRENGTHENS — Batch ZJ (2026-05-26 — en.json:347 anchors the LSN-020 drift AT THE i18n LAYER, ToolbarTabs sidecar surfaces the broader 9-tab unconditional-visibility frame)

Prior REFACTOR-567 (with its batch-ZI strengthen) anchored the LSN-020 Activity User-filter drift across SQL, service, controller, UI Filters component, and live doc page layers. Batch ZJ adds the FIFTH layer: en.json:347 itself — the i18n key `"User": "User"` is the CHANNEL through which the misleading label reaches every user across every locale. The natural-keys pattern (cross-ref ADR-CANDIDATE-011) means no non-English locale could correct the label without breaking the contract; the drift is locked at the resource-bundle level.

**New surfaced_by entry**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[2]` (HIGH) — "**Activity Feed User-filter label IS the LSN-020 drift, anchored at this file's line 347 (HIGH, DOC-GAP-303 instance)**: The `\"User\"` entry (line 347) is the value rendered as the Activity Feed multi-select filter label (`components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58`: `<MultipleFilter key='us' filterName='userIds' name={t('User')} />`). The label promises 'filter by user' — an operator (compliance reviewer, security auditor) reading the label, the doc copy ('events performed by one or more selected users' per WebFetch 2026-05-26), and the parameter name `userIds` infers the filter operates on the ACTOR who performed each action. But the SQL at `ReactiveActivityRepositoryImpl.java:272-273` binds `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` — i.e. filters by the OWNER-of-the-affected-entity, accessed via the user_owner_mapping table."

- `odd-platform__json__locales_translations__i18n-resource__en.md:security.known_security_gaps[0]` (HIGH) — "The `\"User\"` filter label (line 347) participates in the LSN-020 / DOC-GAP-303 drift cluster — the operator-misleading label is a security/compliance concern, not strictly a security defect in this file but a security CONSEQUENCE of the drift."

**What this strengthening adds**: the prior REFACTOR-567 strengthen (batch ZI) covered 4 layers (SQL + service + controller + UI Filters component + live doc). Batch ZJ adds the FIFTH (en.json resource bundle). The drift now spans the full 5-layer cross-section:
1. SQL (`ReactiveActivityRepositoryImpl.java:272-273` — `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`)
2. Service (`ActivityServiceImpl.java`)
3. Controller (`ActivityController.getActivity`)
4. UI Filters (`Filters.tsx:58` — `<MultipleFilter filterName='userIds' name={t('User')} />`)
5. **i18n resource bundle (`en.json:347` — `"User": "User"`)** ← NEW this batch
6. Live doc copy (`/features/active-platform-features/activity-feed` — "performed by")

Five surfaces all reinforcing the wrong promise. The fix-span widens: renaming the i18n key from `"User"` to `"Affected Entity Owner"` (or similar) requires:
- en.json:347 + the 5 non-English locales need new entries (since they currently rely on natural-keys; a key rename means each locale must add the new key or the rename surfaces as a missing-key fall-through)
- Filters.tsx:58 callsite update
- Live doc page update (verified 2026-05-26 WebFetch)
- The SQL layer is unchanged — only the LABEL needs to be honest about what SQL does

**Triangulation count after ZJ**: 5 sidecars (was 4 — ReactiveActivityRepositoryImpl + ActivityServiceImpl + ActivityController + activity UI route; ZJ adds en.json primary-source).

**Severity unchanged**: MEDIUM. The cross-layer corroboration is now complete; the priority is bounded by the same compliance-audit-misleading framing.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-565 (sibling `ownerIds` silently dropped for MY_OBJECTS/UPSTREAM/DOWNSTREAM); REFACTOR-060 (`userIds`/`ownerIds` filter parameter enumeration); ADR-CANDIDATE-011 (natural-keys — the i18n contract that locks the drift across all locales).
- SUPERSEDES: none.
- CONFLICTS: none.

---
