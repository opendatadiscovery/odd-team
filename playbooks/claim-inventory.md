---
playbook: claim-inventory
status: active
since: 2026-05-01
applies_to: universal
---

# PROTOCOL claim-inventory

Draft the `Sources:` commit footer **before** authoring. For every factual claim the change will make, name the canonical SoT class and verify it. Memory and plausibility are not sources.

## trigger

Any implementation commit on a pillar's content surface (documentation, tests, features, code-quality) that asserts factual claims.

## inputs

- list of factual claims the change will make
- the active pillar's SoT-class table (`pillars/documentation/gates.md` Gate 9 for documentation; future pillars author their own SoT table)
- the navigation index (`navigation/architecture.md`, `navigation/domains/*.md`)

## procedure

1. **Enumerate every factual claim** the change will make. Sentences like "the default is X", "the SDK retries Y times", "the endpoint accepts Z", "this is hosted at repo W" are claims. Sentences like "this section explains how" are not.

2. **Per claim, name the SoT class.** The active pillar's SoT-class table maps claim shape → class:

   | Claim shape | Class | Sources-line format |
   |---|---|---|
   | A GitHub URL or a repo's role | `Repo` | `Repo: {url} → architecture.md row "{repo}"` |
   | An integration's category (adapter / collector / push-client / plugin / SDK) | `Integration` | `Integration: {name} → architecture.md §"Canonical vocabulary"` |
   | A config key's behavior or default | `Config` + `Config-consumer` | `Config: {yml-key} → {consumer:line}` (one bullet per consumer) |
   | An SDK builder's behavior | `Builder` | `Builder: {file:line} ({param-status table})` (run `playbooks/unset-parameter-audit.md`) |
   | A spec path / verb / schema | `Spec` | `Spec: {yaml-path}:line` |
   | A term, alias, or canonical name | `Term` | `Term: main-concepts.md §Terms — "{alias}"` |
   | A feature lifecycle (GA / Beta / Experimental / Deprecated) | `Lifecycle` | `Lifecycle: {ADR + CHANGELOG}` |
   | A dependency or version | `Dep` | `Dep: {file:line}` |
   | An error / retry / timeout behavior | `Handler` | `Handler: {file:line}` |
   | A cross-repo code reference | `Cross-repo` | `Cross-repo: {repo}/{file:line}` |
   | An existing in-flight backlog item | `Backlog` | `Backlog: {DOC-NNN} ({status})` |

3. **Per class, verify the SoT** (run `playbooks/consumer-read.md` for the `Config` / `SDK` / `Feature` / `Error` classes):

   - `Repo` → WebFetch target README + check `navigation/architecture.md` row.
   - `Integration` → read `navigation/architecture.md` "Canonical vocabulary" + the integration's README.
   - `Config` → run `playbooks/consumer-read.md` with `claim class = config`.
   - `Builder` → run `playbooks/unset-parameter-audit.md`.
   - `Spec` → grep the OpenAPI YAML on current `main`.
   - `Term` → read `docs/main-concepts.md` Terms & Aliases (or add a row in this PR).
   - `Lifecycle` → read ADR + target repo `CHANGELOG.md` / release tag + grep current `main`.
   - `Dep` → read `pyproject.toml` / `build.gradle` / `package.json` on current `main`.
   - `Handler` → read explicit handler file.
   - `Cross-repo` → read target repo clone (not GitHub web UI — line offsets must match).
   - `Backlog` → grep `backlog/{cat}/` for keywords (run `playbooks/duplication-sweep.md` step 3).

4. **Compose the `Sources:` footer** with one line per claim class. Multiple bullets per class are fine (one per consumer / one per file).

5. **Banned-phrase check.** Scan the commit body and any review note. Reject the following as standalone justifications:

   `"defensible"`, `"monorepo default"`, `"probably correct"`, `"looks right"`, `"canonical owner"`, `"safe to assume"`, `"presumably"`, `"should be"`.

   Every claim ends in `VERIFIED via {fetch/grep/read}` or `NOT VERIFIED → logging as DOC-NNN`.

6. **Prose-polish exception.** If the change makes no factual claims (whitespace, typo fix, prose-only polish), write `Sources: none (prose polish, no factual claim)` explicitly. Silence is not acceptable.

## exit

- Every claim has a `Sources:` footer line citing a verified SoT.
- No banned phrases standalone in the commit body or review.
- Prose-polish items have the explicit-none footer.

## on-fail

- If a claim's SoT is not reachable in under 60 seconds of verification, drop the claim or mark the item `blocked` pending SoT.
- If a banned phrase appears, rewrite ending with `VERIFIED via …` or `NOT VERIFIED → logging as …`.

## case-law

- `retrospectives/LSN-001-attachment-ephemeral-default.md`, `retrospectives/LSN-002-minio-region-unset.md`, `retrospectives/LSN-010-azure-admin-groups-wrong-default.md` — `Config` and `Builder` claim classes the rule was built around.
- `retrospectives/LSN-003-dbt-wrong-repo-link.md` — `Repo` claim class.
- `retrospectives/LSN-009-backlog-internal-duplication.md` — `Backlog` claim class.
