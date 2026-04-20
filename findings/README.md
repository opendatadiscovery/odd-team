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

## Notes

- Findings are raw data — they may contain false positives
- Triage is the step that converts findings into actionable work items
- A finding marked "already addressed" in a subsequent run means the fix worked
