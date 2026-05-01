---
pillar: <name>
file: canonical-homes
status: template
---

# Canonical homes — <name> pillar

Each recurring content type in this pillar has exactly one canonical home. The pillar surface should link rather than embed. Gate 10 (`pillars/<name>/gates.md`) enforces this at review time.

## How to author this file

For each recurring content type the pillar produces, add a row:

| Content type | What it covers | Canonical home |
|---|---|---|
| Type A | Description | `path/to/canonical/home` |
| Type B | Description | `path/to/canonical/home` |

Examples for the documentation pillar (`pillars/documentation/canonical-homes.md`): Feature description / Configuration reference / API reference / Deployment / ADRs / Glossary / Developer guides / Integrations hub / Examples / Troubleshooting.

When extending the table, add the row in the same commit that introduces the first piece of that content type's content.

## The recurring content types and their canonical homes

| Content type | What it covers | Canonical home |
|---|---|---|
| | | |

## The rule operationalized

When authoring any sub-section, the maintainer asks: *what content type is this?* Then: *where is its canonical home?* Three legitimate outcomes:

1. **Canonical home exists and contains the content.** Link to the relevant section/anchor; do not embed.
2. **Canonical home exists but is sparse for this case.** Extend the canonical home with the new content; link from the embedding surface; both surfaces ship in the same commit.
3. **No canonical home today.** Propose a canonical home (extend the table above; possibly add the home before authoring; or log a backlog item to add the home then migrate). Do **not** silently embed.

## How to use this table

- **At authoring time** (`playbooks/pre-authoring-stance.md` question 2): name the content type, locate its canonical home, route to one of the three outcomes above before writing.
- **At review time** (Gate 10): verify the change is the canonical home or a link to it. Reject embeddings that should have been links.
- **When extending the table**: a new row is a structural decision. Surface the proposal before authoring the first piece of content of that type.
