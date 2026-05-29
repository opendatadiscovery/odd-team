"""Shared constants + path layout for the derived graph query layer.

Everything here is a calibration starting point reasoned in the ADR /
research artefacts; the reasoning travels with the value so a future
maintainer can move it deliberately. See `adrs/drafts/graph-query-layer.md`
and `adrs/drafts/research/graph-query-layer/{STACK,SCHEMA,PROBES}.md`.
"""
from __future__ import annotations

from pathlib import Path

# --------------------------------------------------------------------------
# Versions

BUILDER_VERSION = "0.1.0"

# --------------------------------------------------------------------------
# Embedding model.
#
# The ADR's lead candidate is EmbeddingGemma-300m. It is NOT in fastembed's
# supported-model registry (verified 2026-05-21 — fastembed ships 30 text
# models; EmbeddingGemma is not one). STACK + SCHEMA both flag the model
# choice as a probe-time decision, not a hard commitment: STACK closes with
# "resolve it with a retrieval probe on the actual sidecar corpus rather than
# leaderboard averages"; SCHEMA open-question #3 defers to "a slice that
# measures shape-A recall on a fixed query set before committing".
#
# So the default below is a fastembed-native, licence-clean retrieval model;
# the maiden PROBES run (query-gold-set.yaml) settles the final choice. The
# embedding cache is keyed on this id, so swapping the model correctly
# invalidates every vector — the swap is a one-line change here.
#
#   BAAI/bge-small-en-v1.5 — MIT licence, 384-dim, ~67 MB, retrieval-tuned,
#   deterministic on CPU via ONNX, zero custom-model wiring.
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"

# --------------------------------------------------------------------------
# Query defaults (SCHEMA §4.1, PROBES thresholds table).

DEFAULT_K = 8           # vector top-k seeds for a hybrid query
DEFAULT_HOPS = 2        # bounded BFS radius — 2-hop captures most useful context
RRF_K = 60              # Reciprocal Rank Fusion constant (Weaviate convention)
RESULT_TOKEN_CEILING = 25_000   # PROBES family-2 absolute per-query payload ceiling
TOKENS_PER_CHAR = 0.27          # rough chars→tokens factor for the payload estimate

# An embed unit is truncated to this many characters before embedding. The
# model's window is ~512 tokens (≈2k chars); a whole reducer detail file is far
# longer — embedding it would both spike memory and average a dozen topics into
# one washed-out vector (the SCHEMA §2 detail-washout failure). The headline +
# lead is the high-signal retrieval target.
MAX_EMBED_CHARS = 2_000
EMBED_CHUNK = 256       # texts per embed() call — cache-flush cadence (resumable build)
EMBED_BATCH_SIZE = 64   # fastembed forward-pass batch. The ONNX activation
                        # tensor is (batch x seq_len<=512 x hidden); the default
                        # 256 OOMs a 16 GB laptop on full-length text. 64 peaks
                        # ~3 GB and is ~2x the throughput of 32.

# --------------------------------------------------------------------------
# Node labels — the labeled-property-graph projection (SCHEMA §1.1).
# CodeNode is the structural spine; Sidecar + Finding are per-node enrichment;
# the remaining seven are reducer-derived emergent axes.

L_CODE_NODE = "CodeNode"
L_SIDECAR = "Sidecar"
L_CONCEPT = "Concept"
L_IMPLICIT_ADR = "ImplicitADR"
L_REFACTOR_SCOPE = "RefactoringScope"
L_DOC_GAP = "DocGap"
L_TEST_GAP = "TestGap"
L_FEATURE = "Feature"
L_FEATURE_REFLECTION = "FeatureReflection"
L_DOC = "Doc"
L_FINDING = "Finding"
L_SHOEBOX = "ShoeboxThread"   # rev-10 — unfinished hypotheses (APPROACH.md §18); markdown-loader-backed reducer node.

# Ground-truth anchor labels (adrs/drafts/ground-truth-lineage.md). The
# positive-space counterparts to the derived/gap labels above — each is a real,
# human-ratified, committed external surface, NOT a regenerated candidate. The
# bare-noun asymmetry IS the documentation: ADR vs ImplicitADR, Test vs TestGap.
# Doc (above) is upgraded by this layer from a bare-URL stub to content-bearing.
# ADR / Issue / IssueDraft / Test are projected in phases 2-4; their constants
# are defined now so the topology is complete and stable.
L_ADR = "ADR"                 # a published / agreed ADR (vs derived ImplicitADR)
L_ISSUE = "Issue"             # a real filed GitHub issue (vs derived Finding)
L_ISSUE_DRAFT = "IssueDraft"  # an on-disk issues/{repo}/*.md draft (the bridge to Issue)
L_TEST = "Test"               # an existing test (vs derived TestGap)

NODE_LABELS = (
    L_CODE_NODE, L_SIDECAR, L_CONCEPT, L_IMPLICIT_ADR, L_REFACTOR_SCOPE,
    L_DOC_GAP, L_TEST_GAP, L_FEATURE, L_FEATURE_REFLECTION, L_DOC, L_FINDING,
    L_SHOEBOX, L_ADR, L_ISSUE, L_ISSUE_DRAFT, L_TEST,
)

# --------------------------------------------------------------------------
# Relationship types (SCHEMA §1.2).
# Structural edge types come straight from edges.jsonl (whatever `type` values
# appear, uppercased). The join-fabric types below are the projected edges
# that make the six reducer outputs traversable rather than disconnected.

E_ENRICHED_BY = "ENRICHED_BY"            # CodeNode  -> Sidecar
E_MENTIONS_CONCEPT = "MENTIONS_CONCEPT"  # Sidecar   -> Concept
E_SURFACES_FINDING = "SURFACES_FINDING"  # Sidecar   -> Finding
E_IMPLIES_ADR = "IMPLIES_ADR"            # Sidecar   -> ImplicitADR
E_HAS_DOC_GAP = "HAS_DOC_GAP"            # Sidecar   -> DocGap
E_HAS_TEST_GAP = "HAS_TEST_GAP"          # Sidecar   -> TestGap
E_HAS_REFACTOR_SCOPE = "HAS_REFACTOR_SCOPE"  # Sidecar -> RefactoringScope
E_LINKS_DOC = "LINKS_DOC"                # Sidecar   -> Doc
E_PART_OF_FEATURE = "PART_OF_FEATURE"    # CodeNode  -> Feature
E_REFLECTED_BY = "REFLECTED_BY"          # Feature   -> FeatureReflection
E_CONTRADICTS = "CONTRADICTS"            # FeatureReflection -> Sidecar|Doc|ImplicitADR
E_CANONICALISES = "CANONICALISES"        # Concept   -> Concept

# Ground-truth-lineage edges (adrs/drafts/ground-truth-lineage.md). OSLC RM
# vocabulary (validatedBy / satisfies / trackedBy) rendered into UPPER_SNAKE.
# DESCRIBES + DOC_REFERENCES are wired in Phase 1 (documentation); the rest are
# defined now and projected in phases 2-4 (ADRs / issues / tests).
E_DESCRIBES = "DESCRIBES"                # Doc       -> Concept|Feature|CodeNode  (reverse of LINKS_DOC)
E_DOC_REFERENCES = "DOC_REFERENCES"      # Doc       -> Doc      (intra-manual hyperlink)
E_PROMOTED_TO = "PROMOTED_TO"            # ImplicitADR -> ADR    (candidate ratified)
E_REALISES = "REALISES"                  # CodeNode  -> ADR      (OSLC satisfiedBy)
E_SUPERSEDED_BY = "SUPERSEDED_BY"        # ADR       -> ADR
E_FILED_AS = "FILED_AS"                  # IssueDraft -> Issue
E_TRACKS = "TRACKS"                      # Finding|RefactoringScope -> Issue (OSLC trackedBy)
E_CLOSED_BY = "CLOSED_BY"                # Issue     -> CodeNode  (PR/commit)
E_COVERS = "COVERS"                      # Test      -> CodeNode  (SPDX TEST_OF)
E_VALIDATES = "VALIDATES"                # Test      -> Feature   (OSLC validatedBy)
E_REGRESSES = "REGRESSES"                # Test      -> Issue|Finding
E_ENFORCES = "ENFORCES"                  # Test      -> ADR

JOIN_EDGE_TYPES = (
    E_ENRICHED_BY, E_MENTIONS_CONCEPT, E_SURFACES_FINDING, E_IMPLIES_ADR,
    E_HAS_DOC_GAP, E_HAS_TEST_GAP, E_HAS_REFACTOR_SCOPE, E_LINKS_DOC,
    E_PART_OF_FEATURE, E_REFLECTED_BY, E_CONTRADICTS, E_CANONICALISES,
    E_DESCRIBES, E_DOC_REFERENCES, E_PROMOTED_TO, E_REALISES, E_SUPERSEDED_BY,
    E_FILED_AS, E_TRACKS, E_CLOSED_BY, E_COVERS, E_VALIDATES, E_REGRESSES,
    E_ENFORCES,
)

# --------------------------------------------------------------------------
# On-disk layout — the ephemeral, git-ignored graph dir.

GRAPH_DIRNAME = "graph"
PARSE_CACHE_SUBDIR = ".cache/parse"
EMBED_CACHE_SUBDIR = ".cache/embed"
BUILD_INFO_FILENAME = "build-info.yaml"

GENERATED_HEADER = (
    "# GENERATED — do not edit; rebuilt from lineage/{repo}/ canonical files.\n"
    "# The graph query layer is ephemeral (adrs/drafts/graph-query-layer.md).\n"
    "# To change what the graph says, edit a sidecar/reducer output and rebuild.\n"
)


def graph_dir(lineage_dir: Path) -> Path:
    """The ephemeral graph dir for a `lineage/{repo}` directory."""
    return lineage_dir / GRAPH_DIRNAME


def parse_cache_dir(lineage_dir: Path) -> Path:
    return graph_dir(lineage_dir) / PARSE_CACHE_SUBDIR


def embed_cache_dir(lineage_dir: Path, model_id: str) -> Path:
    """Embedding cache, sharded per model — swapping the model never collides."""
    return graph_dir(lineage_dir) / EMBED_CACHE_SUBDIR / _slug(model_id)


def _slug(text: str) -> str:
    """Filesystem-safe slug for a model id (`BAAI/bge-small-en-v1.5` -> `BAAI_bge-small-en-v1.5`)."""
    return "".join(c if c.isalnum() or c in "-._" else "_" for c in text)
