---
id: docs/quality/outbound-urls
target_repo: documentation (local: ../documentation)
scope: Outbound URL audit — verifies every external URL in docs/ resolves cleanly and matches the canonical Source-of-Truth (Gate 9). Catches mistargeted ODD-org URLs, stale third-party docs links, and version-pinned URLs that have drifted past their pin.
estimated_items: bounded by the count of .md files under docs/ (~80 today)
chunking: Process one folder per run when the file count is large, OR one URL class per run (ODD-org / self-links / third-party docs)
depends_on: []
priority: high
---

## Purpose

Outbound URLs that look right at authoring time can rot in three ways:

1. **Mistargeted org URL** — an integration is documented as living in repo X when it actually lives in repo Y. The 2026-04-23 DOC-027 incident shipped `github.com/opendatadiscovery/odd-collectors/tree/main/odd-dbt` for a push adapter that lives at `github.com/opendatadiscovery/odd-dbt`. Both URLs resolve, both render, but only one is the canonical home — so an operator clicking through landed inside the wrong monorepo.
2. **Stale or moved third-party docs** — a vendor reorganises their docs and the old URL 404s, or 301-redirects somewhere unexpected. Build-time markdown rendering does not validate target reachability.
3. **Commit-pinned URL drift** — `blob/{40-hex-commit}/...` URLs freeze the linked content at a moment that the surrounding prose has long since outgrown. The 2026-04-30 audit caught a Features.md figure pinned to a commit far behind `main`.

This scanner is the systemic catch. Gate 9 (Factual Claim Provenance) catches new URLs at authoring time; this scanner catches *existing* URLs that have rotted between authoring and now.

## MANDATORY pre-scan step

```bash
git -C ../documentation fetch origin main
git -C ../documentation checkout origin/main
```

Same rationale as every docs scan — GitBook commits land on main, local branches lag.

## Inputs

- `navigation/architecture.md` — the canonical repo + integration-pattern map (Gate 9 SoT for any `github.com/opendatadiscovery/*` claim).
- `navigation/repos.yaml` — the mechanical companion (paths, tech stacks).
- `docs/main-concepts.md` Terms & Aliases table — source of truth for terminology that should match link text near a URL.
- Every `.md` file under `docs/`.

## Method

1. **Inventory.** Run four greps over the working tree:
   - `grep -rEn "https?://github\.com/opendatadiscovery/" docs/ --include="*.md"` — ODD-org URLs.
   - `grep -rEn "https?://github\.com/[a-z0-9-]+/[a-z0-9._-]+" docs/ --include="*.md"` then exclude the previous bucket — third-party org URLs called out as integrations (capitalone/DataProfiler, etc.).
   - `grep -rEn "https?://docs\.opendatadiscovery\.org/" docs/ --include="*.md"` — self-links to the published doc site.
   - `grep -rEn "https?://(docs\.snowflake|dbt\.com|greatexpectations\.io|airflow\.apache\.org|prometheus\.io|jdbc\.postgresql\.org|api\.slack\.com|learn\.microsoft\.com|google\.aip\.dev|spark\.apache\.org|helm\.sh|kubernetes\.io|aws\.amazon\.com|.*\.aws\.amazon\.com|google\.com|googleapis\.com)/" docs/ --include="*.md"` — third-party docs URLs.

2. **Resolve every ODD-org URL against `navigation/architecture.md`.** For each unique `github.com/opendatadiscovery/*` URL extracted in step 1:
   - Find the canonical row in the architecture.md "Canonical Repo Table" that matches the repo segment of the URL.
   - Compare the URL's repo path char-for-char with the row's "Canonical URL". A non-canonical prefix (e.g., `odd-collectors/tree/main/odd-dbt` for the standalone `odd-dbt` repo) is a **mismatch finding**.
   - For tree- or blob-deep links: confirm the deep path ends in the canonical repo. `github.com/opendatadiscovery/odd-collectors/tree/main/odd-collector-aws` is fine (sub-path of the monorepo); `github.com/opendatadiscovery/odd-collectors/tree/main/odd-dbt` is not (odd-dbt is a standalone repo).
   - For repo names not present in architecture.md but visible in `navigation/repos.yaml` or `navigation/features.yaml` — that is a **navigation gap**: the architecture canonical table is incomplete. Log the gap; do not let the scanner treat it as a fix-this-page finding.
   - For repo names not present in either — that is a **dead/unknown URL finding**: the surrounding prose is referring to something that no SoT corroborates.

3. **Confirm every ODD-org URL resolves.** WebFetch each unique URL (one fetch per URL, not per occurrence). For ones that 404 → **dead URL finding**. For ones that 301-redirect to a different path → confirm the new path is still in the same canonical repo; if it's moved to a different repo, that's a **mismatch finding**.

4. **Sweep commit-pinned URLs.** Match `https://github\.com/[^/]+/[^/]+/blob/[0-9a-f]{7,40}/` — anything pinned to a commit hash. For each:
   - If the surrounding prose names a specific version (release notes, migration guide), the pin is intentional → keep.
   - Otherwise → **stale-pin finding**: the link should track `blob/main/`. The 2026-04-30 Features.md case (filtering example pinned to a year-old commit) is the canonical example.

5. **Sweep version-tagged URLs.** Same idea for `https://github\.com/[^/]+/[^/]+/(blob|tree)/v\d+\.\d+`. These are usually intentional (a guide tied to a specific release) — flag only if the surrounding prose disagrees with the tagged version.

6. **Confirm self-links.** For each `https://docs.opendatadiscovery.org/{slug}` URL:
   - GitBook generates slugs from `SUMMARY.md` hierarchy. The path should match the slug an editor would compute by following the `SUMMARY.md` chain to the target page.
   - WebFetch the URL. A 404 plus a "page not found" body is a **dead self-link finding**.
   - Note the GitBook routing artefact: pages nested under a section header named the same as the page itself produce doubled prefixes (`/integrations/integrations/<page>` for the Integrations hub). The scanner should treat the doubled-prefix form as canonical when SUMMARY puts the page that way; do not flag it as a typo.

7. **Confirm third-party docs URLs.** WebFetch each unique URL once. For each:
   - 200 OK → keep.
   - 404 / 301 to root / removed page → **dead 3p URL finding**. Recommend the new canonical page (search the vendor's site).
   - For the small set of well-known canonical references (`spark.apache.org/...SparkListener.html`, `google.aip.dev/auth/4110`, `learn.microsoft.com/.../azure-identity/...`) the scanner can short-circuit on the first known-good fetch and skip subsequent runs unless the URL changes.

8. **Cross-check link text against canonical vocabulary.** For each ODD-org URL whose surrounding text uses a term from `main-concepts.md` Terms & Aliases:
   - The term in the prose should be the canonical name or an alias listed in the table.
   - A repo that is a **push adapter** (per architecture.md Pattern column) introduced as "the X collector" is a **terminology drift finding** — push adapters are not collectors.
   - A repo that is a **collector** (per architecture.md Pattern column) introduced as "an adapter" is a **terminology drift finding** — adapters are components inside collectors, not deployment units.

## Criteria for a Finding

- **Mismatch finding** (step 2) — the URL points at a repo or path that is not the canonical home for the named integration / artifact.
- **Dead URL finding** (step 3 / step 6 / step 7) — WebFetch returns 404 (or a redirect to a non-canonical destination).
- **Navigation gap** (step 2) — repo cited but missing from `navigation/architecture.md` canonical table.
- **Stale-pin finding** (step 4) — `blob/<hash>/` URL with no version-tied surrounding prose.
- **Terminology drift finding** (step 8) — link text uses non-canonical vocabulary that contradicts the architecture.md Pattern column.

## Severity Guidance

- **High** — mismatch findings against ODD-org repos (an operator clicks through to the wrong place), and dead URLs on operator-critical pages (Configure ODD Platform, Deployment Options, Enable security).
- **Medium** — stale pins, terminology drift, dead third-party docs URLs on developer guides.
- **Low** — navigation gaps (the URL is correct, the architecture map needs a row), redirect-but-still-resolves cases.

## Output

Write to: `findings/docs-quality-outbound-urls/YYYY-MM-DD.md`

Per finding:

```
### F-NNN: {one-line summary}
- **Page**: docs/path/page.md, line N
- **URL**: {full URL}
- **Class**: mismatch | dead | navigation-gap | stale-pin | terminology-drift
- **Architecture row**: {row in navigation/architecture.md} (or "missing" for navigation-gap)
- **Verification method**: WebFetch | gh repo view | architecture.md lookup | grep
- **Verification result**: {what was returned / what was expected}
- **Severity**: high | medium | low
- **Recommended action**: {edit suggestion — be specific about the new URL or new prose}
```

## Coverage manifest

`state/coverage/docs-quality-outbound-urls.yaml` enumerates one item per `.md` file under `docs/`. Each item records the URL inventory at last scan plus the URLs verified-clean. Re-run when:

- A new `.md` file lands under `docs/`.
- An item touched the architecture.md canonical table (the SoT moved).
- More than ~30 days have elapsed (third-party docs reorganise on a quarterly cadence).

## Relationship to Other Scanners

- `docs/quality/duplication` reads link text near canonical-term mentions; this scanner reads URL targets. Complementary — duplication catches "X is mentioned without a link", outbound-urls catches "X is linked but the link is wrong".
- `docs/accuracy/feature-behavior` reads code; this scanner reads URLs. Independent.
- Gate 9 in `CLAUDE.md` covers new URLs at authoring time; this scanner covers existing URLs that may have rotted. Together they keep outbound URL claims honest both forward and backward in time.

## How this scanner's output feeds `/implement`

Mismatch and dead-URL findings should be triaged as DOC items immediately — they are operator-visible defects. Navigation gaps should be triaged as `navigation/architecture.md` updates plus, optionally, a `navigation/repos.yaml` entry. Stale-pin and terminology-drift findings can batch into a single hygiene PR per scan unless the count is small (<5), in which case they can ride along with the next adjacent docs PR.
