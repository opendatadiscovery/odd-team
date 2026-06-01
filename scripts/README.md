# Local dev scripts — the pre-push test gate

Run the project's tests **locally before pushing**. A red test in a public repo
is exactly the failure this workspace exists to prevent, so verify locally first.

## Prerequisites (one-time, no sudo)

- **JDK 17** — odd-platform requires Temurin 17 (CI `java-version: '17'`, Jib base
  `eclipse-temurin:17-jdk`). Install user-space:
  ```bash
  mkdir -p ~/.local/jdks && cd ~/.local/jdks \
    && curl -fsSL -o t.tgz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" \
    && tar xzf t.tgz && rm t.tgz
  ```
  The runner auto-detects `~/.local/jdks/jdk-17*` (or set `JAVA_HOME_17`).
- **Docker** running — for Testcontainers integration tests and the probe stacks.
- **uv** — for the ontology extractor + the probe harness.

## 1. odd-platform tests — unit + Testcontainers integration

```bash
scripts/run-platform-tests.sh --check                     # verify the toolchain only
scripts/run-platform-tests.sh --tests "*RegressionPin*"   # the LSN-001/002 landmine pins
scripts/run-platform-tests.sh                             # the whole odd-platform-api suite
```

Auto-detects JDK 17 + Docker, then runs `./gradlew :odd-platform-api:test`.
odd-platform mixes unit and integration in one `src/test` source set; the
integration tests (`BaseIntegrationTest`, Testcontainers-Postgres) need Docker
running. Use `--tests "<pattern>"` to scope to fast unit tests while iterating.

## 2. Integration e2e — the probe harness (odd-team-managed, local-only)

The dynamic-verification harness spins an ephemeral docker-compose mirror of the
target system and runs declarative probes against it (no remote infra, per
APPROACH.md Rule 12):

```bash
/probe-run <P-NNN>     # the skill entry point (recommended)
```

Stacks live in `lineage/_extractor/probe-stacks/`. **Today only `odd-minimal`
(postgres + odd-platform) exists** — the Great-Expectations / Airflow / webhook
multi-service stacks the named integrations need are a pending build (see the
`/align` scorecard D5).

## 3. Ontology extractor tests

```bash
cd lineage/_extractor && uv run pytest -q
```
