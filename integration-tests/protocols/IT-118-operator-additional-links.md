---
id: IT-118
title: "Operator additional links: empty default + App Info menu keyboard-inaccessible + target=_blank without rel (pins)"
gates:
  validates: [F-035]
  enforces: []
  regresses: [PLT-088]
test_class: integration
stack: odd-minimal
automation: "e2e:operator-additional-links.spec.ts"
plan_ref: I10
status: ready
---

# IT-118 — Operator-configured additional links (GET /api/links + App Info menu)

> A protocol is the **source of truth** — a human can execute every step below
> WITHOUT any tooling. The `automation:` spec is a convenience rail that runs the
> same steps and writes the same result; it never replaces the protocol.

## 1. What this checks

F-035 Operator-Configured Additional Links. Operators add external links via the
`odd.links[].{title,url}` config (`@ConfigurationProperties("odd")`,
AdditionalLinkProperties.java:6-9); `GET /api/links` returns them
(LinksController.java:25-36) and the UI renders them in the App Info menu
(AppInfoMenu.tsx:55-69). This pins one confirmed promise + two CONTRADICTED promises:

- **UC-3 (confirmed)** — operator default (`odd.links` unset; it is absent from the shipped
  application.yml) → `200 {"items":[]}`; the App Info menu opens and shows its four hardcoded
  items (Documentation / Slack / version / Leave-a-feedback) with no operator-links section
  and no error.
- **UC-6 (CONTRADICTED → RED-on-fix pin)** — the App Info menu is keyboard- and touch-
  inaccessible. The info icon button declares `aria-haspopup='true'` (AppInfoMenu.tsx:80) but
  wires ONLY `onMouseEnter` (line 81) — no onClick/onKeyDown/onFocus — so focus+Enter+Space
  does NOT open it (WCAG 2.1 SC 2.1.1 violation, PLT-088 Defect 3).
- **UC-7 (CONTRADICTED → RED-on-fix pin)** — the menu's external links render
  `target='_blank'` WITHOUT `rel='noopener noreferrer'` (AppInfoMenu.tsx:95,103 hardcoded;
  :61 operator links), leaking `window.opener` to the destination (reverse-tabnabbing,
  PLT-088 Defect 2). Pinned on the always-present Documentation + Slack links.

**Operator consequence if a pin FLIPS:** UC-6/UC-7 are GREEN characterization pins
(LSN-029) of shipped defects — they flip RED the day the fix lands, signalling the
known-bug guard is now stale and should become a positive assertion. UC-3 flipping RED
means a link now ships by default or the empty-default render path broke. Source: F-035
use_cases UC-3/UC-6/UC-7; `issues/odd-platform/PLT-088.md` (Defects 2 + 3).

## 2. Preparation — build the test stand

- **Stack**: the shared `odd-minimal` stack, already running. Reuse it with
  `ODD_STACK_EXTERNAL=1` — never bring it up or tear it down.
- **Auth/config**: `auth.type=DISABLED` (odd-minimal default); `odd.links` unset (the shipped
  default — operators configure it themselves, so the stock stand exercises the empty path).
- **Seed data**: none. The operator-link content path (`odd.links` populated) is boot-bound
  config not injectable into the shared running stack; the contradiction pins ride the
  always-present hardcoded links, which share the identical bug.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Endpoint live: `curl -s http://localhost:18080/api/links` → `{"items":[]}`
- UI up: `http://localhost:18080/` loads the SPA toolbar (the App Info icon button is present).

## 4. Run protocol — what to run

1. `curl -s -i http://localhost:18080/api/links` — confirm `200`, `application/json`,
   `{"items":[]}`.
2. In a browser at `/`: hover the App Info icon button (aria-label `app info menu`) →
   the menu opens; Documentation / Slack / "ODD Platform version" / "Leave a feedback"
   render; there is no operator-links section.
3. Focus that icon button via keyboard and press Enter then Space → the menu does NOT open
   (the keyboard-accessibility bug).
4. With the menu open, inspect the Documentation + Slack `<a>` elements → `target="_blank"`,
   `rel` absent.

**Automated rail**: from `integration-tests/e2e`:
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/operator-additional-links.spec.ts --reporter=line`

## 5. What it checks — assertions

- **PASS** when: `/api/links` is `200` JSON `items: []`; the menu opens on hover and shows
  the four hardcoded items with no operator section; focus+Enter+Space does NOT open the
  menu; the Documentation + Slack links have `target="_blank"` and NO `rel` containing
  `noopener`.
- **FAIL** when: `/api/links` 404s / returns null; OR the empty-default menu render breaks;
  OR (pin flips) the menu becomes keyboard-operable (Enter/Space opens it) — fix landed,
  update UC-6 pin; OR (pin flips) `rel="noopener noreferrer"` appears on the links — fix
  landed, update UC-7 pin.

## 6. Result log

Every run appends a dated entry to `integration-tests/run-log/{YYYY-MM-DD}-IT-118.md`.
Log fields: `date · stack_commit · runner (AI/human + name) · outcome (PASS|FAIL) · evidence (captured values) · notes`.

## Cross-references
- Source: F-035 UC-3 / UC-6 / UC-7 (`lineage/odd-platform/feature-flows/detail/F-035.yaml`)
- Filed bug guarded: `issues/odd-platform/PLT-088.md` (Defect 2 reverse-tabnabbing · Defect 3 keyboard-inaccessibility); doc companion DOC-257
- Plan: `lineage/odd-platform/test-plan.md` batch I10
- Automation spec: `integration-tests/e2e/specs/operator-additional-links.spec.ts`
- Sibling chrome pin: IT-101 (F-041 application toolbar — hosts this menu)
