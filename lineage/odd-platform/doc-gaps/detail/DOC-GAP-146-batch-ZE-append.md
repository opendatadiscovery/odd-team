## STRENGTHENS — TitleController read-side class-tier complement (batch ZE)

The TitleController class-tier sidecar (batch ZE) supplies the READ-SIDE PRIMARY SOURCE for the Title directory auto-grow finding DOC-GAP-146 captures at the WRITE-side (OwnershipServiceImpl batch K). Triangulation now: WRITE-side service-tier (batch K) + READ-side controller-class (batch ZE) — 2-LAYER coverage on the Title-feature.

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__TitleController__controller-class__TitleController.md:implicit_adrs.[0]` ("Title directory mutated only as a side effect of OwnershipServiceImpl — the controller exposes ONLY `getTitleList` (no POST/PUT/DELETE)")
  - `odd-platform__java__TitleController__controller-class__TitleController.md:concepts.operations.[1]` ("(Out-of-band sibling) `titleService.getOrCreate(name)` — the AUTO-CREATE side-effect path called by `OwnershipServiceImpl`; reads via `getByName` then inserts if missing")
  - `odd-platform__java__TitleController__controller-class__TitleController.md:bugs_limitations_corner_cases.[6]` (MEDIUM per sidecar — "No live doc page documents what a Title is") — the canonical-page absence that DOC-GAP-283 (NEW batch ZE) names as a distinct sibling finding
  - `odd-platform__java__TitleController__controller-class__TitleController.md:dependencies_semantic.requires-feature.[0]` ("Ownership feature — Titles ONLY exist to label `ownership.title_id` → `title.id`")
  - `odd-platform__java__TitleController__controller-class__TitleController.md:dependencies_semantic.requires-feature.[1]` ("Authorization framework Policy conditions — `dataEntity:owner:title` and `term:owner:title` are condition fields in the live Policies page — Policies CAN gate access by an owner's Title attribute, making the Title directory a load-bearing dimension for the authorization model")

- **NEW evidence (batch ZE)**:
  - `TitleController.java:14-24` — the controller exposes ONLY `getTitleList(page, size, query)`; NO POST / PUT / DELETE endpoint. The directory is mutated EXCLUSIVELY via `OwnershipServiceImpl.create / update` calling `titleService.getOrCreate(formData.getTitleName())` — verified by the TitleService interface (`TitleService.java:7-11`) carrying only `getOrCreate(name)` and `list(page, size, query)`.
  - `grep titleRepository.create\(` against `<odd-platform-repo>/odd-platform-api/src/main/java` returns ONLY `TitleServiceImpl.java:21` and test fixtures (per the class sidecar's verification). The read-only controller surface is structurally enforced by the absence of any other create call site.
  - The class-tier finding identifies THE DATA-QUALITY-RUNS FILTER as another consumer of the Title directory: `titleIds` and `deTitleIds` query parameters (`openapi.yaml:2009-2018, 2059-2068`) on the data-quality-runs endpoint reference `title.id` to filter test runs by the title of the test's owner / data entity's owner. The Title directory thus drives THREE consumer surfaces: (a) ownership-form autocomplete, (b) Policy condition fields, (c) Data Quality runs filter. The doc-side fix's blast radius is wider than the autocomplete-and-Policies framing batch K named.

- **NEW dimension (batch ZE) — Title-feature trio**:
  Batch ZE closes the Title-feature documentation coverage trio:
  1. **DOC-GAP-146** (WRITE-side — auto-grow via free-text in OwnershipServiceImpl)
  2. **DOC-GAP-283** (NEW batch ZE — READ-side endpoint + canonical page missing)
  3. **DOC-GAP-289** (NEW batch ZE — schema-level constraint absence + concurrent race + no curation affordance)
  The three findings together name the entire Title-feature documentation gap. The maintainer's most efficient doc-side fix is the coordinated authoring of the new `titles.md` page (per DOC-GAP-283) covering all three findings.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The class-tier finding STRENGTHENS the existing WRITE-side finding by naming the read-only controller surface + the Data Quality consumer + the explicit ADR-implicit decision (Title is a derived dimension that follows ownership grants, not an independently managed catalogue). No CONTRADICTS, no SUPERSEDES.

- **Severity stays MEDIUM**. The trio's coordinated doc-side fix preserves the medium severity at each individual finding; the cross-cutting design conversation (Title-as-derived-dimension vs Title-as-managed-vocabulary) is a more strategic question the maintainer raises via the proposed `/log-issue` upstream entries.
