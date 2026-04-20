# ODD Specification (stub)

The Open Data Discovery data model, Ingress API contract, and ODDRN format specification.

## Code Entry Points
- Specification root: `opendatadiscovery-specification/specification/`
- Changelog: `opendatadiscovery-specification/CHANGELOG.md`

## Key Concepts
- DataEntity: base metadata unit (dataset, transformer, consumer, quality test, group)
- DataEntityList: batch ingestion payload
- ODDRN: Open Data Discovery Resource Name — unique identifier format
- DataSource: registered origin of metadata

## Consumers of This Spec
- odd-platform Ingress API (implements the server side)
- odd-collectors SDK (implements the client side)
- odd-models Python package (generated from spec)

## Tests
<!-- Spec validation tests to be identified -->

## Documentation
<!-- Gitbook reference to spec to be verified -->

## Related Domains
→ ingestion (spec defines the Ingress API contract)
→ collectors-sdk (SDK implements spec client-side)
→ data-entities (spec defines entity types)
