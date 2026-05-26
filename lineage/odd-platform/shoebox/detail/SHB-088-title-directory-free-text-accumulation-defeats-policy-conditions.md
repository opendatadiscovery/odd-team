# SHB-088 — Title directory's free-text auto-create silently defeats Policy conditions on `dataEntity:owner:title == 'X'`

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators writing an RBAC policy with condition `dataEntity:owner:title == 'Data Steward'` expect the rule to match every grant whose Title is conceptually "Data Steward." The actual behaviour: the Title directory is a free-text catch-bucket auto-created by `OwnershipServiceImpl.create/update` via `titleService.getOrCreate(formData.getTitleName())`; there is no allowlist, no case-folding, no trimming, no enum, no `@Pattern`, no `@Size`. Two operators typing "Data Steward", "data steward", "DATA STEWARD", " Data Steward " (leading space), "data-steward", "Data_Steward", "Métier de Steward" (locale variant) each create DISTINCT rows. The policy condition matches only one — every other variant silently grants the operator NOTHING.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TitleServiceImpl.java:19-22` — `getOrCreate(name)` impl: read-then-insert; accepts any string verbatim.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnershipServiceImpl.java:53` — sole production caller of `titleService.getOrCreate(formData.getTitleName())` (also at update path line 107).
- `odd-platform-api/src/main/resources/db/migration/V0_0_3__add_ownership.sql:1-8` — `title.name varchar(128)` — no CHECK constraint, no pattern, no normalisation.
- `odd-platform-specification/components.yaml:278-288` — Title OpenAPI schema: `{id, name: string}` both required, no description, no `pattern`, no `minLength`/`maxLength`, no enum.
- `odd-platform-ui/src/components/shared/elements/Autocomplete/OwnerTitleAutocomplete/OwnerTitleAutocomplete.tsx:43-48, 149` — MUI Autocomplete `freeSolo` mode: operator can pick existing OR type brand-new; the typed string is sent verbatim to the OwnershipForm POST.
- Live `/configuration-and-deployment/enable-security/authorization/policies` (WebFetched 2026-05-25, status 200) — mentions `dataEntity:owner:title` and `term:owner:title` as Policy condition fields but does NOT explain whether Title is a controlled vocabulary; mentions no warning about case-sensitivity or free-text accumulation.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTitleRepositoryImpl.java:26` — `getByName` uses `TITLE.NAME.eq(name)` — case-sensitive byte equality.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/exceptions/ExceptionUtils.java:22-23` — `TITLE_NAME_UNIQUE` constraint name; the partial unique index on `title.name` is case-sensitive.

## Notes

- The same class as F-018 (Manual Object Tagging — operator + ingestion-driven Tag directory with side-channel mint) and SHB-084 (Owner directory side-doors), but with a TWIST: Title is consumed by Policy conditions, so the directory's free-text drift directly defeats authorization rules. Tag and Owner drift have UX consequences; Title drift has SECURITY consequences.
- Operator-visible scenarios:
  - Operator writes Policy `dataEntity:owner:title == 'Data Steward'` to grant DataEntity-update to all Data Stewards. Three months later half the team's Ownership records show `'data steward'` (lowercase) because the autocomplete's client-side filter doesn't show all entries (only 30 oldest per SHB-NNN sibling). The policy silently doesn't apply to the lowercase users — they get access denied without any operator-visible signal.
  - Operator using the live `/policies` page can write the condition without realising the matched value is case-sensitive byte equality. The docs page does not explain Title's free-text nature.
- The directory has NO UI delete endpoint and NO admin curation — once a typo'd title is in the directory, it stays. The soft-delete machinery is provisioned (`ReactiveTitleRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository`) but unused — operators have no path to clean up.
- The autocomplete fetches `size=30` and shows the 30 oldest matching titles — when the directory grows past 30, newer matching titles become un-autocompletable (server-side ORDER BY id ASC, client-side filter operates only on the 30-row window).
- Mitigation options: (a) introduce a `title.canonical_name` column normalised on write (lowercase + trim + collapse-whitespace + diacritics-fold), use it for Policy condition matches; (b) curated allowlist with operator-management UI; (c) require an admin-approved Title before it can be assigned (decoupling Title-create from Title-assign — distinct permissions); (d) hard de-dupe pass on existing data.

## Next

1. **PROMOTE** to feature: `F-NNN — Owner-Relationship Title directory and authorization-condition matching` with pillar P-09 (or extend F-036 with this facet — F-036 names the "Owner-Relationship Title Directory" but doesn't enumerate the policy-condition drift).
2. **REFACTOR-NNN**: add canonical-name column + case/whitespace normalisation OR introduce Title allowlist mechanism.
3. **DOC-NNN**: live `/policies` page must document the case-sensitive byte-equality semantics of `:owner:title`. Live `/owners` and `/ownership` pages must document that Titles are free-text auto-created.
4. **TEST-GAP-NNN**: regression test seeding `'Data Steward'` + `'data steward'` as distinct titles; assert Policy condition matches one but not the other.

## Links

- cluster_with: [F-036, F-018]
- merged_into: (open)
- supersedes: []
