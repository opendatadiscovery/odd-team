---
pillar: <name>
status: template
since: YYYY-MM-DD
---

# <Pillar name> pillar

## The bar — stated explicitly

**What does world-class look like for this pillar?** The documentation pillar's bar (`pillars/documentation/pillar.md` "The bar — stated explicitly") is "a documentation product that possibly does not yet exist for any open-source project — super-clean structure, every aspect of the implementation covered, no redundancy that shouldn't exist, every cross-reference consistent, every topic at top quality." Draft an analogous bar for this pillar before the first authoring session.

**There is no middle ground.** "Good enough" drifts the moment the next session forgets which rules already covered a case. The choice is to hold the bar, or to give up and stop developing — there is no third option that makes ODD worth maintaining.

Every change in this pillar either holds that bar or proves the bar wasn't real. The maintainer's pride — not rule-compliance — is the mechanism that holds it.

## What this pillar maintains

<Describe the pillar's artefact, scope, and live surface.>

## Concrete quality criteria

<List the specific axes the bar above is measured on. Each enforced by a Cornerstone (`cornerstones.md`), a gate (`gates.md`), or both.>

- **Quality criterion 1.** Description.
- **Quality criterion 2.** Description.
- ...

## Success signals

<What does success look like for this pillar's audience?>

## Failure signals

<What does failure look like? Cite concrete cases when they accumulate as `retrospectives/LSN-NNN`.>

## What authoring sessions in this pillar must load

Beyond the universal framework in `CLAUDE.md`, every authoring session in this pillar loads:

- `pillars/<name>/cornerstones.md` — IA-level constraints
- `pillars/<name>/gates.md` — pillar-specific gates + universal-gate specialisations
- `pillars/<name>/authoring.md` — surface conventions
- `pillars/<name>/canonical-homes.md` — content-type homing table

## Recent retrospectives that inform this pillar's gates

See `retrospectives/` for the case law, indexed by `LSN-NNN`. New pillars should add LSNs as soon as the first failure mode is captured.

## Migration status

This file is a template scaffold. Replace this section with the pillar's activation date and any phased migration notes once the pillar is bootstrapped.
