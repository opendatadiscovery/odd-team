## STRENGTHENS — en.json sidecar supplies the i18n-channel primary source for the LSN-020 User-filter drift (batch ZJ)

DOC-GAP-303 documents the Activity Feed User-filter drift — the live doc says "events **performed by** the selected users", the UI labels it "User", but the SQL binds `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` (filters by owner-of-entity via mapping, NOT by the actor). Batch ZJ adds the **i18n-CHANNEL PRIMARY SOURCE** — the en.json sidecar confirms the misleading label ships uniformly to every locale via the natural-keys pattern, and surfaces the doc-copy-vs-label-vs-SQL three-way drift completion.

### Added surfaced_by (new sidecar cited)

- `odd-platform__json__locales_translations__i18n-resource__en.md:bugs_limitations_corner_cases[2]` — **NEW PRIMARY SOURCE — THE i18n CHANNEL**: "Activity Feed User-filter label IS the LSN-020 drift, anchored at this file's line 347 (HIGH, DOC-GAP-303 instance): The `\"User\"` entry (line 347) is the value rendered as the Activity Feed multi-select filter label (`components/DataEntityDetails/DataEntityActivity/Filters/Filters.tsx:58`: `<MultipleFilter key='us' filterName='userIds' name={t('User')} />`). The label promises 'filter by user' — an operator (compliance reviewer, security auditor) reading the label, the doc copy ('events performed by one or more selected users' per WebFetch 2026-05-26), and the parameter name `userIds` infers the filter operates on the ACTOR who performed each action. But the SQL at `ReactiveActivityRepositoryImpl.java:272-273` binds `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)` — i.e. filters by the OWNER-of-the-affected-entity, accessed via the user_owner_mapping table. The available column `activity.created_by` (the actual actor) is read by the LEFT JOIN but is NEVER referenced in WHERE. This file does not cause the drift but is the channel that ships the misleading label to every user; no locale corrects it (natural-keys default)." **(severity HIGH per sidecar)**
- `odd-platform__json__locales_translations__i18n-resource__en.md:docs_link_semantic.inferred_docs[Activity Feed]` — **NEW**: WebFetch this session 2026-05-26 status 200 — verbatim: "**User** — show events performed by one or more selected users (multi-select). Useful for auditing a specific person's platform activity." The doc explicitly uses the phrasing "performed by" — confirming the LSN-020 drift: the doc reinforces the wrong promise. **(NEW batch ZJ — re-verification of the live doc page within session)**

### New evidence (supplementary)

- `odd-platform-ui/src/locales/translations/en.json:347` (verbatim, full Read this session): `"User": "User"` — the natural-keys entry that labels the Activity Feed multi-select filter. The localized rendering equals the lookup key in every of the 6 locales (no locale overrides this entry to clarify the actual SQL semantic).
- The en.json sidecar enumerates how the cross-locale uniformity is enforced (the natural-keys + no-missing-key-handler pattern); see DOC-GAP-310 NEW (the maintenance-contract META) for the mechanism.
- The SQL evidence remains unchanged (`ReactiveActivityRepositoryImpl.java:272-273` binds `userIds` to `USER_OWNER_MAPPING.OWNER_ID.in(userIds)`); the original DOC-GAP-303 cited the activity-route sidecar + ActivityController sidecar for SQL trace. Batch ZJ adds the i18n-channel triangulation: the label ships to every locale, the doc page reinforces the wrong promise, the SQL filters differently.
- Live WebFetch re-verification this session (per en.json sidecar inferred_docs WebFetch): `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed` 2026-05-26 status **200** — confirms the doc copy "performed by" persists at the canonical doc page. The 11-day stale-probe window per LSN-018 has not closed the gap — the doc still reinforces the wrong promise.

### New operator-impact dimensions surfaced

1. **THREE-SURFACE LSN-020 COMPLETION**: DOC-GAP-303 originally established the doc-copy-vs-SQL drift. Batch ZJ adds the **THIRD SURFACE** — the i18n key file. The drift is now structurally complete across three vectors: (1) the doc page says "performed by"; (2) the i18n key labels it "User" (rendered uniformly across all 6 locales via the natural-keys pattern); (3) the SQL filters by `USER_OWNER_MAPPING.OWNER_ID`. All three surfaces agree on the wrong promise; the right column (`activity.created_by`) is read but never filtered.
2. **i18n CHANNEL CAN AMPLIFY OR CORRECT THE DRIFT**: the en.json sidecar surfaces a structural point — a locale-specific rename of the `"User"` key (e.g. to `"Affected Entity Owner"` in en.json + propagated to 5 locales) would close the operator-facing surface of the drift WITHOUT requiring SQL or doc changes. The i18n layer is a NEW FIX POINT not surfaced in the original DOC-GAP-303. (The cleaner long-term fix is to align all three surfaces, but the i18n channel offers a fast operator-facing remediation if SQL changes are blocked.)
3. **CROSS-LOCALE UNIFORMITY (no locale corrects it)**: the misleading label persists in every of the 6 locales — operators in Ukrainian / Spanish / Chinese / French / Armenian deployments encounter the SAME drift as English operators. The compliance reviewer's mental model is uniformly wrong across the platform's user base.

### Triangulation update

DOC-GAP-303 was originally surfaced by 1 sidecar (`activity.md` route sidecar — batch ZI). Batch ZJ adds 1 NEW PRIMARY i18n-CHANNEL SOURCE (en.json sidecar — the locale bundle that ships the misleading label). **Coverage: 1 → 2 sidecars; the three-surface drift completion is now structurally triangulated (doc-copy + i18n-label + SQL).**

### Proposed doc action update

The original DOC-GAP-303 4-part proposed action (correct the live `/features/active-platform-features/activity-feed` page + add a "Filter semantics" note + cross-link permissions docs + the long-term canonical-vocabulary alignment) STILL APPLIES; batch ZJ adds two new dimensions:

1. **Code-side OPTIONAL — i18n quick fix as an EARLIER remediation**: rename the `"User"` key in `en.json` to `"Affected Entity Owner"` (or `"Entity Owner (mapped from user)"`) + propagate the translation to the 5 non-English bundles. One-line change per bundle × 6 bundles = 6 lines. Does NOT fix the SQL semantic (still binds to `USER_OWNER_MAPPING.OWNER_ID`) but ALIGNS the operator-facing label with the SQL behaviour. Cross-link to DOC-GAP-310 NEW (the maintenance-contract META — the propagation to 5 non-English bundles needs to be enforced by CI).

2. **Doc-side EXTENDED — explicitly enumerate the three-surface drift in the live page rewrite**:
   - "**Filter semantics**: the 'User' filter binds at the SQL layer to `USER_OWNER_MAPPING.OWNER_ID.in(...)` — i.e. selects activity on entities OWNED by users (via the user-owner mapping table), NOT activity PERFORMED BY users. A user without an owner mapping returns NO activity. The platform's per-action ACTOR column (`activity.created_by`) is recorded for audit but is not exposed via this filter. **For "find what Alice DID" queries**: use the platform's audit-log endpoints (cross-link permission docs) rather than the Activity Feed UI. **For "find activity on entities Alice owns" queries**: this filter is correct. The LABEL is misleading; the filter is named 'User' but operates on the entity-owner-via-mapping."

### Cross-references update

Add to existing DOC-GAP-303 cross-references:
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — the platform-wide UI-shell page could host a META section "When labels and SQL semantics diverge" that catalogues this finding + similar LSN-020 instances
- **DOC-GAP-309 NEW** (3 primary-nav tabs missing i18n keys) — sibling i18n surface; both findings demonstrate the i18n channel as a load-bearing surface where drift ships uniformly
- **DOC-GAP-310 NEW** (locale-set drift + no missing-key handler — the META) — explains the structural mechanism (natural-keys + no CI gate) that allows the misleading label to persist uniformly across all 6 locales

### Severity update

Severity remains **HIGH** — the 3-surface triangulation (doc + i18n + SQL) reinforces the original assessment. Batch ZJ's en.json sidecar contribution does NOT change the severity but adds a STRUCTURAL DIMENSION (the i18n channel as an amplification surface + a fast fix point). Severity is HIGH because: (a) compliance / security audit use-cases rely on the filter; (b) the misleading label COMPOUNDS via the doc page's "performed by" copy; (c) the natural-keys i18n pattern ships the misleading label to every locale uniformly without any locale correcting it; (d) the right column (`activity.created_by`) is read but never filtered — the drift is enforced by the absence of one SQL clause.

---

**Batch ZJ contribution**: 1 NEW PRIMARY i18n-CHANNEL SOURCE (en.json sidecar); coverage 1 → 2 sidecars; 3-surface LSN-020 drift completion (doc + i18n + SQL); 1 NEW FIX-POINT surfaced (the i18n channel can amplify or correct the drift via a 6-line bundle rename); severity unchanged (HIGH); proposed doc action extended with the i18n-quick-fix option + an extended "Filter semantics" doc rewrite.
