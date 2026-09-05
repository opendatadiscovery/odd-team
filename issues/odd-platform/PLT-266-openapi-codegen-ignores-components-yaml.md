---
id: PLT-266
title: "Track components.yaml as an input of the OpenAPI codegen task"
target_repo: odd-platform
issue_type: bug
status: draft
github_issue_url: ""
github_issue_number: null
filed_title: "Gradle: a components.yaml-only spec change leaves the generated API models stale (openApiGenerate stays UP-TO-DATE)"
filed_labels: "kind: bug, scope: backend"
severity: low            # developer-only: no runtime or operator impact; a local incremental-build defect with a three-line fix
discovered_during: "the maintainer's own local ./gradlew build of main@af5a573b right after merging #1879 (CTRIB-065), 2026-09-05; root-caused, reproduced and the fix verified in a clean worktree the same day"
found_date: "2026-09-05"
user_facing_verified: true    # the user here is the developer at the build: observed on the maintainer's checkout (three javac errors in SavedSearchServiceImpl, 15 tasks up-to-date) and reproduced deterministically in a clean worktree at af5a573b (Steps to reproduce)
suggested_milestone: ""       # build hygiene, no release coupling; the maintainer attaches one
---

## What

A change that touches only `odd-platform-specification/components.yaml` does not re-run the `openApiGenerate`
task of `odd-platform-api-contract` in an existing Gradle build directory. Gradle reports the task `UP-TO-DATE`,
the generated `org.opendatadiscovery.oddplatform.api.contract.model.*` classes keep their previous shape, and
`:odd-platform-api:compileJava` then fails with type errors that look like a bug in hand-written code.

Seen on `main` at `af5a573b` (the #1879 squash, which retyped `SavedSearch.spec` and `SavedSearchFormData.spec`
from `SearchFormData` to `AssetSearchFormData` in components.yaml only) with an incremental `./gradlew build`:

```
> Task :odd-platform-api:compileJava
.../service/SavedSearchServiceImpl.java:52: error: incompatible types: SearchFormData cannot be converted to AssetSearchFormData
.../service/SavedSearchServiceImpl.java:84: error: incompatible types: SearchFormData cannot be converted to AssetSearchFormData
.../service/SavedSearchServiceImpl.java:102: error: incompatible types: AssetSearchFormData cannot be converted to SearchFormData
3 errors
> Task :odd-platform-api:compileJava FAILED
...
19 actionable tasks: 4 executed, 15 up-to-date
```

The source is correct: CI is green on that commit, and the same tree compiles clean once the codegen is fresh
(`BUILD SUCCESSFUL in 3m 35s` for `:odd-platform-api:compileJava` on a clean worktree). The generated
`SavedSearchFormData.java` in `build/` was two days older than the spec and still declared
`private SearchFormData spec;`.

## Where

- `odd-platform-api-contract/build.gradle:9-34` -- the `openApiGenerate { ... }` block sets
  `inputSpec = "$projectDir/../odd-platform-specification/openapi.yaml"` (`:12`) and declares nothing else
  as an input.
- `odd-platform-specification/openapi.yaml` -- 531 `$ref: './components.yaml/#/components/schemas/...'`
  references (for example `:986`); every request and response schema is defined in `components.yaml`, the file
  Gradle does not track.
- `org.openapi.generator` plugin 6.5.0 (`build.gradle:2`): its `GenerateTask` declares `inputSpec` as
  `@InputFile` and `templateDir` as `@InputDirectory` (read off the 6.5.0 jar). It knows nothing about
  `$ref`-ed files, so Gradle's up-to-date check fingerprints `openapi.yaml` alone.

## Steps to reproduce

On a clean checkout of `af5a573b` (Gradle 8.5, JDK 17, no `build/` directory yet):

```
./gradlew :odd-platform-api-contract:openApiGenerate         # executes (1m44s); generated SavedSearchFormData.spec is AssetSearchFormData
./gradlew :odd-platform-api-contract:openApiGenerate         # UP-TO-DATE (5s), as expected
# edit any schema text in odd-platform-specification/components.yaml -- a description is enough
./gradlew :odd-platform-api-contract:openApiGenerate         # UP-TO-DATE (4s): the edit never reaches the generated sources
./gradlew :odd-platform-api-contract:openApiGenerate --rerun # executes (56s); the edited text is now in the generated model
```

The real-world trigger is a `git pull` that brings a components.yaml-only change, followed by a build without
`clean`. Of the last 12 commits that touched the spec, 5 changed components.yaml only (`af5a573b`, `969a5d5b`,
`b5d9f150`, `a3d849cc`, `f12b8fbc`), so this is the common case, not a corner.

## User-facing impact

Developer-facing only; operators and API consumers are unaffected. A contributor who pulls `main` and builds
incrementally gets a red build in `:odd-platform-api:compileJava` that blames service code, with no hint that
the generated model is stale. The maintainer hit it on 2026-09-05 right after merging #1879: a 9-minute build
(UI bundle included) ending in the three errors above.

CI never sees it: the build workflows start from `actions/checkout` and run `./gradlew ...` on a fresh tree,
and the `gradle` cache they keep is `~/.gradle/caches` (dependencies), not the project's `build/` output. The
UI module is not affected either: its client is regenerated on every build (in the same failing build the
generated `SavedSearchFormData.ts` was fresh and already typed `spec: AssetSearchFormData`). Only the Java
contract module carries the gap.

## Why it matters

Every API change in this repository starts in components.yaml, so this is the default failure mode for anyone
building incrementally after a pull: a confusing red build, time lost chasing a phantom source bug, and a
`./gradlew clean` habit as the workaround (which also throws away the jOOQ codegen and the UI bundle, minutes
per build). Low severity because nothing shipped is wrong; it is simply paid on most pulls, and the fix is three
lines.

## Suggested fix

Declare the spec directory as an input of the task. It has to go on the task: the `openApiGenerate { ... }`
block in this build script configures the plugin's extension, which has no `inputs` property (adding it there
fails with `Could not get unknown property 'inputs' for extension 'openApiGenerate'`).

```groovy
// odd-platform-api-contract/build.gradle, after `compileJava.dependsOn tasks.openApiGenerate`

// openapi.yaml $ref-s every schema from components.yaml, but the plugin declares only inputSpec as a task
// input, so a components.yaml-only change left the task UP-TO-DATE and the generated models stale.
tasks.named("openApiGenerate") {
    inputs.dir("$projectDir/../odd-platform-specification")
}
```

Verified 2026-09-05 on a clean worktree at `af5a573b`: with the block in place the task executed once for the
changed input set (53s), was UP-TO-DATE on the next run (4s), executed again after a components.yaml edit (50s,
the edited text present in the generated model) and was UP-TO-DATE after that (3s).
`inputs.files(fileTree(...) { include '*.yaml' })` would do as well if the directory ever grows non-spec files;
open to alternatives.

Until it lands, the workaround after pulling a spec change is
`./gradlew :odd-platform-api-contract:openApiGenerate --rerun` (or `:odd-platform-api-contract:clean`) before
the build.

## How discovered

The maintainer's local `./gradlew build` on `main` right after merging #1879 (workspace item CTRIB-065) failed
as above on 2026-09-05. Root-caused in the odd-team workspace the same day by reading the generated
`SavedSearchFormData.java` (dated 2026-09-03, `spec` typed `SearchFormData`) against `components.yaml` (updated
by the pull) and the task's declared inputs; reproduced, and the fix verified, in a throwaway worktree at
`af5a573b`. Tracked as `PLT-266`.
