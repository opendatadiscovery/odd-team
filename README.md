# ODD Team

A team of AI maintainers for the [Open Data Discovery](https://github.com/opendatadiscovery) project.

## Mission

1. **Maintain** documentation, codebase, and tests in a traceable, maintainable, useful way
2. **Implement** change requests from users — including complexity analysis, dependency mapping, and prioritization
3. **Answer** questions about features, implementations, and deployment options

## Current Phase: Audit & Gap-Closing

Before the team can maintain and extend the project, it needs a solid foundation: accurate docs, adequate test coverage, navigable code, and correct specifications. The current focus is systematically closing these gaps across all ODD repositories.

### Workflow

```
/scan <scanner>       → discover gaps, write findings, enrich navigation index
/triage <findings>    → convert to reviewable work items
[human reviews]       → approve/reprioritize backlog
/implement <item-id>  → execute change, atomic commit in target repo
/review <item-id>     → verify acceptance criteria
```

## Architecture

```
navigation/        Feature-to-code pointer maps (token-efficient, prevents redundant scanning)
scanners/          Audit definitions (docs, tests, navigation, spec)
findings/          Raw audit output (timestamped per scanner)
backlog/           Triaged work items (DOC/TST/NAV/SPC)
state/             Progress dashboard, file registry, decisions
agents/            Reusable role prompts
.claude/skills/    Slash commands for each workflow step
```

### Navigation Index

The codebase is large — multiple repos, hundreds of files per feature. The navigation index (`navigation/`) provides token-efficient pointer maps so any AI session can find relevant code in O(1) reads without scanning entire repositories. This is the foundation that makes all other capabilities sustainable.

### Skills (Slash Commands)

| Command | Purpose |
|---------|---------|
| `/orient` | New session briefing — state and recommended next action |
| `/enumerate <scanner>` | List ALL items in a scanner's scope (generates coverage manifest) |
| `/scan <scanner>` | Scan next unscanned batch from coverage manifest |
| `/coverage [scanner]` | Show what's been analyzed vs. what remains |
| `/triage <findings>` | Convert findings to work items |
| `/implement <id>` | Execute an approved work item |
| `/review <id>` | Verify completed work |
| `/status` | Progress dashboard |
| `/navigate <feature>` | Find where a feature lives in code |

## Target Repositories

### Core
| Repo | Purpose |
|------|---------|
| [odd-platform](https://github.com/opendatadiscovery/odd-platform) | Data discovery platform (Java/Spring Boot + React) |
| [odd-collectors](https://github.com/opendatadiscovery/odd-collectors) | Metadata extraction adapters (Python, 40+) |
| [opendatadiscovery-specification](https://github.com/opendatadiscovery/opendatadiscovery-specification) | ODD data model and Ingress API spec |
| [odd-models-package](https://github.com/opendatadiscovery/odd-models-package) | Generated Python models from spec |
| [opendatadiscovery-specification-contracts](https://github.com/opendatadiscovery/opendatadiscovery-specification-contracts) | Generated code contracts from spec |

### Standalone Integrations
| Repo | Purpose |
|------|---------|
| [odd-great-expectations](https://github.com/opendatadiscovery/odd-great-expectations) | Great Expectations plugin — pushes quality results |
| [odd-dbt](https://github.com/opendatadiscovery/odd-dbt) | dbt plugin — pushes model/test/lineage metadata |
| [odd-spark-adapter](https://github.com/opendatadiscovery/odd-spark-adapter) | Spark listener — captures job lineage |
| [odd-airflow-2](https://github.com/opendatadiscovery/odd-airflow-2) | Airflow plugin — reports DAG/task metadata |
| [odd-collector-profiler](https://github.com/opendatadiscovery/odd-collector-profiler) | Data profiling collector |

### Deployment, Tooling, Docs
| Repo | Purpose |
|------|---------|
| [charts](https://github.com/opendatadiscovery/charts) | Helm charts for Kubernetes deployment |
| [odd-cli](https://github.com/opendatadiscovery/odd-cli) | CLI for interacting with ODD Platform |
| [odd-examples](https://github.com/opendatadiscovery/odd-examples) | Usage examples and reference deployments |
| [odd-docs](https://github.com/opendatadiscovery/odd-docs) | Gitbook documentation |
| [opendatadiscovery-integration-manifests](https://github.com/opendatadiscovery/opendatadiscovery-integration-manifests) | Registry of supported integrations |

## Roadmap

### Phase 1: Foundation (current)
- Audit documentation accuracy, completeness, coverage
- Audit test coverage across platform and collectors
- Build navigation index for all feature domains
- Verify specification alignment
- Close all identified gaps

### Phase 2: Change Request Implementation
- Accept change requests as GitHub Issues
- Perform complexity and dependency analysis
- Break down into implementable tasks with prioritization
- Execute with full traceability (Issue → PR → commit)

### Phase 3: Knowledge & Support
- Answer user questions about features and architecture
- Provide deployment guidance
- Explain implementation decisions with references to code and ADRs
- Community support via Slack integration

## Principles

- Backward-incompatible changes avoided unless absolutely necessary
- Chase engineering perfection honestly — log imperfections as issues, fix incrementally
- Heavily rely on PostgreSQL-native capabilities
- No functional changes during audit phase — only docs, tests, comments, spec alignment
- Human reviews backlog before implementation
- Navigation index prevents redundant scanning across sessions
- One work item = one atomic commit
