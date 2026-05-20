- **DOC-GAP-245**: `odd-platform-specification/openapi.yaml:2-9` declares `info.title: ProspectLog data catalog HTTP API contract` AND `info.contact.email: ndementev@provectus.com` AND `info.contact.url: https://provectus.com` AND `info.contact.name: Provectus` — the title is a LEGACY PROJECT NAME (ProspectLog is an internal/early name predating the ODD rename to Open Data Discovery); the contact ties to Provectus (ODD's origin company) and an individual external contributor's email; the spec is publicly served under `{platform-base-url}/api/v3/api-docs` by every running platform deployment per live api-reference doc (WebFetched 2026-05-20 status 200 — verbatim "The Swagger UI hosted on every running ODD Platform"); under `auth.type=DISABLED` (the documented default per system-mission.md P-09) the Swagger UI is reachable WITHOUT authentication — operators interacting with the Swagger UI see the title "ProspectLog data catalog HTTP API contract" which does NOT match the project's public branding "Open Data Discovery"; the individual contact email is exposed to any caller able to reach the Swagger UI URL (arguably PII exposure under DISABLED) AND the legacy title creates operator confusion ("is this the ODD platform or a different product?"); additionally `openapi.yaml:10-12` declares `servers: - url: 'http://localhost' description: stub` — the spec's `servers:` field is a programmatic discovery surface ('the API is hosted at X'); declaring `http://localhost` is a development-time placeholder that has never been updated for live deployments; SDK generators using the spec's `servers:` value would target localhost (LOW; NEW batch Z — odd-platform-public-api openapi-spec PRIMARY SOURCE; cosmetic + minor PII exposure)
  - **Category**: drift (legacy branding + minor PII exposure on a publicly-served surface + outdated programmatic-discovery field)
  - **Surfaced by**:
    - `odd-platform__openapi__spec__odd-platform-public-api.md:bugs_limitations_corner_cases.[8]` (LOW per sidecar — "`info.title: ProspectLog data catalog HTTP API contract` is a legacy project name — line 3 declares the title as 'ProspectLog' (an internal/early name); `info.contact.url: https://provectus.com` ties to Provectus, ODD's origin company. The spec is publicly served under `{platform-base-url}/api/v3/api-docs` — operators interacting with the Swagger UI see the title 'ProspectLog data catalog HTTP API contract' which does not match the project's public branding 'Open Data Discovery'.") **(NEW batch Z — openapi-spec PRIMARY SOURCE)**
    - `odd-platform__openapi__spec__odd-platform-public-api.md:bugs_limitations_corner_cases.[9]` (LOW per sidecar — "`servers:` is a stub — `openapi.yaml:10-12` declares `servers: - url: 'http://localhost' description: stub`. The spec's `servers:` field is meant to be a programmatic discovery surface ('the API is hosted at X'); declaring `http://localhost` is a development-time placeholder, never updated for live deployments. SDK generators using the spec'd `servers:` value would target localhost.")
    - `odd-platform__openapi__spec__odd-platform-public-api.md:security.data_exposure.[2]` (per sidecar — "`info.contact.email: ndementev@provectus.com` (`openapi.yaml:5-9`) → exposed via the Swagger UI to any caller that can reach `/api/v3/api-docs`. Direct individual email contact for an external contributor; arguably PII exposure if the spec is reachable by unauthenticated traffic under `auth.type=DISABLED` mode (default per docs)")
    - `concepts.yaml:entities[odd-platform-public-api]` + `:invariants[legacy-prospectlog-branding-in-spec]`
  - **Evidence**:
    - `openapi.yaml:2-9` (per sidecar primary source — the `info` block) — verbatim:
      ```yaml
      info:
        title: ProspectLog data catalog HTTP API contract
        version: ...
        contact:
          name: Provectus
          url: https://provectus.com
          email: ndementev@provectus.com
      ```
    - `openapi.yaml:10-12` (per sidecar primary source — the `servers` block) — verbatim:
      ```yaml
      servers:
        - url: 'http://localhost'
          description: stub
      ```
    - WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference` (per sidecar inherited 2026-05-20 status 200): verbatim "The Swagger UI hosted on every running ODD Platform" — confirms the spec is publicly served at `{platform-base-url}/api/v3/api-docs`.
    - **The operator's first-impression surface**: an operator opening the Swagger UI sees the title "ProspectLog data catalog HTTP API contract" (the page's `<title>` tag and the in-page H1 header) and the contact "Provectus / https://provectus.com / ndementev@provectus.com". The cognitive load: "Is this the ODD platform or a Provectus product called ProspectLog? Should I email this individual or use the GitHub repo?" An operator unfamiliar with the project's history may infer the product is in flux or that ODD is a Provectus-internal tool, NOT an open-source project.
    - **The legacy-name discovery surface**: the `ProspectLog` name appears nowhere else in the public ODD documentation, GitHub README, npm package names, Docker image names, etc. The spec is the ONLY operator-visible artefact carrying the legacy name. Operators discovering the legacy name in the Swagger UI cannot reconcile it with the project's public branding without research.
    - **The contact-email PII surface**: the `info.contact.email` is an individual contributor's personal/professional email. Under `auth.type=DISABLED`, the Swagger UI is reachable unauthenticated; any HTTP caller can scrape the email. The exposure surface is bounded (one email per ODD deployment) but accumulating: every operator running an ODD instance with the default config exposes the email at `{platform-base-url}/api/v3/api-docs`. The doc-side fix is to replace with an organisational contact (e.g. `info@opendatadiscovery.org`, the public GitHub issue tracker URL, or the project's public mailing list).
    - **The servers-stub impact**: SDK generators consuming the spec's `servers:` field target `http://localhost` by default. The impact is minor (most SDK generators allow overriding the base URL at runtime), but for operators using the spec as a contract-discovery surface (e.g. integrating against multiple ODD deployments), the `servers:` field SHOULD enumerate the canonical platform URLs (e.g. the demo deployment, the docs site's interactive playground). The current `stub` placeholder communicates "not maintained" — which IS the case but should not be the case for a published spec.
    - **The composition with DOC-GAP-242**: the spec's `info.contact.email` exposure is one of the higher-fidelity reconnaissance signals an attacker can scrape from the publicly-served Swagger UI; the absence of `securitySchemes` (DOC-GAP-242) means the entire API surface is enumerable; together they form a recon-friendly attack surface under `auth.type=DISABLED`.
  - **Proposed doc action**: **Two-part action — spec-side primary (rename + contact + servers) + doc-side companion (no doc-side action needed — the fix is upstream in the spec repo)**.
    1. **Spec-side PRIMARY — `odd-platform-specification/openapi.yaml` (or the upstream `opendatadiscovery-specification` repo per the dual-spec architecture)** — three sub-edits:
       a. **Rename `info.title`** from `ProspectLog data catalog HTTP API contract` to `Open Data Discovery Platform HTTP API`. Matches the project's public branding and removes operator confusion.
       b. **Replace `info.contact`** with organisational contact:
          ```yaml
          contact:
            name: Open Data Discovery
            url: https://github.com/opendatadiscovery/odd-platform
          ```
          Drop the individual `email` field. Operators wanting to contact the project use the GitHub issue tracker — which is the project's actual support surface. Closes the PII exposure.
       c. **Update `servers:`** to enumerate the canonical platform URLs OR remove the stub entirely:
          ```yaml
          servers:
            - url: '{protocol}://{host}/api'
              description: ODD Platform deployment
              variables:
                protocol:
                  default: https
                  enum: [https, http]
                host:
                  default: localhost:8080
          ```
          This communicates "this is the runtime URL pattern" and lets SDK consumers parameterise it.
    2. **Doc-side COMPANION — `documentation/docs/developer-guides/api-reference.md`** (the hub page): NO change required. The fix lives upstream in the spec repo. Once the spec rename ships, the Swagger UI's title and contact display update automatically.
  - **Cross-references**:
    - **DOC-GAP-242** (NEW batch Z — no securitySchemes in spec) — sibling spec-authoring-quality finding; together they bound the spec's operator-visible surface improvements.
    - **DOC-GAP-244** (NEW batch Z — 9-vs-35 tag coverage gap) — sibling api-reference hub gap; the spec's title affects the api-reference hub's perceived legitimacy.
    - **DOC-GAP-099 META** (OpenAPI authoring-quality cluster) — adjacent finding in the cluster; not a "failure shape" per se but an authoring-cleanup item.
    - **The 26-tag api-reference gap (DOC-GAP-244 NEW)** — the SAME upstream spec is the source of the operator-visible surface; the bigger fix is the coverage gap, but the title/contact/servers cleanup is a 5-line PR.
  - **Severity rationale**: LOW — the gaps are cosmetic + minor PII + outdated programmatic-discovery field. None are operationally load-bearing. The fix is a 5-line PR in the upstream spec repo. The reason this is filed as a DOC-GAP at all (rather than ignored) is the audit framing: every operator-visible artefact on the platform's published surface should match the project's current branding; legacy names create operator-confusion and erode trust. The PII exposure under DISABLED is bounded but accumulating; replacing with an organisational contact is the standard practice. The servers-stub is a minor SDK-generation hint that should be updated for consistency.
