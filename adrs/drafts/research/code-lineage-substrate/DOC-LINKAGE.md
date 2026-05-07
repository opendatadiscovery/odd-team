---
research: code-lineage-substrate
artifact: DOC-LINKAGE
date: 2026-05-08
mode: ecosystem
overall_confidence: HIGH
---

# DOC-LINKAGE — Joining lineage nodes to docs.opendatadiscovery.org

## Recommendations (opinionated)

1. **Stable doc identifier = the docs-relative path stem.** A page at `https://docs.opendatadiscovery.org/data-discovery/attachments` is identified by `data-discovery/attachments` (the path under `documentation/docs/`, with no `.md` extension). This matches how SUMMARY.md already references pages.

2. **Bidirectional join with two existing patterns:**
   - **Code → docs**: each lineage node carries a `documents:` field (zero or more doc-relpath strings). The extractor populates this from explicit annotations in source (see "Annotation conventions" below); the rollup surface displays it.
   - **Docs → code**: the existing `Sources:` footer convention on commits (per CLAUDE.md Gate 9 / `feedback_factual_provenance`) is the inverse — each doc claim cites its source `file:line`. The lineage substrate makes this auditable: every `Sources:` citation should resolve to a node ID.

3. **Borrow Backstage TechDocs's annotation pattern, inverted.** TechDocs uses `backstage.io/techdocs-ref: dir:.` in `catalog-info.yaml` to point an entity at its docs folder ([Backstage TechDocs setup](https://backstage.io/docs/features/techdocs/creating-and-publishing/)). We invert: each code symbol can declare a `@docs` annotation (Java) / `// @docs:` comment (TS) / docstring tag (Python) listing the doc page(s) it underlies.

4. **SUMMARY.md is the validator, not the source.** The extractor doesn't *generate* doc paths — it *validates* claimed paths against `documentation/docs/SUMMARY.md`. A `documents:` field pointing at a path not in SUMMARY is itself a finding (broken link).

Confidence: **HIGH** — consistent with workspace's existing `Sources:` discipline, adapted from production-tested Backstage pattern.

## Stable identifier — concrete shape

Looking at `documentation/docs/SUMMARY.md` (line numbers in this workspace's local checkout):

```markdown
* [Data Discovery](data-discovery.md)
  * [Catalog Overview page](data-discovery/catalog-overview.md)
  * [Directory](data-discovery/directory.md)
  ...
```

The path under `docs/` (without `.md`) is the URL slug:

| SUMMARY entry | doc-relpath stem | Live URL |
|---|---|---|
| `data-discovery.md` | `data-discovery` | `https://docs.opendatadiscovery.org/features/data-discovery` |
| `data-discovery/attachments.md` | `data-discovery/attachments` | `https://docs.opendatadiscovery.org/features/data-discovery/data-entity-attachments` |
| `integrations/collectors/odd-collector-aws.md` | `integrations/collectors/odd-collector-aws` | `https://docs.opendatadiscovery.org/integrations/odd-collector-aws` |
| `developer-guides/api-reference/alerts.md` | `developer-guides/api-reference/alerts` | `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` |

**Note**: GitBook's published URL slug isn't always identical to the SUMMARY filename — there's a slug-rewrite layer (e.g., `attachments.md` → `data-entity-attachments` in URL). The extractor stores the **filename-stem path** (auditable, stable across GitBook config changes); a small build step resolves to the live URL when needed for `Gate 8 — Live-Site Verification`.

Anchor-level addressing: `data-discovery/attachments#configuration` for sub-section linkage. Optional, only used when a single page documents multiple symbols.

## Annotation conventions (per language)

### Java

```java
/**
 * Configures the MinIO client for attachment storage.
 *
 * @docs configuration-and-deployment/odd-platform#attachments
 * @docs configuration-and-deployment/odd-platform#s3-compatible-storage
 */
@Configuration
public class MinioConfig {
    @Bean
    @Docs("configuration-and-deployment/odd-platform#attachments")
    public MinioAsyncClient minioClient(...) { ... }
}
```

Two equivalent styles:
- Javadoc `@docs` tag — preferred for class-level (no runtime cost)
- `@Docs("...")` annotation — for method/field-level when granularity matters; defined once in a tiny `@interface Docs { String[] value(); }` annotation under the workspace's shared annotations module (or a no-op marker — extractor reads the value but Spring ignores it).

### TypeScript

```ts
// @docs: features/data-discovery/search#advanced-search
// @docs: developer-guides/api-reference/glossary
import { ... } from '...';

/** @docs features/data-discovery/search */
export const SearchView = () => { ... };
```

JSDoc `@docs` tag (preferred for exports) or line-comment `// @docs:` directive (preferred for module-level imports/bootstraps).

### Python

```python
class SnowflakeAdapter:
    """
    Snowflake collector adapter.

    @docs: integrations/odd-collector-aws#snowflake
    """
```

Docstring tag `@docs:` parsed by tree-sitter query.

### YAML / config

```yaml
# @docs: configuration-and-deployment/odd-platform#genai
genai:
  enabled: false
  url: ...
```

Comment-line directive immediately above the prefix declaration.

## Why not auto-derive doc paths from code structure?

Considered and rejected. Two failure modes:

1. **Naming drift**: `MinioConfig.java` documents *attachment storage* (the user-facing concept), not *MinIO* (an SDK detail). Auto-derivation by name produces wrong doc paths.
2. **Multi-page features**: `i18n.ts` underlies a single feature that should appear under `configuration-and-deployment/` (operator config) AND `developer-guides/` (contributor extension). One source symbol → multiple docs is the norm, not the exception. Auto-derivation forces 1:1 mapping.

The annotation approach is **declarative**: maintainers state the binding; the extractor only validates and surfaces it.

## Bootstrap problem — what about existing code without annotations?

Real concern: today, no source file has `@docs` annotations. A naive lineage build would report **everything** as undocumented.

Mitigation, two-phase:

**Phase 0 (one-shot, before MVP scanners run):** Seed `documents:` annotations from the existing handful of `Sources:` footers + the existing `navigation/domains/*.md` pointer files. The handful of features already documented should get their annotations in a single sweep PR. Probably 50-100 annotations across the platform.

**Phase MVP onward:** New code requires a `@docs` annotation if it introduces a documented feature; the lineage substrate's `undocumented-features` query becomes "every node with no `documents:` field AND kind in {route, controller, ui-shell-*, spring-bean-factory, ...}."

## Validation rules

The extractor validates `@docs` claims at build time:

| Check | Behavior |
|---|---|
| Claimed doc-relpath does not exist in SUMMARY.md | Lineage node carries `doc_validation: broken-link`, surfaces in `gates.md` Gate 7 (layout) |
| Claimed anchor does not exist on the resolved page | `doc_validation: broken-anchor`, lower severity (warning) |
| Multiple symbols claim the same doc-relpath without anchors | `doc_validation: ambiguous-binding`, surface in `duplication-sweep` |
| A doc page in SUMMARY.md has zero `documents:` claims pointing at it | Logged as candidate orphan in `rollups/orphan-docs.md` (low confidence — page may be conceptual without a single code anchor) |

## How this powers existing scanners

- **`undocumented-features`**: `SELECT * FROM nodes WHERE documents IS NULL AND kind IN (...)` — was the i18n miss; now structurally caught.
- **`integration-docs`**: every `collector-adapter` node should have `documents: integrations/...`. Missing ones are findings.
- **`feature-behavior`**: every `controller-method` node's `documents:` page should be live-fetched and the doc claims diffed against the method's annotations / OpenAPI metadata.
- **`integration-caveats`**: every `spring-bean-factory` of kind SDK-builder must declare a `documents:` pointing at a configuration page. The doc page must contain admonition blocks for each `sdk_builder_params_unset` entry on the node.
- **`missing-limitations`**: every `controller-method` whose code body contains catch-blocks must document those limits in its `documents:` page.

Each of these is a **lineage query**, not a fresh enumeration. That is the substrate's whole point.

## Sources

- [Backstage TechDocs creating and publishing](https://backstage.io/docs/features/techdocs/creating-and-publishing/)
- [Backstage TechDocs FAQ](https://backstage.io/docs/features/techdocs/faqs/)
- [OpenAPI externalDocs object](https://idratherbewriting.com/learnapidoc/pubapis_openapi_step8_externaldocs_object.html)
- [docs-as-code best practices 2025/2026](https://www.augmentcode.com/learn/auto-document-your-code-tools-and-best-practices)
- Local: `documentation/docs/SUMMARY.md` (read 2026-05-08)
- Local: `CLAUDE.md` Gate 9 — `Sources:` footer discipline
