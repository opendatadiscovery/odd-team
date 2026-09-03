---
id: CTRIB-064
title: "The demo injector crashes with a JSONDecodeError traceback against any auth-gated Platform — `requests` follows the 302 to /login, the login page answers 200 text/html, so the status-code guard passes and the unguarded .json() explodes"
issue: "(none — reported directly by the maintainer, 2026-09-03, running the merged demo stand locally with AUTH_TYPE=LOGIN_FORM)"
parent_epic: null
class: "bug — pre-existing (reproduced identically on the pre-fix base 969a5d5b), but squarely inside the class CTRIB-063 claimed to close, in the same file and the same two functions that change touched. No production code path; injector/ + the IT-154 rail only."
status: pr-draft
target_repo: odd-platform
milestone: "1.0.0"
base_sha: "ab457f0d"      # odd-platform origin/main = the CTRIB-063 squash merge
reproduced: "YES — on the maintainer's own live stack, twice: the merged injector AND the pre-fix `969a5d5b` injector both die with `requests.exceptions.JSONDecodeError: Expecting value: line 1 column 1 (char 0)` at the same call."
adr_required: false
plan_approved_by: "(implicit — the maintainer reported the traceback on merged main and asked for progress, not a plan; the fix is 3 guards in a file this stream already owns, GATE 2 still gates the merge)"
plan_approved_at: "2026-09-03"
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1877"   # DRAFT. Docs: https://github.com/opendatadiscovery/documentation/pull/114 (DRAFT, base release/1.0.0)
pr_draft: true
docs_routing: "release/1.0.0 train — the injector's auth constraint is undocumented and the page that documents the injector is already on the train (CTRIB-063 / DOC-520)"
stream: ctrib064
predecessor: "CTRIB-063 (#1870) — merged as ab457f0d; this is the residue of its own stated class"
---

# CTRIB-064 — the injector's status-code guard is defeated by a redirect

## The report

The maintainer ran the merged demo stand from `main` with their local `docker/demo.yaml`
(`AUTH_TYPE=LOGIN_FORM` + `AUTH_LOGIN_FORM_CREDENTIALS=admin:admin`) and got:

```
odd-platform-enricher-1  | Waiting for the platform to be able to receive requests: attempt 1 of 60
odd-platform-enricher-1  | Starting to inject metadata
odd-platform-enricher-1  | Traceback (most recent call last):
...
odd-platform-enricher-1  |   File "//./injector/inject.py", line 122, in fetch_existing_datasources
odd-platform-enricher-1  |     return response.json()['items']
odd-platform-enricher-1  | requests.exceptions.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
odd-platform-enricher-1 exited with code 1
```

`attempt 1 of 60` is worth reading twice: **the CTRIB-063 readiness gate did its job.** Compose held the
enricher until the Platform's healthcheck passed, so the very first poll succeeded. The failure is the next
call.

## Root cause — measured on the live stack, not reasoned

| Fact | Evidence |
|---|---|
| `/actuator/health` is permit-all in every auth mode, so health goes `UP` and `service_healthy` releases the enricher | `curl http://localhost:8080/actuator/health` → `200 {"status":"UP"}` on the maintainer's LOGIN_FORM stack |
| `/api/datasources` answers a **302** to an unauthenticated caller | `curl -sS -D - .../api/datasources?page=1&size=1000` → `HTTP/1.1 302 Found`, `Location: /login`, **0-byte body** |
| **`requests` follows redirects by default**, so the response the script inspects is the login *page* | `curl -sSL` → `FINAL HTTP 200 \| bytes=960 \| ct=text/html \| url=.../login` |
| So `if response.status_code != 200` **passes** — it is testing the redirected 200 | `inject.py:119` @ `ab457f0d` |
| …and the next line's `.json()` raises out of the module | `inject.py:122` `return response.json()['items']` |
| **Pre-existing, not a CTRIB-063 regression** | the `969a5d5b` injector, run against the *same* live stack from `../odd-platform-ctrib063base`, dies with the identical `JSONDecodeError` at its own `:35` |

### Why it is nonetheless CTRIB-063's residue

CTRIB-063's plan said, verbatim, that it would *"guard `hc_response.json()`, which currently raises straight
out of the retry loop on a non-JSON body"* and that an injection failure would *"report the platform's ACTUAL
status and body … never a guess."* It guarded **one** `.json()` — the health poll — and left the **two that
run immediately after**, in functions it edited in the same commit:

- `fetch_existing_datasources():122` — `response.json()['items']`, unguarded (this is the crash)
- `create_data_source_and_retrieve_token():137` — `response.json()['token']['value']`, unguarded

And a third, worse one: `inject_data()` checks only the status code, so **a 302 → 200 login page would make it
report a successful injection for a sample that was never delivered** — success reported while
under-delivering, the single property that change existed to eliminate.

## The change

`injector/inject.py` — three guards and a `die()`, no restructuring:

1. **`die(message)`** — every FATAL path prints a sentence and `sys.exit(1)` instead of raising out of the
   module. A give-up message that names the cause and the remedy is worth nothing wrapped in a traceback,
   which is exactly what the maintainer saw. Same shape `validate_samples()` already used; applied to the
   readiness give-up too, which had the same defect.
2. **`api_json(response, what)`** — one checked accessor for both JSON reads: it fails on
   `response.history` (a followed redirect) naming the redirect *and* the remedy, then on a non-200, then on
   a body that is not JSON, reporting the `Content-Type` it actually got.
3. **`inject_data()`** — rejects a followed redirect explicitly, so an auth-gated platform can never be
   mistaken for a successful injection.

## Test plan (G-C9)

**Integration** — `IT-154` gains **case 10**: an in-process stand-in Platform that serves health as
permit-all, answers `/api/**` with `302 → /login`, and serves `/login` as `200 text/html`. Asserts the run
fails, that the output names the redirect, its target and `auth.type=DISABLED`, and — the point of the case —
that it contains **neither** `JSONDecodeError` **nor** `Traceback (most recent call last)`.

RED on `ab457f0d`; GREEN on the fix. Both halves measured, plus the live-stack reproduction above, which is
the stronger proof because it is the exact configuration that produced the report.

## Docs decision (G-C10)

The injector's auth constraint was **undocumented**. `build-and-run-odd-platform.md` (already on the
`release/1.0.0` train from CTRIB-063 / `DOC-520`) gains a warning hint: the injector sends no credentials,
so it needs `auth.type=DISABLED`; any other mode redirects `/api/**` to `/login`; health is permit-all in
every mode, which is why the readiness wait succeeds first and the failure lands on the first real API call;
to load metadata into an authenticated deployment, ingest through a collector with a token.

Routed to the train, not docs `main`: the sentence describes the *new* diagnosis behaviour, which is
unreleased.

## Definition of Done

| # | Gate | State |
|---|---|---|
| 1 | full unit build green | **N/A for the build, CI is the gate** — the diff is one Python file; no Java, TypeScript or SQL. CI on the pushed head `271bb13b` decides. |
| 2 | IT-154 whole, GREEN on the fix + case 10 RED on `ab457f0d` | **PASS — both halves run.** GREEN: the whole spec **5/5 (3.5m)** against the patched injector, and the happy path still delivers — `up -d odd-platform-enricher` blocked **76s** against `ghcr.io/…@sha256:3b61b3f2`. RED: case 10 against `../odd-platform-ctrib063` (= the merged `ab457f0d` content) **fails** at `toContain('redirected to')`, with the reporter's `requests.exceptions.JSONDecodeError: Expecting value: line 1 column 1 (char 0)` in the captured output. Plus the live-stack reproduction on both the merged and the pre-fix injector, which is the stronger proof because it is the configuration that produced the report. **Not run: the full four-suite regression** — the diff is `injector/inject.py`, which no suite but IT-154 touches and which is not in the SUT image at all (the enricher runs it from a bind mount); the reviewer decides whether that carry-over holds. |
| 3 | docs authored on the train | done — `docs/CTRIB-064-injector-needs-unauthenticated-platform` off `origin/release/1.0.0` @ `a9ffa4e` |
| 4 | ontology | N/A — `injector/` carries no substrate node; no doc-understanding sidecar quotes the injector's auth behaviour |
| 5 | Principal sufficiency (G-C13) | **What did I make worse?** Nothing: two duplicated guard blocks removed, one shared accessor added, three real guards where there were none. The one judgement call is `die()` over `raise` — it makes the fatal paths unpluggable as a library, which this script has never been (it is a `__main__` with top-level statements). `inject_data()` deliberately still raises, because its failure is caught per-sample and must stay loud-but-not-fatal per #1870's GATE-1 decision D1. |
