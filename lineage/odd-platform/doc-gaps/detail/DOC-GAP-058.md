- **DOC-GAP-058**: **META-FINDING** — GitBook legacy-vs-canonical routing drift is a cross-cutting class (**now 3-sidecar triangulated after batch E: DataCollaboration + Notifications + Search**); recommend a doc-side audit of ALL legacy paths
  - **Category**: broken-url
  - **Surfaced by**:
    - `postMessageInSlack.md:docs_link_semantic.inferred_docs.[0]` (DataCollaboration legacy 404 — batch 2026-05-10A)
    - `NotificationsProperties.md:docs_link_semantic.inferred_docs.[2]` + `:doc_drift_findings.[0]` (Notifications legacy 404 — batch 2026-05-12C)
    - `search.md:docs_link_semantic.inferred_docs.[1]` (status 404; `/features/active-platform-features/search` — batch 2026-05-12E) **(NEW batch E — strengthens to 3-sidecar)**
    - Pattern referenced in concepts.yaml's batch-C cross-cutting findings comment block
    - All individual instances: DOC-GAP-011..015 + DOC-GAP-035 + DOC-GAP-056 + DOC-GAP-081
  - **Evidence**:
    - Pattern: every URL of the form `/active-platform-features/{slug}` or `/data-discovery/{slug}` or `/features/active-platform-features/{slug-that-actually-lives-under-features/data-discovery}` or `/main-concepts` 404s with a GitBook redirect-suggestion stub. The canonical paths fall under `/features/active-platform-features/{slug}` OR `/features/data-discovery/{slug}` OR `/introduction/main-concepts.md`. **Batch E adds a new sub-shape**: the search slug exists under `/features/data-discovery/search` but the natural-guess `/features/active-platform-features/search` does NOT — a cross-pillar drift (some features live under `data-discovery`, others under `active-platform-features`, the IA boundary is not obvious from feature name alone).
    - 3-sidecar triangulation across batches A, C, and E confirms the pattern is generalisable, not single-page noise. Recommend treating as a class-level concern. The cross-pillar drift (search lives in data-discovery, not active-platform-features) is worth a separate IA-decision admonition on the docs side.
  - **Proposed doc action**: Three-part class-level fix (strengthened by batch E):
    1. **Doc-side audit**: Sweep the `documentation/` repo for any internal links pointing at the legacy paths (`/active-platform-features/*`, `/data-discovery/*`, `/main-concepts`). Update to canonical paths. Verify via `git grep` in the docs repo.
    2. **External-link mitigation**: For each legacy path that's likely to surface in external blog posts / Slack discussions / GitHub README hyperlinks, add a GitBook redirect rule in `.gitbook.yaml` (GitBook supports path redirects). **Recommended set updated batch E**: alerting, genai, data-collaboration, notifications, activity-feed (all under `active-platform-features/`); attachments, directory, **search** (under `data-discovery/`); plus `/main-concepts`. The `search` redirect should cover BOTH `/active-platform-features/search` and `/features/active-platform-features/search` → `/features/data-discovery/search`.
    3. **Substrate / scanner / state-file fix**: Any sidecar / scanner / state file pointing at legacy URLs needs an update on next enrichment.
  - **Cross-references**:
    - All individual broken-url findings: DOC-GAP-011..015 + DOC-GAP-035 + DOC-GAP-056 + DOC-GAP-081
    - Concept "Notifications" + "Slack collaboration app" + "Search Session" in concepts.yaml (all have cross_file_inconsistencies entries naming this drift)
  - **Severity rationale**: MEDIUM (meta — the underlying broken-URL rubric is MEDIUM); the class is worth surfacing as a single audit-recommendation rather than 8 individual same-shape findings. Batch E's 3-sidecar strengthening materially supports the recommendation.
