---
pillar: <name>
file: gates
status: template
---

# Quality Bar gates — <name> pillar

Acceptance criteria on a work item are the named deliverables. The Quality Bar is the responsibility the maintainer carries on **every** change regardless of scope.

Each gate is a gate, not a principle. Review will reject an item that cannot cite evidence for each one.

## How to author this file

This pillar's gates layer on top of the universal gates in `playbooks/`. For each gate:

- **Universal gates** (Pre-authoring stance, Gate 1, Gate 4, Gate 5, Gate 8, Gate 9, Follow-up on disk): cite the playbook + add pillar-specific extensions and case-law.
- **Pillar-specific gates**: full text + case-law from `retrospectives/`.

The documentation pillar's gates file (`pillars/documentation/gates.md`) is a worked example.

## Pre-authoring stance check

Run before every sub-section. Five questions:

1. What content type is this section?
2. Where is the canonical home for this type?
3. Where does this page sit in the global SUMMARY taxonomy (or this pillar's equivalent structural surface)?
4. Does this change preserve the WHY?
5. Would I be ashamed to see this change quoted back?

The executable form lives in `playbooks/pre-authoring-stance.md`. This pillar plugs in its own canonical-homes (`pillars/<name>/canonical-homes.md`) and cornerstones (`pillars/<name>/cornerstones.md`) at questions 1, 2, 3.

## 1. No duplicates.

Universal core: `playbooks/duplication-sweep.md`. <Pillar-specific extension: what does the alias table look like for this pillar? What is the bi-directional sweep target?>

## 2. <Pillar-specific gate>.

<Full text + retrospectives/LSN-NNN case-law.>

## 3. Caveats captured.

<Pillar-specific extension: what does a "caveat" look like in this pillar's artefact?>

## 4. Consumer-read before authoring. (Gate)

Universal core: `playbooks/consumer-read.md`. <Pillar-specific SoT classes if different from documentation's.>

## 5. Unset-parameter audit for SDK integrations. (Gate)

Universal core: `playbooks/unset-parameter-audit.md`. <Pillar-specific scope: which SDKs does this pillar's surface touch?>

## 6. Bidirectional <pillar-specific> coverage.

<Pillar-specific gate: e.g., "every test covers a feature" (tests pillar) or "every feature is tested" (features pillar).>

## 7. Layout and completeness.

<Pillar-specific extension: SUMMARY-equivalent for this pillar.>

## 8. Publishing standards always.

Universal core: `playbooks/live-site-verification.md`. <Pillar-specific: what does "live-site verification" mean? For tests, it might be "CI green on origin/main"; for features, "feature flag enabled in staging".>

## 9. Factual claim provenance. (Gate)

Universal core: `playbooks/claim-inventory.md`. <Pillar-specific SoT-class table.>

## 10. <Pillar-specific gate>. (Optional)

<E.g., for tests: "Every test asserts behavior, not implementation".>
