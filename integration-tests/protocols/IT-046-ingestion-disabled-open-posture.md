---
id: IT-046
title: "DISABLED-mode open posture — anonymous ingestion write + anonymous collector/token minting"
gates:
  validates: [F-008]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:ingestion-disabled-open-posture.spec.ts"
plan_ref: I1
status: ready
---

# IT-046 — F-008 DISABLED-mode open posture (UC-01 + UC-10)

## 1. What this checks

Under the shipped default `auth.type=DISABLED`, the platform permits every request. Two characterization
pins of that posture (GREEN under DISABLED; they flip when the default becomes fail-closed or these
surfaces get gated):

- **UC-01:** an anonymous (no-credential) caller WRITES via `POST /ingestion/entities` (200) — the most
  destructive surface, open.
- **UC-10:** an anonymous caller MINTS a collector + a usable S2S token via `POST /api/collectors`.

**Operator caveat (why pin it):** a DISABLED deployment is FULLY OPEN — any network caller can write the
catalog AND mint S2S credentials. DISABLED is for trusted networks only; never internet-expose it.

## 2. Preparation

- **Stack:** `odd-minimal` (auth.type=DISABLED — the default). `ODD_STACK_EXTERNAL=1` to reuse a running stack.
- **Seed:** a raw `data_source` for the ingestion write (the collector create needs nothing).

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → UP
- `appInfo.authType` is DISABLED (the default for odd-minimal).

## 4. Run protocol

1. `POST /ingestion/entities` with NO Authorization header → **200** (anonymous write).
2. `POST /api/collectors {name, namespace_name}` with NO auth → **200** + `token.value` (non-empty 40-char S2S token).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-046`.

## 5. Assertions

- **PASS (DISABLED)** when: anonymous ingestion write returns 200; anonymous collector create returns 200 + a token.
- **FLIPS** when: either returns 401/403 (auth enabled / fail-closed default) — then the posture changed; re-scope the pins.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-046.md`.

## Cross-references
- Source: F-008 UC-01 (anonymous write) + UC-10 (anonymous collector/token minting, API half); memory reference_odd_platform_auth_modes (DISABLED = permitAll).
- Plan: `lineage/odd-platform/test-plan.md` batch I1 (auth-mode posture)
