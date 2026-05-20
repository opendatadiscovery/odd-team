- **DOC-GAP-081**: Legacy URL `/features/active-platform-features/search` returns 404 — canonical at `/features/data-discovery/search`; 3rd corroborating instance of the legacy-vs-canonical routing-drift cross-cutting pattern (strengthens DOC-GAP-058 META from 2-sidecar to 3-sidecar)
  - **Category**: broken-url
  - **Surfaced by**:
    - `odd-platform__java__SearchController__controller-method__search.md:docs_link_semantic.inferred_docs.[1]` (status 404 verified this session) **(NEW batch E)**
    - `concepts.yaml:entities[Search Session]`
  - **Evidence**:
    - WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/search` 2026-05-12 status 404 — H1 "Page Not Found"; suggests redirect via documentation navigation.
    - WebFetch `https://docs.opendatadiscovery.org/features/data-discovery/search` 2026-05-12 status 200 — canonical search page renders normally.
    - This is the third instance of the same shape — `/features/active-platform-features/{slug}` 404 with `/features/data-discovery/{slug}` 200 — joining `/active-platform-features/data-collaboration` (batch A; DOC-GAP-035) and `/active-platform-features/notifications` (batch C; DOC-GAP-056). The 2-sidecar pattern in DOC-GAP-058 META is now 3-sidecar; the recommendation for a doc-side audit of ALL legacy paths is strengthened.
  - **Proposed doc action**: Same as DOC-GAP-011 / DOC-GAP-035 / DOC-GAP-056 — included in the doc-side sweep recommended by DOC-GAP-058 META. Add a GitBook redirect rule (`.gitbook.yaml`) for `/features/active-platform-features/search` → `/features/data-discovery/search` since the slug "search" is high-traffic and likely linked from external blog posts / Slack discussions.
  - **Cross-references**:
    - DOC-GAP-035 (data-collaboration legacy 404) + DOC-GAP-056 (notifications legacy 404) — sibling instances
    - DOC-GAP-058 (META — GitBook legacy-vs-canonical routing drift class; THIS finding strengthens to 3-sidecar)
    - DOC-GAP-079 (search WHO/visibility — adjacent gap on the canonical page)
  - **Severity rationale**: MEDIUM — broken-URL rubric. The third 3rd-corroborating instance materially strengthens the meta-finding case for a single doc-side audit of all legacy paths.

#### Batch 2026-05-13-G new MEDIUM findings (DOC-GAP-100..102)
