"""YAML manifest read/write.

Manifest shape (per ADR adrs/drafts/code-lineage-substrate.md):

    repo: odd-platform
    last_scan_commit: ede5d277
    last_scan_date: 2026-05-08
    last_scan_mode: full
    extractor_version: 0.1.0
    axes:
      ui_shell:        { version: 1, last_built: 2026-05-08 }
      controllers:     { version: 0, last_built: null }
      ...
    node_count: 0
    edge_count: 0
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

from lineage_extractor import __version__

_yaml = YAML()
_yaml.preserve_quotes = True
_yaml.indent(mapping=2, sequence=4, offset=2)


@dataclass
class AxisState:
    version: int = 0
    last_built: str | None = None


_CANONICAL_KEYS = frozenset({
    "repo", "last_scan_commit", "last_scan_date", "last_scan_mode",
    "extractor_version", "axes", "node_count", "edge_count",
})


@dataclass
class Manifest:
    repo: str
    last_scan_commit: str | None = None
    last_scan_date: str | None = None
    last_scan_mode: str | None = None
    extractor_version: str = __version__
    axes: dict[str, AxisState] = field(default_factory=dict)
    node_count: int = 0
    edge_count: int = 0
    extras: dict[str, Any] = field(default_factory=dict)
    """Downstream-computed manifest extensions (e.g. `coverage_metrics`
    written by `lineage/_extractor/registry-shard/coverage.py`). Preserved
    verbatim across full scans so the extractor never wipes a downstream
    tool's fields."""

    def axis(self, name: str) -> AxisState:
        if name not in self.axes:
            self.axes[name] = AxisState()
        return self.axes[name]

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "repo": self.repo,
            "last_scan_commit": self.last_scan_commit,
            "last_scan_date": self.last_scan_date,
            "last_scan_mode": self.last_scan_mode,
            "extractor_version": self.extractor_version,
            "axes": {
                name: {"version": a.version, "last_built": a.last_built}
                for name, a in self.axes.items()
            },
            "node_count": self.node_count,
            "edge_count": self.edge_count,
        }
        # Append unknown (downstream-computed) keys at the end, preserving
        # their on-disk shape. Never let canonical keys be shadowed.
        for key, value in self.extras.items():
            if key not in _CANONICAL_KEYS:
                out[key] = value
        return out


def load_manifest(path: Path) -> Manifest | None:
    """Return a Manifest if the file exists, else None."""
    if not path.is_file():
        return None
    with path.open("r") as fh:
        raw = _yaml.load(fh) or {}
    repo = raw.get("repo") or path.parent.name
    axes_raw = raw.get("axes") or {}
    axes = {
        name: AxisState(
            version=int(a.get("version", 0)),
            last_built=a.get("last_built"),
        )
        for name, a in axes_raw.items()
    }
    extras = {k: v for k, v in raw.items() if k not in _CANONICAL_KEYS}
    return Manifest(
        repo=repo,
        last_scan_commit=raw.get("last_scan_commit"),
        last_scan_date=raw.get("last_scan_date"),
        last_scan_mode=raw.get("last_scan_mode"),
        extractor_version=raw.get("extractor_version") or __version__,
        axes=axes,
        node_count=int(raw.get("node_count", 0)),
        edge_count=int(raw.get("edge_count", 0)),
        extras=extras,
    )


def save_manifest(path: Path, manifest: Manifest) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as fh:
        _yaml.dump(manifest.to_dict(), fh)


def today_iso() -> str:
    return date.today().isoformat()
