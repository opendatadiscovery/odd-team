---
adr_slug: parallel-contribution-infra
title: "Running multiple /contribute streams in parallel — isolation model + the script/skill/agent changes it needs"
status: findings-in-progress
date: "2026-06-22"
author: odd-team (CTRIB-029 session, in parallel with the CTRIB-028/#1754 session)
trigger: "maintainer directive 2026-06-22 — raise velocity by closing issues in parallel without the streams interfering"
---

# Parallel contribution infra — findings + recommendations

> **Living document.** Started during the CTRIB-029 (#1740) run while a second `/contribute` (CTRIB-028 /
> #1754) was actively implementing. The maintainer asked: collect everything learned about running parallel
> streams — obstacles, workarounds, and what the scripts / skills / agents must change to support N
> change-requests at once. Section 4 (runtime obstacles) grows as the CTRIB-029 stream proceeds.

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
