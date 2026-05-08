"""Deterministic schema validator for per-node ontology sidecars.

A sidecar lives at `lineage/{repo}/understanding/{slug}.md`. Schema:
- YAML frontmatter (required fields per the file-analyser system prompt)
- H1 heading: `# {descriptor} — semantic understanding`
- Required H2 sections (named exactly as below)
- Optional `## Maintainer notes` section (preserved across refreshes)

This module is the gate the /enrich skill runs after each subagent invocation.
No LLM calls. Pure parser + structural checks. Code-anchor verification
(does file:line resolve to a real line) lives in a separate verifier; this
file checks the *shape* of the sidecar, not the *truth* of every claim.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML
from ruamel.yaml.error import YAMLError


REQUIRED_FRONTMATTER_FIELDS = {
    "node_id",
    "node_kind",
    "axis",
    "extracted_at_commit",
    "enriched_at_commit",
    "extractor_version",
    "prompt_version",
    "enrichment_status",
    "confidence_overall",
}

VALID_ENRICHMENT_STATUSES = {"complete", "partial", "stale", "failed"}
VALID_CONFIDENCE_VALUES = {"HIGH", "MEDIUM", "LOW", "N/A"}

REQUIRED_SECTIONS = [
    "understanding",
    "concepts",
    "dependencies_semantic",
    "tests_coverage_semantic",
    "docs_link_semantic",
    "implicit_adrs",
    "bugs_limitations_corner_cases",
    "sources",
    "confidence_per_field",
]

OPTIONAL_SECTIONS = ["Maintainer notes"]

# Phrases banned by Gate 9 / file-analyser prompt. A claim that contains one of
# these uncited (i.e., not in a quoted block) is a finding the validator surfaces.
BANNED_PHRASES = [
    "probably",
    "likely",
    "should be",      # narrower than "should" alone — avoid false positives on "should"-as-imperative
    "looks right",
    "presumably",
    "defensible",
    "canonical owner",
    "monorepo default",
    "safe to assume",
]


@dataclass
class SidecarValidationResult:
    """Outcome of validating one sidecar file."""

    path: Path
    ok: bool
    frontmatter: dict[str, Any] = field(default_factory=dict)
    sections: dict[str, str] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def validate_sidecar(path: Path) -> SidecarValidationResult:
    """Parse + validate one sidecar. Return a structured result.

    Returns ok=True only if every error is empty. Warnings do not block
    acceptance but are surfaced to the maintainer.
    """
    result = SidecarValidationResult(path=path, ok=False)

    if not path.is_file():
        result.errors.append(f"sidecar file not found: {path}")
        return result

    try:
        text = path.read_text()
    except OSError as exc:
        result.errors.append(f"could not read sidecar: {exc}")
        return result

    # 1. Split frontmatter from body.
    fm_match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if fm_match is None:
        result.errors.append("missing or malformed YAML frontmatter (expected --- ... --- at top)")
        return result

    fm_text = fm_match.group(1)
    body = text[fm_match.end():]

    # 2. Parse frontmatter.
    yaml = YAML(typ="safe")
    try:
        frontmatter = yaml.load(fm_text) or {}
    except YAMLError as exc:
        result.errors.append(f"frontmatter is not valid YAML: {exc}")
        return result
    if not isinstance(frontmatter, dict):
        result.errors.append("frontmatter must be a YAML mapping")
        return result
    result.frontmatter = frontmatter

    # 3. Verify required frontmatter fields.
    for field_name in REQUIRED_FRONTMATTER_FIELDS:
        if field_name not in frontmatter:
            result.errors.append(f"frontmatter missing required field: {field_name}")
        elif frontmatter[field_name] in (None, ""):
            result.errors.append(f"frontmatter field is empty: {field_name}")

    if "enrichment_status" in frontmatter:
        if frontmatter["enrichment_status"] not in VALID_ENRICHMENT_STATUSES:
            result.errors.append(
                f"frontmatter enrichment_status must be one of {sorted(VALID_ENRICHMENT_STATUSES)}; "
                f"got {frontmatter['enrichment_status']!r}"
            )
    if "confidence_overall" in frontmatter:
        if frontmatter["confidence_overall"] not in VALID_CONFIDENCE_VALUES:
            result.errors.append(
                f"frontmatter confidence_overall must be one of {sorted(VALID_CONFIDENCE_VALUES)}; "
                f"got {frontmatter['confidence_overall']!r}"
            )

    # 4. Parse body sections.
    sections = _parse_sections(body)
    result.sections = sections

    # 5. Verify H1 heading is present (any text — descriptor-specific).
    if not re.search(r"^# .+", body, re.MULTILINE):
        result.errors.append("missing H1 heading (expected `# <descriptor> — semantic understanding`)")

    # 6. Verify required sections exist + are non-trivially populated.
    for section_name in REQUIRED_SECTIONS:
        if section_name not in sections:
            result.errors.append(f"missing required H2 section: ## {section_name}")
            continue
        content = sections[section_name].strip()
        if not content:
            result.errors.append(f"required section is empty: ## {section_name}")
        elif content in ("[]", "(none)") and section_name not in {"implicit_adrs", "bugs_limitations_corner_cases"}:
            # Empty arrays only valid on the two "may legitimately be []" sections.
            result.errors.append(
                f"section ## {section_name} contains '[]'/'(none)' — only implicit_adrs "
                "and bugs_limitations_corner_cases may be intentionally empty; other "
                "sections must have content or 'N/A — <reason>'"
            )

    # 7. confidence_per_field must reference each populated section.
    if "confidence_per_field" in sections:
        cpf = sections["confidence_per_field"]
        for required in [
            "understanding", "concepts", "dependencies_semantic",
            "tests_coverage_semantic", "docs_link_semantic", "implicit_adrs",
            "bugs_limitations_corner_cases",
        ]:
            if required not in cpf:
                result.errors.append(
                    f"confidence_per_field block missing entry for: {required}"
                )

    # 8. Banned-phrase scan (warnings, not errors — let maintainer judge in MVP).
    for phrase in BANNED_PHRASES:
        # Look outside ``` code fences and YAML frontmatter (which we already handle).
        # Simple heuristic: case-insensitive search across body. False positives are
        # acceptable since this is a warning, not an error.
        if re.search(rf"\b{re.escape(phrase)}\b", body, re.IGNORECASE):
            result.warnings.append(
                f"banned phrase detected (CLAUDE.md Gate 9): {phrase!r} — "
                f"replace with HIGH/MEDIUM/LOW + citation"
            )

    # 9. Doc-link verification — every entry in declared_docs / inferred_docs
    # must carry last_verified_status. (This is a structural check; the actual
    # WebFetch verification is the file-analyser's responsibility at write
    # time. The validator catches "subagent skipped the verification step".)
    if "docs_link_semantic" in sections:
        docs_block = sections["docs_link_semantic"]
        # Count `url:` occurrences and `last_verified_status:` occurrences. They
        # must be equal (every URL has a status).
        url_count = len(re.findall(r"^\s*-?\s*url:", docs_block, re.MULTILINE))
        status_count = len(re.findall(r"last_verified_status:", docs_block))
        if url_count != status_count:
            result.errors.append(
                f"docs_link_semantic: {url_count} URL(s) but {status_count} "
                "last_verified_status entries — every doc URL must carry a "
                "WebFetch verification result (live-URL-only rule)"
            )

    # 10. sources block must reference at least the populated required sections.
    if "sources" in sections:
        sources_block = sections["sources"]
        sources_lines = [ln for ln in sources_block.splitlines() if ln.strip().startswith("-")]
        if len(sources_lines) < 3:
            result.warnings.append(
                f"sources block has only {len(sources_lines)} entries — "
                "expected one per non-trivial claim (CLAUDE.md Gate 9)"
            )

    result.ok = not result.errors
    return result


def _parse_sections(body: str) -> dict[str, str]:
    """Split a Markdown body into {section_name: section_content} on H2 headings."""
    sections: dict[str, str] = {}
    current_name: str | None = None
    current_lines: list[str] = []

    for line in body.splitlines():
        h2_match = re.match(r"^## (.+?)\s*$", line)
        if h2_match:
            if current_name is not None:
                sections[current_name] = "\n".join(current_lines).rstrip()
            current_name = h2_match.group(1).strip()
            current_lines = []
        else:
            if current_name is not None:
                current_lines.append(line)
    if current_name is not None:
        sections[current_name] = "\n".join(current_lines).rstrip()
    return sections


def format_result(result: SidecarValidationResult) -> str:
    """Human-readable formatter for CLI output."""
    lines: list[str] = []
    status = "OK" if result.ok else "FAIL"
    lines.append(f"[{status}] {result.path}")
    if result.frontmatter.get("node_id"):
        lines.append(f"  node_id: {result.frontmatter['node_id']}")
    if result.errors:
        lines.append("  errors:")
        for err in result.errors:
            lines.append(f"    - {err}")
    if result.warnings:
        lines.append("  warnings:")
        for warn in result.warnings:
            lines.append(f"    - {warn}")
    return "\n".join(lines)


__all__ = [
    "SidecarValidationResult",
    "validate_sidecar",
    "format_result",
    "REQUIRED_FRONTMATTER_FIELDS",
    "REQUIRED_SECTIONS",
    "BANNED_PHRASES",
]
