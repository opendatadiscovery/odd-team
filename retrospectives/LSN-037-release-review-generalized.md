---
name: LSN-037-release-review-generalized
title: A release review is a code+test+doc+ontology bundle verified against the published artifact — not a documentation-merge gate. The full test suite on the released version was missing from it.
gates: [release-review, canonical-suite, real-instance, security-disclosure]
date: 2026-06-18
---

# LSN-037 — Generalising the post-release review

**Context.** odd-platform `0.28.0` shipped (tag + ghcr image, milestone #28 closed). The maintainer asked to review the release: docs reflect the changes, claims true on a real instance, ontology up-to-date. Before this, the only codified post-release procedure was `playbooks/release-train-merge.md` — the **documentation-publication gate**. A release is bigger than its docs, and the review ran ad-hoc beyond that gate. Generalised into `playbooks/release-review.md` (seven checks) so the next release does not re-improvise.

## What went well — keep these

1. **Delta-first.** The backbone was `git log {prev-tag}..{release-tag}` (`0.27.13..0.28.0` = 31 commits), each mapped to a doc commit on the train + a milestone-issue cross-check. Everything else keyed off it. Compute the delta before anything else.
2. **Real-instance verification on the *genuine* released image** caught a near-false-positive: `/v3/api-docs` returned **HTTP 200**, which looked like the Swagger-revival fix working — but the body was the SPA's `index.html` (the catch-all fallback), not the OpenAPI doc. The real definition was at the springdoc-configured `/api/v3/swagger-ui.html`. **HTTP 200 ≠ working; read the body + content-type** (`memory/feedback_verify_absence_by_reading_config`). A code-only or status-only check would have shipped a wrong "verified".
3. **Security-disclosure discipline held under an explicit instruction.** The release shipped four GHSA fixes; the maintainer said "publish the doc updates." Three independent signals (empty published-advisories API ×2; both advisory pages 404) showed the advisories were **not public**, and the doc items forbade pre-disclosure. "Closed" ≠ "published" on GitHub. Surfacing the contradiction *once, with evidence*, before writing vuln caveats to the public manual was correct — the `documentation` repo is public, so even a pushed branch discloses.
4. **Ontology refresh as a deterministic pipeline** (`scan --full` → `adrs-ingest` → `docs-ingest` → `graph-build` → `alignment`) flipped the scorecard trust-gate `substrate == code HEAD` from RED to GREEN at the released tag, with the heavy agentic reducers correctly *deferred* rather than fired inline.
5. **Mechanical gates + milestone cross-check were fast and clean** — Gate 11 / ≤200-char / PyYAML over the full train, and 17 closed milestone items reconciled to the delta with no stranger.

## What was missing — the gaps that justify the playbook

1. **No full-test-suite run on the released version.** The biggest gap, added by the maintainer: *every* test we have (unit **and** integration/e2e) must run **against the published artifact** and be green — `scripts/run-platform-tests.sh` on the `{version}` checkout, and `ODD_SUT=published:{version} integration-tests/run-suite.sh {suite}` for the IT buckets (pinned to the ghcr image via `build-sut.sh published:{version}`, per `LSN-032`/`LSN-033`). Per-item review already ran full suites; the *release* review did not. A red suite on a published tag = the release fails its own tests = CRITICAL.
2. **The review was ad-hoc beyond the doc gate.** Real-instance verification, the ontology refresh, the security-fix coordination, and the delta-coverage matrix were all improvised. Now they are checks 1, 3, 5, 6 of `release-review.md`; `release-train-merge.md` is check 4 (one dimension, not the whole).
3. **Over-process is itself a defect.** A 3-question `AskUserQuestion` widget and re-surfacing the same security blocker across turns burned the maintainer's scarcest resource (roundtrips) — the same waste as churn (`memory/feedback_ramp_fast_fix_end_to_end_no_questions`). The bar is the *right* amount of process: surface a genuine irreversible-action contradiction once with evidence, then act on the call.

## How to apply

- `/review release:{version}` runs `playbooks/release-review.md` — seven checks: delta-coverage · **full suite on the released version (unit + IT, both buckets, green)** · real-instance on the released image · doc-publication gate · ontology refresh · security coordination · close-out + release record.
- The full suite is **non-negotiable** and runs against the *published* build (`published:{version}`), never local `main`.
- Verify the release on the *running released image*, not the source — and never trust a bare HTTP 200.
- Gate security-doc graduation on advisory **publication**, not just the release; "closed" ≠ "published"; the docs repo is public.
- Refresh the ontology to the released tag and validate via the alignment trust-gate; defer the heavy agentic reducers.
