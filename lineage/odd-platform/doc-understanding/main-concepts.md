---
doc_page: "docs/main-concepts.md"
page_title: "Main Concepts"
live_url: "https://docs.opendatadiscovery.org/introduction/main-concepts"
live_url_verified_status: "200"
live_url_resolved_slug: "introduction/main-concepts"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data Entity"
    - "ODDRN"
    - "Collector"
    - "Collector Token"
    - "GenAI Assistant"
    - "Directory"
    - "Tag"
  features: []
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (`## ODDRN`) frames ODDRN purely as a producer-side identity string powering the Ingestion API; it omits that on the consumer side ODDRN is the parse-and-group key whose UNPARSEABLE case has user-visible fallout — sources whose ODDRN cannot be parsed bucket under `Other`/UNKNOWN_DATASOURCE_TYPE in Directory, and `entity_oddrn` is trusted verbatim as the routing key for AlertManager webhooks. The vocabulary definition is correct but the operator-visible failure mode of a malformed ODDRN is undocumented. Evidence: entitie:oddrn (concepts/detail/entities/oddrn.yaml); entitie:directory `concept` (DirectoryController sidecar — ODDRN prefix is the grouping key, Other/UNKNOWN_DATASOURCE_TYPE bucket); invariant:entity-oddrn-trust-from-alertmanager-webhook."
  - "Page (`## The architecture chain`) describes Collector authentication only implicitly (`Platform-API client`); it never states that the collector→platform leg is a 40-char plaintext shared-secret bearer token compared by literal `.equals(...)`, rotated as an in-place UPDATE with NO overlap window (rotating a token instantly breaks the running collector until reconfigured). This is operator-critical deployment knowledge absent from the canonical vocabulary. Evidence: entitie:collector and entitie:collector-token (concepts/detail/entities/collector-token.yaml — plaintext in TOKEN table, literal .equals, in-place rotation, no overlap window)."
  - "Page (`## AI aspects` → GenAI assistant) lists the GenAI config surface narratively but the canonical concept records a config-key naming hazard: `genai.request_timeout` is baked into genAiWebClient at startup and actually governs the RESPONSE timeout, not request timeout — an operator copy-pasting the documented key may set the wrong dimension. Evidence: entitie:genai-assistant (concepts/detail/entities/genai-assistant.yaml); invariant:genai-request-timeout-yaml-key-actually-response-timeout."
maintainer_curated: false
---

# Main Concepts — doc understanding

This is the **canonical-vocabulary page** for the ODD project — the map that defines the core nouns (`Data source`, `Adapter`, `Plugin`, `Collector`, `Push adapter`, `ODD Platform`, `ODDRN`, `ODD Specification`) and the eight Data Governance pillars, with each term linking to its canonical deep-dive. It is the page `concepts.yaml` is explicitly anchored on (`canonical_vocabulary_source`), and several concept nodes name it verbatim as their canonical home: `entitie:oddrn` (`main-concepts.md ## ODDRN is the canonical home`), `entitie:genai-assistant` (`main-concepts.md ## AI aspects`), `entitie:directory` (`Data Discovery` pillar names Directory), and `Data Entity` (`canonical_in_docs: true` in `concepts.yaml`).

Of the terms the page defines, seven map to odd-platform concept nodes confirmed via `graph-node`: **Data Entity** (the platform's unit of metadata, addressable by ODDRN — controller `DataEntityController`), **ODDRN** (`entitie:oddrn`), **Collector** (`entitie:collector`), **Collector Token** (`entitie:collector-token`), **GenAI Assistant** (`entitie:genai-assistant`), **Directory** (`entitie:directory`, the four-level browse hierarchy), and **Tag** (`entitie:tag`). The remaining architecture-chain vocabulary the page introduces — `Adapter`, `Pull adapter`, `Push adapter`, `Plugin`, `Data source`, `ODD Platform`, `ODD Specification` — has **no concept entry in odd-platform's catalog** by design: these are collector-side / spec-repo concepts (their implementation lives in `odd-collectors` and `opendatadiscovery-specification`, not in the platform server this catalog is built from). That absence is honest coverage scope, not drift.

No features (`F-NNN`) and no code nodes are bound: this is a definitional map, not a feature or implementation page. The two nearest Feature vector-neighbours (F-054 microservices lineage, F-123 deletion semantics) are unrelated to what the page documents and were rejected per the no-padding rule.

The drift findings above are not factual errors in the vocabulary — the definitions are accurate. They are the LSN-001/LSN-002-class pattern: the canonical page gives the correct mental model but omits the operator-critical consumer-side caveat the code makes load-bearing (malformed-ODDRN bucketing + AlertManager trust; plaintext no-overlap collector-token rotation; the `genai.request_timeout`-is-really-response-timeout key naming). Each is a DOC-NNN candidate for `doc-gaps.md`.

## Maintainer notes
