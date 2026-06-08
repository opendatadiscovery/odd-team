---
id: IT-100
title: "One-shot token reveal (cross-Management UI pattern) — fresh create reveals plaintext + Copy + warning banner; a refresh masks it (no Copy, Regenerate offered)"
gates:
  validates: [F-163]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:one-shot-token-reveal.spec.ts"
plan_ref: I5
status: ready
---

# IT-100 — F-163 Cross-Management one-shot token reveal pattern

## 1. What this checks

F-163 is the SHARED one-shot reveal UX used by BOTH `CollectorItemToken` and `DataSourceItemToken`: the
server returns the 40-char plaintext token ONCE (create/rotate), and every subsequent read returns it MASKED
as `******`+last6. The UI decides reveal-vs-masked purely by the substring sniff
`token.value.substring(0,6) === '******'` (`CollectorItemToken.tsx:26` == `DataSourceItemToken.tsx:26` —
identical literal, no shared constant). IT-060 pins this contract at the API level (F-125); THIS protocol
drives the REAL browser to verify the cross-Management UI PATTERN on the Collectors surface (byte-for-byte
the same shape as the DataSource one — F-163's whole point). Three claims:

- **UC-001 (CONFIRMED):** creating a collector IN THE UI reveals the 40-char plaintext `<Token>`, a Copy
  button, and the warning banner *"Save token in a secure location. You will not be able to retrieve it
  again."* (the reveal state is only reachable via in-UI create, because redux must hold the one-shot
  plaintext response for the sniff to return `isHidden=false`).
- **UC-002 (CONTRADICTED → pin):** a page reload re-fetches the list (masked) and the reveal COLLAPSES —
  the token renders `******`+last6, the warning banner is gone, Copy is gone, Regenerate is offered instead.
  The one-shot plaintext is unrecoverable after the refresh (the warning is derived from the mask state).
- **UC-006 (CONFIRMED):** under today's `******`+last6 mask format the substring sniff classifies
  masked-vs-plaintext correctly; the masked tail is the genuine plaintext suffix; the at-rest DB value is
  the full plaintext (masking is read-side only). A second test pins the server mask format both UI surfaces
  hard-code (`/^\*{6}[A-Za-z0-9]{6}$/`) — if the format ever changes, BOTH surfaces silently break.

**Operator consequence:** if the operator navigates away / refreshes before copying, the plaintext is
unrecoverable — the only path back is a destructive rotation (no grace period — F-020/F-031). The warning
banner is the sole signal, and it vanishes on the next refresh.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED`). `ODD_STACK_EXTERNAL=1` reuses a running stack. Admin
  identity under DISABLED carries all four `COLLECTOR_*` permissions, so Add/Copy/Regenerate affordances render.
- **Auth/config:** DISABLED → anonymous create/list/delete permitted.
- **Seed:** none. Each test creates its own `it100_`-prefixed collector and soft-deletes it at the end
  (cleanup resolves the id by name via the list read).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Permissions present (so the UI affordances render): `curl -fsS http://localhost:18080/api/identity/whoami` →
  `identity.permissions` includes `COLLECTOR_CREATE` / `COLLECTOR_TOKEN_REGENERATE`.

## 4. Run protocol

1. `page.goto('/management/collectors')`; click "Add collector"; fill `input[name="name"]`; click "Save"
   (capture the POST `/api/collectors` response → the one-shot plaintext).
2. Reveal state: assert the warning banner ("You will not be able to retrieve it again"), the full 40-char
   plaintext token, and a "Copy" button are all visible.
3. `page.reload()`; wait for GET `/api/collectors`.
4. Masked state: assert the token renders `******`+<plaintext last6>; the warning banner has count 0; the
   full plaintext has count 0; a "Regenerate" button is visible. Cross-check the API: the list read returns
   exactly `******`+last6.
5. Contract pin (second test): create via API → list read masks to `/^\*{6}[A-Za-z0-9]{6}$/`, tail ==
   plaintext tail; DB at-rest value == full plaintext.

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-100`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/one-shot-token-reveal.spec.ts`).

## 5. Assertions

- **PASS** when: an in-UI create shows the plaintext + Copy + warning banner; a refresh masks the token to
  `******`+last6, removes the banner + Copy, and offers Regenerate; the masked format matches the literal
  both UI surfaces sniff for; the at-rest value is the full plaintext.
- **FLIPS (RED)** when: the reveal no longer collapses on refresh (banner/plaintext persisted — UC-002
  remediation: explicit-dismiss banner / modal reveal), OR the server mask format changes (e.g. ≠ six `*` —
  both `CollectorItemToken`/`DataSourceItemToken` sniffs would break). Each flip is a measurable change —
  re-scope the pin.
- **FAIL** when: a fresh create shows no plaintext/Copy/banner, or a masked refresh still exposes the
  plaintext / still offers Copy.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-100.md`.

## Cross-references
- Source: F-163 UC-001 (fresh reveal, confirmed) · UC-002 (one-time reveal collapses on refresh, contradicted)
  · UC-006 (today's mask format classifies correctly, confirmed).
- Plan: `lineage/odd-platform/test-plan.md` batch I5.
- Related: IT-060 (F-125 the API-level one-time reveal / at-rest / orphan pins) — this protocol adds the
  cross-Management UI PATTERN angle. IT-097 (F-020 the collector lifecycle that mints these tokens).
