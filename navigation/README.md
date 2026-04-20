# Navigation Index

Token-efficient knowledge map for the ODD project. Read these files BEFORE exploring any repository.

## How It Works

- `features.yaml` — top-level index mapping features to domain files (~100 lines)
- `repos.yaml` — repository orientation (structure, tech stack, key commands)
- `domains/{feature}.md` — compact pointer map per feature (~50-80 lines each)

## Rules

1. Navigation files contain POINTERS, not documentation
2. Each domain file is max 80 lines — if it grows beyond, split into sub-domains
3. Update immediately when you discover a pointer is stale (file moved/renamed/deleted)
4. When a scanner discovers code locations, populate the relevant domain file
5. Every implementer reads the relevant domain file before starting work

## When to Read

- Starting any task → read `features.yaml` to find relevant domain(s)
- Need to find code for a feature → read `domains/{feature}.md`
- Need to understand a repo's layout → read `repos.yaml`
- Never grep/glob an entire repo without checking navigation first