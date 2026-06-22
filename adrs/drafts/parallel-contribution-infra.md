---
adr_slug: parallel-contribution-infra
title: "Running multiple /contribute streams in parallel — isolation model + the script/skill/agent changes it needs"
status: findings-in-progress
date: "2026-06-22"
author: odd-team (CTRIB-029 #1740 session + the CTRIB-028 #1754 /review session — §8)
trigger: "maintainer directive 2026-06-22 — raise velocity by closing issues in parallel without the streams interfering"
---

# Parallel contribution infra — findings + recommendations

> **Living document.** Started during the CTRIB-029 (#1740) run while a second `/contribute` (CTRIB-028 /
> #1754) was actively implementing. The maintainer asked: collect everything learned about running parallel
> streams — obstacles, workarounds, and what the scripts / skills / agents must change to support N
> change-requests at once. Section 4 (runtime obstacles) grows as the CTRIB-029 stream proceeds.
> **Section 8** adds the CTRIB-028 `/review` session's perspective — a reviewer is *also* a parallel stream,
> and reviewing surfaced obstacles (O7-O10) + a resource (R9) the contributor-only model could not see.

## 1. The goal and the core problem

Today a `/contribute` run assumes it is the **only** writer of a set of single-instance, machine-global
resources. Two runs that share them corrupt each other. The maintainer's directive is to make parallel
streams a first-class capability — so the assumption "I am the only run" must be replaced by an explicit
**per-stream isolation namespace**.

The failure this document exists to prevent is the one the CTRIB-028 frontmatter already nearly caused: its
record said `status: planned` (awaiting GATE 1) while its working tree was actually mid-implement on
`contrib/CTRIB-028` with 18 dirty files and its SUT image freshly built into the shared tag — i.e. the
on-disk state and the record had diverged, and a second run reading the record would have mis-modelled what
was safe to touch.

## 2. Shared-resource inventory (what is single-instance today)

Verified this session against the running system and the scripts:

| # | Resource | Where it is fixed | Shared by | Collision effect |
|---|---|---|---|---|
| R1 | **odd-platform working tree** (single checkout) | `../odd-platform` (one clone) | every stream that implements | branch-switch / dirty-file / index races; `ODD_SUT=working` builds the *other* stream's code |
| R2 | **SUT docker image tag** `odd-platform:odd-team-sut` | `build-sut.sh:30` (`TAG=`, not parameterised) | every stream that builds a SUT | last build wins; the other stream's stack silently runs the wrong image |
| R3 | **Compose stack** — container names `probe-odd-platform` / `probe-database`, host ports **18080** / **15432**, one compose file | `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml:30,37,51,65`; consumed at `run-suite.sh:166-168` | every stream that runs the integration bucket | container-name + port conflicts; a second `up` fails or hijacks the first |
| R4 | **Persistent shared e2e stack** (by design) | `run-suite.sh:141-148` | every e2e run | a concurrent `--fresh` does `down -v` on the shared stack mid-run → ECONNREFUSED for the other stream (the documented 2026-06-08 lesson, now a *cross-stream* hazard, not just intra-stream) |
| R5 | **odd-team git index/HEAD** (bookkeeping commits) | `../odd-team` (one clone, shared `main`) | every stream's CTRIB/ADR/IT commits | a `git add` in one stream stages into the index the other stream is about to commit; both push `main` |
| R6 | **documentation working tree** | `../documentation` (one clone) | every stream that touches docs (DOC items, ADRs, the release train) | same as R1/R5 for the docs repo; the train branch `release/0.29.0` is a shared integration branch |
| R7 | **run-log / probe-runs / e2e test-results** output dirs | `integration-tests/run-log/`, `lineage/odd-platform/probe-runs/`, `integration-tests/e2e/test-results/` | every integration run | interleaved/overwritten artefacts; `run-suite.sh:202` logs `../odd-platform` HEAD = the *other* stream's sha |
| R8 | **Shared `:latest` / `:0.0.1-SNAPSHOT` jib tags** | jib default `to.tags` | every jib build | a build retags `odd-platform:latest` to its own image (cosmetic — running containers are ID-pinned — but a *new* `up` resolving `:latest` would drift) |

## 3. The escape hatches that already exist (the good news)

The scripts were written SUT-as-a-parameter-aware, so several knobs already enable isolation without patching:

- **`ODD_PLATFORM_DIR=<path>`** — both `build-sut.sh:33` and `run-platform-tests.sh:40` honour it → point the
  unit build and the `working` SUT build at **my worktree** instead of the shared checkout. (Solves R1 for builds.)
- **`ODD_PLATFORM_IMAGE=<tag>`** — `run-suite.sh:105` bypasses `build-sut.sh` entirely and uses a raw image →
  I build my own tag and hand it in. (Works around R2 *if* I build the tag myself.)
- **`--no-daemon`** (`run-platform-tests.sh:100`) — no shared gradle daemon to conflict; concurrent unit
  builds in separate project dirs are correctness-safe (Testcontainers uses random host ports + Ryuk per run).
- **`git worktree`** — the repo's own object store is shared but each worktree has its **own index + HEAD +
  working files**, so a worktree is the clean isolation primitive for R1/R6. (`build-sut.sh:70-78` already uses
  an ephemeral `/tmp` worktree for `main`/`ref:` builds — the pattern is proven in-tree.)
- **The compose image is `${ODD_PLATFORM_IMAGE:-…}`** (`odd-minimal…yml:50`) — already env-driven.

## 4. The per-stream isolation model (what a parallel stream must set)

Every stream claims a short **stream id** (e.g. `ctrib029`) and namespaces ALL of R1-R7 by it:

| Resource | Single-stream default | Isolated value for stream `ctrib029` |
|---|---|---|
| worktree (R1) | `../odd-platform` | `../odd-platform-ctrib029` (`git worktree add … origin/main -b contrib/CTRIB-029-…`) |
| SUT image (R2) | `odd-platform:odd-team-sut` | `odd-platform:odd-team-sut-ctrib029` |
| compose project (R3) | (dir default) | `COMPOSE_PROJECT_NAME=ctrib029` |
| container names (R3) | `probe-odd-platform` / `probe-database` | `ctrib029-odd-platform` / `ctrib029-database` |
| host ports (R3) | 18080 / 15432 | **18090 / 15442** (verified free vs #1754's live 18080/15432) |
| docs worktree (R6) | `../documentation` | `../documentation-ctrib029` (branch off `release/0.29.0`) |
| run-log tag (R7) | `${day}-${arg}.md` | include the stream id in the arg/log name |

**Obstacle O1 (R2 — image tag not parameterised).** `build-sut.sh` hardcodes `TAG`. *Workaround:* build jib
directly into my tag (`gradlew :odd-platform-api:jibDockerBuild --image=odd-platform:odd-team-sut-ctrib029 -x test`,
the same command `build-sut.sh:47` runs) from my worktree, then `ODD_PLATFORM_IMAGE=…-ctrib029 run-suite.sh`.
*Better fix:* `build-sut.sh` should accept `ODD_SUT_TAG` / `--tag` (default the stable tag) so it stays the
single build entrypoint for every stream.

**Obstacle O2 (R3/R4 — `run-suite.sh` e2e rail is welded to the fixed compose + name + port).** Lines 166-168
hardcode the compose path, `probe-odd-platform`, and `:18080`; the stack is deliberately persistent+shared
(R4). *Workaround for CTRIB-029:* drive my **own** stack for the API-level reproduction + the API-probe IT
(a parameterised copy of the compose with my project/names/ports/tag), bypassing the e2e rail; the e2e rail
cannot today point at a second stack. *Better fix:* `run-suite.sh` should take a stream id and template the
compose (project name, container names, host ports, health URL) — i.e. the persistent-shared-stack design
(correct for one stream) needs a per-stream-stack mode for N streams.

**Obstacle O3 (R5/R6 — shared git index on odd-team + documentation).** Two streams committing bookkeeping to
the same `main`/train share one index; a careless `git add` in one sweeps the other's staged files. *Workaround:*
stage ONLY explicit paths and commit atomically (never leave files staged across an await); keep new files
untracked until the commit moment (CTRIB-029 + this doc sit untracked, as CTRIB-028's artefacts do). *Better fix:*
give each stream its own odd-team worktree branch for bookkeeping, merged at the gate; or a per-stream commit
queue. (The git index is the one shared resource a worktree of *odd-platform* does NOT solve — it's the
*coordination* repo.)

**Obstacle O4 (cross-stream state visibility).** A stream's CTRIB frontmatter can lag its real on-disk state
(CTRIB-028 said `planned` while mid-implement). A second stream that trusts the record mis-plans. *Workaround:*
verify the live working tree (`git -C ../odd-platform status/branch`, `docker ps`) rather than the record.
*Better fix:* a lightweight `state/active-streams.yaml` lock each `/contribute` run writes at intake and
updates per phase (stream id, issue, branch, worktree path, image tag, ports, the files it OWNS), so a starting
run reads one place to learn what is claimed — and picks non-colliding ports/ids deterministically.

**Obstacle O5 (CTRIB id race).** Two runs both compute `max(CTRIB-*)+1` → same id. *Workaround this session:*
CTRIB-028 already existed on disk, so CTRIB-029 was unambiguous. *Better fix:* the `active-streams.yaml` lock
(O4) reserves the id atomically at intake.

**Obstacle O6 (push-to-shared-`main` trap — LSN-038, amplified by parallel streams).** A worktree branch created
with `worktree add -b <branch> origin/main` (like `checkout -b <branch> origin/main`) is auto-set to track
`origin/main` (`branch.<name>.merge=refs/heads/main`); a bare `git push` then fast-forwards **shared `main`** with
unreviewed code — and it bypasses G-C4's bot-only merge gate when a human admin pushes. With N streams the hazard
compounds: every worktree is a fresh chance to mis-track, and the victim is the one branch all streams share. This
actually fired in the CTRIB-028 stream — its fix branch published unreviewed code to public `odd-platform` `main`
(`retrospectives/LSN-038`, sequel to `LSN-034`). *Standing fix (applied this session):* `git config push.default
current` **once per clone** — it lives in `.git/config`, so every worktree of that clone inherits it and a bare
push can only ever update the *same-named* remote branch, never `main`. *Per-worktree belt-and-suspenders:* publish
with an explicit same-name refspec (`git push -u origin <branch>`), and before any push assert
`git rev-parse --abbrev-ref @{u}` ≠ `origin/main`. The §6 recipe below bakes this in. (`playbooks/github-write.md`
step 5; `pillars/contributor/gates.md` G-C4 human-path clause.)

## 5. Recommended changes (for the maintainer's script/skill/agent pass)

1. **`build-sut.sh`** — add `ODD_SUT_TAG` (default `odd-platform:odd-team-sut`); emit it in `SUT_IMAGE=`. (O1/R2)
2. **`run-suite.sh`** — add a stream-id mode: template `COMPOSE_PROJECT_NAME`, container names, host ports, and
   the health URL; keep the persistent-shared stack as the default (one stream), add per-stream stacks for N. (O2/R3/R4)
3. **The compose file** — parameterise container names + ports (`${ODD_STREAM:-probe}-odd-platform`,
   `${ODD_API_PORT:-18080}:8080`, …) so one file serves every stream. (R3)
4. **`state/active-streams.yaml`** — a new coordination lock the `/contribute` skill writes at intake (id, issue,
   branch, worktree, image tag, ports, owned-files) and clears at GATE 2 / blocked. (O4/O5)
   **✓ Built 2026-06-22** (the CTRIB-028 `/review` session): the file exists + is committed, carrying a `role`
   enum (`contributor` / `reviewer` / `probe-run` / `reducer`), a `shared_resources` block (incl. the
   `lineage/**` single-writer row R9), and an `unowned_dirty_state` block. §8 records the obstacles (O7-O10)
   that shaped it; #9-11 below are the remaining skill/protocol wiring that keeps it populated automatically.
5. **The `/contribute` skill (Phase A + Phase B/D)** — read `active-streams.yaml`, reserve a stream id + a free
   port pair, create a worktree by default when another stream is active, and verify live working-tree state
   over the record. (O3/O4)
6. **Per-stream odd-team bookkeeping** — a worktree/branch per stream merged at the gate, or explicit-path
   atomic commits as the interim discipline. (O3/R5)
7. **The full e2e regression stays serialized across streams** (R4): even with per-stream stacks, the heavy
   `feature-complete`/`multi-stack`/`ingestion-e2e` runs contend for CPU/RAM/disk and for "one e2e at a time vs a
   possible maintainer run" (G-C2). Recommend: parallelize the cheap, fully-isolatable buckets (unit + targeted
   API-probe) and **schedule** the full e2e regression (a queue / a gate), rather than running two at once.
8. **Worktree git-safety — a push must never reach shared `main` (O6 / `retrospectives/LSN-038`).** `git config
   push.default current` **once per clone** (inherited by every worktree — the standing guard); never leave a
   worktree/contrib branch tracking `origin/main` (the `worktree add -b … origin/main` form does — unset it or
   publish only via a same-name `git push -u origin <branch>`); the `/contribute` skill asserts
   `@{u} != origin/main` before every push. The shared-`main` blast radius makes this non-optional for parallel
   streams. (`playbooks/github-write.md` step 5; G-C4 human-path clause.)

## 6. The isolated-stream recipe (CTRIB-029, concrete)

```
STREAM=ctrib029
# R1: worktree off origin/main on the contrib branch
git -C ../odd-platform worktree add ../odd-platform-$STREAM -b contrib/CTRIB-029-ingestion-auth-coverage origin/main
# SAFETY (O6 / LSN-038): the branch above is auto-tracked to origin/main → a bare push would hit shared main.
git -C ../odd-platform config push.default current   # once per clone; inherited by EVERY worktree (.git/config)
# publish ONLY via a same-name refspec; pre-push assert the upstream is not main:
#   git -C ../odd-platform-$STREAM push -u origin contrib/CTRIB-029-ingestion-auth-coverage
#   test "$(git -C ../odd-platform-$STREAM rev-parse --abbrev-ref @{u} 2>/dev/null)" != origin/main
# R1: unit bucket on MY code
ODD_PLATFORM_DIR=$PWD/../odd-platform-$STREAM scripts/run-platform-tests.sh --tests "*Ingestion*Filter*"
# R2: build MY image tag from MY worktree (build-sut's jib cmd, retargeted)
JAVA_HOME=$JDK17 ../odd-platform-$STREAM/gradlew -p ../odd-platform-$STREAM \
  :odd-platform-api:jibDockerBuild --image=odd-platform:odd-team-sut-$STREAM -x test
# R3: MY stack — copy the compose, set project/names/ports, image=my tag, flag ON
#   ports 18090/15442, names ctrib029-*, COMPOSE_PROJECT_NAME=ctrib029
# curl MY api on :18090 for the live reproduction; author the API-probe IT against MY ports
```

## 7. Runtime validation (CTRIB-029, live — the model held)

Standing up the #1740 stream beside the live #1754 stream, in practice:

- **Unit bucket — clean parallel, today.** `ODD_PLATFORM_DIR=../odd-platform-ctrib029
  scripts/run-platform-tests.sh --tests "*Ingestion*"` compiled + checkstyled + ran the filter/repo tests
  against MY worktree while #1754's gradle + Testcontainers ran — no collision (separate project dirs,
  `--no-daemon`, Testcontainers' own random ports). The `ODD_PLATFORM_DIR` hatch is sufficient for unit. ✓
- **SUT image — O1 confirmed.** `build-sut.sh` cannot target a per-stream tag, so I ran its jib command
  directly: `gradlew -p ../odd-platform-ctrib029 :odd-platform-api:jibDockerBuild
  --image=odd-platform:odd-team-sut-ctrib029 -x test -PbundleUI=false`. Works; every stream re-deriving this
  is the argument for the `ODD_SUT_TAG` knob (§5.1).
- **Integration stack — O2 confirmed.** `run-suite.sh`'s rails are welded to the fixed compose + `probe-*`
  names + 18080/15432, so I authored a separate `/tmp/ctrib029-stack/docker-compose.yml` (project ctrib029,
  names `ctrib029-*`, ports 18090/15442) and drive it with `curl`. A parameterised compose + a stream-id mode
  on `run-suite.sh` (§5.2-3) would let the IT rail target it instead of a hand-rolled stack.
- **Shared jib tags (R8) — observed.** jib also writes `odd-platform:0.0.1-SNAPSHOT`/`:latest`; my build
  moves those to my image. Harmless here (#1754's running containers are ID-pinned and its flow references
  `odd-team-sut` explicitly, never `:latest`), but a stream resolving `:latest` would drift — suppress the
  extra tags per stream, or accept the cosmetic move.
- **Net:** the cheap, fully-isolatable buckets (unit + a targeted API stack) parallelise cleanly TODAY with
  env knobs + a worktree + a hand-authored compose. The remaining gap is ergonomics (make the knobs built-in)
  and the full e2e regression (§5.7), which still serializes across streams.

Sources: `integration-tests/build-sut.sh`, `integration-tests/run-suite.sh`,
`scripts/run-platform-tests.sh`, `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml`,
`docker ps` (#1754's live stack on 18080/15432), and the live CTRIB-029 parallel run, all 2026-06-22.

## 8. Reviewer-session findings (2026-06-22) — the second perspective + what the contributor model missed

> Added by the **CTRIB-028 `/review` session** running parallel-aware beside the CTRIB-029 (#1740) stream.
> §1-7 are the contributor's view (two `/contribute` streams sharing a machine). A `/review` is *also* a parallel
> stream, with a different resource profile — and reviewing CTRIB-028 surfaced obstacles the contributor-only
> model structurally could not see. The committed `state/active-streams.yaml` (§5 #4, now built) already encodes
> these; this section is the WHY, and the recommendations (#9-11) are the wiring that keeps it true automatically.

### New shared resource

| # | Resource | Where it is fixed | Shared by | Collision effect |
|---|---|---|---|---|
| R9 | **the `lineage/**` ontology tree + the graph embedding** | `lineage/{repo}/**` + the embedded index | every `/enrich`, every `/probe-run`, every reducer / `/next-batch` loop | two writers rewriting sidecars / `feature-flows.yaml` + re-embedding concurrently corrupt the tree + the index — it is **single-writer-serialized**, broader than R7's per-run output dirs |

### Obstacles (continuing the O-series)

**O7 — the reviewer is an unmodelled stream role.** §1-7 model contributor↔contributor only. A `/review` session
has a distinct profile: (a) it reads the target repos (`../odd-platform`, `../documentation`) **read-only** — no
worktree, no SUT build, no docker, no stack (so it does NOT touch R1/R2/R3/R4); (b) it **must NOT write
`lineage/**` (R9)** — review is read-only on the ontology and `/enrich` is `/implement`'s job (re-enrich as a
review side-effect is forbidden, `.claude/skills/review`); but (c) it **does** contend for **R5** — it commits
the verdict + the `PROGRESS.md` record to the shared odd-team index. And it creates the **awareness asymmetry the
maintainer named explicitly**: the contributor streams do not know a review is in flight against one of them
("you know about CTRIB-029 … it does not know about you"). *Workaround (this session):* the reviewer registered a
read-only entry in `active-streams.yaml` so 029 — and any later run — can see it. *Better fix:* the `/review`
skill reads + registers a `role: reviewer` entry at intake and clears it at the verdict (§5 #10).

**O8 — `lineage/**` is multi-writer, and the lock holder is often NOT a `/contribute` stream.** The model
implicitly assumes the parallel actors are contribute streams; the actual holder of the `lineage/**` lock this
session was a **`/probe-run` (P-001)** — its measured-value merge left 6 `lineage/**` files dirty + an untracked
`probe-runs/2026-06-22-P-001.yaml`. **CTRIB-028's ledger mis-attributed this dirt to "CTRIB-029's lineage
edits"**, but 029's enrich was still *pending* and its uncommitted work is auth-filter code in its worktree —
nowhere near `lineage/**`. The deferral *decision* (don't `/enrich` into a dirty tree) was correct; the *named
owner was wrong*, and a stream trusting that record would mis-model who holds the lock. *Workaround:* attribute
the lock to whatever is actually dirty (`git status lineage/` + read the `probe_run_id` in `feature-flows.yaml`),
never to a guessed stream. *Better fix:* the registry tracks R9 with its **true current holder** and a `role`
enum including `probe-run` / `reducer` / `enrich`; the rule is "no `/enrich` while `lineage/**` is dirty **or**
claimed, whoever holds it" (§5 #9). **The deepest implication:** the registry is not "active *contribute*
streams" — it is "active **writers of any shared resource**." A `/probe-run`, a reducer batch, or a `/next-batch`
loop must register too, or the single most common lineage-lock holder stays invisible — which is exactly the O8
miss.

**O9 — shared-checkout manual churn → a stale recorded SHA (sharpens O4).** O4's example is a lagging *status*;
a sharper case this session is a lagging *commit*. The shared `../odd-platform` checkout had a **manual
revert+reapply** by the maintainer (`9d3de146` → revert `b5930a75` → reapply `75fc06cd`), yet CTRIB-028's record
still cited `9d3de146`. `git diff 9d3de146 75fc06cd` was empty (content-identical, so the code itself stood), but
a stream or reviewer that checked out the *recorded* SHA would land on a commit that is no longer the branch head
— and on a busy shared checkout the next churn may not be content-identical. *Better fix:* O4's "verify the live
tree" explicitly includes `git -C ../odd-platform rev-parse HEAD` + the branch name, compared against the
record's cited SHA; the registry records the **live head + a `verified-at` timestamp**, never the record's claim
(§5 #11).

**O10 — orphaned unowned dirty state in the shared tree.** Beyond the probe-run residue (O8), the working tree
also carried an uncommitted `integration-tests/e2e/specs/dq-run-history.spec.ts` (run-status / DQ class — the
CTRIB-024 / #1757 area) that **no registered stream's record claims**. A starting stream must therefore **not
assume a clean tree**, and must **never `git checkout --` / `git add` files it does not own** — reverting another
activity's in-flight work is the destructive sibling of the O3 index race. *Better fix:* the registry carries an
`unowned_dirty_state` block (built this session); the read-at-intake protocol adds "reconcile or route around
unowned dirt; sweep nothing you don't own" (§5 #11).

### Added recommendations (continuing §5)

9. **Broaden the registry from "active /contribute streams" to "active writers of any shared resource."** A
   `/probe-run`, a reducer batch, a `/next-batch` autonomous loop, and an `/enrich` all write R9 and must
   register, under a `role` enum (`contributor` / `reviewer` / `probe-run` / `reducer` / `enrich` /
   `maintainer`). Without this, the most common `lineage/**` lock-holder (a probe-run) is invisible to a
   contributor planning its own enrich — the O8 miss. (O8 / R9)
10. **The `/review` skill reads + registers a read-only `reviewer` entry** at intake, and clears it at the
    verdict — so contributor streams can see a review in flight (O7). It must NOT run `/enrich` (read-only on
    `lineage/**`); a review writes only its verdict + `PROGRESS.md` (+ the registry). This is the §5 #5 analogue
    for the reviewer role. (O7)
11. **The registry records live-verified state, not record claims, and flags unowned dirt.** Each entry carries
    the **live** branch head + a `verified-at` timestamp (O9); a top-level `unowned_dirty_state` block lists
    uncommitted residue no stream owns (O10). The read-at-intake protocol gains two rules: *verify the live
    tree over any record*, and *sweep nothing you don't own*. (O9 / O10)

> §5 #4 is now **built**; the committed `state/active-streams.yaml` already implements the #9-11 schema (the
> `role` enum, R9 as a `shared_resources` single-writer row with its true holder, the `unowned_dirty_state`
> block). #9-11 are the skill/protocol wiring that keeps it populated without hand-maintenance.

Sources (reviewer session, all 2026-06-22, verified live): `git -C ../odd-platform log/diff/rev-parse`
(head `75fc06cd` vs recorded `9d3de146`; revert `b5930a75`; `git diff` empty); `git -C ../odd-team status`
(probe-run `lineage/**` residue + `integration-tests/e2e/specs/dq-run-history.spec.ts`);
`lineage/odd-platform/feature-flows.yaml` (`probe_run_id R-20260622T123548Z-P-001`, `ran_at 2026-06-22T12:35:48Z`);
`docker ps` (only #1754's 18080/15432 + ryuk — no ctrib029 stack up); `git worktree list`
(`../odd-platform-ctrib029` on its own branch); `.claude/skills/review` (review is read-only on the repo;
re-enrich is `/implement`'s job); `pillars/contributor/gates.md` G-C10 (ontology refresh is a DoD gate);
`state/active-streams.yaml` (built + committed this session).
