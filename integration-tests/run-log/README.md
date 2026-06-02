# Integration-test run log

The reproducible evidence trail. Every `run-suite.sh` invocation appends a dated
entry here; a human running a protocol by hand appends the same shape. This is what
makes an integration result **auditable + re-runnable** — you can see what was run,
against which code, by whom/what, and the outcome.

## Entry format

```markdown
## {YYYY-MM-DD} — suite/protocol: {name}
- runner: AI-assisted (<model>, session) | human (<name>)
- stack_commit (odd-platform): <short sha the stack image/source corresponds to>
- protocols: IT-NNN [IT-NNN ...]
- automation probes: P-NNN [...] | none (manual)
- outcome: PASS | FAIL | PARTIAL
- machine traces: lineage/odd-platform/probe-runs/{date}-P-NNN.yaml (per automated probe)
- evidence/notes: <captured values, or the manual observation, + any caveat>
```

Files are named `{date}-{suite-or-IT}.md`. Multiple runs the same day append to the
same file (newest at the bottom). The machine-level trace (exact captured values) for
an automated run lives in `lineage/odd-platform/probe-runs/`; this log is the
human-readable, suite-level record that points at it.
