# Core Packages (stub)

Shared libraries consumed across the ODD ecosystem.

## odd-models-package
- Path: `../odd-models-package`
- Purpose: Python Pydantic models generated from ODD specification
- Consumers: odd-collectors SDK, odd-great-expectations, odd-dbt, odd-airflow-2, odd-spark-adapter
- Changes here break all downstream consumers

## opendatadiscovery-specification-contracts
- Path: remote (github.com/opendatadiscovery/opendatadiscovery-specification-contracts)
- Purpose: Generated client/server code from spec (multi-language)
- Relationship: spec → code generation → contracts → consumers

## oddrn-generator
- Path: `../oddrn-generator` (if local)
- Purpose: Generate Open Data Discovery Resource Names (unique identifiers)
- Consumers: all collectors and integrations
- Pattern: `//host/path/entity/name`

## Tests
<!-- To be populated — model/contract generation tests? -->

## Dependency Chain
```
specification → odd-models-package → odd-collectors SDK → adapters
                                   → standalone integrations
             → specification-contracts → odd-platform (Java models)
```

## Related Domains
→ specification (models generated from spec)
→ collectors-sdk (primary consumer of odd-models)
→ standalone-integrations (also consume odd-models)
