"""Test axis — the ground-truth test-suite ingester (Phase 4, ground-truth-lineage).

Positive-space counterpart to the derived `TestGap`. Where the test-coverage-mapper
reducer surfaces *missing* tests (`TEST-GAP-NNN`), this module projects the
**existing** tests as `Test` nodes and wires the ground-truth test edges:
`COVERS` (Test→CodeNode), `ENFORCES` (Test→ADR), `VALIDATES` (Test→Feature),
`REGRESSES` (Test→Finding/RefactoringScope). The bare-noun asymmetry IS the
documentation: `Test` vs `TestGap` (`adrs/drafts/ground-truth-lineage.md` Phase 4).

Two tiers of linkage, mirroring the `@docs` convention the substrate already uses:

1. **Mechanical COVERS** — a test class `FooServiceTest` covers the production
   descriptor `FooService`, resolved against the substrate's
   `(repo, lang, descriptor)` index (the same forgiving identity REALISES uses).
   No annotation required; gives a coverage baseline from the existing suite.
2. **Declared gates** — `@enforces ADR-NNNN` / `@validates F-NNN` /
   `@regresses <id>` / `@pins <bug-id>` / `@covers <ref>` tags in test-file comments,
   parsed here and projected as edges by `graph_query/projector.py`. This is the rail
   that makes `feedback_tests_as_deterministic_gates` real: a test with NO gate is an
   orphan; a gated test declares WHY it exists (which ADR / feature / bug it protects).

   `@regresses` vs `@pins` is the fixed-vs-open distinction: `@regresses <id>` guards a
   FIXED bug against re-introduction (the test is GREEN by asserting the *correct*
   behaviour); `@pins <bug-id>` is a CHARACTERIZATION pin of an OPEN, deliberately-unfixed
   bug — it asserts the documented-INCORRECT behaviour, so it is GREEN while the bug
   exists and goes RED the instant the behaviour changes (a live tripwire on an unplanned
   fix OR a deepening regression — never a dead `@Disabled`). A `@pins` test carries
   `status: pins-known-bug` so the known-bug register is navigable. On the intentional,
   planned fix the test is inverted to `@regresses` + correct-behaviour asserts. The
   general rule + lifecycle: retrospectives/LSN-029.

Deterministic + mechanical (no LLM, no network): files iterate in sorted path
order; rows sorted by `test_id`; only repo-relative paths are emitted (CLAUDE.md
Rule 5); hashing is over normalised text. A gate ref resolving to no node is
surfaced as `unresolved`, never silently dropped.

Granularity (slice 1): one `Test` node per test CLASS (Java) / spec FILE (TS).
The ground-truth-lineage ADR's eventual identity is method-level
(`{file}::{class}::{method}`) — class-level is the first slice, a documented
refinement target, not a silent deviation.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from lineage_extractor.extractors.docs import section_content_hash
from lineage_extractor.repo import short_sha

# Where tests live. Java: any `*.java` under a `src/test/` tree. TS: `*.spec.ts` /
# `*.test.ts` outside node_modules. Globs are repo-root-relative, recursive.
_JAVA_TEST_GLOB = "**/src/test/**/*.java"
_TS_TEST_GLOBS = ("**/*.spec.ts", "**/*.test.ts")

# Gate annotations — the `@docs`-style convention. Parsed from comments anywhere
# in the file (Javadoc/JSDoc/line). The id shapes are deliberately strict so a
# prose mention ("regression of the ADR-0040 behaviour") is not mis-parsed.
_ENFORCES_RE = re.compile(r"@enforces\s+(ADR-\d{2,4})", re.I)
_VALIDATES_RE = re.compile(r"@validates\s+(F-[A-Za-z0-9-]+)", re.I)
_REGRESSES_RE = re.compile(r"@regresses\s+([A-Za-z0-9_.#-]+)", re.I)
# @pins — characterization pin of an OPEN, deliberately-unfixed bug (asserts the
# documented-incorrect behaviour). Distinct from @regresses (guards a FIXED bug).
# The id must be id-SHAPED (a `<PREFIX>-<digit…>` like PLT-016 / LSN-029, or #139) so a
# PROSE mention of the tag ("delete this @pins pin") is not mis-parsed as a bug id — the
# same id-shape discipline @enforces (ADR-\d) / @validates (F-\d) already rely on.
_PINS_RE = re.compile(r"@pins\s+([A-Za-z]+-\d[A-Za-z0-9_.#-]*|#\d+)", re.I)
_COVERS_RE = re.compile(r"@covers\s+(\S+)", re.I)

_JAVA_CLASS_RE = re.compile(r"\b(?:public\s+|final\s+|abstract\s+)*class\s+(\w+)")
# All JUnit5 test-method annotations — not just @Test. Missing the others
# under-counts methods for parameterised/repeated tests and (with the
# 0-method=base-class rule) would wrongly drop real tests like a
# @ParameterizedTest-only MetadataParserTest.
_TEST_METHOD_RE = re.compile(r"@(?:Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b")
_TEST_SUFFIX_RE = re.compile(r"(ITCase|IT|Tests|Test)$")

# test_class heuristics — Java integration markers (Spring slices / Testcontainers).
_INTEGRATION_MARKERS = (
    "BaseIntegrationTest", "@SpringBootTest", "Testcontainers", "@Testcontainers",
    "@WebFluxTest", "@DataR2dbcTest", "@AutoConfigure", "WebTestClient",
)
_SECURITY_MARKERS = ("Security", "Authorization", "Authentication", "@WithMockUser")


@dataclass
class TestNode:
    """One row of `test-nodes.jsonl` — an existing test class/file + its gates.

    Identity is `test_id` = `{repo_rel_path}::{class_or_stem}`. `covers` is the
    mechanically-inferred production descriptor (class-name minus the Test
    suffix); the gate lists are the declared `@enforces/@validates/@regresses/
    @covers` refs. `content_hash` is the drift anchor."""

    __test__ = False  # domain record, not a pytest test class

    test_id: str
    repo: str
    lang: str
    framework: str
    test_class: str               # integration | security | unit
    path: str                     # repo-relative
    class_name: str
    covers: str                   # inferred production descriptor ("" if none)
    method_count: int
    enforces: list[str] = field(default_factory=list)   # ADR-NNNN ids
    validates: list[str] = field(default_factory=list)   # F-NNN ids
    regresses: list[str] = field(default_factory=list)   # guards a FIXED finding/bug from re-introduction
    pins: list[str] = field(default_factory=list)        # characterizes an OPEN bug (→ status pins-known-bug)
    covers_refs: list[str] = field(default_factory=list)  # explicit @covers refs
    content_hash: str = ""
    status: str = "active"                                # active | pins-known-bug (derived from `pins`)

    @property
    def gates_total(self) -> int:
        return (len(self.enforces) + len(self.validates) + len(self.regresses)
                + len(self.pins) + len(self.covers_refs))


@dataclass
class TestIngestResult:
    __test__ = False  # domain record, not a pytest test class

    ok: bool
    upstream_commit: str
    test_count: int
    gated_count: int = 0
    orphan_count: int = 0
    summary: str = ""
    error: str | None = None


def ingest_tests(repo_path: Path, lineage_dir: Path, repo: str, *, dry_run: bool = False) -> TestIngestResult:
    """Walk `repo_path`'s test files → write `test-nodes.jsonl` under `lineage_dir`.
    Pure mechanical transcription (see module docstring)."""
    if not repo_path.is_dir():
        return TestIngestResult(False, "", 0, error=f"repo path not found: {repo_path}")

    nodes: list[TestNode] = []
    for jpath in sorted(repo_path.glob(_JAVA_TEST_GLOB)):
        node = _parse_java_test(jpath, repo_path, repo)
        if node is not None:
            nodes.append(node)
    for pattern in _TS_TEST_GLOBS:
        for tpath in sorted(repo_path.glob(pattern)):
            if "node_modules" in tpath.parts:
                continue
            node = _parse_ts_test(tpath, repo_path, repo)
            if node is not None:
                nodes.append(node)

    # odd-team integration-test protocols (integration-tests/protocols/*.md) — the
    # source-of-truth for the local integration suite; their frontmatter `gates:` block
    # is the contract (the e2e spec / probe is the automation rail).
    nodes.extend(_ingest_integration_protocols(lineage_dir, repo))

    nodes.sort(key=lambda n: n.test_id)
    merged = _merge_gate_map(lineage_dir, nodes)
    # Derive the navigable status AFTER the gate-map merge (which may add @pins refs).
    for n in nodes:
        n.status = "pins-known-bug" if n.pins else "active"
    gated = sum(1 for n in nodes if n.gates_total > 0)
    pinned = sum(1 for n in nodes if n.pins)
    upstream = _safe_short_sha(repo_path)
    summary = "\n".join([
        f"test-lineage ingest — repo={repo} upstream={upstream}",
        f"test nodes: {len(nodes)}  gated (>=1 typed gate): {gated}  orphan: {len(nodes) - gated}"
        + (f"  ({merged} gated via test-gates.yaml retrofit map)" if merged else ""),
        f"known-bug pins (status=pins-known-bug, characterization tripwires): {pinned}",
    ])
    if not dry_run:
        _write_test_nodes(lineage_dir / "test-nodes.jsonl", nodes)
    return TestIngestResult(
        ok=True, upstream_commit=upstream, test_count=len(nodes),
        gated_count=gated, orphan_count=len(nodes) - gated, summary=summary,
    )


def _merge_gate_map(lineage_dir: Path, nodes: list[TestNode]) -> int:
    """Merge an ontology-side gate-map (`lineage/{repo}/test-gates.yaml`) onto the
    parsed Test nodes. The map carries RETROFIT gates for legacy tests whose
    authors did not declare in-source @enforces/@validates/@regresses/@covers —
    these are the ontology maintainer's INFERRED mapping (what each existing test
    covers), kept in the workspace rather than churned into the target repo as
    comments. New deliberate contract tests still declare gates in-source; the two
    sources are unioned. Keyed by `test_id`. Returns the count of nodes the map
    moved from orphan → gated."""
    path = lineage_dir / "test-gates.yaml"
    if not path.is_file():
        return 0
    try:
        from ruamel.yaml import YAML
        data = YAML(typ="safe").load(path.read_text()) or {}
    except Exception:
        return 0
    gate_map = data.get("gates") if isinstance(data, dict) else None
    if not isinstance(gate_map, dict):
        return 0
    by_id = {n.test_id: n for n in nodes}
    moved = 0
    for test_id, gates in gate_map.items():
        node = by_id.get(test_id)
        if node is None or not isinstance(gates, dict):
            continue
        before = node.gates_total
        node.enforces = sorted(set(node.enforces) | {str(x) for x in (gates.get("enforces") or [])})
        node.validates = sorted(set(node.validates) | {str(x) for x in (gates.get("validates") or [])})
        node.regresses = sorted(set(node.regresses) | {str(x) for x in (gates.get("regresses") or [])})
        node.pins = sorted(set(node.pins) | {str(x) for x in (gates.get("pins") or [])})
        node.covers_refs = sorted(set(node.covers_refs) | {str(x) for x in (gates.get("covers") or [])})
        if before == 0 and node.gates_total > 0:
            moved += 1
    return moved


_IT_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---", re.S)


def _ingest_integration_protocols(lineage_dir: Path, repo: str) -> list[TestNode]:
    """Ingest the odd-team integration-test protocols
    (`integration-tests/protocols/*.md`) as Test nodes, reading their frontmatter
    `gates:` block (validates/enforces/regresses). The protocol is the integration
    test's source-of-truth; its e2e spec (`automation: e2e:…`) or probe (`P-NNN`) is the
    automation rail. Workspace-relative: `lineage_dir` is `<workspace>/lineage/{repo}`,
    so the protocols live at `<workspace>/integration-tests/protocols/`. Mechanical, no
    LLM — same deterministic transcription as the repo test scan."""
    proto_dir = lineage_dir.parent.parent / "integration-tests" / "protocols"
    if not proto_dir.is_dir():
        return []
    try:
        from ruamel.yaml import YAML
        yaml = YAML(typ="safe")
    except Exception:
        return []
    nodes: list[TestNode] = []
    for mpath in sorted(proto_dir.glob("*.md")):
        try:
            text = mpath.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        fm_match = _IT_FRONTMATTER_RE.match(text)
        if not fm_match:
            continue
        try:
            fm = yaml.load(fm_match.group(1))
        except Exception:
            continue
        if not isinstance(fm, dict):
            continue
        it_id = str(fm.get("id") or mpath.stem)
        gates = fm.get("gates") if isinstance(fm.get("gates"), dict) else {}
        automation = str(fm.get("automation") or "").strip().lower()
        framework = (
            "playwright" if automation.startswith("e2e:")
            else "probe" if automation.startswith("p-")
            else "manual"
        )
        rel = f"integration-tests/protocols/{mpath.name}"
        nodes.append(TestNode(
            test_id=f"{rel}::{it_id}",
            repo=repo,
            lang="protocol",
            framework=framework,
            test_class=str(fm.get("test_class") or "integration"),
            path=rel,
            class_name=it_id,
            covers="",
            method_count=1,
            enforces=_uniq([str(x) for x in (gates.get("enforces") or [])]),
            validates=_uniq([str(x) for x in (gates.get("validates") or [])]),
            regresses=_uniq([str(x) for x in (gates.get("regresses") or [])]),
            pins=_uniq([str(x) for x in (gates.get("pins") or [])]),
            covers_refs=[],
            content_hash=section_content_hash(text),
        ))
    return nodes


def _parse_java_test(path: Path, repo_path: Path, repo: str) -> TestNode | None:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    methods = len(_TEST_METHOD_RE.findall(text))
    class_m = _JAVA_CLASS_RE.search(text)
    class_name = class_m.group(1) if class_m else path.stem
    # A real test has >=1 @Test method. A 0-method *Test class is a base/abstract/
    # util class (BaseIntegrationTest, BaseIngestionTest, ...) — infrastructure,
    # not a runnable test — so it is not a Test node (and not an "orphan").
    if methods == 0:
        return None
    rel = path.relative_to(repo_path).as_posix()
    covers = _covers_descriptor(class_name)
    return TestNode(
        test_id=f"{rel}::{class_name}",
        repo=repo, lang="java", framework="junit",
        test_class=_test_class(text, class_name),
        path=rel, class_name=class_name, covers=covers, method_count=methods,
        enforces=_uniq(_ENFORCES_RE.findall(text)),
        validates=_uniq(_VALIDATES_RE.findall(text)),
        regresses=_uniq(_REGRESSES_RE.findall(text)),
        pins=_uniq(_PINS_RE.findall(text)),
        covers_refs=_uniq(_COVERS_RE.findall(text)),
        content_hash=section_content_hash(text),
    )


def _parse_ts_test(path: Path, repo_path: Path, repo: str) -> TestNode | None:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None
    rel = path.relative_to(repo_path).as_posix()
    stem = path.name
    framework = "playwright" if (".spec." in path.name or "playwright" in text.lower()) else "vitest"
    methods = len(re.findall(r"\b(?:test|it)\s*\(", text))
    return TestNode(
        test_id=f"{rel}::{stem}",
        repo=repo, lang="ts", framework=framework,
        test_class="integration" if framework == "playwright" else "unit",
        path=rel, class_name=stem, covers="", method_count=methods,
        enforces=_uniq(_ENFORCES_RE.findall(text)),
        validates=_uniq(_VALIDATES_RE.findall(text)),
        regresses=_uniq(_REGRESSES_RE.findall(text)),
        pins=_uniq(_PINS_RE.findall(text)),
        covers_refs=_uniq(_COVERS_RE.findall(text)),
        content_hash=section_content_hash(text),
    )


def _covers_descriptor(class_name: str) -> str:
    """`AlertControllerTest` -> `AlertController`; `OwnershipServiceImplTest` ->
    `OwnershipServiceImpl`. The substrate descriptor index resolves it (or not)."""
    return _TEST_SUFFIX_RE.sub("", class_name)


def _test_class(text: str, class_name: str) -> str:
    if any(m in text for m in _INTEGRATION_MARKERS):
        return "integration"
    if any(m in text for m in _SECURITY_MARKERS) or "Security" in class_name or "Auth" in class_name:
        return "security"
    return "unit"


def _uniq(items: list[str]) -> list[str]:
    return sorted({i.strip() for i in items if i.strip()})


def _safe_short_sha(repo_path: Path) -> str:
    try:
        return short_sha(repo_path)
    except Exception:  # noqa: BLE001 — a repo without git history is still ingestable
        return "unknown"


def _write_test_nodes(path: Path, nodes: list[TestNode]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for node in nodes:
            row = {k: v for k, v in asdict(node).items()}
            fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True))
            fh.write("\n")
    return len(nodes)
