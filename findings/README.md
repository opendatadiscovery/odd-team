# Findings

Raw output from scanner runs. Each scanner writes to its own subdirectory with timestamped files.

## Structure

```
findings/
└── {scanner-id-with-dashes}/     # e.g., docs-accuracy-feature-behavior/
    ├── YYYY-MM-DD.md             # Full-scope run
    └── YYYY-MM-DD-{chunk}.md     # Chunked run (e.g., 2026-04-20-lineage.md)
```

## Format

See `scanners/README.md` for the standard findings format.

## Lifecycle

1. Scanner writes findings here
2. Triager reads findings and creates work items in `backlog/`
3. Findings are preserved as audit trail (never deleted)
4. Re-running a scanner produces a new dated file (shows progress over time)

## Deduplication & Enrichment

Multiple scanners may discover the same gap from different angles. Instead of creating duplicates, later scanners **enrich** the original finding:

```markdown
### F-042 ← enriches F-012 (docs-accuracy-feature-behavior)
- **Original**: F-012 in `findings/docs-accuracy-feature-behavior/2026-04-20-batch-2.md`
- **New evidence**: {what this scanner found that adds to the original}
- **Severity adjustment**: unchanged | escalate to X | de-escalate to X — {reason}
```

The original finding gets a back-link:
```markdown
- **Cross-ref**: enriched by F-042 in `findings/{scanner-dir}/{file}.md`
```

This ensures each real-world gap has ONE canonical finding that accumulates evidence, rather than N duplicates from N scanners. The triager uses the canonical finding (with all enrichments) to create a single work item.

## Notes

- Findings are raw data — they may contain false positives
- Triage is the step that converts findings into actionable work items
- A finding marked "already addressed" in a subsequent run means the fix worked
