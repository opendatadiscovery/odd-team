## REFACTOR-624 — `Title.name` has NO length / pattern / case-normalization constraint at schema or service; Policy conditions like `dataEntity:owner:title == 'Data Steward'` silently miss `'data steward'`, `'Data  Steward'`, etc. → silent policy-leak class

**Severity**: MEDIUM
**Category**: missing-normalization (silent-policy-leak)
**Pillars affected**: [P-05 Ownership, P-09 Security & Access Control]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**Title directory has no length / pattern / allowlist constraint at the schema or service** — `title.name varchar(128)` per `V0_0_3__add_ownership.sql:4`. No `@Pattern`, no `@Size`, no enum check, no normalisation (case-folding, trimming, deduping by lowercase). The directory accumulates `'data steward'`, `'Data Steward'`, `'DATA STEWARD'`, `' Data Steward '` (leading space), `'data-steward'`, `'data_steward'` as DISTINCT rows the moment two operators type slightly different forms into the autocomplete." — severity: MEDIUM (the policies `dataEntity:owner:title == 'Data Steward'` condition then misses every other-casing variant — a silent policy-leak class)

**Description**: The Title directory's `name varchar(128)` column (per `V0_0_3__add_ownership.sql:1-8`) has:
- NO `@Pattern` regex constraint at the OpenAPI/POJO layer (`components.yaml:278-288`)
- NO `@Size` length constraint at the form data level
- NO enum check (no enum `TitleKind` exists; titles are free-text)
- NO case-normalisation at the service layer (`TitleServiceImpl.java:19-22`'s `getOrCreate(name)` calls `getByName(name)` which uses `containsIgnoreCase` for the read path but the WRITE uses verbatim `name`)
- NO trim() / whitespace-strip at the service layer

The directory therefore accumulates DISTINCT rows for every case-variant and whitespace-variant of the same logical title:
- `Data Steward`
- `data steward`
- `DATA STEWARD`
- ` Data Steward` (leading space)
- `Data Steward ` (trailing space)
- `Data  Steward` (double space)
- `data-steward`
- `data_steward`
- `DataSteward`

Each is a separate `title` row with its own `title_id`. The autocomplete (`OwnerTitleAutocomplete.tsx`) shows all variants in the dropdown; operators may pick any of them.

**The silent-policy-leak class** — Policy conditions cite titles by name string (per the WebFetched Policies page that documents `dataEntity:owner:title` and `term:owner:title` as condition fields, last verified 2026-05-25). A policy like:

```
GRANT DATA_ENTITY_VIEW WHEN dataEntity:owner:title == 'Data Steward'
```

matches ONLY ownerships whose title is EXACTLY 'Data Steward' (case-sensitive string equality at the Policy evaluator). An ownership granted with title 'data steward' / 'DATA STEWARD' / 'Data  Steward' is INVISIBLE to the policy — the user with such an ownership does NOT get the granted permission. This is a SILENT POLICY-LEAK: the operator's intent was "all data stewards have view access"; the actual outcome is "only the exactly-cased 'Data Steward' has view access". The operator has no visibility into the leak — the audit log shows neither the intent nor the miss.

**The compounding factor**: `TitleService.getOrCreate(name)` (REFACTOR-206) AUTO-CREATES a fresh `title` row on every cased-variant. Two operators typing into the OwnerTitleAutocomplete on consecutive days, one typing 'Data Steward' and the other typing 'data steward', BOTH succeed; the directory now has TWO logically-identical titles with DIFFERENT IDs. Subsequent policies hit only one.

**Operator-visible consequence**:
- Day 1: Operator A creates ownership for User1 with title 'Data Steward' (Title row 1).
- Day 2: Operator B creates ownership for User2 with title 'data steward' (typo; auto-creates Title row 2).
- Day 3: Admin writes a policy `dataEntity:owner:title == 'Data Steward'`.
- User1 (linked to Title row 1) gets the permission. User2 (linked to Title row 2) does NOT.
- Neither admin nor User2 sees any error — User2 just silently lacks access; admin assumes everyone has it.

**Primary source citations**:
- `V0_0_3__add_ownership.sql:4` (`name varchar(128)` — no CHECK constraint)
- `TitleServiceImpl.java:19-22` (`getOrCreate(name)` calls `getByName(name).switchIfEmpty(create)` — no normalisation, no trim, no case-fold)
- `components.yaml:278-288` (Title schema — no pattern, no constraints)
- `OwnerTitleAutocomplete.tsx:43-48` (free-text input via MUI Autocomplete `freeSolo`)
- WebFetched Policies page (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/policies`) verified 2026-05-25 — confirms `dataEntity:owner:title` and `term:owner:title` are Policy condition fields, but does NOT explain the case-sensitivity exposure

**Existing-ADR-or-implied-prescription**: links to REFACTOR-206 (auto-create no allowlist — the WRITE side of the same problem). REFACTOR-624 is the ENFORCEMENT side: even WITH normalisation at write, the read side (Policy condition evaluator) is case-sensitive — both sides need fixing.

**Proposed remedy**: Three-step fix:
1. **Schema migration**: add a CHECK constraint or, better, a generated column `name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED` with a UNIQUE index on `name_normalized`. Migrate existing rows by collapsing case-variants (use case-by-case maintainer judgement for which variant to keep; rebind ownerships).
2. **Service layer**: `TitleServiceImpl.getOrCreate(name)` normalises the input — `name.trim().toLowerCase()` or a configurable normalisation. Reject duplicates that collide on the normalised form.
3. **Policy evaluator**: change `==` to `equalsIgnoreCase` (or canonicalise both sides at evaluation time). Alternative: validate the policy's title literal at write-time against the normalised directory; reject if no matching title exists.

The remedy is structural (schema migration + service-layer change + Policy evaluator change). The DOC-disclose alternative is to add a warning to the Policies docs page explaining the case-sensitivity exposure and recommending operators normalise titles before writing policies.

**Severity rationale**: MEDIUM — silent-policy-leak class. Not a security exposure that grants extra permissions; instead a permission-DENIAL where the operator INTENDED to grant but didn't. The blast radius scales with how many cased-variants accumulate in the directory; observed in real deployments (per maintainer reports cited in the OwnershipServiceImpl batch-K sidecar).

**Suggested backlog grouping**: `Owner / Title directory hygiene` — couple with REFACTOR-206 (auto-create no allowlist) and REFACTOR-199 (Owner side).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-206 (auto-create no allowlist — the WRITE side); REFACTOR-199 (Owner side, sibling shape).
- SUPERSEDES: none.
- CONFLICTS: none.

---
