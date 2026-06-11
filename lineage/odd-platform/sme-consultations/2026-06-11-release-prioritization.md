---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-11T00:00:00Z
consulted_by: maintainer-direct
consultation_question: "For the next odd-platform release (15-20 fixes, solo spare-time, goals: most-important + backwards-compatible + most-annoying-bugs), rank operator daily pain across the 190 PLT drafts + PLT-109, screen the candidates for upgrade/compat risk, and group them into coherent ship-together themes."
slug: release-prioritization
confidence_overall: MEDIUM
prompt_version: odd-sme/0.1.0
---

# Release prioritization for the next odd-platform release

## TL;DR

Anchor the release on the **core daily surfaces** an ODD operator actually touches every shift — Catalog Search, Entity Detail, Lineage, DQ test-runs, the Alerts page — because that is where a defect is felt most often and where a silent failure corrupts the most trust (per `system-mission.md` P-01/P-04/P-05/P-07 and the live data-discovery / active-platform-features docs, which name Catalog Overview + Search as "where most catalog sessions start"). The single highest-value ship is **PLT-109** (confirmed SQL injection on the search-highlight path — the fix is parameterizing one jOOQ call, compat-safe). The biggest daily-pain cluster is **"search never 500s on user input"** (PLT-147 / PLT-127 / PLT-090) — three bugs that 500 the most-touched surface in the product on ordinary input. The release's compat landmines are the auth-posture and changed-default fixes (PLT-072, PLT-080, PLT-064-A1, PLT-003) — exclude or flag those, they are exactly the "operator upgrades in place and gets bricked / locked out" class.

## Question scope

Archetype: **mixed** (plausibility-by-workflow + implicit-requirements + comparative-internal). Three sub-questions answered: (1) operator-pain ranking top-25; (2) backwards-compat screen; (3) coherent ship-together themes. Out of scope: per-item fix design, effort estimation beyond the drafts' own "one-line fix" signals, and re-verification of each draft's code citations (I trust the `ufv=true` flag + the drafts' 2026-06-10 verification notes; I read 24 full bodies).

## Domain plausibility (which surfaces are core daily workflows)

Grounded in `system-mission.md` and two live-doc fetches (data-discovery, active-platform-features — both 200, quoted in Citations). The daily-workflow weighting:

- **Search + Catalog Overview (P-01)** — "where most catalog sessions start"; the primary entry point. A 500 here is felt by every user, every session. Highest weight.
- **Entity Detail (P-01)** — every drill-through lands here; view_count + tags + terms + DQ all render here.
- **Lineage (P-05)** — blast-radius assessment before a schema change; the diagnostic surface.
- **DQ test-runs + Dashboard (P-04)** — the DQ engineer's daily "why did my test fail / is it running" surface.
- **Alerts + Notifications (P-07)** — the steward's daily triage; notifications are opt-in but set-and-forget, so a *silent* death is worse than a loud one.
- **Activity Feed (P-07)** — compliance/audit "what did X do."
- **Management / Owner-association (P-08)**, **Glossary/Term search (P-06)**, **Lookup Tables (P-03)** — frequent but narrower audiences.

Annoyance classes used: **daily-blocker** (loud, stops a core workflow, no workaround) · **trust-eroder** (the surface lies but the user can route around once they know) · **silent-corruption** (data/signal is silently wrong; the user never learns) · **polish** (friction, not failure).

## Implicit requirements an operator holds by default

- **Functional:** the search box must survive any character a human types into it (a `:` or `(` is *common* in technical table/term names — PLT-127/PLT-090); a list endpoint must not 500 the whole page because one row has a null sub-projection (PLT-147); a "create/add" verb must not silently delete (PLT-184/PLT-066/PLT-044/PLT-025); a tab labelled "All" must show all (PLT-121).
- **Reliability:** a feature that works in the maintainer's OAUTH2 test stack must work in the `DISABLED` posture an evaluator reaches first (PLT-148); a config key omitted from a trimmed overlay must fall back to the documented default, not brick boot (PLT-105) or silently kill a platform-wide signal (PLT-097); notifications enabled once must keep delivering across restarts (PLT-139).
- **Security:** catalog search is assumed safe — a SQLi there (PLT-109) is the worst-case violation of that assumption.
- **Upgrade-safety (the maintainer's explicit goal):** an in-place upgrade must not newly *require* a config key (PLT-072), drop a default credential the quick-start relies on (PLT-080), revoke access users currently have (PLT-064-A1), or close an endpoint live automations POST to (PLT-003).

## Operator workflows this release serves

- *Discover a dataset* (analyst, daily) → PLT-147, PLT-127, PLT-090, PLT-104, PLT-026.
- *Diagnose a stale dashboard / failing DQ test* (DQ engineer) → PLT-021, PLT-052, PLT-097.
- *Trace blast radius before a schema change* (data engineer) → PLT-100.
- *Triage / audit alerts* (steward) → PLT-121, PLT-050, PLT-139, PLT-156.
- *Onboard a source / manage owners* (platform admin) → PLT-148, PLT-066, PLT-135, PLT-145.

## Recommended framing for the caller

Ship one **"Search & detail never 500 on user input"** theme (the daily-pain core, all compat-safe) + **PLT-109** (the security must-fix, compat-safe) + a **"4xx not 5xx error-contract"** sweep of one-liners, and consciously **defer every auth-posture / changed-default fix** to a clearly-release-noted minor or a major. That hits all three of the maintainer's stated goals (most-important, safe, most-annoying) without a single upgrade-bricking change in the "safe" train.

## Caveats and uncertainty

- This is a **portfolio triage**, intentionally broader than a single-hypothesis SME consult (the contract's 400-1200-word / one-question budget); the maintainer explicitly asked for a 25-item ranking + compat screen + themes, so the consultation ran wide by design. Confidence is MEDIUM not HIGH because I read 24 of 190 bodies in full and trusted the inventory's `ufv` flag + the drafts' own verification notes for the rest.
- The compat verdicts are domain judgement on the *fix shapes the drafts propose*; a different fix shape can move an EXCLUDE to SAFE (e.g. PLT-080's warn-only self-check is SAFE even though dropping the default is EXCLUDE; PLT-064's Option A2 warn-only is SAFE even though A1 wiring is EXCLUDE). The verdict is per-fix-option, not per-item.
- `confidence: LOW` on exact effort: I used the drafts' "one-line fix" self-reports as an effort signal, not an independent estimate.

## Citations

- `lineage/odd-platform/system-mission.md` (read 2026-06-11) — pillar shape P-01..P-11, audiences, daily-ops workflows; P-01 "where most catalog sessions start" framing, P-07 alert lifecycle.
- `/tmp/plt-draft-inventory.txt` (read 2026-06-11) — 190-item compact inventory (id|severity|type|ufv|title); the triage substrate.
- Full bodies read (24): PLT-003, 012, 021, 025, 030, 044, 064, 066, 072, 074, 076, 078, 080, 083, 090, 097, 100, 104, 105, 109, 121, 127, 139, 141, 145, 146, 147, 148, 152, 163, 184.
- `https://docs.opendatadiscovery.org/features/data-discovery` — last_verified_status: **200**, fetched 2026-06-11. Quote: Data Discovery is "the home for finding entities in the catalog"; Catalog Overview is where "most catalog sessions start," Search is the "query-oriented entry point." Confirms Search/Detail as primary daily surfaces.
- `https://docs.opendatadiscovery.org/features/active-platform-features` — last_verified_status: **200**, fetched 2026-06-11. Quote: the Alerts section "lists open alerts only; resolved history is read on each entity's own Alerts tab" (confirms PLT-121 is now documented behaviour, DOC-291); notifications "route out via Slack incoming-webhook, generic webhook, and SMTP email," each "opt-in — disabled out of the box."
