# Term Detail page hardening (#1754 — defects 1, 2, 4, 5, 6, 7)

Part of #1754 (defects 1, 2, 4, 5, 6, 7). Defects 3 & 8 are deferred to their own follow-ups (see Scope), so
this PR intentionally does **not** auto-close the epic — `Closes #1754` would orphan the remaining two defects.
(Once defects 3 & 8 are filed as their own issues, the maintainer can close #1754 with a reference to them.)

Resolves six defects on the Term Detail page (`/terms/{id}`). Each fix conforms to an existing sibling/pattern
on the page (no new components introduced). Reproduced live and verified on a running stack before/after.

## What changed

- **D1 — Overview no longer double-fetches the term-details query.** The shell (`TermDetails.tsx`) loads the
  term details + permissions into redux; `Overview.tsx` now reads that store instead of firing its own
  tanstack `useGetTermByID`/`useResourcePermissions`. One `GET /api/terms/{id}` per page open (was two,
  separate caches). The Overview linked-term add/delete still refreshes (the mutations dispatch a redux
  `fetchTermDetails`). *(No change to the three list-tab state patterns — that's the deferred Defect 8.)*
- **D2 — the reverse-lookup tabs stay visible at zero count.** `TermDetailsTabs.tsx` no longer sets
  `hidden: !count`; Linked entities / columns / terms are always shown (count badge incl. 0), so linking is
  discoverable on a fresh term.
- **D4 — the Linked Columns tab paginates past 50, and the backend `page_info` is honest.** FE:
  `LinkedColumnsList` uses `useInfiniteQuery` + wired `fetchNextPage` (was a pinned page + a noop
  `InfiniteScroll next`). BE: `ReactiveDatasetFieldRepositoryImpl.countByTerm` + `DatasetFieldServiceImpl`
  zip the page with the real total, and `DatasetFieldListMapperImpl` reports `total`/`hasNext` correctly
  (was `page_info(returnedPageSize, false)`). A term with 60 linked columns now shows all 60; the tab badge
  no longer disagrees with the list.
- **D5 — a real backend failure on Linked Terms shows an error, not the empty state.** `LinkedTermsList`
  renders `AppErrorPage` on `isError` with the real mapped error and gates the empty state on `!isError`
  (was a synthesised `status:500` shown during loading + real errors swallowed into "empty").
- **D6 — the Linked Terms empty copy reads "No linked terms"** (was the copy-pasted "No linked entities");
  the new key is added to all 7 locales.
- **D7 — the Linked Terms search is debounced (500 ms) + Enter-submittable** (was one request per keystroke),
  mirroring the LinkedEntitiesList sibling.

## Scope (bounded)

In: defects 1, 2, 4, 5, 6, 7. **Deferred** (tracked, not in this PR): **Defect 3** (Overview/Linked-Terms
dual-surface — a product/UX decision) and **Defect 8** (unify the three tabs' state-management — needs an ADR).
A latent orphan-column NPE on the linked-columns endpoint (a term-linked column whose dataset is missing) is
also tracked separately. No DB migration, no OpenAPI/client regeneration, no auth-posture change.

## Verification (running system, not the diff)

- **Reproduced** all six on the pre-fix stack; **verified** all six fixed on the working-tree stack (API curl
  + Playwright, with screenshots).
- **Unit:** full `:odd-platform-api:build` green (test + checkstyle + assemble) incl. new
  `DatasetFieldServiceImplTest.listByTerm` + `DatasetFieldListMapperImplTest` (page_info math). Patch-coverage
  gate satisfied (the repo/mapper are jacoco-excluded; the service method is covered).
- **Integration (odd-team):** new `IT-139` (linked-columns pagination) + extended `IT-032` (D1/D2) + `IT-082`
  (D5/D7 + re-grounded D6 pin) — all GREEN on the working-tree SUT, RED on `ref:main` (the bug baseline).

## Docs

The live Business Glossary page publishes operator caveats for D1/D2/D4 (DOC-233). This PR makes them false in
0.29.0, so they are removed on the documentation `release/0.29.0` train (publishes at the release gate; the
Defect-3 dual-surface caveat stays). Tracked by DOC-478.

Milestone: 0.29.0
Docs: documentation@release/0.29.0 — publishes with the 0.29.0 release (caveat retirement; DOC-478)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
