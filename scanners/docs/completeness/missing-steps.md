---
id: docs/completeness/missing-steps
target_repo: odd-docs (remote) + odd-platform (local) + odd-collectors (local)
scope: Setup guides, how-tos, and procedures with incomplete steps
estimated_items: 10-20
chunking: Platform setup in one session, collector setup in another
depends_on: []
priority: high
---

## Purpose

Find documentation procedures (setup guides, how-tos, configuration steps) that skip steps a user would need, assume prerequisites without stating them, or leave the user at a non-working state.

## Method

1. Fetch setup/installation/configuration docs from odd-docs
2. Mentally "execute" each procedure:
   - Are all prerequisites listed?
   - Does each step follow logically from the previous?
   - Are there implicit steps (e.g., "create database" assumed but not stated)?
   - Does the procedure end at a working state or leave things hanging?
3. Verify against Docker compose files, CI scripts, and actual startup code

## Criteria for a Finding

- Procedure assumes a service is running without saying to start it
- Procedure mentions a config file without showing how to create it
- Procedure skips a required step (e.g., database migration, token generation)
- Procedure ends before the user has a working system
- Procedure references a tool/command without installation instructions

## Output

Write to: `findings/docs-completeness-missing-steps/YYYY-MM-DD-{target}.md`

Per finding:
- Doc page and procedure name
- What step is missing or assumed
- Evidence (what would actually fail if you followed docs literally)
- Where in the procedure the gap occurs
