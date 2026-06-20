---
artefact: sme-consultation
project: odd-platform
consulted_at: 2026-06-20T00:00:00Z
consulted_by: maintainer-direct
consultation_question: For CTRIB-025 (#1763), is ODD's global Alerts page showing OPEN-only with no global path to resolved alerts a real product gap, is the "All" tab a name-vs-behaviour defect, and which fix shape (status filter / relabel / BE-only) best serves a data-observability operator?
slug: global-alerts-status-filter
confidence_overall: HIGH
prompt_version: odd-sme/0.1.0
---

# Global Alerts page: OPEN-only behaviour, the "All" tab name, and the right fix shape

## TL;DR

The de-facto standard for a global alerts/incidents surface is **a status-filter affordance with an open-leaning default, and resolved/closed items always reachable from the same global surface** — verified in Grafana (a `rule state` filter), Datadog (a `status:` search facet), and PagerDuty (Triggered/Acknowledged/Resolved with a default Open-Incidents view). ODD diverges on the *reachability* half: resolved alerts are reachable **only per-asset**, never globally — that is a genuine product gap for the audit/postmortem workflow. Separately, a tab literally labelled **"All"** that returns only the OPEN subset is a real name-vs-behaviour defect independent of the gap. Recommended: **Option A** — add an optional `status` param (default OPEN) to the three global endpoints plus a status control on the page — keeping OPEN as the default so the day-to-day triage surface is unchanged while history becomes globally reachable.

## Question scope

Five sub-questions from the maintainer at GATE 1 (archetype: **comparative + implicit-requirements + plausibility**, with a vocabulary touch on the "All" label):
1. Competitor default-status / resolved-reachability / status-affordance norms (Grafana, Datadog, PagerDuty; Monte Carlo + Elementary attempted).
2. Is OPEN-only-with-no-global-resolved a real PO gap or acceptable-as-per-asset?
3. What does ODD's own live manual say the global Alerts page shows (verify DOC-291)?
4. Is "All" labelling the OPEN subset a real defect on its own?
5. PO recommendation among Option A / B / C, plus the default-status call.

Out of scope: the precise jOOQ/repository change, the FE control widget choice, and the Resolve/Reopen action semantics (code-verified facts supplied by the caller; not re-derived). Elementary and Monte Carlo specifics could not be verified live (see Caveats).

## Domain plausibility

**Operator workflow this serves (Rule 4):** the *audit / history / postmortem* workflow — a steward who resolved an alert later needs to answer "what fired last month, when, and was it handled?" either for a retro, an SLA review, or to confirm an automatic resolution actually happened. This is a recognizable, first-class data-observability workflow, distinct from the day-to-day *triage* workflow (what is on fire right now). ODD's global Alerts page serves triage well; it does not serve audit at the global grain at all.

**Match against ODD's own framing:** Alerting is a sub-feature of P-07 Active Platform Features, where "the platform is itself an actor … detect a condition and raise an alert" (`system-mission.md:206`), with the lifecycle "Alert (4 types, OPEN→RESOLVED lifecycle)" (`system-mission.md:204`) and the three tabs "All/My/Dependents" named at `system-mission.md:213`. `concepts.yaml:610` records the lifecycle as `OPEN (Platform creates) → RESOLVED (Operator) / RESOLVED_AUTOMATICALLY (Platform when condition clears)` and the three scopes as "All / My Objects (owner-linked) / Dependents (downstream-by-lineage)" — confirming "All" is a *scope* axis, orthogonal to the *status* axis, which makes the OPEN hard-filter an implicit, undocumented-in-the-name second filter.

**Verdict: HIGH-PLAUSIBILITY** that globally-reachable resolved alerts is a real expected capability — three named competitors expose exactly this, and it maps to a named operator workflow.

## Industry vocabulary alignment

- **Canonical axis name:** "status" / "state" is the universal label for the OPEN↔RESOLVED axis. Grafana calls it **rule state** ("You can filter by … rule state …", grafana.com view-alert-rules). Datadog calls it **status** with the facet value set "`Triggered` (`Alert`, `Warn`, `No Data`) or `OK`" and the query form `status:Alert` (docs.datadoghq.com monitors/manage/search). PagerDuty calls it **status**: Triggered / Acknowledged / Resolved (support.pagerduty.com/main/docs/incidents).
- **ODD's term** (`concepts.yaml:610`, verbatim): lifecycle states `OPEN`, `RESOLVED`, `RESOLVED_AUTOMATICALLY`; the API DTO is `AlertStatus` / `AlertStatusFormData` (`concepts.yaml:624`). ODD's vocabulary is already industry-aligned on the *status* axis — the only misalignment is at the UI label "All", which names the scope axis but silently also pins the status axis to OPEN.
- **Recommended alignment:** **preserve** ODD's `AlertStatus` vocabulary (it matches the industry); **re-align the UI** so the status axis is named and operable rather than hidden — either an explicit status control (Option A) or, at minimum, rename "All" to "Open" so the label stops over-claiming (Option B). "All" should mean all-statuses or it should not be the word used.

## Implicit requirements (functional / security / performance / reliability)

- **Functional — globally-reachable history.** Operators expect a resolved alert to be findable from the global surface, not only by first navigating to the exact asset that raised it (which presupposes you already know which asset — the thing audit work is trying to discover). *No citation — domain knowledge; corroborated by the three competitor patterns below.* Confidence: HIGH.
- **Functional — default stays OPEN.** Operators opening an alerts page expect the actionable/triage set first; showing all-history-by-default would bury live incidents under closed noise. PagerDuty's product encodes this as a dedicated "Open Incidents page" as the working surface (support.pagerduty.com/main/docs/incidents). Confidence: HIGH.
- **Security — read-only history, same posture as live alerts.** Resolved alerts are already retained and viewable per-asset (`getAlertsByDataEntityId`, caller-supplied) under ODD's read-collaborative posture (`system-mission.md:267` — every authenticated user can enumerate the catalog). Exposing them globally adds **no new** disclosure boundary: the same rows are already reachable to the same audience per-asset. *Cited: read-collaborative posture, `system-mission.md:267`.* Confidence: HIGH. (Per memory: ODD reads are unscoped by design; this is not a new authz surface.)
- **Performance — bounded by paging, but watch the cardinality shift.** The global queries are already paged (`getAllAlerts.md:concepts … list-open-alerts-platform-wide (paged, no filter)`, `concepts.yaml:627`). Adding RESOLVED to the addressable set materially enlarges the candidate row count (resolved alerts accumulate monotonically until the housekeeping TTL purges them). The default-OPEN filter keeps the common path on the same small working set; only an explicit status switch pays the larger scan. Confidence: MEDIUM (TTL bounds total volume, but resolved >> open at steady state).
- **Reliability — resolved-history retention is real and TTL-bounded.** `concepts.yaml:366-371` records a housekeeping TTL (`resolved_alerts_days`) AND a documented jOOQ operator-precedence bug where "manual RESOLVED alerts deleted regardless of [the configured window]". Implication for this feature: a globally-reachable resolved view will surface gaps caused by that purge bug — worth a one-line note in the CTRIB record, not a blocker. Confidence: HIGH (code-anchored in concepts).

## Operator workflows this feature participates in

- **Diagnose a stale dashboard / audit after an incident (postmortem):** steward needs "did an alert fire on this table last week and was it auto-resolved?" — today only answerable if they already know the table. The gap bites exactly here.
- **Audit data quality across a domain (`system-mission.md` Rule-4 seed):** a quarterly review wants the closed-alert record across many assets at once; per-asset navigation makes this O(assets) clicks instead of one filtered global view.
- **Triage (what is on fire now):** served well today by the OPEN default; a status filter must not regress this — hence default-OPEN.

## Competitor comparison

| System | Equivalent surface | Default shown | Resolved/closed reachable from the same global view? | Affordance | URL (verified) |
|---|---|---|---|---|---|
| Grafana Alerting | Alert rules / instances list | Rules grouped by state; not open-only | Yes — `Normal` (resolved) is a filterable state | **State filter** ("filter by … rule state …") | grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/ (200) |
| Datadog | Manage Monitors | All-status surface (a separate "Triggered Monitors" page is the open-only one) | Yes — `status:OK` etc. on the same search | **Status search facet** (`status:Alert`; values Triggered/Alert/Warn/No Data/OK) | docs.datadoghq.com/monitors/manage/search/ (200) |
| PagerDuty | Incidents | Open Incidents (Triggered + Acknowledged) | Yes — Resolved is a status alongside Triggered/Acknowledged on the incidents surface | **Status** axis (Triggered/Acknowledged/Resolved) | support.pagerduty.com/main/docs/incidents (200) |

Consistent three-way pattern: **status is an exposed, operable axis; resolved/closed is reachable from the global surface; the default leans to the actionable set.** ODD matches the "default leans actionable" half and breaks the "reachable from the global surface" half.

## Recommended framing for the caller

**Option A is the product-correct fix; keep OPEN as the default.** Add an optional `status` query param (default `OPEN`) to `getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts`, and a status control on the global page, so the audit/postmortem workflow gains a global path to resolved alerts that today exists only per-asset — matching how Grafana, Datadog, and PagerDuty all expose status. This is one cohesive change end-to-end (spec + the three endpoints + repo queries that already exist per-asset via `getAlertsByDataEntityId` + the FE control), not a capability ODD has to invent from scratch.

Why not the others, briefly:
- **Option B (relabel "All" → "Open", nothing else):** fixes the name-vs-behaviour defect (which is real and worth fixing regardless) but **leaves the capability gap** — resolved alerts stay globally unreachable. It is a correct *subset* of A, not a substitute. Ship B only if A is out of budget — and if so, B is mandatory, because shipping a tab called "All" that hides resolved is itself a defect (Q4).
- **Option C (BE param only, defer UI):** lands a `status` param that no UI consumes — a half-finished surface the next session has to remember to complete, exactly the "scattered intent" failure CLAUDE.md warns against. Only defensible if the FE control genuinely cannot land in the same batch; if so, the deferred UI item must be logged on disk (`follow-up-on-disk`), not narrated.

On the **"All" label (Q4): yes, it is a real defect independent of the gap.** "All" names the *scope* axis (all-objects vs my-objects vs dependents) while silently pinning the *status* axis to OPEN; a user reasonably reads "All" as "all alerts" and concludes resolved ones were purged. Under Option A, either rename "All" → "Open" with the status control beside it, or make "All" honest by having the default control read "Open" while the tab keeps meaning all-scopes. Do not ship a tab named "All" that returns a strict subset.

**On Q2 (gap or acceptable):** it is a **genuine gap**, not an acceptable per-asset concern. Per-asset resolved history is necessary but not sufficient — audit work starts without knowing the asset, which is the whole point of a *global* alerts surface.

**On Q3 (does the live manual match):** **Yes — DOC-291's correction is live.** The live alerting page now states verbatim: *"The Alerts section in the navigation pane (with All / My Objects / Dependents tabs) lists open alerts only; resolved history is read on each entity's own Alerts tab."* (docs.opendatadiscovery.org/features/active-platform-features, fetched 2026-06-20, 200). So the manual is **accurate** about today's behaviour — this is not a docs-lie case; it is a product-capability decision. If Option A ships, this sentence must be updated on the release train (it currently documents the limitation as the design).

## Caveats and uncertainty

- **Monte Carlo and Elementary not verified.** `docs.getmontecarlo.com/docs/alerts` returned 404 (fetched 2026-06-20); I did not substitute a guessed URL or pretrained recollection. The data-observability-native comparison therefore rests on Datadog (the closest verified observability-monitor analogue) plus Grafana; the three verified systems already establish the pattern with HIGH confidence, so this does not change the recommendation. If the maintainer wants a Monte-Carlo-specific data point, that is a focused follow-up fetch (likely needs the current docs URL or an authenticated source).
- **Grafana state enumeration** came from two pages; the *filter* claim is verified verbatim ("filter by … rule state"), the full state list (Normal/Pending/Alerting/NoData/Error) is corroborated but the second page's excerpt was partial — the load-bearing claim (a state filter exists, Normal/resolved is filterable) is solid.
- **Datadog default-view** for Manage Monitors: docs confirm the `status` facet and that a *separate* "Triggered Monitors" page is the open-only surface; they do not state in one line that an empty query returns all monitors. The inference (Manage Monitors is all-status because Triggered Monitors is the open-only sibling) is strong but is an inference, flagged as such.
- **Housekeeping purge bug** (`concepts.yaml:371`) means a global resolved view may show fewer rows than expected for manual-RESOLVED alerts past the window — surface as a known caveat in the CTRIB record, separate from this issue's scope.

## Citations

- `lineage/odd-platform/system-mission.md:204,206,213,267` (read 2026-06-20) — P-07 Alerting lifecycle, three tabs, read-collaborative posture.
- `lineage/odd-platform/concepts.yaml:610,624,627` (read 2026-06-20) — Alert concept: lifecycle OPEN→RESOLVED/RESOLVED_AUTOMATICALLY, `AlertStatus` DTO, `list-open-alerts-platform-wide (paged, no filter)`.
- `lineage/odd-platform/concepts.yaml:366-371` (read 2026-06-20) — `resolved_alerts_days` TTL + the AlertHousekeepingJob jOOQ operator-precedence purge bug.
- https://docs.opendatadiscovery.org/features/active-platform-features — last_verified_status: **200** (fetched 2026-06-20). Quote: "The Alerts section in the navigation pane (with All / My Objects / Dependents tabs) lists open alerts only; resolved history is read on each entity's own Alerts tab." Confirms DOC-291 correction is live; no visible last-updated date.
- https://grafana.com/docs/grafana/latest/alerting/monitor-status/view-alert-rules/ — last_verified_status: **200** (fetched 2026-06-20). Quote: "You can filter by name, label, folder/namespace, evaluation group, data source, contact point, rule source, rule state, rule type, and the health of the alert rule …".
- https://grafana.com/docs/grafana/latest/alerting/fundamentals/alert-rule-evaluation/state-and-health/ — last_verified_status: **200** (fetched 2026-06-20). States corroborated: Normal, Pending, Alerting, No Data, Error (partial excerpt).
- https://docs.datadoghq.com/monitors/manage/search/ — last_verified_status: **200** (fetched 2026-06-20). Quote: "The monitor status: `Triggered` (`Alert`, `Warn`, `No Data`) or `OK`"; example `status:Alert`.
- https://docs.datadoghq.com/monitors/manage/ — last_verified_status: **200** (fetched 2026-06-20). Confirms a separate "Triggered Monitors" page (the open-only sibling of Manage Monitors); `group_status` search attribute.
- https://support.pagerduty.com/main/docs/incidents — last_verified_status: **200** (fetched 2026-06-20). Statuses Triggered/Acknowledged/Resolved; "Open Incidents page" as the working surface.
- https://docs.datadoghq.com/monitors/manage/status/ — last_verified_status: **404** (fetched 2026-06-20) — recorded as failed; superseded by /monitors/manage/search/.
- https://docs.getmontecarlo.com/docs/alerts — last_verified_status: **404** (fetched 2026-06-20) — recorded as failed; Monte Carlo not used as a load-bearing citation.
